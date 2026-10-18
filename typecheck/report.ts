// Renders results.json / ablation.json / experiments.json into the generated
// blocks of TYPECHECK.md (between `<!-- typecheck:<name>:begin/end -->`).
//
//   bun typecheck/report.ts

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = import.meta.dir
const DOC = join(ROOT, '..', 'TYPECHECK.md')

interface D {
  instantiations: number
  checkTime: number
  totalTime: number
}

const read = (f: string) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'))
const fmtInt = (n: number) => n.toLocaleString('en-US')
const fmtK = (n: number) => `${n >= 0 ? '+' : ''}${(n / 1000).toFixed(0)}k`
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/</g, '&lt;')
const fmtS = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(3)}s`

const LABELS: Record<string, string> = {
  guren: 'Guren (codegen)',
  void: 'Void 1.1.11',
  'hono-chain': 'Hono RPC (one chain)',
  'hono-split': 'Hono RPC (10-route sub-routers)',
}

function mainTable(): string {
  const r = read('results.json')
  const stacks = Object.keys(r.stacks)
  const counts = Object.keys(r.stacks[stacks[0]].counts).map(Number).filter((n) => n > 0)
  const head = `| Stack | Baseline (0 routes) | ${counts.map((n) => `${n} routes`).join(' | ')} |`
  const sep = `|---|---|${counts.map(() => '---').join('|')}|`
  const rows = stacks.map((s) => {
    const c = r.stacks[s].counts as Record<string, D>
    const base = c['0']
    const cells = counts.map((n) => `${fmtK(c[n].instantiations - base.instantiations)} / ${fmtS(c[n].checkTime - base.checkTime)}`)
    return `| ${LABELS[s] ?? s} | ${fmtInt(base.instantiations)} / ${base.checkTime.toFixed(3)}s | ${cells.join(' | ')} |`
  })
  const per = stacks.map((s) => {
    const c = r.stacks[s].counts as Record<string, D>
    const top = Math.max(...counts)
    return `${LABELS[s] ?? s}: ${fmtInt(Math.round((c[top].instantiations - c['0'].instantiations) / top))}`
  })
  return [
    `Instantiations / Check time, as the increase over each stack's own 0-route app. Median of ${r.runs} runs, ${r.host}, TypeScript ${r.stacks[stacks[0]].versions.typescript}.`,
    '',
    head,
    sep,
    ...rows,
    '',
    `Instantiations per endpoint at ${Math.max(...counts)}: ${per.join(' · ')}.`,
  ].join('\n')
}

function ablationTable(): string {
  const a = read('ablation.json')
  const base: Record<string, number> = {}
  const baseCheck: Record<string, number> = {}
  for (const v of a.variants) if (v.variant === 'baseline') {
    base[v.stack] = v.instantiations
    baseCheck[v.stack] = v.checkTime
  }
  const rows = a.variants
    .filter((v: { variant: string }) => v.variant !== 'baseline')
    .map((v: { stack: string; variant: string; description: string } & D) =>
      `| ${LABELS[v.stack] ?? v.stack} | \`${v.variant}\` | ${cell(v.description)} | ${fmtK(v.instantiations - base[v.stack])} | ${fmtS(v.checkTime - baseCheck[v.stack])} |`,
    )
  return [
    `N = ${a.n}, median of ${a.runs} runs, increase over the 0-route app.`,
    '',
    '| Stack | Variant | What is removed | Instantiations | Check time |',
    '|---|---|---|---|---|',
    ...rows,
  ].join('\n')
}

function experimentsTable(): string {
  const x = read('experiments.json')
  const ref = x.experiments[0]
  const rows = x.experiments.map((e: { experiment: string; routesFileMs: number } & D) =>
    `| ${cell(e.experiment)} | ${fmtInt(e.instantiations)} (${fmtK(e.instantiations - ref.instantiations)}) | ${e.checkTime.toFixed(3)}s (${fmtS(e.checkTime - ref.checkTime)}) | ${e.routesFileMs} ms |`,
  )
  return [
    `Guren, N = ${x.n}, full app (server + client), median of ${x.runs} runs. Deltas are against the first row. The last column is the slowest routes file's own check time under \`--generateTrace\` (traced runs are slower than untraced ones).`,
    '',
    '| Variant | Instantiations | Check time | routes file |',
    '|---|---|---|---|',
    ...rows,
  ].join('\n')
}

const blocks: Record<string, () => string> = { results: mainTable, ablation: ablationTable, experiments: experimentsTable }

let doc = readFileSync(DOC, 'utf8')
for (const [name, render] of Object.entries(blocks)) {
  const file = name === 'results' ? 'results.json' : `${name}.json`
  if (!existsSync(join(ROOT, file))) continue
  const re = new RegExp(`(<!-- typecheck:${name}:begin[^>]*-->\\n)[\\s\\S]*?(<!-- typecheck:${name}:end -->)`)
  if (!re.test(doc)) throw new Error(`TYPECHECK.md has no typecheck:${name} block`)
  doc = doc.replace(re, (_m, a, b) => `${a}${render()}\n${b}`)
}
writeFileSync(DOC, doc)
console.log(`updated ${DOC}`)
