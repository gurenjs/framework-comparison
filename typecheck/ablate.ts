// Attribution: which part of each stack's typecheck cost comes from where.
// Generates N endpoints (default 500), runs codegen, then removes or stubs one
// piece at a time and re-measures. Writes typecheck/ablation.json.
//
//   bun typecheck/ablate.ts            # N=500, RUNS=3
//   N=100 RUNS=1 bun typecheck/ablate.ts
//
// Run after run.ts, not alongside it: both write into typecheck/.work/.

import { rmSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generate, type Stack } from './generate.ts'
import { codegen, measure } from './run.ts'

const ROOT = import.meta.dir
const WORK = join(ROOT, '.work')
const N = Number(process.env.N ?? 500)
const RUNS = Number(process.env.RUNS ?? 3)

interface Variant {
  stack: Stack
  name: string
  description: string
  mutate?: (dir: string) => void
  count?: number
}

function edit(path: string, fn: (s: string) => string): void {
  const before = readFileSync(path, 'utf8')
  const after = fn(before)
  if (after === before) throw new Error(`ablation edit changed nothing in ${path}`)
  writeFileSync(path, after)
}

const VARIANTS: Variant[] = [
  { stack: 'guren', name: 'baseline', description: 'scaffold, 0 endpoints', count: 0 },
  { stack: 'guren', name: 'full', description: 'N endpoints, api client + route() + typed <Link> consumers' },
  {
    stack: 'guren',
    name: 'server-only',
    description: 'no client consumer files (routes, controllers, contracts, generated files only)',
    mutate: (d) => rmSync(join(d, 'resources/js/bench'), { recursive: true }),
  },
  {
    stack: 'guren',
    name: 'no-links',
    description: 'drop Links.tsx (typed <Link> + route())',
    mutate: (d) => rmSync(join(d, 'resources/js/bench/Links.tsx')),
  },
  {
    stack: 'guren',
    name: 'no-api-client',
    description: 'drop api.ts (createApiClient().request())',
    mutate: (d) => rmSync(join(d, 'resources/js/bench/api.ts')),
  },
  {
    stack: 'guren',
    name: 'no-href-union',
    description: 'types/generated/routes.d.ts: RoutePath union → string (Inertia href augmentation)',
    mutate: (d) =>
      edit(join(d, 'types/generated/routes.d.ts'), (s) =>
        s.replace(/export type RoutePath =[\s\S]*?\n\n/, 'export type RoutePath = string\n\n'),
      ),
  },
  {
    stack: 'guren',
    name: 'no-contract-augmentation',
    description: "routes.gen.ts: drop `declare module '@guren/core'` (validated() untyped)",
    mutate: (d) => {
      edit(join(d, '.guren/routes.gen.ts'), (s) => s.replace(/declare module '@guren\/core' \{[\s\S]*$/, 'export {}\n'))
      // Untyped validated() returns `params: Record<string, any> | undefined`.
      for (let i = 0; i < N; i += 2) {
        edit(join(d, `app/Http/Controllers/Bench/R${i}Controller.ts`), (s) => s.replace('params.id', 'params!.id'))
      }
    },
  },
  { stack: 'void', name: 'baseline', description: '0 endpoints', count: 0 },
  { stack: 'void', name: 'full', description: 'N endpoints + typed fetch consumer' },
  {
    stack: 'void',
    name: 'server-only',
    description: 'no typed fetch consumer',
    mutate: (d) => rmSync(join(d, 'src/bench'), { recursive: true }),
  },
  { stack: 'hono-chain', name: 'baseline', description: '0 endpoints', count: 0 },
  { stack: 'hono-chain', name: 'full', description: 'N endpoints + hc client consumer' },
  {
    stack: 'hono-chain',
    name: 'server-only',
    description: 'no hc client consumer',
    mutate: (d) => rmSync(join(d, 'src/client.ts')),
  },
]

if (import.meta.main) {
  const only = process.env.STACKS?.split(',')
  const out: Record<string, unknown>[] = []
  for (const v of VARIANTS) {
    if (only && !only.includes(v.stack)) continue
    const dir = join(WORK, v.stack)
    const n = v.count ?? N
    generate(v.stack, n, dir)
    codegen(v.stack, dir)
    v.mutate?.(dir)
    const d = measure(dir, RUNS)
    out.push({ stack: v.stack, variant: v.name, description: v.description, n, ...d })
    console.log(`${v.stack.padEnd(10)} ${v.name.padEnd(26)} inst=${d.instantiations} check=${d.checkTime}s`)
  }
  writeFileSync(join(ROOT, 'ablation.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), n: N, runs: RUNS, variants: out }, null, 2)}\n`)
}
