// Runs the typecheck benchmark: for each stack and route count, generate the
// routes, run the stack's codegen, then `tsc --noEmit --extendedDiagnostics`
// RUNS times and keep the median. Writes typecheck/results.json.
//
//   bun typecheck/run.ts                 # full matrix
//   STACKS=guren COUNTS=0,500 RUNS=1 bun typecheck/run.ts
//
// Prerequisite: typecheck/setup.sh.

import { spawnSync } from 'node:child_process'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { generate, STACKS, type Stack } from './generate.ts'

const ROOT = import.meta.dir
const WORK = join(ROOT, '.work')
const stacks = (process.env.STACKS?.split(',') as Stack[] | undefined) ?? STACKS
const counts = process.env.COUNTS?.split(',').map(Number) ?? [0, 100, 300, 500]
const RUNS = Number(process.env.RUNS ?? 3)
const OUT = process.env.OUT ?? join(ROOT, 'results.json')

export interface Diagnostics {
  instantiations: number
  types: number
  checkTime: number
  totalTime: number
  memoryKB: number
}

function sh(cmd: string, args: string[], cwd: string): string {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed in ${cwd}:\n${r.stdout}\n${r.stderr}`)
  }
  return r.stdout
}

export function codegen(stack: Stack, dir: string): void {
  if (stack === 'guren') sh('bunx', ['guren', 'codegen', '--force'], dir)
  if (stack === 'void') sh('./node_modules/.bin/void', ['prepare'], dir)
}

export function tsc(dir: string): Diagnostics {
  // A type error would make the numbers meaningless (and tsc exits non-zero).
  const out = sh('./node_modules/.bin/tsc', ['--noEmit', '--extendedDiagnostics'], dir)
  const num = (label: string) => {
    const m = out.match(new RegExp(`^${label}:\\s+([\\d.]+)`, 'm'))
    if (!m) throw new Error(`no "${label}" in tsc output:\n${out}`)
    return Number(m[1])
  }
  return {
    instantiations: num('Instantiations'),
    types: num('Types'),
    checkTime: num('Check time'),
    totalTime: num('Total time'),
    memoryKB: Number(out.match(/^Memory used:\s+(\d+)K/m)?.[1] ?? NaN),
  }
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

export function measure(dir: string, runs = RUNS): Diagnostics & { runs: Diagnostics[] } {
  const all = Array.from({ length: runs }, () => tsc(dir))
  return {
    instantiations: median(all.map((d) => d.instantiations)),
    types: median(all.map((d) => d.types)),
    checkTime: median(all.map((d) => d.checkTime)),
    totalTime: median(all.map((d) => d.totalTime)),
    memoryKB: median(all.map((d) => d.memoryKB)),
    runs: all,
  }
}

function versions(dir: string, pkgs: string[]): Record<string, string> {
  return Object.fromEntries(
    pkgs
      .filter((p) => existsSync(join(dir, 'node_modules', p, 'package.json')))
      .map((p) => [p, JSON.parse(readFileSync(join(dir, 'node_modules', p, 'package.json'), 'utf8')).version]),
  )
}

if (import.meta.main) {
  const results: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    runs: RUNS,
    host: `${process.platform}-${process.arch}`,
    stacks: {},
  }
  for (const stack of stacks) {
    const dir = join(WORK, stack)
    const entry: Record<string, unknown> = {
      versions: versions(dir, ['typescript', 'zod', 'hono', '@hono/zod-validator', 'void', '@guren/core', '@guren/cli', '@guren/inertia-client']),
      counts: {},
    }
    for (const n of counts) {
      generate(stack, n, dir)
      codegen(stack, dir)
      const d = measure(dir)
      ;(entry.counts as Record<number, unknown>)[n] = d
      console.log(`${stack.padEnd(10)} n=${String(n).padEnd(3)} inst=${d.instantiations} check=${d.checkTime}s total=${d.totalTime}s`)
    }
    ;(results.stacks as Record<string, unknown>)[stack] = entry
  }
  writeFileSync(OUT, `${JSON.stringify(results, null, 2)}\n`)
  console.log(`wrote ${OUT}`)
}
