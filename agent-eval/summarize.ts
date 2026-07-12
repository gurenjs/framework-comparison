/**
 * Aggregates agent-eval trial results into a Markdown table.
 * Usage: bun agent-eval/summarize.ts [trial numbers, default: 2 3 4]
 *
 * Per trial it reports the session totals from the result event plus
 * "to green": the assistant-message ordinal and cumulative output tokens at
 * the first point where the implementation's full test suite passed with new
 * tests included (i.e. more tests passing than the pre-trial baseline).
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const IMPLEMENTATIONS = ['guren', 'hono', 'nextjs', 'tanstack', 'adonisjs', 'nestjs'] as const
const BASELINE_TESTS: Record<string, number> = {
  guren: 11,
  hono: 18,
  nextjs: 26,
  tanstack: 29,
  adonisjs: 17,
  nestjs: 21,
}

interface GreenPoint {
  atMessage: number
  outputTokens: number
}

interface TrialSummary {
  impl: string
  trial: number
  subtype: string
  turns: number
  durationS: number
  costUsd: number
  outputTokens: number
  green: GreenPoint | null
  totalMessages: number
}

function parseTestOutput(impl: string, out: string): { pass: number; failed: boolean } | null {
  if (impl === 'guren' || impl === 'hono') {
    const pass = out.match(/(\d+) pass/)
    const fail = out.match(/(\d+) fail/)
    if (!pass) return null
    return { pass: Number(pass[1]), failed: fail ? Number(fail[1]) > 0 : false }
  }
  if (impl === 'nextjs' || impl === 'tanstack') {
    const pass = out.match(/Tests\s+(\d+) passed/)
    if (!pass) return null
    return { pass: Number(pass[1]), failed: /\d+ failed/.test(out) }
  }
  if (impl === 'adonisjs') {
    const pass = out.match(/Tests\s+(\d+) passed/)
    if (!pass) return null
    return { pass: Number(pass[1]), failed: /FAILED|\d+ failed/.test(out) }
  }
  if (impl === 'nestjs') {
    const pass = out.match(/Tests:.*?(\d+) passed/)
    if (!pass) return null
    return { pass: Number(pass[1]), failed: /\d+ failed/.test(out) }
  }
  return null
}

function isTestCommand(impl: string, command: string): boolean {
  if (impl === 'guren') return /bun (run )?test/.test(command)
  if (impl === 'hono') return /bun test/.test(command)
  if (impl === 'nextjs' || impl === 'tanstack') return /vitest|npm (run )?test/.test(command)
  if (impl === 'adonisjs') return /ace test|npm (run )?test/.test(command)
  if (impl === 'nestjs') return /npm (run )?test|jest/.test(command)
  return false
}

function summarize(impl: string, trial: number, resultsDir: string): TrialSummary | null {
  const streamPath = join(resultsDir, `${impl}-${trial}.stream.jsonl`)
  if (!existsSync(streamPath)) return null

  const events = readFileSync(streamPath, 'utf8')
    .trim()
    .split('\n')
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter(Boolean)

  const result = events.filter((e) => e.type === 'result').pop()
  const commands: Record<string, { command: string; atMessage: number; outputTokens: number }> = {}
  let messageOrdinal = 0
  let cumulativeOutput = 0
  let green: GreenPoint | null = null

  for (const event of events) {
    if (event.type === 'assistant') {
      messageOrdinal += 1
      cumulativeOutput += event.message?.usage?.output_tokens ?? 0
      for (const block of event.message?.content ?? []) {
        if (block.type === 'tool_use' && block.name === 'Bash') {
          commands[block.id] = {
            command: block.input?.command ?? '',
            atMessage: messageOrdinal,
            outputTokens: cumulativeOutput,
          }
        }
      }
    }
    if (event.type === 'user' && green === null) {
      for (const block of event.message?.content ?? []) {
        if (block.type !== 'tool_result' || !commands[block.tool_use_id]) continue
        const meta = commands[block.tool_use_id]
        if (!isTestCommand(impl, meta.command)) continue
        const out = Array.isArray(block.content)
          ? block.content.map((c: { text?: string }) => c.text ?? '').join('')
          : String(block.content ?? '')
        const parsed = parseTestOutput(impl, out)
        if (parsed && !parsed.failed && parsed.pass > (BASELINE_TESTS[impl] ?? 0)) {
          green = { atMessage: meta.atMessage, outputTokens: meta.outputTokens }
        }
      }
    }
  }

  return {
    impl,
    trial,
    subtype: result?.subtype ?? 'missing',
    turns: result?.num_turns ?? 0,
    durationS: Math.round((result?.duration_ms ?? 0) / 1000),
    costUsd: result?.total_cost_usd ?? 0,
    outputTokens: result?.usage?.output_tokens ?? 0,
    green,
    totalMessages: messageOrdinal,
  }
}

const resultsDir = join(import.meta.dirname, 'results')
const trials = process.argv.slice(2).map(Number).filter(Boolean)
const trialNumbers = trials.length > 0 ? trials : [2, 3, 4]

const rows: string[] = []
rows.push('| impl | trial | end | turns | dur(s) | cost($) | out-tokens | green@msg | total-msgs |')
rows.push('|------|-------|-----|-------|--------|---------|------------|-----------|------------|')

const medians: Record<string, number[]> = {}
for (const impl of IMPLEMENTATIONS) {
  for (const trial of trialNumbers) {
    const s = summarize(impl, trial, resultsDir)
    if (!s) continue
    rows.push(
      `| ${s.impl} | ${s.trial} | ${s.subtype} | ${s.turns} | ${s.durationS} | ${s.costUsd.toFixed(2)} | ${s.outputTokens.toLocaleString('en-US')} | ${s.green?.atMessage ?? '—'} | ${s.totalMessages} |`,
    )
    ;(medians[impl] ??= []).push(s.green?.atMessage ?? Number.NaN)
  }
}

rows.push('')
rows.push('| impl | median green@msg |')
rows.push('|------|-------------------------|')
for (const [impl, values] of Object.entries(medians)) {
  const valid = values.filter((v) => !Number.isNaN(v)).sort((a, b) => a - b)
  const median = valid.length ? valid[Math.floor(valid.length / 2)] : null
  rows.push(`| ${impl} | ${median?.toLocaleString('en-US') ?? '—'} |`)
}

console.log(rows.join('\n'))
