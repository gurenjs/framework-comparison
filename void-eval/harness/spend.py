#!/usr/bin/env python3
"""Real API-equivalent spend of result files, priced per model (Claude Code 2.1.289
prices claude-haiku-5-5 at Sonnet rates, so total_cost_usd is not used for Haiku).

Usage: python3 harness/spend.py <results dir> [...]"""
import glob, json, os, sys

# $ per token: input, 1h cache write, cache read, output (claude-api skill, 2026-10-06; cache multipliers 2x / 0.1x).
PRICE = {'claude-sonnet-5-5': (2e-6, 4e-6, 0.2e-6, 10e-6), 'claude-haiku-5-5': (0.1e-6, 0.2e-6, 0.01e-6, 0.5e-6)}


def cost(usage, model):
    """API-equivalent dollars of one result's usage."""
    i, w, r, o = PRICE[model]
    return (usage.get('input_tokens', 0) * i + usage.get('cache_creation_input_tokens', 0) * w
            + usage.get('cache_read_input_tokens', 0) * r + usage.get('output_tokens', 0) * o)


if __name__ == '__main__':
    total = 0.0
    for d in sys.argv[1:]:
        for f in glob.glob(os.path.join(d, '*', '*.result.json')):
            model = next((m for m in PRICE if m in f), None)
            if model:
                total += cost(json.load(open(f)).get('usage') or {}, model)
    print(f'{total:.2f}')
