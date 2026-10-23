#!/usr/bin/env bun
/**
 * Stop hook (Claude Code and Codex share this contract): when the agent ends a
 * turn with uncommitted changes in this app, run `guren gate` (the CI stages:
 * codegen, typecheck, lint, check, audit, test) and block the stop with the
 * findings (exit 2, stderr), so the fix happens in this turn rather than in CI.
 * Then, while `guren plan:next` has marked a plan step, verify it and block until it
 * is verified or the hook gives up (RFC 0030 §7), which it says on stderr.
 */
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

interface HookInput {
  /** Sent by every host speaking this contract; `true` once a Stop hook already blocked this stop. */
  stop_hook_active?: boolean
  /** The session's cwd, which follows the agent's `cd` and a worktree it entered. */
  cwd?: string
}

let input: HookInput
try {
  input = JSON.parse(await Bun.stdin.text()) as HookInput
} catch {
  process.exit(0)
}
// A host that does not send the field loaded this config as a foreign one and
// would be gated on every stop: Cursor reads .claude/settings.json hooks too, and
// its own hook in .cursor/hooks.json owns the turn there.
if (typeof input.stop_hook_active !== 'boolean') {
  process.exit(0)
}

let cli: typeof import('@guren/cli')
try {
  cli = await import('@guren/cli')
} catch {
  // An unrunnable gate is not a passed one.
  console.error('guren gate could not run: @guren/cli is not resolvable from this app (run `bun install`).')
  process.exit(2)
}

/**
 * The app to gate: the nearest ancestor of the session cwd holding this script at
 * its own path, else the script's grandparent (`<app>/.claude/hooks/`, `.codex/hooks/`).
 * Claude Code runs the project dir's copy while the cwd may be a subdirectory or a
 * worktree it entered, whose tree is the one to judge; a monorepo app is not the git root.
 */
function appRoot(cwd: unknown): string {
  const installed = resolve(import.meta.dir, '../..')
  const self = relative(installed, import.meta.path)
  if (typeof cwd === 'string' && isAbsolute(cwd)) {
    for (let dir = cwd; ; dir = dirname(dir)) {
      if (existsSync(join(dir, self))) return dir
      if (dirname(dir) === dir) break
    }
  }
  return installed
}

const root = appRoot(input.cwd)

// The gate blocks once per stop; the plan step counts its own continuations in state.
if (!input.stop_hook_active) {
  const findings = await cli.stopGateFindings(root)
  // Eval overlay of gurenjs 83e8f4570 for @guren/cli 2.31.1, which exports no runAudit:
  // authorization and force-write warnings on this session's files ride on the one block.
  const warnings = changedAuditWarnings(root)
  const warningLines = warnings.length === 0 ? [] : [
    `guren audit warns on files this change touched${findings === null ? ' (the gate passed)' : ''}:`,
    ...warnings.map((warning) => `- ${warning}`),
    'Fix them; `bunx guren audit` says how to record a deliberate exception.',
  ]
  if (findings !== null || warningLines.length > 0) {
    console.error([...(findings === null ? [] : [findings]), ...warningLines].join('\n'))
    process.exit(2)
  }
}

function changedAuditWarnings(app: string): string[] {
  const status = Bun.spawnSync(['git', 'status', '--porcelain', '--untracked-files=all', '--', '.'], { cwd: app })
  const changed = new Set(
    status.stdout.toString().split('\n').filter(Boolean).map((line) => line.slice(3).split(' -> ').pop()!.trim()),
  )
  if (changed.size === 0) return []
  const audit = Bun.spawnSync(['bunx', 'guren', 'audit', '--json'], { cwd: app })
  let report: { findings?: Array<{ key: string; status: string; title: string; message: string; filePath?: string }> }
  try {
    report = JSON.parse(audit.stdout.toString())
  } catch {
    return []
  }
  return (report.findings ?? [])
    .filter((finding) => finding.status === 'warn' && finding.filePath !== undefined && changed.has(finding.filePath))
    .filter((finding) => ['policy:', 'force-write-request-data:'].some((key) => finding.key.startsWith(key)))
    .map((finding) => `${finding.title}: ${finding.message}`)
}

const plan = await cli.planStopHookFindings(root, { stopHookActive: input.stop_hook_active })
if (plan.message) {
  console.error(plan.message)
}
process.exit(plan.block ? 2 : 0)
