## 1. Per ticket

| ticket | arm | pass | turns | input tokens (med) | output tokens (med) | cost (med) | wall s (med) | cells with tests | hand-written added lines (med) |
|---|---|---|---|---|---|---|---|---|---|
| post-tags | guren | 3/3 | 24, 23, 24 | 1159k | 11.1k | $0.56 | 167 | 3/3 | 214 |
| post-tags | void | 3/3 | 15, 10, 13 | 422k | 5.9k | $0.22 | 67 | 0/3 | 121 |
| comments-moderation | guren | 3/3 | 33, 21, 23 | 1131k | 10.9k | $0.55 | 141 | 3/3 | 296 |
| comments-moderation | void | 3/3 | 24, 24, 19 | 582k | 8.2k | $0.30 | 91 | 0/3 | 178 |
| post-revisions | guren | 3/3 | 19, 18, 15 | 450k | 5.7k | $0.30 | 171 | 0/3 | 125 |
| post-revisions | void | 3/3 | 20, 24, 15 | 385k | 6.6k | $0.21 | 74 | 0/3 | 104 |
| json-api-tokens | guren | 3/3 | 42, 39, 46 | 1959k | 14.4k | $0.86 | 375 | 3/3 | 320 |
| json-api-tokens | void | 3/3 | 17, 23, 15 | 431k | 8.1k | $0.27 | 124 | 0/3 | 205 |
| scheduled-publish | guren | 3/3 | 17, 16, 22 | 802k | 7.8k | $0.38 | 154 | 2/3 | 103 |
| scheduled-publish | void | 3/3 | 24, 14, 19 | 518k | 6.6k | $0.25 | 82 | 0/3 | 67 |

guren: 15/15 pass, turns median 23 (mean 25.5), input median 1125k, cost median $0.550 (mean $0.534), total $8.02, hand-written added lines median 214

void: 15/15 pass, turns median 19 (mean 18.4), input median 467k, cost median $0.254 (mean $0.256), total $3.85, hand-written added lines median 121

## 2. Tool output read back into context (mean per cell)

guren:
   codegen/migrate       19663 chars   2.5 calls
   read-framework         8908 chars   2.4 calls
   bash-read/other        6942 chars   3.3 calls
   read-src               2301 chars   0.9 calls
   run-tests              2117 chars   2.3 calls
   edit-src               1404 chars   8.2 calls
   typecheck              1359 chars   1.5 calls
   guren-cli               900 chars   2.1 calls
   edit-test               238 chars   1.2 calls
void:
   read-framework        14534 chars   4.3 calls
   codegen/migrate        6866 chars   2.2 calls
   edit-src               1195 chars   7.3 calls
   bash-read/other         898 chars   1.3 calls
   typecheck               671 chars   2.1 calls
   read-src                124 chars   0.1 calls
   edit-test                 0 chars   0.0 calls
   run-tests                 0 chars   0.0 calls
   guren-cli                 0 chars   0.0 calls

## 3. PostToolUse blocks (exit 2), by message

guren: 33 blocks
     9  - Route graph: Skipped: the route graph failed to load: X is not defined. Agent manifest, route contract and a
     7  - Route graph: Skipped: the route graph failed to load: callback is not a function. (In 'callback(this.router)
     3  - db/schema.ts:1:38: Identifier 'primaryKey' is imported but never used. [Warning/eslint(no-unused-vars)]
     3  - Route graph: Skipped: the route graph failed to load: ResolveMessage: Cannot find module '../app/Http/Contro
     3  - routes/api.ts wiring: routes/api.ts exports a route registrar that nothing reachable from routes/web.ts call
     2  - db/schema.ts:1:38: Identifier 'unique' is imported but never used. [Warning/eslint(no-unused-vars)]
     1  - db/schema.ts:1:38: Identifier 'uniqueIndex' is imported but never used. [Warning/eslint(no-unused-vars)]
     1  - Route graph: Skipped: the route graph failed to load: Export named 'RevisionParamSchema' not found in module
     1  - resources/js/pages/profile/Edit.tsx:27:10: Function 'ApiTokens' is declared but never used. [Warning/eslint(
     1  - tests/ApiTokens.test.ts:4:10: Identifier 'getDatabase' is imported but never used. [Warning/eslint(no-unused
     1  - Route graph: Skipped: the route graph failed to load: BuildMessage: Expected "from" but found "'../app/Http/
     1  - app/Http/Middleware/ApiTokens.ts:6:3: Identifier 'defineMiddleware' is imported but never used. [Warning/esl

## 4. node_modules paths named in tool inputs

void: void/docs 84, void/dist 20, @void/react 3, void/package 1
guren: @guren/server 27, @guren/core 13, @guren 4, @guren/orm 2, @guren/testing 1

## 5. Failing `bun test` followed by a source edit (as far as the truncated outputs show)

guren: 0 of 15 cells that ran tests

## 6. Context growth: per-call jumps over 2500 tokens (first cell per arm of the first ticket)

post-tags guren-claude-sonnet-5-5-1:
   start 37071
   +15492  -> 52563  after Bash ttp/Validators/PostValidator.ts routes/web.ts app/Http/Resources/PostResource.ts
   +7266   -> 59829  after Bash -n '"' | head -30; ls db/seeders; git ls-files | grep -v node_modules | head -80
   +3424   -> 67281  after Edit ees/run-post-tags-guren-claude-sonnet-5-5-1/app/Http/Validators/PostValidator.ts
   +2723   -> 70726  after Bash rite(s) EOF bunx guren codegen 2>&1 | tail -3; bun run typecheck 2>&1 | tail -20
   +4629   -> 80436  after Write /tmp/ve-worktrees/run-post-tags-guren-claude-sonnet-5-5-1/tests/PostTags.test.ts
   end 82009
post-tags void-claude-sonnet-5-5-1:
   start 29902
   +6305   -> 37089  after Bash /*.tsx pages/posts/\[id\]/* db/migrations/*.sql db/migrations/meta/_journal.json
   +2903   -> 45553  after Bash    </Link>             ))}           </p>''') EOF pnpm typecheck 2>&1 | tail -20
   end 45553

