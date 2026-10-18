// Writes N generated API endpoints (plus a client file that calls every one of
// them) into one of the prepared projects under typecheck/.work/.
//
//   bun typecheck/generate.ts <guren|void|hono-chain|hono-split> <N> <projectDir>
//
// Endpoint i (0-based) is the same on every stack:
//   even i — GET  /api/r{i}/:id  → { id: string; name: string; n: number }
//   odd  i — POST /api/r{i}      body { name: string; count: number }
//                                → { id: number; name: string; count: number }
// so N endpoints = N paths, half with a path param, half with a validated body,
// all with a typed response. The client file calls each endpoint once and reads
// a property off the typed result, so the generated types are actually consumed.

import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export type Stack = 'guren' | 'void' | 'hono-chain' | 'hono-split'
export const STACKS: Stack[] = ['guren', 'void', 'hono-chain', 'hono-split']

const isGet = (i: number) => i % 2 === 0

function write(path: string, content: string): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, content)
}

// ---------------------------------------------------------------- Guren ----

const GUREN_WEB_MARK = '  // typecheck-bench\n'

function generateGuren(n: number, dir: string): void {
  rmSync(join(dir, 'app/Http/Controllers/Bench'), { recursive: true, force: true })
  rmSync(join(dir, 'resources/js/bench'), { recursive: true, force: true })

  const imports: string[] = []
  const registrations: string[] = []
  for (let i = 0; i < n; i++) {
    const cls = `R${i}Controller`
    imports.push(`import ${cls}, * as r${i} from '../app/Http/Controllers/Bench/${cls}.js'`)
    if (isGet(i)) {
      registrations.push(
        `  router.get('/api/r${i}/:id', { name: 'r${i}.show', params: r${i}.Params, output: r${i}.Output }, [${cls}, 'show'])`,
      )
      write(
        join(dir, `app/Http/Controllers/Bench/${cls}.ts`),
        `import { Controller } from '@guren/core'
import { z } from 'zod'

export const Params = z.object({ id: z.string() })
export const Output = z.object({ id: z.string(), name: z.string(), n: z.number() })

export default class ${cls} extends Controller {
  async show(): Promise<Response> {
    const { params } = this.validated('r${i}.show')
    return this.json({ id: params.id, name: 'r${i}', n: ${i} })
  }
}
`,
      )
    } else {
      registrations.push(
        `  router.post('/api/r${i}', { name: 'r${i}.store', body: r${i}.Body, output: r${i}.Output }, [${cls}, 'store'])`,
      )
      write(
        join(dir, `app/Http/Controllers/Bench/${cls}.ts`),
        `import { Controller } from '@guren/core'
import { z } from 'zod'

export const Body = z.object({ name: z.string(), count: z.number() })
export const Output = z.object({ id: z.number(), name: z.string(), count: z.number() })

export default class ${cls} extends Controller {
  async store(): Promise<Response> {
    const { body } = this.validated('r${i}.store')
    return this.json({ id: ${i}, name: body.name, count: body.count })
  }
}
`,
      )
    }
  }

  write(
    join(dir, 'routes/bench.ts'),
    `import type { Router } from '@guren/core'
${imports.join('\n')}

export function registerBenchRoutes(router: Router): void {
${registrations.join('\n')}
}
`,
  )

  // Hook the generated routes into routes/web.ts once (idempotent).
  const webPath = join(dir, 'routes/web.ts')
  let web = readFileSync(webPath, 'utf8')
  if (!web.includes(GUREN_WEB_MARK)) {
    web = `import { registerBenchRoutes } from './bench.js'\n${web}`.replace(
      /export function registerWebRoutes\(router: Router\): void \{\n/,
      (m) => `${m}${GUREN_WEB_MARK}  registerBenchRoutes(router)\n\n`,
    )
    writeFileSync(webPath, web)
  }

  // Client side: typed API client, route() helper and typed <Link>.
  const api: string[] = []
  const links: string[] = []
  for (let i = 0; i < n; i++) {
    if (isGet(i)) {
      api.push(
        `  { const res = await client.request('r${i}.show', { params: { id: '1' } }); const data = await res.json(); out.push(data.n) }`,
      )
      links.push(
        `      <Link route="r${i}.show" params={{ id: 1 }}>{route('r${i}.show', { id: 1 })}</Link>`,
      )
    } else {
      api.push(
        `  { const res = await client.request('r${i}.store', { body: { name: 'x', count: 1 } }); const data = await res.json(); out.push(data.count) }`,
      )
      links.push(`      <Link route="r${i}.store">{route('r${i}.store')}</Link>`)
    }
  }
  write(
    join(dir, 'resources/js/bench/api.ts'),
    `import { createApiClient, type ApiRoutes } from '../../../.guren/api-client.gen'

const client = createApiClient<ApiRoutes>({ baseUrl: '' })

export async function callAll(): Promise<number[]> {
  const out: number[] = []
${api.join('\n')}
  return out
}
`,
  )
  write(
    join(dir, 'resources/js/bench/Links.tsx'),
    `import { createTypedLink } from '@guren/inertia-client'
import { route, routeManifest } from '../../../.guren/routes.gen'

const Link = createTypedLink(routeManifest)

export function BenchLinks() {
  return (
    <nav>
${links.join('\n')}
    </nav>
  )
}
`,
  )
}

// ----------------------------------------------------------------- Void ----

function generateVoid(n: number, dir: string): void {
  rmSync(join(dir, 'routes'), { recursive: true, force: true })
  rmSync(join(dir, 'src/bench'), { recursive: true, force: true })
  const calls: string[] = []
  for (let i = 0; i < n; i++) {
    if (isGet(i)) {
      write(
        join(dir, `routes/api/r${i}/[id].ts`),
        `import { defineHandler } from 'void'

export const GET = defineHandler(async (c) => {
  return { id: c.req.param('id') as string, name: 'r${i}', n: ${i} }
})
`,
      )
      calls.push(`  { const data = await fetch('/api/r${i}/:id', { params: { id: '1' } }); out.push(data.n) }`)
    } else {
      write(
        join(dir, `routes/api/r${i}/index.ts`),
        `import { defineHandler } from 'void'
import { z } from 'zod'

export const POST = defineHandler.withValidator({
  body: z.object({ name: z.string(), count: z.number() }),
})(async (c, { body }) => {
  return { id: ${i}, name: body.name, count: body.count }
})
`,
      )
      calls.push(
        `  { const data = await fetch('/api/r${i}', { method: 'POST', body: { name: 'x', count: 1 } }); out.push(data.count) }`,
      )
    }
  }
  mkdirSync(join(dir, 'routes'), { recursive: true })
  write(
    join(dir, 'src/bench/api.ts'),
    `import { fetch } from 'void/client'

export async function callAll(): Promise<number[]> {
  const out: number[] = []
${calls.join('\n')}
  return out
}
`,
  )
}

// ----------------------------------------------------------------- Hono ----

function honoRoute(i: number): string {
  return isGet(i)
    ? `.get('/api/r${i}/:id', (c) => c.json({ id: c.req.param('id'), name: 'r${i}', n: ${i} }))`
    : `.post('/api/r${i}', zValidator('json', z.object({ name: z.string(), count: z.number() })), (c) => {
    const body = c.req.valid('json')
    return c.json({ id: ${i}, name: body.name, count: body.count })
  })`
}

function honoCall(i: number): string {
  return isGet(i)
    ? `  { const res = await client.api.r${i}[':id'].$get({ param: { id: '1' } }); if (res.ok) { const data = await res.json(); out.push(data.n) } }`
    : `  { const res = await client.api.r${i}.$post({ json: { name: 'x', count: 1 } }); if (res.ok) { const data = await res.json(); out.push(data.count) } }`
}

const HONO_SPLIT_SIZE = 10

function generateHono(n: number, dir: string, split: boolean): void {
  rmSync(join(dir, 'src'), { recursive: true, force: true })
  const head = `import { Hono } from 'hono'\nimport { zValidator } from '@hono/zod-validator'\nimport { z } from 'zod'\n`
  if (!split) {
    const chain = Array.from({ length: n }, (_, i) => `  ${honoRoute(i)}`).join('\n')
    write(join(dir, 'src/app.ts'), `${head}\nconst app = new Hono()\n${chain}\n\nexport type AppType = typeof app\nexport default app\n`)
  } else {
    // One sub-router per HONO_SPLIT_SIZE endpoints, mounted with a chained
    // app.route() — the shape Hono's docs give for larger apps.
    const groups = Math.ceil(n / HONO_SPLIT_SIZE)
    const imports: string[] = []
    const mounts: string[] = []
    for (let g = 0; g < groups; g++) {
      const chain: string[] = []
      for (let i = g * HONO_SPLIT_SIZE; i < Math.min(n, (g + 1) * HONO_SPLIT_SIZE); i++) chain.push(`  ${honoRoute(i)}`)
      write(join(dir, `src/routes/g${g}.ts`), `${head}\nexport const g${g} = new Hono()\n${chain.join('\n')}\n`)
      imports.push(`import { g${g} } from './routes/g${g}.js'`)
      mounts.push(`  .route('/', g${g})`)
    }
    write(
      join(dir, 'src/app.ts'),
      `import { Hono } from 'hono'\n${imports.join('\n')}\n\nconst app = new Hono()\n${mounts.join('\n')}\n\nexport type AppType = typeof app\nexport default app\n`,
    )
  }
  const calls = Array.from({ length: n }, (_, i) => honoCall(i)).join('\n')
  write(
    join(dir, 'src/client.ts'),
    `import { hc } from 'hono/client'
import type { AppType } from './app.js'

const client = hc<AppType>('/')

export async function callAll(): Promise<unknown[]> {
  const out: unknown[] = []
${calls}
  return out
}
`,
  )
}

export function generate(stack: Stack, n: number, dir: string): void {
  if (!existsSync(dir)) throw new Error(`project not prepared: ${dir} (run typecheck/setup.sh)`)
  if (stack === 'guren') generateGuren(n, dir)
  else if (stack === 'void') generateVoid(n, dir)
  else generateHono(n, dir, stack === 'hono-split')
}

if (import.meta.main) {
  const [stack, count, dir] = process.argv.slice(2)
  if (!STACKS.includes(stack as Stack) || !count || !dir) {
    console.error('usage: bun typecheck/generate.ts <guren|void|hono-chain|hono-split> <N> <projectDir>')
    process.exit(1)
  }
  generate(stack as Stack, Number(count), dir)
}
