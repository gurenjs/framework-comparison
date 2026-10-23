#!/usr/bin/env python3
"""Round 2: Guren before / Guren after (harness v2) / Void, on the same conditions.

Usage: python3 harness/analyze-round2.py [round2 results dir] [void results dir]
       (defaults: results-round2/, results/; model claude-sonnet-5-5)

Guren arms come from the round-2 directory (lean pages, typecheck-only
definition of done); Void from the round-1 directory, whose app, preamble and
Claude Code version round 2 leaves unchanged. Event streams must be present.
"""
import collections
import glob
import json
import os
import re
import statistics as st
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spend import cost  # noqa: E402  token-priced: Claude Code 2.1.304's total_cost_usd reads ~20% under

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
R2 = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'results-round2')
R1 = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'results')
MODEL = 'claude-sonnet-5-5'
TICKETS = ['post-tags', 'comments-moderation', 'post-revisions', 'json-api-tokens', 'scheduled-publish']
R5 = os.path.join(ROOT, 'results-round5')
ARMS = [('guren', R2, 'Guren before'), ('guren-v2', R2, 'Guren v2'), ('guren-v3', R2, 'Guren v3'), ('guren-v4', R2, 'Guren v4'),
        ('guren-shipped', R5, 'Guren v2.31.0 app'), ('void', R1, 'Void')]
TEST_PATH = re.compile(r'/tests?/|\.test\.')


def cell(base):
    res = json.load(open(base + '.result.json'))
    verdict = json.load(open(base + '.verdict.json')) if os.path.exists(base + '.verdict.json') else {}
    u = res.get('usage', {})
    c = dict(ok=verdict.get('status') == 'PASS', turns=res.get('num_turns') or 0, cost=cost(u, MODEL),
             inp=u.get('input_tokens', 0) + u.get('cache_creation_input_tokens', 0) + u.get('cache_read_input_tokens', 0),
             write=u.get('cache_creation_input_tokens', 0), out=u.get('output_tokens', 0),
             calls=0, first=0, ref=0, nm=0, tests_written=False, test_runs=0, blocks=0)
    seen, ctx = set(), []
    stream = base + '.stream.jsonl'
    for line in open(stream) if os.path.exists(stream) else []:
        try:
            e = json.loads(line)
        except ValueError:
            continue
        if e.get('subtype') == 'hook_response' and e.get('hook_event') == 'PostToolUse' and e.get('exit_code') == 2:
            c['blocks'] += 1
        if e.get('type') != 'assistant' or e.get('parent_tool_use_id'):
            continue
        m = e['message']
        if m['id'] not in seen:
            seen.add(m['id'])
            mu = m.get('usage', {})
            ctx.append(mu.get('input_tokens', 0) + mu.get('cache_creation_input_tokens', 0) + mu.get('cache_read_input_tokens', 0))
        for t in m.get('content') or []:
            if t.get('type') != 'tool_use':
                continue
            blob = json.dumps(t.get('input') or {})
            c['ref'] += 'guren-api/reference' in blob
            c['nm'] += 'node_modules' in blob
            c['test_runs'] += bool(re.search(r'\bbun test\b|\bvitest\b', blob))
            if t['name'] in ('Edit', 'Write') and TEST_PATH.search((t.get('input') or {}).get('file_path', '')):
                c['tests_written'] = True
    c['calls'] = len(ctx)
    c['first'] = ctx[0] if ctx else 0
    c['per_call'] = sum(ctx) / len(ctx) if ctx else 0
    return c


def main():
    rows = collections.defaultdict(list)
    for arm, d, _ in ARMS:
        for t in TICKETS:
            for res in sorted(glob.glob(os.path.join(d, t, f'{arm}-{MODEL}-*.result.json'))):
                rows[(arm, t)].append(cell(res[:-len('.result.json')]))
    med = lambda xs, k: st.median(x[k] for x in xs)
    print('| arm | pass | turns (med) | API calls (med) | context at start | context per call (med) | input tokens (med) | cache write (med) | output (med) | cost (med) | cost (total) | cells that wrote tests | reference reads / cell | node_modules reads / cell | PostToolUse blocks |')
    print('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    for arm, _, label in ARMS:
        xs = [x for t in TICKETS for x in rows[(arm, t)]]
        if not xs:
            continue
        print(f"| {label} | {sum(x['ok'] for x in xs)}/{len(xs)} | {med(xs, 'turns'):.0f} | {med(xs, 'calls'):.0f} | "
              f"{med(xs, 'first') / 1000:.1f}k | {med(xs, 'per_call') / 1000:.1f}k | {med(xs, 'inp') / 1000:.0f}k | "
              f"{med(xs, 'write') / 1000:.0f}k | {med(xs, 'out') / 1000:.1f}k | ${med(xs, 'cost'):.3f} | ${sum(x['cost'] for x in xs):.2f} | "
              f"{sum(x['tests_written'] for x in xs)}/{len(xs)} | {st.mean(x['ref'] for x in xs):.1f} | "
              f"{st.mean(x['nm'] for x in xs):.1f} | {sum(x['blocks'] for x in xs)} |")
    print('\nPer ticket (median cost, turns in run order):\n')
    print('| ticket | ' + ' | '.join(label for _, _, label in ARMS) + ' |')
    print('|---|' + '---|' * len(ARMS))
    for t in TICKETS:
        cells = []
        for arm, _, _ in ARMS:
            xs = rows[(arm, t)]
            cells.append(f"${med(xs, 'cost'):.2f} ({', '.join(str(x['turns']) for x in xs)})" if xs else '-')
        print(f'| {t} | ' + ' | '.join(cells) + ' |')


if __name__ == '__main__':
    main()
