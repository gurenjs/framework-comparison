#!/usr/bin/env python3
"""Rounds 3–4: hidden defects, per defect class, model and arm.

Usage: python3 harness/analyze-defects.py   (reads results-round{3,4}/EXTRAS.tsv and verdicts)
A cell fixed the defect when no failing extra is a "(hidden defect)" check.
"""
import collections, glob, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIND = {'-authz': ('update authorization', 'yes'), '-dauthz': ('delete authorization', 'yes'),
        '-eauthz': ('edit page authorization (GET)', 'no'), '-mass': ('mass-assignable authorId', 'no')}
rows = collections.defaultdict(lambda: [0, 0, 0, 0])  # cells, graded pass, defect fixed, both
for rnd in ('results-round3', 'results-round4'):
    tsv = os.path.join(ROOT, rnd, 'EXTRAS.tsv')
    if not os.path.exists(tsv):
        continue
    for line in open(tsv):
        cell, graded, _, _, names = (line.rstrip('\n').split('\t') + [''] * 5)[:5]
        task, name = cell.split('/')
        arm, model = name.split('-claude-')
        model = 'claude-' + model.rsplit('-', 1)[0]
        kind = next(v for k, v in KIND.items() if task.endswith(k))
        verdict = json.load(open(os.path.join(ROOT, rnd, task, name + '.verdict.json')))
        ok = verdict.get('status') == 'PASS'
        fixed = '(hidden defect)' not in names
        r = rows[(kind, model, 'Guren v4' if arm.startswith('guren') else 'Void')]
        r[0] += 1; r[1] += ok; r[2] += fixed; r[3] += ok and fixed
print('| defect | Guren detector | model | arm | defect fixed | graded tests pass | both |')
print('|---|---|---|---|---|---|---|')
for (kind, model, arm), (n, ok, fixed, both) in sorted(rows.items()):
    print(f'| {kind[0]} | {kind[1]} | {model.replace("claude-", "")} | {arm} | {fixed}/{n} | {ok}/{n} | {both}/{n} |')
