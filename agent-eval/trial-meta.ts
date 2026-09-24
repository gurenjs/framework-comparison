/**
 * Per-cell provenance for run-trial.sh: results/<label>-<trial>.meta.json.
 *
 *   bun trial-meta.ts pre  <meta.json> <app-dir> -- <claude flags...>
 *   bun trial-meta.ts post <meta.json> <stream.jsonl>
 *
 * `pre` runs after the pre-check and before `claude -p`, so the installed
 * versions are the ones the agent starts from (it may `bun add` mid-trial).
 * `post` adds the end timestamp and what the stream's init event says was
 * loaded: the only record that the isolation flags took effect.
 * Context comes from env vars run-trial.sh exports (TRIAL_*).
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

type Json = Record<string, unknown>

const LOCKFILES = ['bun.lock', 'bun.lockb', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']

function readJson(path: string): Json | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Json
  } catch {
    return null
  }
}

function versionAt(path: string): string | null {
  const manifest = readJson(path)
  return typeof manifest?.version === 'string' ? manifest.version : null
}

// Top-level copy plus copies nested one package deep: two copies of a
// framework package typecheck fine and still split runtime state.
function installedCopies(app: string, name: string): Record<string, string | null> {
  const copies: Record<string, string | null> = {}
  const nm = join(app, 'node_modules')
  const top = join(nm, name, 'package.json')
  if (existsSync(top)) copies[`node_modules/${name}`] = versionAt(top)
  if (!existsSync(nm)) return copies
  const parents: string[] = []
  for (const entry of readdirSync(nm)) {
    if (entry.startsWith('.')) continue
    if (entry.startsWith('@')) {
      for (const scoped of readdirSync(join(nm, entry))) parents.push(`${entry}/${scoped}`)
    } else {
      parents.push(entry)
    }
  }
  for (const parent of parents) {
    const nested = join(nm, parent, 'node_modules', name, 'package.json')
    if (existsSync(nested)) copies[`node_modules/${parent}/node_modules/${name}`] = versionAt(nested)
  }
  return copies
}

function frameworkVersions(app: string): Json {
  const manifest = readJson(join(app, 'package.json')) ?? {}
  const declared: Record<string, string> = {
    ...((manifest.dependencies as Record<string, string>) ?? {}),
    ...((manifest.devDependencies as Record<string, string>) ?? {}),
  }
  // @guren/server arrives through core, never declared, and is the copy that matters.
  const guren = join(app, 'node_modules', '@guren')
  const probed = new Set(Object.keys(declared))
  if (existsSync(guren)) for (const entry of readdirSync(guren)) probed.add(`@guren/${entry}`)
  const installed: Record<string, Record<string, string | null>> = {}
  for (const name of [...probed].sort()) installed[name] = installedCopies(app, name)
  const lockfiles: Record<string, string> = {}
  for (const lock of LOCKFILES) {
    const path = join(app, lock)
    if (existsSync(path)) lockfiles[lock] = createHash('sha256').update(readFileSync(path)).digest('hex')
  }
  return { declared, installed, lockfile_sha256: lockfiles }
}

function splitList(value: string | undefined): string[] {
  return (value ?? '').split('\n').filter(Boolean)
}

function pre(metaPath: string, app: string, claudeFlags: string[]): void {
  const env = process.env
  const meta: Json = {
    impl: env.TRIAL_IMPL,
    label: env.TRIAL_LABEL,
    trial: Number(env.TRIAL_NUMBER),
    guidance: env.TRIAL_GUIDANCE,
    model_requested: env.TRIAL_MODEL,
    effort: env.TRIAL_EFFORT || 'default',
    claude_version: env.TRIAL_CLAUDE_VERSION,
    ref_requested: env.TRIAL_REF,
    app_commit: env.TRIAL_APP_COMMIT,
    runner_commit: env.TRIAL_RUNNER_COMMIT,
    runner_dirty: env.TRIAL_RUNNER_DIRTY === '1',
    bun_version: env.TRIAL_BUN_VERSION,
    node_version: env.TRIAL_NODE_VERSION,
    baseline_tests: env.TRIAL_BASELINE_TESTS ? Number(env.TRIAL_BASELINE_TESTS) : null,
    isolation: {
      claude_flags: claudeFlags,
      env: splitList(env.TRIAL_ISOLATION_ENV),
    },
    allowed_tools: splitList(env.TRIAL_ALLOWED_TOOLS),
    disallowed_tools: splitList(env.TRIAL_DISALLOWED_TOOLS),
    framework: frameworkVersions(app),
    started_at: new Date().toISOString(),
  }
  writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`)
}

function post(metaPath: string, streamPath: string): void {
  const meta = readJson(metaPath) ?? {}
  let init: Json | null = null
  let result: Json | null = null
  if (existsSync(streamPath)) {
    for (const line of readFileSync(streamPath, 'utf8').split('\n')) {
      let event: Json
      try {
        event = JSON.parse(line) as Json
      } catch {
        continue
      }
      if (event.type === 'system' && event.subtype === 'init' && !init) init = event
      if (event.type === 'result') result = event
    }
  }
  const names = (list: unknown) =>
    Array.isArray(list) ? list.map((item) => (typeof item === 'string' ? item : (item as Json).name)) : null
  meta.ended_at = new Date().toISOString()
  meta.session = init
    ? {
        model: init.model,
        claude_code_version: init.claude_code_version,
        permission_mode: init.permissionMode,
        tools: init.tools,
        mcp_servers: init.mcp_servers,
        plugins: names(init.plugins),
        skills: init.skills,
        slash_commands: init.slash_commands,
        agents: init.agents,
        memory_paths: init.memory_paths,
        output_style: init.output_style,
      }
    : null
  meta.models_used = result?.modelUsage ? Object.keys(result.modelUsage as Json) : null
  writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`)
}

const [mode, metaPath, target, separator, ...rest] = process.argv.slice(2)
if (mode === 'pre' && metaPath && target && separator === '--') pre(metaPath, target, rest)
else if (mode === 'post' && metaPath && target) post(metaPath, target)
else {
  console.error('usage: trial-meta.ts pre <meta> <app-dir> -- <flags...> | post <meta> <stream>')
  process.exit(2)
}
