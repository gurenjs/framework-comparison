#!/usr/bin/env bash
# regrade-extras.sh <results dir> <guren base> <out tsv>
# Re-grades every saved Stage 2 patch in <results dir> against the extras
# (tests/extras/<task>.robustness.test.ts); appends
# "<cell>\t<graded pass/fail>\t<extra pass>\t<extra fail>\t<failing extra names>" to <out tsv>.
set -uo pipefail
SUITE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIR="$1"; BASE="$2"; OUT="$3"
for t in ${TASKS:-post-tags comments-moderation post-revisions json-api-tokens scheduled-publish}; do
  for p in "$DIR/$t"/*.patch; do
    cell="$t/$(basename "$p" .patch)"
    grep -q "^$cell	" "$OUT" 2>/dev/null && continue
    arm="$(basename "$p" | cut -d- -f1)"
    log="$(env GUREN_BASE="$BASE" bash "$SUITE/run-extras-on.sh" "$arm" "$t" "$p" 2>&1)"
    graded="$(sed '/^--- extra/,$d' <<<"$log" | grep -E '^ *[0-9]+ (pass|fail)$' | tr -s ' ' | tr '\n' ' ')"
    extra="$(sed -n '/^--- extra/,$p' <<<"$log")"
    ep="$(grep -E '^ *[0-9]+ pass$' <<<"$extra" | tr -dc 0-9)"; ef="$(grep -E '^ *[0-9]+ fail$' <<<"$extra" | tr -dc 0-9)"
    names="$(grep -E '^\(fail\)' <<<"$extra" | sed 's/^(fail) //; s/ \[[0-9.]*ms\]$//' | tr '\n' '|')"
    printf '%s\t%s\t%s\t%s\t%s\n' "$cell" "$graded" "${ep:-0}" "${ef:-?}" "$names" >> "$OUT"
  done
done
