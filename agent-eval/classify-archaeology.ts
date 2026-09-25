/**
 * Token-weighted stream analysis of the September 2026 re-run (Part A, §6 of the
 * round-2 plan). Usage: bun agent-eval/classify-archaeology.ts [--json out.json]
 *
 * Every tool action of every cell is put in one category:
 *   a  name confusion: finding WHICH package holds a symbol across the
 *      @guren/core / @guren/server split. The only category RFC 0024 removes,
 *      so it is a lower bound: anything ambiguous goes to b.
 *   b  API learning: reading node_modules/@guren/* (or, for hono, hono/drizzle
 *      types), the app's CLAUDE.md / .claude/ guidance, generated .guren/ types,
 *      `guren context` / `--help`, to learn a signature or behaviour.
 *   c  everything else: reading/writing the app's own files, codegen, typecheck,
 *      tests, gate. Actions the permission layer denied are counted in c and
 *      reported apart (c-denied): they are runner friction, not framework cost.
 *
 * Heuristics (read the code for the exact patterns):
 *   - A Bash command is split into top-level segments (;, &&, ||, newline,
 *     heredoc bodies skipped); each segment is classified on its own and a
 *     mixed action's weight is split equally across its non-neutral segments.
 *   - (a) fires in three ways, all on segments that touch @guren packages:
 *     1. one action names both node_modules/@guren/core and .../@guren/server;
 *     2. an action on @guren/core whose result shows `from '@guren/server'`;
 *     3. a "core miss chain": a search confined to @guren/core that returns
 *        nothing (empty output, zsh `no matches found`) opens a chain; later
 *        actions searching core, server, or @guren/* (wildcard) join it; the
 *        chain is labelled (a) only when one of its results lands in
 *        @guren/server. A chain that ends in @guren/orm, or never resolves within
 *        CHAIN_MAX_GAP actions, stays b (RFC 0024 keeps orm a separate package).
 *     Reads after the server hit (Paginator.d.ts, types.d.ts) are b: the agent
 *     would still read them after a merge.
 *   - A core search whose miss is masked by other output in the same command
 *     is not detected as a miss (lower bound again).
 *
 * Token weighting, in dollars, because the price vector below reproduces every
 * cell's total_cost_usd exactly (the script prints the check). The stream's
 * per-message usage.output_tokens is a message_start snapshot (863 vs 13,070 in
 * guren-shipped-1), so the session's output_tokens are spread over API calls by
 * visible characters (text + tool_use input JSON; thinking arrives empty).
 *
 * Residency model (primary; its buckets sum to total_cost_usd, residual printed).
 * An action issued in API call k is charged
 *   its output × (output + cache write + cache read × reads)
 *   + its result tokens × (cache write + cache read × reads)
 *   + an equal share of call k's re-read of the shared base prefix,
 * where reads = calls after k+1 (a result is written at k+1 and read afterwards).
 * Result tokens = tool_result characters / CHARS_PER_TOKEN, capped by what call
 * k+1 actually wrote; the rest of that write (hook output, reminders, wrappers)
 * is "injections". The shared base prefix is the hono arm's median call-1 prefix
 * (hono ships no guidance). What a cell's call-1 prefix holds beyond it is
 * "b-pushed": the guidance the arm loads at session start, charged a cache write
 * once and a cache read on every later call.
 *
 * Marginal (removal) estimate: what disappears if a category's actions are not
 * taken. Same as the residency charge, except that an action also takes its
 * share of call k's whole history re-read instead of the base-prefix share.
 * It double-counts across categories by design; use it per category only.
 *
 * Literal variant (as first specified, in tokens): the action's output plus the
 * next call's whole input, split by result size within a call. The next call's
 * input is mostly history, so this measures position in the session.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const RESULTS = join(import.meta.dirname, 'results')
const ARMS = ['guren-shipped', 'guren-shipped-paths', 'guren-bare', 'hono-sep', 'guren-july'] as const
const TRIALS = [1, 2, 3]
// USD per million tokens for claude-sonnet-5; 1h cache writes (all writes here are 1h).
const PRICE = { input: 2, cacheWrite: 4, cacheRead: 0.2, output: 10 }
// Measured on result-heavy calls: 2.3-2.4 tool_result characters per cache-written token.
const CHARS_PER_TOKEN = 2.4
const CHAIN_MAX_GAP = 6

type Cat = 'a' | 'b' | 'c'
type Sub =
  | 'a-core-server'
  | 'b-guren-pkg'
  | 'b-other-pkg'
  | 'b-guidance'
  | 'b-generated'
  | 'b-cli-help'
  | 'b-reexport-hop'
  | 'c-app'
  | 'c-edit'
  | 'c-verify'
  | 'c-denied'

interface Segment {
  text: string
  cat: Cat
  sub: Sub
  gurenPkgs: Set<string> // 'core' | 'server' | 'orm' | ... | '*'
  nodeModulesPaths: string[]
}

interface Action {
  index: number // tool action ordinal in the cell, 1-based
  call: number // API call ordinal (unique message id), 1-based
  event: number // assistant event ordinal, as summarize.ts counts messages
  name: string
  input: Record<string, unknown>
  summary: string
  result: string
  isError: boolean
  denied: boolean
  segments: Segment[]
  outputTokens: number
  resultTokens: number
  costUsd: number
  literalTokens: number
  overheadUsd: number
  marginalUsd: number
  shares: Partial<Record<Sub, number>>
}

interface Call {
  id: string
  usage: { input_tokens: number; cache_creation_input_tokens: number; cache_read_input_tokens: number }
  visibleChars: number
  textChars: number
  actions: Action[]
  event: number
}

interface CellReport {
  label: string
  arm: string
  trial: number
  costUsd: number
  modelledCostUsd: number
  calls: number
  actions: Action[]
  prefixTokens: number
  prefixCostUsd: number
  pushedTokens: number
  pushedCostUsd: number
  callOneSharedCostUsd: number
  injectionsCostUsd: number
  textCostUsd: number
  firstEditEvent: number | null
  firstEditAction: number | null
  firstEditCall: number | null
}

const DENIAL_PATTERNS = [
  /requires approval/,
  /^Contains /,
  /Newline followed by #/,
  /Parser skipped input/,
  /needs approval/,
  /^Brace expansion/,
  /was blocked/,
  /Permission to use .* has been denied/,
]

function toText(content: unknown): string {
  if (Array.isArray(content)) return content.map((c: { text?: string }) => c.text ?? '').join('')
  return String(content ?? '')
}

// Splits a shell command into top-level segments, skipping heredoc bodies and
// keeping quoted newlines/semicolons inside their segment. Pipes stay inside.
export function splitShell(command: string): string[] {
  const segments: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  const pendingHeredocs: string[] = []
  let i = 0
  const push = () => {
    if (current.trim()) segments.push(current.trim())
    current = ''
  }
  while (i < command.length) {
    const ch = command[i]
    if (quote) {
      current += ch
      if (ch === '\\' && quote === '"') {
        current += command[i + 1] ?? ''
        i += 2
        continue
      }
      if (ch === quote) quote = null
      i += 1
      continue
    }
    if (ch === "'" || ch === '"') {
      quote = ch
      current += ch
      i += 1
      continue
    }
    if (ch === '<' && command[i + 1] === '<' && command[i + 2] !== '<') {
      const match = command.slice(i).match(/^<<-?\s*(['"]?)([A-Za-z_][\w]*)\1/)
      if (match) {
        pendingHeredocs.push(match[2])
        current += match[0]
        i += match[0].length
        continue
      }
    }
    if (ch === '\n') {
      push()
      i += 1
      while (pendingHeredocs.length > 0) {
        const delimiter = pendingHeredocs.shift()!
        while (i < command.length) {
          const end = command.indexOf('\n', i)
          const line = command.slice(i, end === -1 ? command.length : end)
          i = end === -1 ? command.length : end + 1
          if (line.trim() === delimiter) break
        }
      }
      continue
    }
    if (ch === ';') {
      push()
      i += 1
      continue
    }
    if ((ch === '&' && command[i + 1] === '&') || (ch === '|' && command[i + 1] === '|')) {
      push()
      i += 2
      continue
    }
    current += ch
    i += 1
  }
  push()
  return segments
}

const READ_COMMAND = /^(cat|head|tail|sed -n|grep|rg|find|ls|wc|awk|less|nl)\b/
const GUREN_PKG = /node_modules\/@guren\/([A-Za-z0-9_*-]+|(?=["'\s]|$))/g

function gurenPackages(text: string, cwdPkg: string | null): Set<string> {
  const pkgs = new Set<string>()
  for (const match of text.matchAll(GUREN_PKG)) pkgs.add(match[1] === '' ? '*' : match[1])
  if (/node_modules\/@guren\/?(\s|$|["'])/.test(text)) pkgs.add('*')
  if (cwdPkg && pkgs.size === 0 && READ_COMMAND.test(text.replace(/^cd \S+ &&\s*/, ''))) pkgs.add(cwdPkg)
  return pkgs
}

