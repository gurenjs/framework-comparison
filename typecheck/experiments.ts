// Guren-only follow-ups to ablate.ts: what the server-side cost is made of and
// what would reduce it. N=500, each variant applied after codegen. Writes
// typecheck/experiments.json; `routesFileMs` is the routes file's own check
// time from `tsc --generateTrace` (one file is checked by one checker).
//
//   bun typecheck/experiments.ts
//
// The Router.d.ts variants patch node_modules/@guren/server in place and
// restore it afterwards (also on failure).

import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { generate } from './generate.ts'
import { codegen, measure } from './run.ts'

const ROOT = import.meta.dir
const DIR = join(ROOT, '.work/guren')
const N = 500
const RUNS = Number(process.env.RUNS ?? 3)
const ROUTER_DTS = join(DIR, 'node_modules/@guren/server/dist/mvc/Router.d.ts')
const BENCH = join(DIR, 'routes/bench.ts')

function edit(path: string, fn: (s: string) => string): void {
  const before = readFileSync(path, 'utf8')
  const after = fn(before)
  if (after === before) throw new Error(`experiment edit changed nothing in ${path}`)
  writeFileSync(path, after)
}

function fileCheckMs(suffix: string): number {
  const trace = mkdtempSync(join(tmpdir(), 'tc-trace-'))
  try {
    spawnSync('./node_modules/.bin/tsc', ['--noEmit', '--generateTrace', trace], { cwd: DIR })
    const events = JSON.parse(readFileSync(join(trace, 'trace.json'), 'utf8')) as Array<Record<string, any>>
    const open = new Map<unknown, Array<Record<string, any>>>()
    let ms = 0
    for (const e of events) {
      if (e.ph === 'B') open.set(e.tid, [...(open.get(e.tid) ?? []), e])
      else if (e.ph === 'E') {
        const b = open.get(e.tid)!.pop()!
        if (b.name === 'checkSourceFile' && String(b.args.path).endsWith(suffix)) ms += (e.ts - b.ts) / 1000
      }
    }
    return Math.round(ms)
  } finally {
    rmSync(trace, { recursive: true, force: true })
  }
}

const CONTRACT = /\{ name: '([^']+)', (params|body): r\d+\.\w+, output: r\d+\.Output \}, (\[[^\]]+\])\)/g

// Swap each method's inline-handler overload with its controller-tuple one, so a
// controller route stops trying (and failing) the TypedRouteHandler overload first.
function swapOverloads(s: string): string {
  const lines = s.split('\n')
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].includes('handler: TypedRouteHandler<') && lines[i + 1].includes('handler: ControllerAction<C> | PrototypeRouteHandler')) {
      ;[lines[i], lines[i + 1]] = [lines[i + 1], lines[i]]
      i++
    }
  }
  return lines.join('\n')
}

// The controller-tuple overloads never read their schema type parameters.
function dropControllerSchemaGenerics(s: string): string {
  return s.replace(
    /(\w+)<C extends ControllerConstructor, TParamsSchema extends SchemaLike<unknown>, TQuerySchema extends SchemaLike<unknown>, TBodySchema extends SchemaLike<unknown>, TOutputSchema extends SchemaLike<unknown>>\(([^)]*?)options: RouteContractOptions<TParamsSchema, TQuerySchema, TBodySchema, TOutputSchema>, handler: ControllerAction<C> \| PrototypeRouteHandler\)/g,
    (_m, name, pre) =>
      `${name}<C extends ControllerConstructor>(${pre}options: RouteContractOptions<SchemaLike<unknown>, SchemaLike<unknown>, SchemaLike<unknown>, SchemaLike<unknown>>, handler: ControllerAction<C> | PrototypeRouteHandler)`,
  )
}

interface Experiment {
  name: string
  group: 'routes' | 'router-types' | 'client'
  apply: () => void
}

const EXPERIMENTS: Experiment[] = [
  { group: 'routes', name: 'as generated: { name, params|body, output }', apply: () => {} },
  { group: 'routes', name: 'no output schema', apply: () => edit(BENCH, (s) => s.replace(/, output: r\d+\.Output/g, '')) },
  { group: 'routes', name: 'name only in options', apply: () => edit(BENCH, (s) => s.replace(/, (params|body): r\d+\.\w+, output: r\d+\.Output/g, '')) },
  { group: 'routes', name: "bare [C, action] + .name()", apply: () => edit(BENCH, (s) => s.replace(CONTRACT, "$3).name('$1')")) },
  {
    group: 'routes',
    name: 'split into 10 route files',
    apply: () => {
      const src = readFileSync(BENCH, 'utf8').split('\n')
      const imports = src.filter((l) => l.startsWith('import ') && l.includes('Controllers/Bench'))
      const regs = src.filter((l) => l.startsWith('  router.'))
      const size = Math.ceil(regs.length / 10)
      const groups = Array.from({ length: 10 }, (_, g) => g)
      for (const g of groups) {
        writeFileSync(
          join(DIR, `routes/bench-${g}.ts`),
          `import type { Router } from '@guren/core'\n${imports.slice(g * size, (g + 1) * size).join('\n')}\n\nexport function registerBench${g}(router: Router): void {\n${regs.slice(g * size, (g + 1) * size).join('\n')}\n}\n`,
        )
      }
      writeFileSync(
        BENCH,
        `import type { Router } from '@guren/core'\n${groups.map((g) => `import { registerBench${g} } from './bench-${g}.js'`).join('\n')}\n\nexport function registerBenchRoutes(router: Router): void {\n${groups.map((g) => `  registerBench${g}(router)`).join('\n')}\n}\n`,
      )
    },
  },
  { group: 'router-types', name: 'Router.d.ts: controller overload before inline-handler overload', apply: () => edit(ROUTER_DTS, swapOverloads) },
  { group: 'router-types', name: 'Router.d.ts: controller overload without schema generics', apply: () => edit(ROUTER_DTS, dropControllerSchemaGenerics) },
  { group: 'router-types', name: 'Router.d.ts: both', apply: () => edit(ROUTER_DTS, (s) => swapOverloads(dropControllerSchemaGenerics(s))) },
  {
    group: 'client',
    name: 'Links.tsx: <Link> only (route() calls removed)',
    apply: () => edit(join(DIR, 'resources/js/bench/Links.tsx'), (s) => s.replace(/>\{route\(.*?\)\}<\/Link>/g, '>x</Link>')),
  },
  { group: 'client', name: 'Links.tsx removed', apply: () => rmSync(join(DIR, 'resources/js/bench/Links.tsx')) },
]

if (import.meta.main) {
  const routerOrig = readFileSync(ROUTER_DTS, 'utf8')
  const out: Record<string, unknown>[] = []
  try {
    for (const x of EXPERIMENTS) {
      generate('guren', N, DIR)
      codegen('guren', DIR)
      x.apply()
      const d = measure(DIR, RUNS)
      const routesFileMs = fileCheckMs('routes/bench.ts')
      out.push({ group: x.group, experiment: x.name, n: N, routesFileMs, ...d })
      console.log(`${x.name.padEnd(64)} inst=${d.instantiations} check=${d.checkTime}s routes/bench.ts=${routesFileMs}ms`)
      writeFileSync(ROUTER_DTS, routerOrig)
      for (let g = 0; g < 10; g++) rmSync(join(DIR, `routes/bench-${g}.ts`), { force: true })
    }
  } finally {
    writeFileSync(ROUTER_DTS, routerOrig)
  }
  writeFileSync(join(ROOT, 'experiments.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), n: N, runs: RUNS, experiments: out }, null, 2)}\n`)
}
