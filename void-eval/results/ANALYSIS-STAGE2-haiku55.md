## 1. Per ticket

| ticket | arm | pass | turns | input tokens (med) | output tokens (med) | cost (med) | wall s (med) | cells with tests | hand-written added lines (med) |
|---|---|---|---|---|---|---|---|---|---|
| post-tags | guren | 3/3 | 70, 65, 58 | 4455k | 40.8k | $2.52 | 202 | 3/3 | 297 |
| post-tags | void | 3/3 | 41, 44, 35 | 1873k | 22.6k | $1.26 | 118 | 0/3 | 139 |
| comments-moderation | guren | 3/3 | 39, 41, 56 | 2621k | 35.1k | $1.89 | 173 | 3/3 | 399 |
| comments-moderation | void | 3/3 | 42, 49, 32 | 1894k | 22.9k | $1.37 | 119 | 0/3 | 218 |
| post-revisions | guren | 3/3 | 31, 34, 27 | 1993k | 18.4k | $1.28 | 99 | 3/3 | 271 |
| post-revisions | void | 3/3 | 24, 30, 30 | 1110k | 14.7k | $0.90 | 75 | 0/3 | 114 |
| json-api-tokens | guren | 3/3 | 52, 56, 44 | 4542k | 42.3k | $2.74 | 222 | 3/3 | 369 |
| json-api-tokens | void | 3/3 | 38, 27, 19 | 990k | 21.1k | $1.06 | 104 | 0/3 | 210 |
| scheduled-publish | guren | 3/3 | 58, 61, 53 | 3191k | 32.3k | $2.01 | 174 | 3/3 | 205 |
| scheduled-publish | void | 3/3 | 32, 33, 34 | 1911k | 22.8k | $1.17 | 123 | 0/3 | 83 |

guren: 15/15 pass, turns median 53 (mean 49.7), input median 3191k, cost median $2.011 (mean $2.093), total $31.40, hand-written added lines median 297

void: 15/15 pass, turns median 33 (mean 34.0), input median 1572k, cost median $1.122 (mean $1.140), total $17.10, hand-written added lines median 139

## 2. Tool output read back into context (mean per cell)

guren:
   bash-read/other       23369 chars   4.6 calls
   codegen/migrate       17908 chars   2.6 calls
   read-framework        17207 chars   6.5 calls
   read-src               9279 chars   4.3 calls
   run-tests              4602 chars   4.3 calls
   guren-cli              4112 chars   2.4 calls
   edit-src               3017 chars   16.9 calls
   typecheck              1512 chars   1.3 calls
   edit-test              1121 chars   5.5 calls
   read-test               173 chars   0.2 calls
   Skill                     0 chars   0.0 calls
void:
   read-framework        40039 chars   8.3 calls
   bash-read/other        6799 chars   3.1 calls
   codegen/migrate        6028 chars   2.9 calls
   read-src               3897 chars   4.1 calls
   edit-src               2091 chars   12.8 calls
   typecheck               260 chars   1.5 calls
   Skill                     3 chars   0.1 calls
   read-test                 0 chars   0.0 calls
   run-tests                 0 chars   0.0 calls
   edit-test                 0 chars   0.0 calls
   guren-cli                 0 chars   0.0 calls

## 3. PostToolUse blocks (exit 2), by message

guren: 52 blocks
    12  - routes/api.ts wiring: routes/api.ts exports a route registrar that nothing reachable from routes/web.ts call
     3  - routes/web.ts:3:8: Identifier 'CommentController' is imported but never used. [Warning/eslint(no-unused-vars
     3  - resources/js/pages/posts/Edit.tsx:5:10: Identifier 'fromPublishAtInput' is imported but never used. [Warning
     3  - app/Http/Controllers/PostController.ts:1:22: Identifier 'NotFoundHttpException' is imported but never used. 
     2  - db/schema.ts:1:38: Identifier 'uniqueIndex' is imported but never used. [Warning/eslint(no-unused-vars)]
     2  - Route graph: Skipped: the route graph failed to load: X is not defined. Agent manifest, route contract and a
     2  - resources/js/pages/profile/Edit.tsx:4:8: Identifier 'ApiTokens' is imported but never used. [Warning/eslint(
     2  - resources/js/pages/profile/Edit.tsx:29:10: Function 'ApiTokens' is declared but never used. [Warning/eslint(
     2  - resources/js/pages/posts/Index.tsx:8:10: Identifier 'isScheduled' is imported but never used. [Warning/eslin
     2  - resources/js/pages/posts/Edit.tsx:12:10: Function 'toUtcIso' is declared but never used. [Warning/eslint(no-
     2  - resources/js/pages/posts/New.tsx:5:10: Identifier 'fromLocalInput' is imported but never used. [Warning/esli
     1  - db/schema.ts:1:32: Identifier 'primaryKey' is imported but never used. [Warning/eslint(no-unused-vars)]

## 4. node_modules paths named in tool inputs

guren: @guren/core 73, @guren/server 67, @guren/orm 52, @guren 22, @guren/testing 10, @inertiajs/core 2, @guren/cli 1
void: void/docs 163, void/dist 54, void/package 17, void 14, @void/react 7, drizzle-orm/d 2, zod/index 2, drizzle-orm/sqlite-core 1

## 5. Failing `bun test` followed by a source edit (as far as the truncated outputs show)

guren: 0 of 15 cells that ran tests

## 6. Context growth: per-call jumps over 2500 tokens (first cell per arm of the first ticket)

post-tags guren-claude-haiku-5-5-1:
   start 43854
   +18484  -> 64005  after Read $WT_ROOT/run-post-tags-guren-claude-haiku-5-5-1/routes/web.ts
   +10577  -> 74582  after Read ve-worktrees/run-post-tags-guren-claude-haiku-5-5-1/tests/PostController.test.ts
   +4454   -> 79036  after Bash b-9879df7bfbbc/tool-results/hook-74174f2b-4ec5-458e-943b-ccdb86e985d5-stdout.txt
   +6106   -> 85142  after Read b-9879df7bfbbc/tool-results/hook-74174f2b-4ec5-458e-943b-ccdb86e985d5-stdout.txt
   +6409   -> 91551  after Bash 0; grep -rln "WithRelations" node_modules/@guren/core/dist 2>/dev/null | head -5
   +3717   -> 105902 after Write es/run-post-tags-guren-claude-haiku-5-5-1/app/Http/Controllers/PostController.ts
   +2502   -> 109343 after Edit rktrees/run-post-tags-guren-claude-haiku-5-5-1/resources/js/pages/posts/Show.tsx
   end 133946
post-tags void-claude-haiku-5-5-1:
   start 38166
   +2962   -> 41128  after Bash d/docs/ node_modules/void/docs/*; cat node_modules/void/docs/guide/quickstart.md
   +3219   -> 44347  after Bash \]/edit.server.ts pages/posts/\[id\]/edit.tsx; do echo "==== $f"; cat "$f"; done
   +4777   -> 49124  after Read tmp/ve-worktrees/run-post-tags-void-claude-haiku-5-5-1/pages/posts/[id]/edit.tsx
   +8340   -> 60938  after Bash ; echo ----; cat node_modules/void/docs/guide/pages-routing/actions-and-forms.md
   +6264   -> 67202  after Bash ude=*.md | head -20; echo ----; ls node_modules/void/dist 2>/dev/null | head -50
   +2532   -> 77316  after Edit $WT_ROOT/run-post-tags-void-claude-haiku-5-5-1/lib/posts.ts
   end 86695