function nodeModulesPaths(text: string, cwdPkg: string | null): string[] {
  const paths = [...text.matchAll(/node_modules\/[^\s'"|;>)]+/g)].map((m) => m[0].replace(/[,:]$/, ''))
  if (paths.length === 0 && cwdPkg && READ_COMMAND.test(text)) {
    for (const m of text.matchAll(/\b(dist\/[^\s'"|;>)]+)/g)) paths.push(`node_modules/@guren/${cwdPkg}/${m[1]}`)
  }
  return paths
}

function classifySegment(text: string, cwdPkg: string | null, impl: string): Segment {
  const pkgs = gurenPackages(text, cwdPkg)
  const nm = nodeModulesPaths(text, cwdPkg)
  const base = { text, gurenPkgs: pkgs, nodeModulesPaths: nm }
  if (pkgs.size > 0) return { ...base, cat: 'b', sub: 'b-guren-pkg' }
  if (nm.length > 0) return { ...base, cat: 'b', sub: 'b-other-pkg' }
  if (/\bguren (context|guidelines|model:list|tool:list|docs:graph)\b/.test(text) || /\bguren\b.*--help\b/.test(text))
    return { ...base, cat: 'b', sub: 'b-cli-help' }
  if (READ_COMMAND.test(text) && /(^|[\s/])(CLAUDE\.md|AGENTS\.md|\.claude\/)/.test(text))
    return { ...base, cat: 'b', sub: 'b-guidance' }
  if (impl === 'guren' && READ_COMMAND.test(text) && /(^|[\s/'"])(\.guren\/|types\/generated\/)/.test(text))
    return { ...base, cat: 'b', sub: 'b-generated' }
  if (/\b(bun (run )?(test|typecheck|codegen|lint)|bun test|tsc\b|guren (gate|check|audit|codegen|spec:generate)|drizzle-kit|db:generate|db:make|make:migration)/.test(text))
    return { ...base, cat: 'c', sub: 'c-verify' }
  return { ...base, cat: 'c', sub: 'c-app' }
}

function isNeutral(text: string): boolean {
  return /^(cd|echo|printf ['"]?=|true|set )\b/.test(text) || /^cat > \/dev\/null/.test(text)
}

function segmentsFor(name: string, input: Record<string, unknown>, impl: string): Segment[] {
  if (name === 'Bash') {
    const parts = splitShell(String(input.command ?? ''))
    const out: Segment[] = []
    let cwdPkg: string | null = null
    for (const part of parts) {
      const cd = part.match(/^cd\s+(\S+)/)
      if (cd) {
        const pkg = cd[1].match(/node_modules\/@guren\/([\w-]+)/)
        cwdPkg = pkg ? pkg[1] : null
        continue
      }
      if (isNeutral(part)) continue
      out.push(classifySegment(part, cwdPkg, impl))
    }
    return out.length > 0 ? out : [classifySegment(String(input.command ?? ''), null, impl)]
  }
  if (name === 'Write' || name === 'Edit' || name === 'NotebookEdit' || name === 'MultiEdit') {
    return [{ text: String(input.file_path ?? ''), cat: 'c', sub: 'c-edit', gurenPkgs: new Set(), nodeModulesPaths: [] }]
  }
  const path = String(input.file_path ?? input.path ?? '')
  const pattern = String(input.pattern ?? '')
  const pseudo = name === 'Read' ? `cat ${path}` : `grep ${pattern} ${path}`
  if (name === 'Read' || name === 'Grep' || name === 'Glob') return [classifySegment(pseudo, null, impl)]
  if (name === 'Skill') return [{ text: JSON.stringify(input), cat: 'b', sub: 'b-guidance', gurenPkgs: new Set(), nodeModulesPaths: [] }]
  return [{ text: `${name} ${JSON.stringify(input)}`, cat: 'c', sub: 'c-app', gurenPkgs: new Set(), nodeModulesPaths: [] }]
}

function isMiss(result: string): boolean {
  const lines = result
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  return lines.every((l) => /no matches found|No such file or directory|^\(Bash completed with no output\)$/.test(l))
}

const SERVER_HIT = /@guren\/server\/|from ['"]@guren\/server['"]/

// Relabels segments to (a) by the three rules in the header; mutates actions.
function applyNameConfusion(actions: Action[]): void {
  let chain: { members: Action[]; lastIndex: number } | null = null
  const touchesSplit = (a: Action) =>
    a.segments.some((s) => s.gurenPkgs.has('core') || s.gurenPkgs.has('server') || s.gurenPkgs.has('*'))
  const markA = (a: Action) => {
    for (const s of a.segments) {
      if (s.gurenPkgs.has('core') || s.gurenPkgs.has('server') || s.gurenPkgs.has('*')) {
        s.cat = 'a'
        s.sub = 'a-core-server'
      }
    }
  }
  const closeChain = (resolved: boolean) => {
    if (!chain) return
    for (const m of chain.members) {
      if (resolved) markA(m)
      else
        for (const s of m.segments)
          if (s.sub === 'b-guren-pkg' && (s.gurenPkgs.has('core') || s.gurenPkgs.has('*'))) s.sub = 'b-reexport-hop'
    }
    chain = null
  }
  for (const action of actions) {
    if (action.denied) continue
    const gurenSegs = action.segments.filter((s) => s.gurenPkgs.size > 0)
    if (gurenSegs.length === 0) {
      if (chain && action.index - chain.lastIndex > CHAIN_MAX_GAP) closeChain(false)
      continue
    }
    const pkgs = new Set(gurenSegs.flatMap((s) => [...s.gurenPkgs]))
    if (pkgs.has('core') && pkgs.has('server')) markA(action)
    else if (pkgs.has('core') && /from ['"]@guren\/server['"]/.test(action.result)) markA(action)

    if (chain) {
      if (action.index - chain.lastIndex > CHAIN_MAX_GAP) closeChain(false)
    }
    if (chain && touchesSplit(action)) {
      chain.members.push(action)
      chain.lastIndex = action.index
      if (SERVER_HIT.test(action.result)) closeChain(true)
      continue
    }
    const coreOnly = [...pkgs].every((p) => p === 'core')
    if (!chain && coreOnly && isMiss(action.result)) {
      chain = { members: [action], lastIndex: action.index }
    }
  }
  closeChain(false)
}

function isEditAction(action: Action): boolean {
  if (action.denied || action.isError) return false
  if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(action.name)) return true
  if (action.name !== 'Bash') return false
  const cmd = String(action.input.command ?? '')
  return /(^|\s)(sed -i|perl -\S*i)\b|>>?\s*(?!\/dev\/null|&)(app|db|resources|tests|src|routes)\//.test(cmd)
}

function loadCell(arm: string, trial: number, sharedPrefixTokens: number): CellReport | null {
  const label = `${arm}-${trial}`
  const streamPath = join(RESULTS, `${label}.stream.jsonl`)
  if (!existsSync(streamPath)) return null
  const metaPath = join(RESULTS, `${label}.meta.json`)
  const impl = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')).impl ?? 'guren' : 'guren'
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

  const results = new Map<string, { text: string; isError: boolean }>()
  for (const e of events)
    if (e.type === 'user')
      for (const b of e.message?.content ?? [])
        if (b.type === 'tool_result') results.set(b.tool_use_id, { text: toText(b.content), isError: Boolean(b.is_error) })

  const calls: Call[] = []
  const byId = new Map<string, Call>()
  const actions: Action[] = []
  let eventOrdinal = 0
  for (const e of events) {
    if (e.type !== 'assistant') continue
    eventOrdinal += 1
    let call = byId.get(e.message.id)
    if (!call) {
      call = { id: e.message.id, usage: e.message.usage, visibleChars: 0, textChars: 0, actions: [], event: eventOrdinal }
      byId.set(call.id, call)
      calls.push(call)
    }
    for (const b of e.message.content ?? []) {
      if (b.type === 'text') {
        call.visibleChars += b.text.length
        call.textChars += b.text.length
      }
      if (b.type !== 'tool_use') continue
      const inputChars = JSON.stringify(b.input).length
      call.visibleChars += inputChars
      const r = results.get(b.id) ?? { text: '', isError: false }
      const denied = r.isError && DENIAL_PATTERNS.some((p) => p.test(r.text))
      const action: Action = {
        index: actions.length + 1,
        call: calls.length,
        event: eventOrdinal,
        name: b.name,
        input: b.input,
        summary: b.name === 'Bash' ? String(b.input.command) : String(b.input.file_path ?? JSON.stringify(b.input)),
        result: r.text,
        isError: r.isError,
        denied,
        segments: denied
          ? [{ text: '', cat: 'c', sub: 'c-denied', gurenPkgs: new Set(), nodeModulesPaths: [] }]
          : segmentsFor(b.name, b.input, impl),
        outputTokens: inputChars, // replaced below by the calibrated share
        resultTokens: 0,
        costUsd: 0,
        literalTokens: 0,
        overheadUsd: 0,
        marginalUsd: 0,
        shares: {},
      }
      call.actions.push(action)
      actions.push(action)
    }
  }

  applyNameConfusion(actions)

  const result = events.filter((e) => e.type === 'result').pop()
  const totalOut: number = result?.usage?.output_tokens ?? 0
  const totalChars = calls.reduce((n, c) => n + c.visibleChars, 0) || 1
  const M = calls.length
  const per = (t: number, p: number) => (t * p) / 1e6
  let injectionsCost = 0
  let textCost = 0
  const first = calls[0]
  const prefixTokens = first
    ? first.usage.input_tokens + first.usage.cache_creation_input_tokens + first.usage.cache_read_input_tokens
    : 0
  const pushedTokens = Math.max(0, prefixTokens - sharedPrefixTokens)
  const baseTokens = prefixTokens - pushedTokens

  calls.forEach((call, k0) => {
    const k = k0 + 1
    const next = calls[k0 + 1]
    const reads = Math.max(0, M - (k + 1))
    const residency = (tokens: number) => (next ? per(tokens, PRICE.cacheWrite) + per(tokens, PRICE.cacheRead) * reads : 0)
    const callOut = (totalOut * call.visibleChars) / totalChars
    const textOut = (totalOut * call.textChars) / totalChars
    textCost += per(textOut, PRICE.output) + residency(textOut)
    // Calls after the first re-read the shared base prefix; that read is charged to
    // the actions the call issued (to text when it issued none).
    const overhead = k > 1 ? per(baseTokens, PRICE.cacheRead) : 0
    if (call.actions.length === 0) textCost += overhead
    // Re-reading everything before this call: what disappears with the call.
    const roundTrip = per(call.usage.cache_read_input_tokens, PRICE.cacheRead) + per(call.usage.input_tokens, PRICE.input)
    const written = next ? next.usage.cache_creation_input_tokens + next.usage.input_tokens : 0
    const resultChars = call.actions.map((a) => a.result.length)
    const estimated = resultChars.map((c) => c / CHARS_PER_TOKEN)
    const room = Math.max(0, written - callOut)
    const estimatedSum = estimated.reduce((n, v) => n + v, 0)
    const scale = estimatedSum > room && estimatedSum > 0 ? room / estimatedSum : 1
    const nextInput = next
      ? next.usage.input_tokens + next.usage.cache_creation_input_tokens + next.usage.cache_read_input_tokens
      : 0
    const totalResultChars = resultChars.reduce((n, v) => n + v, 0)
    call.actions.forEach((action, j) => {
      const out = (totalOut * action.outputTokens) / totalChars
      action.outputTokens = out
      action.resultTokens = estimated[j] * scale
      action.overheadUsd = overhead / call.actions.length
      action.costUsd = per(out, PRICE.output) + residency(out) + residency(action.resultTokens) + action.overheadUsd
      action.marginalUsd = action.costUsd - action.overheadUsd + roundTrip / call.actions.length
      const nextShare = totalResultChars > 0 ? resultChars[j] / totalResultChars : 1 / call.actions.length
      action.literalTokens = out + nextInput * nextShare
      const counted = action.segments
      for (const s of counted) action.shares[s.sub] = (action.shares[s.sub] ?? 0) + 1 / counted.length
    })
    const attributedResults = estimated.reduce((n, v) => n + v * scale, 0)
    const leftover = Math.max(0, written - callOut - attributedResults)
    injectionsCost += residency(leftover)
  })

  const callOneCost = first
    ? per(first.usage.input_tokens, PRICE.input) +
      per(first.usage.cache_creation_input_tokens, PRICE.cacheWrite) +
      per(first.usage.cache_read_input_tokens, PRICE.cacheRead)
    : 0
  // The guidance an arm ships is session-specific, so call 1 writes it (not reads it).
  const pushedCost = per(pushedTokens, PRICE.cacheWrite) + per(pushedTokens, PRICE.cacheRead) * (M - 1)
  const callOneShared = callOneCost - per(pushedTokens, PRICE.cacheWrite)
  const prefixCost = callOneCost + per(pushedTokens, PRICE.cacheRead) * (M - 1)

  let modelled = per(totalOut, PRICE.output)
  for (const c of calls)
    modelled +=
      per(c.usage.input_tokens, PRICE.input) +
      per(c.usage.cache_creation_input_tokens, PRICE.cacheWrite) +
      per(c.usage.cache_read_input_tokens, PRICE.cacheRead)

  const firstEdit = actions.find(isEditAction) ?? null
  return {
    label,
    arm,
    trial,
    costUsd: result?.total_cost_usd ?? 0,
    modelledCostUsd: modelled,
    calls: M,
    actions,
    prefixTokens,
    prefixCostUsd: prefixCost,
    pushedTokens,
    pushedCostUsd: pushedCost,
    callOneSharedCostUsd: callOneShared,
    injectionsCostUsd: injectionsCost,
    textCostUsd: textCost,
    firstEditEvent: firstEdit?.event ?? null,
    firstEditAction: firstEdit?.index ?? null,
    firstEditCall: firstEdit?.call ?? null,
  }
}

interface CellNumbers {
  label: string
  arm: string
  cost: number
  calls: number
  actions: number
  count: Record<Cat, number>
  usd: Record<Cat, number>
  marginal: Record<Cat, number>
  literal: Record<Cat, number>
  denied: number
  deniedUsd: number
  preEditAbUsd: number
  preEditAbCount: number
  firstEditEvent: number | null
  firstEditAction: number | null
  prefixTokens: number
  pushedTokens: number
  pushedUsd: number
  callOneSharedUsd: number
  injectionsUsd: number
  textUsd: number
  residualUsd: number
  subUsd: Partial<Record<Sub, number>>
}

function numbers(cell: CellReport): CellNumbers {
  const zero = (): Record<Cat, number> => ({ a: 0, b: 0, c: 0 })
  const count = zero()
  const usd = zero()
  const marginal = zero()
  const literal = zero()
  const subUsd: Partial<Record<Sub, number>> = {}
  let denied = 0
  let deniedUsd = 0
  let preEditAbUsd = 0
  let preEditAbCount = 0
  for (const a of cell.actions) {
    if (a.denied) {
      denied += 1
      deniedUsd += a.costUsd
    }
    for (const [sub, share] of Object.entries(a.shares) as [Sub, number][]) {
      const cat = sub[0] as Cat
      count[cat] += share
      usd[cat] += a.costUsd * share
      marginal[cat] += a.marginalUsd * share
      literal[cat] += a.literalTokens * share
      subUsd[sub] = (subUsd[sub] ?? 0) + a.costUsd * share
      if (cat !== 'c' && cell.firstEditAction !== null && a.index < cell.firstEditAction) {
        preEditAbUsd += a.costUsd * share
        preEditAbCount += share
      }
    }
  }
  const attributed =
    usd.a + usd.b + usd.c + cell.pushedCostUsd + cell.callOneSharedCostUsd + cell.injectionsCostUsd + cell.textCostUsd
  return {
    label: cell.label,
    arm: cell.arm,
    cost: cell.costUsd,
    calls: cell.calls,
    actions: cell.actions.length,
    count,
    usd,
    marginal,
    literal,
    denied,
    deniedUsd,
    preEditAbUsd,
    preEditAbCount,
    firstEditEvent: cell.firstEditEvent,
    firstEditAction: cell.firstEditAction,
    prefixTokens: cell.prefixTokens,
    pushedTokens: cell.pushedTokens,
    pushedUsd: cell.pushedCostUsd,
    callOneSharedUsd: cell.callOneSharedCostUsd,
    injectionsUsd: cell.injectionsCostUsd,
    textUsd: cell.textCostUsd,
    residualUsd: cell.costUsd - attributed,
    subUsd,
  }
}

const median = (xs: number[]) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  return s.length === 0 ? Number.NaN : s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
const mean = (xs: number[]) => xs.reduce((n, v) => n + v, 0) / xs.length
const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(0)}%` : '-')
const usdf = (x: number) => `$${x.toFixed(3)}`

function callOnePrefix(label: string): number | null {
  const path = join(RESULTS, `${label}.stream.jsonl`)
  if (!existsSync(path)) return null
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.includes('"type":"assistant"')) continue
    const u = JSON.parse(line).message.usage
    return u.input_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens
  }
  return null
}
// The hono app ships no agent guidance, so its call-1 prefix is the shared base.
const sharedPrefix = median(TRIALS.map((t) => callOnePrefix(`hono-sep-${t}`) ?? Number.NaN))
const cells: CellReport[] = []
for (const arm of ARMS)
  for (const t of TRIALS) {
    const c = loadCell(arm, t, sharedPrefix)
    if (c) cells.push(c)
  }
const rows = cells.map(numbers)
const out: string[] = []

out.push('## Price check (modelled vs reported total_cost_usd)')
for (const c of cells) out.push(`${c.label}: modelled ${usdf(c.modelledCostUsd)} reported ${usdf(c.costUsd)}`)

const shareOf = (rec: Record<Cat, number>, cat: Cat) => rec[cat] / (rec.a + rec.b + rec.c)
out.push('', '## Per cell (residency $; count is fractional for mixed commands)')
out.push(
  '| cell | cost | calls | actions | a/b/c count | a $ | b $ | c $ (of which denied) | b-pushed $ (tok) | call-1 shared $ | injections $ | text $ | residual $ | marginal a/b $ | literal a/b/c | first edit msg / action | a+b before first edit |',
)
out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
for (const r of rows) {
  const ab = r.usd.a + r.usd.b
  out.push(
    `| ${r.label} | ${usdf(r.cost)} | ${r.calls} | ${r.actions} | ${r.count.a.toFixed(1)}/${r.count.b.toFixed(1)}/${r.count.c.toFixed(1)} | ${usdf(r.usd.a)} | ${usdf(r.usd.b)} | ${usdf(r.usd.c)} (${usdf(r.deniedUsd)}, n=${r.denied}) | ${usdf(r.pushedUsd)} (${r.pushedTokens}) | ${usdf(r.callOneSharedUsd)} | ${usdf(r.injectionsUsd)} | ${usdf(r.textUsd)} | ${usdf(r.residualUsd)} | ${usdf(r.marginal.a)}/${usdf(r.marginal.b)} | ${pct(shareOf(r.literal, 'a'))}/${pct(shareOf(r.literal, 'b'))}/${pct(shareOf(r.literal, 'c'))} | ${r.firstEditEvent ?? '-'} / ${r.firstEditAction ?? '-'} | ${ab > 0 ? `${pct(r.preEditAbUsd / ab)} of $, ${r.preEditAbCount.toFixed(1)} actions` : '-'} |`,
  )
}

out.push('', '## Per arm (N=3 medians; shares are of action $, residency model)')
out.push(
  '| arm | cost | calls | actions | a n | b n | c n | a $ | b $ | b-pushed $ | c $ | a/b/c share | marginal a $ | marginal b $ | literal a/b/c | first edit msg | a+b $ before first edit |',
)
out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
for (const arm of ARMS) {
  const rs = rows.filter((r) => r.arm === arm)
  const m = (f: (r: CellNumbers) => number) => median(rs.map(f))
  out.push(
    `| ${arm} | ${usdf(m((r) => r.cost))} | ${m((r) => r.calls)} | ${m((r) => r.actions)} | ${m((r) => r.count.a).toFixed(1)} | ${m((r) => r.count.b).toFixed(1)} | ${m((r) => r.count.c).toFixed(1)} | ${usdf(m((r) => r.usd.a))} | ${usdf(m((r) => r.usd.b))} | ${usdf(m((r) => r.pushedUsd))} | ${usdf(m((r) => r.usd.c))} | ${pct(m((r) => shareOf(r.usd, 'a')))}/${pct(m((r) => shareOf(r.usd, 'b')))}/${pct(m((r) => shareOf(r.usd, 'c')))} | ${usdf(m((r) => r.marginal.a))} | ${usdf(m((r) => r.marginal.b))} | ${pct(m((r) => shareOf(r.literal, 'a')))}/${pct(m((r) => shareOf(r.literal, 'b')))}/${pct(m((r) => shareOf(r.literal, 'c')))} | ${m((r) => r.firstEditEvent ?? Number.NaN)} | ${usdf(m((r) => r.preEditAbUsd))} |`,
  )
}

out.push('', '## Gap decomposition vs hono (arm means, residency model; buckets sum to the cost)')
const bucket = (r: CellNumbers) => ({
  'a name confusion': r.usd.a,
  'b actions': r.usd.b,
  'b pushed guidance': r.pushedUsd,
  'c denied': r.deniedUsd,
  'c other': r.usd.c - r.deniedUsd,
  'call-1 shared prefix': r.callOneSharedUsd,
  injections: r.injectionsUsd,
  'assistant text': r.textUsd,
  residual: r.residualUsd,
})
type Bucket = ReturnType<typeof bucket>
const armMean = (arm: string): Bucket => {
  const bs = rows.filter((r) => r.arm === arm).map(bucket)
  const keys = Object.keys(bs[0]) as (keyof Bucket)[]
  return Object.fromEntries(keys.map((k) => [k, mean(bs.map((b) => b[k]))])) as Bucket
}
const others = ARMS.filter((a) => a !== 'hono-sep')
const means = Object.fromEntries(ARMS.map((a) => [a, armMean(a)])) as Record<string, Bucket>
const honoMean = means['hono-sep']
out.push(`| bucket | ${ARMS.join(' | ')} | ${others.map((a) => `${a} − hono`).join(' | ')} |`)
out.push(`|---|${ARMS.map(() => '---').join('|')}|${others.map(() => '---').join('|')}|`)
for (const k of Object.keys(honoMean) as (keyof Bucket)[])
  out.push(
    `| ${k} | ${ARMS.map((a) => usdf(means[a][k])).join(' | ')} | ${others.map((a) => usdf(means[a][k] - honoMean[k])).join(' | ')} |`,
  )
const totals = Object.fromEntries(ARMS.map((a) => [a, mean(rows.filter((r) => r.arm === a).map((r) => r.cost))]))
out.push(
  `| total (mean cost) | ${ARMS.map((a) => usdf(totals[a])).join(' | ')} | ${others.map((a) => usdf(totals[a] - totals['hono-sep'])).join(' | ')} |`,
)
for (const a of others) {
  const gap = totals[a] - totals['hono-sep']
  const d = (k: keyof Bucket) => means[a][k] - honoMean[k]
  const marginalA = mean(rows.filter((r) => r.arm === a).map((r) => r.marginal.a))
  const marginalB = mean(rows.filter((r) => r.arm === a).map((r) => r.marginal.b))
  out.push(
    `- ${a}: gap ${usdf(gap)}. a ${pct(d('a name confusion') / gap)}; b ${pct((d('b actions') + d('b pushed guidance')) / gap)} (actions ${pct(d('b actions') / gap)}, pushed ${pct(d('b pushed guidance') / gap)}); c ${pct((d('c denied') + d('c other')) / gap)}; call-1/injections/text/residual ${pct((d('call-1 shared prefix') + d('injections') + d('assistant text') + d('residual')) / gap)}. Removal estimate (marginal): a ${usdf(marginalA)} = ${pct(marginalA / gap)} of the gap, b actions ${usdf(marginalB)} = ${pct(marginalB / gap)}`,
  )
}

out.push('', '## b sub-buckets (arm means, $)')
const subs: Sub[] = ['b-guren-pkg', 'b-reexport-hop', 'b-other-pkg', 'b-guidance', 'b-generated', 'b-cli-help']
out.push(`| sub | ${ARMS.join(' | ')} |`)
out.push(`|---|${ARMS.map(() => '---').join('|')}|`)
for (const s of subs)
  out.push(`| ${s} | ${ARMS.map((a) => usdf(mean(rows.filter((r) => r.arm === a).map((r) => r.subUsd[s] ?? 0)))).join(' | ')} |`)

out.push('', '## Actions labelled (a)')
for (const c of cells)
  for (const a of c.actions)
    if (a.shares['a-core-server'])
      out.push(`- ${c.label} #${a.index} (msg ${a.event}, ${usdf(a.costUsd)}): ${a.summary.replace(/\s+/g, ' ').slice(0, 160)}`)

out.push('', '## Top node_modules files read (actions referencing the path, cells)')
for (const arm of ARMS) {
  const hits = new Map<string, { actions: number; cells: Set<string> }>()
  for (const c of cells.filter((x) => x.arm === arm))
    for (const a of c.actions) {
      if (a.denied) continue
      const paths = new Set(a.segments.flatMap((s) => s.nodeModulesPaths))
      for (const p of paths) {
        const h = hits.get(p) ?? { actions: 0, cells: new Set() }
        h.actions += 1
        h.cells.add(c.label)
        hits.set(p, h)
      }
    }
  const top = [...hits.entries()].sort((x, y) => y[1].actions - x[1].actions).slice(0, 10)
  out.push(`### ${arm}`)
  if (top.length === 0) out.push('none')
  for (const [p, h] of top) out.push(`- \`${p}\`: ${h.actions} actions, ${h.cells.size} cells`)
}

// Added lines only, app code only: schema and migrations use drizzle in every arm by design.
const MODEL_MARKERS: [string, RegExp][] = [
  ['defineModel', /\bdefineModel\(/g],
  ['Model query/find', /\b[A-Z]\w*\.(query|newQuery|find|findOrFail|firstWhere|create|all|paginate)\(/g],
  ['.with(', /\.with\(/g],
  ['relationship', /\b(belongsToMany|hasMany|belongsTo|hasOne)\(/g],
  ['attach/sync/detach', /\.(attach|detach|sync)\(/g],
]
const DRIZZLE_MARKERS: [string, RegExp][] = [
  ['db.select/insert/update/delete', /\b(db|tx|database)\.(select|insert|update|delete)\(/g],
  ["import 'drizzle-orm'", /from ['"]drizzle-orm['"]/g],
  ['eq(/inArray(/and(', /\b(eq|inArray|and|or)\(/g],
  ['getDatabase', /\bgetDatabase\b/g],
]
function patchMarkers(label: string) {
  const path = join(RESULTS, `${label}.patch`)
  if (!existsSync(path)) return null
  let file = ''
  const added: string[] = []
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const header = line.match(/^\+\+\+ b\/(.+)$/)
    if (header) {
      file = header[1]
      continue
    }
    if (!line.startsWith('+') || line.startsWith('+++')) continue
    if (/(^|\/)(db\/schema\.ts|db\/migrations\/|drizzle\/|\.claude\/|docs\/|\.guren\/|src\/server\/db\/schema\.ts)|\.md$|\.json$|\.sql$/.test(file)) continue
    added.push(line.slice(1))
  }
  const text = added.join('\n')
  const count = (ms: [string, RegExp][]) => Object.fromEntries(ms.map(([k, re]) => [k, (text.match(re) ?? []).length]))
  return { model: count(MODEL_MARKERS), drizzle: count(DRIZZLE_MARKERS) }
}
out.push('', '## Model API vs raw drizzle markers (added app-code lines, schema/migrations excluded)')
out.push(`| cell | ${MODEL_MARKERS.map(([k]) => k).join(' | ')} | model Σ | ${DRIZZLE_MARKERS.map(([k]) => k).join(' | ')} | drizzle Σ |`)
out.push(`|---|${MODEL_MARKERS.map(() => '---').join('|')}|---|${DRIZZLE_MARKERS.map(() => '---').join('|')}|---|`)
for (const c of cells) {
  const m = patchMarkers(c.label)
  if (!m) continue
  const ms = Object.values(m.model).reduce((n, v) => n + v, 0)
  const ds = Object.values(m.drizzle).reduce((n, v) => n + v, 0)
  out.push(`| ${c.label} | ${Object.values(m.model).join(' | ')} | ${ms} | ${Object.values(m.drizzle).join(' | ')} | ${ds} |`)
}

console.log(out.join('\n'))

const jsonFlag = process.argv.indexOf('--json')
if (jsonFlag !== -1 && process.argv[jsonFlag + 1]) {
  const dump = cells.map((c) => ({
    label: c.label,
    actions: c.actions.map((a) => ({
      index: a.index,
      msg: a.event,
      call: a.call,
      name: a.name,
      denied: a.denied,
      costUsd: Number(a.costUsd.toFixed(5)),
      shares: a.shares,
      summary: a.summary.replace(/\s+/g, ' ').slice(0, 200),
    })),
  }))
  writeFileSync(process.argv[jsonFlag + 1], JSON.stringify(dump, null, 2))
}
