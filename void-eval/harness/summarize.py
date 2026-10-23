#!/usr/bin/env python3
"""Summarize void-eval cells: pass, turns, cost, and verification behaviour.

Usage: python3 harness/summarize.py [--out FILE]

Verification columns count the agent's own Bash commands, not hook output:
  typecheck  tsc / `typecheck` script / `void prepare`
  tests      bun test / vitest / vp test
  gate       guren check|gate|audit|doctor (Guren's own verification CLI)
A cell "verified" when it ran a typecheck at least once AFTER its last edit.
Stop-hook runs/blocks are counted separately: Guren's shipped harness runs its
gate from a Stop hook, which is not something the agent chose to do.
"""
import glob, json, os, statistics, sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from streams import GATE, TESTS, TYPECHECK, events, tool_uses  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULTS = os.path.join(ROOT, 'results')

EDIT_TOOLS = {'Edit', 'Write', 'MultiEdit', 'NotebookEdit'}


def stream_facts(path):
    f = dict(tc_runs=0, tests=0, gate=0, stop_runs=0, stop_blocks=0, docs_reads=0, skill_uses=0,
             agents_md_read=False, verified_after_last_edit=False, denials=0)
    last_edit = last_tc = -1
    seen = set()
    i = 0
    for e in events(path):
        i += 1
        if e.get('type') == 'system' and e.get('subtype') == 'hook_response' and (e.get('hook_event') or e.get('hook_event_name')) == 'Stop':
            f['stop_runs'] += 1
            f['stop_blocks'] += e.get('exit_code') == 2
        if e.get('type') == 'system' and e.get('subtype') == 'permission_denied':
            f['denials'] += 1
        for c in tool_uses(e):
            if c.get('id') in seen:
                continue
            seen.add(c.get('id'))
            name, inp = c.get('name'), c.get('input') or {}
            if name in EDIT_TOOLS:
                last_edit = i
            elif name == 'Bash':
                cmd = inp.get('command', '')
                if TYPECHECK.search(cmd):
                    f['tc_runs'] += 1; last_tc = i
                f['tests'] += bool(TESTS.search(cmd))
                f['gate'] += bool(GATE.search(cmd))
                if 'void/docs' in cmd:
                    f['docs_reads'] += 1
                if 'AGENTS.md' in cmd:
                    f['agents_md_read'] = True
            elif name in ('Read', 'Grep', 'Glob'):
                p = inp.get('file_path') or inp.get('path') or ''
                if 'void/docs' in p or 'void/skills' in p:
                    f['docs_reads'] += 1
                if p.endswith('AGENTS.md'):
                    f['agents_md_read'] = True
            elif name == 'Skill':
                f['skill_uses'] += 1
    f['verified_after_last_edit'] = last_tc > last_edit >= 0
    return f


def med(xs):
    xs = [x for x in xs if x is not None]
    return statistics.median(xs) if xs else None


def main():
    out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else None
    cells = []
    for v in sorted(glob.glob(os.path.join(RESULTS, '*', '*.verdict.json'))):
        base = v[:-len('.verdict.json')]
        verdict = json.load(open(v))
        result = json.load(open(base + '.result.json')) if os.path.exists(base + '.result.json') else {}
        facts = stream_facts(base + '.stream.jsonl') if os.path.exists(base + '.stream.jsonl') else {}
        cells.append({**verdict, 'turns': result.get('num_turns'), 'cost': result.get('total_cost_usd'),
                      'subtype': result.get('subtype'), **facts})

    by_arm = defaultdict(list)
    for c in cells:
        by_arm[(c['model'], c['arm'])].append(c)

    md = ['# void-eval results', '',
          '| model | arm | cells | pass | med turns | med cost (USD) | total cost (USD) | typecheck after last edit | ran typecheck at all | ran tests | guren gate CLI | stop-hook runs / blocks | Void docs reads (med) | Skill uses | denials |',
          '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|']
    for (model, arm), cs in sorted(by_arm.items()):
        n = len(cs)
        md.append('| {} | {} | {} | {}/{} | {} | {} | {:.2f} | {}/{} | {}/{} | {}/{} | {}/{} | {} / {} | {} | {} | {} |'.format(
            model, arm, n, sum(c['status'] == 'PASS' for c in cs), n,
            med([c['turns'] for c in cs]), round(med([c['cost'] for c in cs]) or 0, 2), sum(c['cost'] or 0 for c in cs),
            sum(c.get('verified_after_last_edit', False) for c in cs), n,
            sum(c.get('tc_runs', 0) > 0 for c in cs), n,
            sum(c.get('tests', 0) > 0 for c in cs), n,
            sum(c.get('gate', 0) > 0 for c in cs), n,
            sum(c.get('stop_runs', 0) for c in cs), sum(c.get('stop_blocks', 0) for c in cs),
            med([c.get('docs_reads') for c in cs]), sum(c.get('skill_uses', 0) for c in cs), sum(c.get('denials', 0) for c in cs)))

    md += ['', '## Per cell', '',
           '| task | arm | model | trial | status | typecheck | suite | turns | cost | tc runs | tc after last edit | tests | gate | stop runs/blocks | docs reads | skills | denials |',
           '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|']
    for c in sorted(cells, key=lambda c: (c['task'], c['arm'], c['model'], c['trial'])):
        md.append('| {task} | {arm} | {model} | {trial} | {status} | {typecheck} | {suite} ({suite_summary}) | {turns} | {cost_r} | {tc} | {va} | {tests_n} | {gate_n} | {sr}/{sb} | {dr} | {sk} | {dn} |'.format(
            **c, cost_r=round(c["cost"] or 0, 3), tc=c.get('tc_runs'), va=c.get('verified_after_last_edit'),
            tests_n=c.get('tests'), gate_n=c.get('gate'), sr=c.get('stop_runs'), sb=c.get('stop_blocks'),
            dr=c.get('docs_reads'), sk=c.get('skill_uses'), dn=c.get('denials')))
    text = '\n'.join(md) + '\n'
    if out:
        open(out, 'w').write(text)
    print(text)


if __name__ == '__main__':
    main()
