#!/usr/bin/env python3
"""Where the tokens go: the per-ticket table and breakdowns in AGENT-EVAL-VOID.md.

Usage: python3 harness/analyze.py [ticket ...]   (default: the five Stage 2 tickets)

Reads results/<ticket>/<arm>-<model>-<trial>.{result.json,verdict.json,patch,stream.jsonl}.
Event streams are gitignored; unpack the release tarball first.

Sections:
  1. per-ticket table: pass, turns, median input/output tokens, cost, wall time,
     cells whose patch adds or edits a test file
  2. tool output size by category (what the agent read back into context)
  3. PostToolUse hook blocks, grouped by message
  4. reads of framework dist under node_modules, with grep patterns
  5. cells where a failing `bun test` was followed by a source edit
  6. context growth: the largest per-call jumps in one cell per arm
"""
import collections
import glob
import json
import os
import re
import statistics as st
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULTS = os.path.join(ROOT, 'results')
TICKETS = sys.argv[1:] or ['post-tags', 'comments-moderation', 'post-revisions', 'json-api-tokens', 'scheduled-publish']
TEST_PATH = re.compile(r'/tests?/|\.test\.')
# Files a patch adds that no one wrote by hand: migration SQL and Drizzle
# snapshots, Guren codegen output, lockfiles. Excluded from "added lines".
GENERATED = re.compile(r'(^|/)(db/migrations/|docs/spec/|\.guren/|bun\.lock$|pnpm-lock\.yaml$)|\.gen\.ts$')


def added_lines(patch):
    """Hand-written lines a patch adds (generated files excluded)."""
    n, skip = 0, False
    for line in patch.splitlines():
        if line.startswith('diff --git'):
            path = line.split(' b/', 1)[-1]
            skip = bool(GENERATED.search(path))
        elif line.startswith('+') and not line.startswith('+++') and not skip:
            n += 1
    return n


def cells():
    for t in TICKETS:
        for res in sorted(glob.glob(os.path.join(RESULTS, t, '*.result.json'))):
            base = res[:-len('.result.json')]
            arm = os.path.basename(base).split('-')[0]
            yield t, arm, base


def events(base):
    path = base + '.stream.jsonl'
    if not os.path.exists(path):
        return
    for line in open(path):
        try:
            yield json.loads(line)
        except json.JSONDecodeError:
            continue


def tool_uses(e):
    if e.get('type') != 'assistant':
        return []
    return [c for c in e['message'].get('content', []) if isinstance(c, dict) and c.get('type') == 'tool_use']


def tool_results(e):
    content = e.get('message', {}).get('content') if e.get('type') == 'user' else None
    return [c for c in content if isinstance(c, dict) and c.get('type') == 'tool_result'] if isinstance(content, list) else []


def category(name, inp):
    if name in ('Edit', 'Write', 'MultiEdit'):
        return 'edit-test' if TEST_PATH.search(inp.get('file_path', '')) else 'edit-src'
    if name == 'Bash':
        cmd = inp.get('command', '')
        if re.search(r'\bbun test\b', cmd): return 'run-tests'
        if re.search(r'tsc|typecheck|void prepare', cmd): return 'typecheck'
        if re.search(r'guren (check|gate|audit|doctor|context|routes|make|db)', cmd): return 'guren-cli'
        if 'node_modules' in cmd: return 'read-framework'
        if re.search(r'codegen|db:|migrat|void db', cmd): return 'codegen/migrate'
        return 'bash-read/other'
    if name in ('Read', 'Grep', 'Glob'):
        p = inp.get('file_path') or inp.get('path') or ''
        if 'node_modules' in p: return 'read-framework'
        return 'read-test' if TEST_PATH.search(p) else 'read-src'
    return name


def section_table():
    rows = collections.defaultdict(list)
    for t, arm, base in cells():
        d = json.load(open(base + '.result.json'))
        if d.get('num_turns') is None:  # the session died before its result event
            print(f'(skipped, no result event: {base})', file=sys.stderr)
            continue
        u = d.get('usage', {})
        v = json.load(open(base + '.verdict.json')) if os.path.exists(base + '.verdict.json') else {}
        patch = open(base + '.patch').read() if os.path.exists(base + '.patch') else ''
        tests = any(l.startswith('diff --git') and TEST_PATH.search(l) for l in patch.splitlines())
        rows[(t, arm)].append(dict(
            turns=d.get('num_turns'), cost=d.get('total_cost_usd', 0), ok=v.get('status') == 'PASS',
            inp=u.get('input_tokens', 0) + u.get('cache_creation_input_tokens', 0) + u.get('cache_read_input_tokens', 0),
            out=u.get('output_tokens', 0), wall=d.get('duration_ms', 0) / 1000, tests=tests,
            added=added_lines(patch)))
    print('## 1. Per ticket\n')
    print('| ticket | arm | pass | turns | input tokens (med) | output tokens (med) | cost (med) | wall s (med) | cells with tests | hand-written added lines (med) |')
    print('|---|---|---|---|---|---|---|---|---|---|')
    for t in TICKETS:
        for arm in ('guren', 'void'):
            c = rows.get((t, arm), [])
            if not c: continue
            print(f"| {t} | {arm} | {sum(x['ok'] for x in c)}/{len(c)} | {', '.join(str(x['turns']) for x in c)} | "
                  f"{st.median(x['inp'] for x in c) / 1000:.0f}k | {st.median(x['out'] for x in c) / 1000:.1f}k | "
                  f"${st.median(x['cost'] for x in c):.2f} | {st.median(x['wall'] for x in c):.0f} | "
                  f"{sum(x['tests'] for x in c)}/{len(c)} | {st.median(x['added'] for x in c):.0f} |")
    for arm in ('guren', 'void'):
        c = [x for (t, a), xs in rows.items() if a == arm for x in xs]
        if c:
            print(f"\n{arm}: {sum(x['ok'] for x in c)}/{len(c)} pass, turns median {st.median(x['turns'] for x in c)} "
                  f"(mean {st.mean(x['turns'] for x in c):.1f}), input median {st.median(x['inp'] for x in c) / 1000:.0f}k, "
                  f"cost median ${st.median(x['cost'] for x in c):.3f} (mean ${st.mean(x['cost'] for x in c):.3f}), "
                  f"total ${sum(x['cost'] for x in c):.2f}, hand-written added lines median {st.median(x['added'] for x in c):.0f}")
    print()


