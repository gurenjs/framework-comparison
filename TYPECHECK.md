# Typecheck Benchmark: Guren codegen vs Void vs Hono RPC

How does `tsc` cost grow as an app gains API routes? Hono RPC carries route
types through one inferred `typeof app`, so every route widens the type every
client call re-reads. Void ([`void@1.1.11`](https://www.npmjs.com/package/void))
generates a route map into `.void/`, and the
[measurement by ashunar0](https://ashunar0.dev/posts/try-void) put it at 38万
instantiations / 0.06 s for 500 APIs against 999万 / 1.59 s for Hono RPC.
Guren also generates flat types (`.guren/routes.gen.ts`, `api-client.gen.ts`,
`pages.gen.ts`) instead of inferring through Hono, so it should land near
Void. This benchmark measures all three under one set of conditions.

**Result: Guren is in Void's class, not Hono RPC's.** At 500 endpoints Guren
adds 396k instantiations to Void's 351k (1.13×), against 4.87M for a chained
Hono RPC app (12× Guren). Both codegen stacks grow linearly (~790 vs ~700
instantiations per endpoint); Hono RPC grows superlinearly. Check time is
where Guren trails Void: +0.33 s against +0.22 s, and the attribution below
traces that to one file, the routes registrar, rather than to the generated
types.

## Results

<!-- typecheck:results:begin -->
Instantiations / Check time, as the increase over each stack's own 0-route app. Median of 3 runs, darwin-arm64, TypeScript 7.0.2.

| Stack | Baseline (0 routes) | 100 routes | 300 routes | 500 routes |
|---|---|---|---|---|
| Guren (codegen) | 8,081 / 0.011s | +86k / +0.063s | +241k / +0.189s | +396k / +0.334s |
| Void 1.1.11 | 1 / 0.000s | +77k / +0.051s | +214k / +0.124s | +351k / +0.216s |
| Hono RPC (one chain) | 141,015 / 0.053s | +459k / +0.158s | +2145k / +0.893s | +4872k / +2.270s |
| Hono RPC (10-route sub-routers) | 141,015 / 0.044s | +617k / +0.175s | +1572k / +0.710s | +2633k / +1.837s |

Instantiations per endpoint at 500: Guren (codegen): 791 · Void 1.1.11: 703 · Hono RPC (one chain): 9,743 · Hono RPC (10-route sub-routers): 5,265.
<!-- typecheck:results:end -->

The absolute numbers are not comparable to the article's: its route shapes
and machine differ (its Void line is 38万 / 0.06 s, its Hono line 999万 /
1.59 s). The claim here is the ratio under identical conditions.
Splitting Hono into sub-routers helps only past ~300 endpoints; at 100 the
extra `app.route()` layers cost more than the shorter chains save.

## Where the cost sits

<!-- typecheck:ablation:begin -->
N = 500, median of 3 runs, increase over the 0-route app.

| Stack | Variant | What is removed | Instantiations | Check time |
|---|---|---|---|---|
| Guren (codegen) | `full` | N endpoints, api client + route() + typed &lt;Link> consumers | +396k | +0.301s |
| Guren (codegen) | `server-only` | no client consumer files (routes, controllers, contracts, generated files only) | +236k | +0.276s |
| Guren (codegen) | `no-links` | drop Links.tsx (typed &lt;Link> + route()) | +295k | +0.281s |
| Guren (codegen) | `no-api-client` | drop api.ts (createApiClient().request()) | +337k | +0.286s |
| Guren (codegen) | `no-href-union` | types/generated/routes.d.ts: RoutePath union → string (Inertia href augmentation) | +396k | +0.296s |
| Guren (codegen) | `no-contract-augmentation` | routes.gen.ts: drop `declare module '@guren/core'` (validated() untyped) | +384k | +0.303s |
| Void 1.1.11 | `full` | N endpoints + typed fetch consumer | +351k | +0.197s |
| Void 1.1.11 | `server-only` | no typed fetch consumer | +100k | +0.049s |
| Hono RPC (one chain) | `full` | N endpoints + hc client consumer | +4872k | +2.264s |
| Hono RPC (one chain) | `server-only` | no hc client consumer | +1975k | +0.693s |
<!-- typecheck:ablation:end -->

The two codegen stacks put their cost on opposite sides:

| At 500 endpoints | Guren | Void |
|---|---|---|
| Server side (routes, handlers, contracts, generated files) | +236k | +100k |
| Typed API calls, 500 of them | +59k (118 per call) | +251k (502 per call) |
| Typed `route()` helper, 500 calls | +36k | n/a |
| Typed `<Link>`, 500 elements | +65k | n/a |

- **Guren's client side is the cheaper one.** `createApiClient<ApiRoutes>().request()`
  resolves against a flat interface of literal types, about a quarter of what
  Void's typed `fetch` pays per call. Void's `RouteMap` entries are
  `typeof import("../routes/...")["GET"]["__output"]` wrapped in `Serialize<>`
  and `ExtractInput<>`, so every call site re-infers the handler and its
  validator.
- **With the same consumer on both sides** (API calls only, the `no-links`
  row), Guren adds 295k instantiations to Void's 351k, 16% fewer.
- **The generated `.guren/*.gen.ts` declarations are cheap.** Removing the
  `GurenRouteContracts` augmentation that types `this.validated()` saves 12k.
- **The generated Inertia `href` union has no effect at all.**
  `types/generated/routes.d.ts` augments `BaseInertiaLinkProps` in
  `@inertiajs/react`, but in `@inertiajs/react` 3.9.1 that interface is not
  exported (it is local to `types/Link.d.ts`), so the augmentation declares a
  new, unrelated interface. `<Link href="/nope">` typechecks in the scaffold,
  and 500 extra `<Link href={route(...)}>` elements add only 6.5k
  instantiations because `href` is still `string`. Replacing the union with
  `string` (`no-href-union`) therefore changes nothing. The `Router`
  augmentation in the same file only adds overloads beside Inertia's own
  `string` ones, so it does not narrow `router.visit()` either.

### Why Guren's check time is higher

tsgo checks files on four checkers in parallel, and one file is always checked
by one checker. Guren's server-side cost is concentrated in `routes/bench.ts`,
which registers all 500 routes; the trace (`tsc --generateTrace`) shows that
file alone taking ~350 ms of checking (traced, so slower than an untraced
run), while the 500 controller files together took ~140 ms spread over the
four checkers in a one-off trace (not recorded in the JSON files). The registrar is what sets the wall-clock check time. Void's cost is spread over 500 route files plus one client file.

What makes the registrar expensive is the zod schemas in the route contracts.
Every Guren endpoint in this benchmark references two schemas from its
contract (`params` or `body`, plus `output` so the client gets a typed
response), so the registrar refers to 1,000 `z.object(...)` declarations.
TypeScript has to infer each of them to type the argument, and because checkers
do not share a type cache, the registrar's checker infers them again even
though the controller files' checkers already did (a one-off `--checkers 1` run,
not recorded in the JSON files, dropped the full app from 404k to 360k
instantiations). Void needs a schema only for the
250 POST bodies and infers responses from the handler's return type.

<!-- typecheck:experiments:begin -->
Guren, N = 500, full app (server + client), median of 5 runs. Deltas are against the first row. The last column is the slowest routes file's own check time under `--generateTrace` (traced runs are slower than untraced ones).

| Variant | Instantiations | Check time | routes file |
|---|---|---|---|
| as generated: { name, params\|body, output } | 403,816 (+0k) | 0.308s (+0.000s) | 418 ms |
| no output schema | 342,058 (-62k) | 0.228s (-0.080s) | 247 ms |
| name only in options | 276,549 (-127k) | 0.206s (-0.102s) | 139 ms |
| bare [C, action] + .name() | 266,655 (-137k) | 0.214s (-0.094s) | 78 ms |
| split into 10 route files | 405,870 (+2k) | 0.263s (-0.045s) | 70 ms |
| GET without params schema (id read from the path, as Void and Hono do) | 372,737 (-31k) | 0.275s (-0.033s) | 343 ms |
| Router.d.ts: controller overload before inline-handler overload | 388,262 (-16k) | 0.302s (-0.006s) | 318 ms |
| Router.d.ts: controller overload without schema generics | 395,296 (-9k) | 0.330s (+0.022s) | 347 ms |
| Router.d.ts: both | 377,742 (-26k) | 0.281s (-0.027s) | 275 ms |
| Links.tsx: &lt;Link> only (route() calls removed) | 367,518 (-36k) | 0.308s (+0.000s) | 360 ms |
| +500 Inertia &lt;Link href={route(...)}> | 410,357 (+7k) | 0.441s (+0.133s) | 399 ms |
| Links.tsx removed | 302,847 (-101k) | 0.310s (+0.002s) | 339 ms |
<!-- typecheck:experiments:end -->

Reading the experiments:

Instantiations are exact; the check-time column was measured while other
work shared the machine, so treat differences under ~0.03 s (and the
`<Link href>` row's check time) as noise.

- **Contract schemas in the registrar are the largest single item**: removing
  all of them from the route options (`bare [C, action]`) saves 137k
  instantiations and ~0.1 s; the output schemas alone are 62k and ~0.08 s.
  Keeping them is what makes the API client typed, so this row bounds what a
  different placement of the schemas could save, not something to switch off.
- **Guren carries 250 schemas the other stacks do not.** The GET endpoints
  declare `params: z.object({ id: z.string() })` so the controller can read
  `this.validated().params`; Void and Hono type `:id` from the path. Dropping
  it (and reading the id with `this.ctx.req.param('id')`) saves 31k
  instantiations, which narrows Guren's total to 365k against Void's 351k.
- **Splitting the registrar into 10 files** leaves instantiations unchanged (the
  routes-file column then shows the slowest of the ten) and
  cuts check time by 0.05 s (15%), because the work spreads over the checkers.
- **The Router overloads cost a little on top.** A controller route with a
  contract first tries the inline-handler overload (inferring four schema type
  parameters) before matching the controller one. Putting the controller
  overload first and dropping its unused schema type parameters saves 26k
  instantiations (6%) and 0.03 s. Measured by patching the installed
  `Router.d.ts`; overload behaviour (error messages, inline handler inference)
  was not re-verified.

## What to change in gurenjs

In order of measured effect at 500 endpoints:

1. **Let a contract's schemas be inferred once, next to the action.** The
   registrar is the one file that touches every schema, so it pays for all of
   them on one checker. Declaring the contract beside the controller action
   (for example a static contract map on the controller, read by both the
   router and codegen) would leave the registrar referencing classes only. The
   `bare [C, action]` row (−137k, ~−0.1 s) is the upper bound. This changes the
   routing API, so it needs an RFC.
2. **Have `make:feature` write `routes/<collection>.ts`** and register it from
   `routes/web.ts`, the shape `plan:scaffold` already uses, instead of
   appending to `routes/web.ts`. Same instantiations, −15% check time, no API
   change.
3. **Reorder the `Router` overloads** in `packages/server/src/mvc/Router.ts`
   so the `(path, options, [Controller, action])` overload precedes the
   `TypedRouteHandler` one, and drop the schema type parameters it never reads.
   −26k (−6%), −0.03 s. Needs the router's type tests to confirm inline
   handlers still infer their input.
4. **Fix or drop the Inertia `href` augmentation** in
   `types/generated/routes.d.ts`. It is generated on every codegen and has no
   effect with `@inertiajs/react` 3.x (see above). Making it work means
   augmenting an exported type, or shipping a typed `Link` wrapper; either
   way it will add instantiations that this benchmark does not count today.
5. **Prefer `resource` hints over `output` schemas** where a Resource exists:
   codegen reads the hint as a type, so no zod output schema is inferred. The
   `no output schema` row (−62k, ~−0.08 s) is the ceiling for this app's shape.

Not worth changing on this evidence: the generated `.guren/*.gen.ts` types
and the contract augmentation.

## Conditions

- **Endpoints.** Endpoint *i* is the same on every stack: even *i* is
  `GET /api/r{i}/:id` returning `{ id: string; name: string; n: number }`, odd
  *i* is `POST /api/r{i}` with a zod body `{ name: string; count: number }`
  returning `{ id: number; name: string; count: number }`. "500 routes" means
  500 endpoints on 500 paths.
- **Guren.** The published `create-guren-app@1.18.4` default blueprint
  (`@guren/core` 1.24.0, `@guren/cli` 2.31.1). Each endpoint is a controller
  file (`app/Http/Controllers/Bench/R{i}Controller.ts`) reading its input with
  `this.validated()`, registered from `routes/bench.ts` (called by
  `routes/web.ts`) with a contract `{ name, params | body, output }`, then
  `bunx guren codegen --force`. The client files call every endpoint through
  `createApiClient<ApiRoutes>().request()`, and render a typed `<Link>`
  (`createTypedLink(routeManifest)`) whose child is a `route()` call.
- **Void.** `void@1.1.11`, one file per path under `routes/api/` exporting
  `GET` via `defineHandler` or `POST` via `defineHandler.withValidator({ body })`,
  then `void prepare` for `.void/routes.d.ts`. The client calls every endpoint
  through `fetch` from `void/client`. tsconfig extends `.void/tsconfig.json`.
- **Hono RPC.** `hono@4.13.13` (the version Void installs) with
  `@hono/zod-validator@0.9.1`. *One chain*: every route on one
  `new Hono().get(...).post(...)` chain. *Sub-routers*: one `new Hono()` chain
  per 10 endpoints, mounted with chained `app.route('/', gN)`. The client calls
  every endpoint through `hc<AppType>` and reads `res.json()` under `res.ok`.
- **Schemas per endpoint differ.** Guren: `params` (GET) or `body` (POST),
  plus `output`, so 1,000 zod schemas at 500 endpoints. Void and Hono: the
  250 POST bodies only, with path params typed from the path and responses
  inferred from the handler. The `output` schema is what types Guren's
  client response; the `params` schema is not needed for that, and the
  experiments include a row without it.
- **`pages.gen.ts` does not grow.** API endpoints add no pages, so
  `.guren/pages.gen.ts` stays the scaffold's and sits in the 0-route
  baseline; page-count scaling is not measured here.
- **Everything consumes the types.** Each client call reads a property off the
  typed response (`data.n` / `data.count`), and a wrong body or a missing
  property was confirmed to be a type error on Guren and Void before measuring.
- **Shared.** TypeScript 7.0.2 (native), zod 4.6.7, `strict`, `skipLibCheck`,
  `tsc --noEmit --extendedDiagnostics`, default checker count. Each stack's
  numbers are relative to its own 0-route app, so scaffold size does not count.
  Medians of 3 runs. Void's 0-route app has nothing to check (1
  instantiation), so its increase also carries zod's first use; Guren's
  scaffold does not import zod either, so both pay it inside the increase. Instantiations are deterministic; check time varies by a
  few hundredths of a second between runs.

## Reproduce

```bash
typecheck/setup.sh                 # scaffolds and installs the four apps into typecheck/.work/
bun typecheck/run.ts               # results.json  (STACKS=, COUNTS=, RUNS= to narrow)
bun typecheck/ablate.ts            # ablation.json
bun typecheck/experiments.ts       # experiments.json (Guren only)
bun typecheck/report.ts            # regenerates the tables above
```

`typecheck/generate.ts <stack> <N> <dir>` writes one app's routes and client
on its own, for poking at a single size.