def section_streams():
    size = collections.defaultdict(lambda: collections.defaultdict(list))
    calls = collections.defaultdict(lambda: collections.defaultdict(list))
    blocks = collections.defaultdict(collections.Counter)
    dist = collections.defaultdict(collections.Counter)
    test_caught = collections.Counter()
    test_cells = collections.Counter()
    per_cell = []
    for t, arm, base in cells():
        ids, s, n = {}, collections.Counter(), collections.Counter()
        failed_test = fixed_after = ran_tests = False
        for e in events(base):
            if e.get('subtype') == 'hook_response' and e.get('hook_event') == 'PostToolUse' and e.get('exit_code') == 2:
                lines = (e.get('output') or '').split('\n')
                msg = lines[2] if len(lines) > 2 else lines[0]
                blocks[arm][re.sub(r'[A-Za-z_]+ is not defined', 'X is not defined', msg)[:110]] += 1
            for x in tool_uses(e):
                inp = x.get('input') or {}
                ids[x['id']] = (category(x['name'], inp), inp.get('command', ''))
                n[ids[x['id']][0]] += 1
                blob = json.dumps(inp)
                if 'node_modules/' in blob:
                    for m in re.findall(r'node_modules/(@?[a-z][a-z-]*(?:/[a-z-]+)?)', blob):
                        dist[arm][m] += 1
                if x['name'] in ('Edit', 'Write') and failed_test and not TEST_PATH.search(inp.get('file_path', '')):
                    fixed_after = True
            for r in tool_results(e):
                body = r.get('content')
                body = body if isinstance(body, str) else json.dumps(body)
                cat, cmd = ids.get(r.get('tool_use_id'), ('?', ''))
                s[cat] += len(body)
                if re.search(r'\bbun test\b', cmd):
                    ran_tests = True
                    m = re.search(r'(\d+) fail', body)
                    if m and int(m.group(1)) > 0:
                        failed_test = True
        per_cell.append((arm, s, n))
        if ran_tests:
            test_cells[arm] += 1
            test_caught[arm] += failed_test and fixed_after
    # Average over every cell of the arm, counting a category a cell never used as 0.
    cats = {k for _, s, n in per_cell for k in set(s) | set(n)}
    for arm, s, n in per_cell:
        for k in cats:
            size[arm][k].append(s.get(k, 0))
            calls[arm][k].append(n.get(k, 0))
    print('## 2. Tool output read back into context (mean per cell)\n')
    for arm in size:
        print(f'{arm}:')
        for k, v in sorted(size[arm].items(), key=lambda kv: -st.mean(kv[1])):
            print(f'   {k:18} {st.mean(v):>8.0f} chars   {st.mean(calls[arm][k]):.1f} calls')
    print('\n## 3. PostToolUse blocks (exit 2), by message\n')
    for arm in blocks:
        print(f'{arm}: {sum(blocks[arm].values())} blocks')
        for k, v in blocks[arm].most_common(12):
            print(f'   {v:3}  {k}')
    print('\n## 4. node_modules paths named in tool inputs\n')
    for arm in dist:
        print(f'{arm}: ' + ', '.join(f'{k} {v}' for k, v in dist[arm].most_common(10)))
    print('\n## 5. Failing `bun test` followed by a source edit (as far as the truncated outputs show)\n')
    for arm in test_cells:
        print(f'{arm}: {test_caught[arm]} of {test_cells[arm]} cells that ran tests')
    print()


def section_growth(per_arm=1, threshold=2500):
    print(f'## 6. Context growth: per-call jumps over {threshold} tokens (first cell per arm of the first ticket)\n')
    shown = collections.Counter()
    for t, arm, base in cells():
        if t != TICKETS[0] or shown[arm] >= per_arm:
            continue
        shown[arm] += 1
        print(f'{t} {os.path.basename(base)}:')
        prev, last_tool, seen = None, '', set()
        for e in events(base):
            if e.get('type') != 'assistant':
                continue
            m = e['message']
            u = m.get('usage', {})
            tot = u.get('input_tokens', 0) + u.get('cache_creation_input_tokens', 0) + u.get('cache_read_input_tokens', 0)
            if m.get('id') not in seen:
                seen.add(m.get('id'))
                if prev is None:
                    print(f'   start {tot}')
                elif tot - prev > threshold:
                    print(f'   +{tot - prev:<6} -> {tot:<6} after {last_tool}')
                prev = tot
            for x in tool_uses(e):
                i = x.get('input') or {}
                last_tool = x['name'] + ' ' + (i.get('file_path') or i.get('command') or '').replace('\n', ' ')[-80:]
        print(f'   end {prev}')
    print()


if __name__ == '__main__':
    section_table()
    section_streams()
    section_growth()
