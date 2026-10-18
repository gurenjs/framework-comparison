# void-eval results

| model | arm | cells | pass | med turns | med cost (USD) | total cost (USD) | typecheck after last edit | ran typecheck at all | ran tests | guren gate CLI | stop-hook runs / blocks | Void docs reads (med) | Skill uses | denials |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | guren | 19 | 19/19 | 21 | 0.41 | 8.76 | 17/19 | 19/19 | 19/19 | 8/19 | 19 / 0 | 0 | 0 | 28 |
| claude-sonnet-5-5 | void | 19 | 19/19 | 15 | 0.24 | 4.19 | 19/19 | 19/19 | 0/19 | 0/19 | 0 / 0 | 2 | 0 | 23 |

## Per cell

| task | arm | model | trial | status | typecheck | suite | turns | cost | tc runs | tc after last edit | tests | gate | stop runs/blocks | docs reads | skills | denials |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| api-posts-contract | guren | claude-sonnet-5-5 | 1 | PASS | pass | pass (8 pass  0 fail) | 19 | 0.339 | 1 | False | 3 | 0 | 1/0 | 0 | 0 | 1 |
| api-posts-contract | void | claude-sonnet-5-5 | 1 | PASS | pass | pass (8 pass  0 fail) | 6 | 0.107 | 2 | True | 0 | 0 | 0/0 | 2 | 0 | 1 |
| comments-moderation | guren | claude-sonnet-5-5 | 1 | PASS | pass | pass (8 pass  0 fail) | 33 | 0.56 | 2 | True | 2 | 1 | 1/0 | 0 | 0 | 4 |
| comments-moderation | guren | claude-sonnet-5-5 | 2 | PASS | pass | pass (8 pass  0 fail) | 21 | 0.467 | 2 | True | 2 | 0 | 1/0 | 0 | 0 | 2 |
| comments-moderation | guren | claude-sonnet-5-5 | 3 | PASS | pass | pass (8 pass  0 fail) | 23 | 0.555 | 5 | True | 2 | 0 | 1/0 | 0 | 0 | 2 |
| comments-moderation | void | claude-sonnet-5-5 | 1 | PASS | pass | pass (8 pass  0 fail) | 24 | 0.298 | 2 | True | 0 | 0 | 0/0 | 5 | 0 | 2 |
| comments-moderation | void | claude-sonnet-5-5 | 2 | PASS | pass | pass (8 pass  0 fail) | 24 | 0.315 | 4 | True | 0 | 0 | 0/0 | 7 | 0 | 2 |
| comments-moderation | void | claude-sonnet-5-5 | 3 | PASS | pass | pass (8 pass  0 fail) | 19 | 0.284 | 2 | True | 0 | 0 | 0/0 | 3 | 0 | 1 |
| json-api-tokens | guren | claude-sonnet-5-5 | 1 | PASS | pass | pass (10 pass  0 fail) | 42 | 0.764 | 3 | True | 3 | 0 | 1/0 | 0 | 0 | 2 |
| json-api-tokens | guren | claude-sonnet-5-5 | 2 | PASS | pass | pass (10 pass  0 fail) | 39 | 0.862 | 3 | True | 2 | 1 | 1/0 | 0 | 0 | 2 |
| json-api-tokens | guren | claude-sonnet-5-5 | 3 | PASS | pass | pass (10 pass  0 fail) | 46 | 1.046 | 4 | True | 2 | 1 | 1/0 | 0 | 0 | 3 |
| json-api-tokens | void | claude-sonnet-5-5 | 1 | PASS | pass | pass (10 pass  0 fail) | 17 | 0.258 | 1 | True | 0 | 0 | 0/0 | 4 | 0 | 1 |
| json-api-tokens | void | claude-sonnet-5-5 | 2 | PASS | pass | pass (10 pass  0 fail) | 23 | 0.35 | 1 | True | 0 | 0 | 0/0 | 5 | 0 | 2 |
| json-api-tokens | void | claude-sonnet-5-5 | 3 | PASS | pass | pass (10 pass  0 fail) | 15 | 0.268 | 2 | True | 0 | 0 | 0/0 | 4 | 0 | 0 |
| missing-authorize-destroy | guren | claude-sonnet-5-5 | 1 | PASS | pass | pass (3 pass  0 fail) | 5 | 0.129 | 1 | True | 1 | 0 | 1/0 | 0 | 0 | 0 |
| missing-authorize-destroy | void | claude-sonnet-5-5 | 1 | PASS | pass | pass (3 pass  0 fail) | 6 | 0.066 | 1 | True | 0 | 0 | 0/0 | 0 | 0 | 0 |
| pagination-skips-page | guren | claude-sonnet-5-5 | 1 | PASS | pass | pass (6 pass  0 fail) | 6 | 0.139 | 2 | True | 2 | 0 | 1/0 | 0 | 0 | 0 |
| pagination-skips-page | void | claude-sonnet-5-5 | 1 | PASS | pass | pass (6 pass  0 fail) | 9 | 0.083 | 1 | True | 0 | 0 | 0/0 | 0 | 0 | 0 |
| post-revisions | guren | claude-sonnet-5-5 | 1 | PASS | pass | pass (6 pass  0 fail) | 19 | 0.301 | 1 | True | 1 | 1 | 1/0 | 0 | 0 | 1 |
| post-revisions | guren | claude-sonnet-5-5 | 2 | PASS | pass | pass (6 pass  0 fail) | 18 | 0.304 | 1 | True | 1 | 1 | 1/0 | 0 | 0 | 1 |
| post-revisions | guren | claude-sonnet-5-5 | 3 | PASS | pass | pass (6 pass  0 fail) | 15 | 0.294 | 1 | True | 1 | 1 | 1/0 | 0 | 0 | 1 |
| post-revisions | void | claude-sonnet-5-5 | 1 | PASS | pass | pass (6 pass  0 fail) | 20 | 0.214 | 2 | True | 0 | 0 | 0/0 | 2 | 0 | 1 |
| post-revisions | void | claude-sonnet-5-5 | 2 | PASS | pass | pass (6 pass  0 fail) | 24 | 0.252 | 2 | True | 0 | 0 | 0/0 | 4 | 0 | 2 |
| post-revisions | void | claude-sonnet-5-5 | 3 | PASS | pass | pass (6 pass  0 fail) | 15 | 0.204 | 2 | True | 0 | 0 | 0/0 | 2 | 0 | 1 |
| post-tags | guren | claude-sonnet-5-5 | 1 | PASS | pass | pass (6 pass  0 fail) | 24 | 0.558 | 3 | True | 1 | 0 | 1/0 | 0 | 0 | 1 |
| post-tags | guren | claude-sonnet-5-5 | 2 | PASS | pass | pass (6 pass  0 fail) | 23 | 0.582 | 4 | True | 4 | 0 | 1/0 | 0 | 0 | 1 |
| post-tags | guren | claude-sonnet-5-5 | 3 | PASS | pass | pass (6 pass  0 fail) | 24 | 0.55 | 6 | True | 3 | 1 | 1/0 | 0 | 0 | 2 |
| post-tags | void | claude-sonnet-5-5 | 1 | PASS | pass | pass (6 pass  0 fail) | 15 | 0.242 | 1 | True | 0 | 0 | 0/0 | 2 | 0 | 1 |
| post-tags | void | claude-sonnet-5-5 | 2 | PASS | pass | pass (6 pass  0 fail) | 10 | 0.198 | 1 | True | 0 | 0 | 0/0 | 1 | 0 | 1 |
| post-tags | void | claude-sonnet-5-5 | 3 | PASS | pass | pass (6 pass  0 fail) | 13 | 0.224 | 1 | True | 0 | 0 | 0/0 | 1 | 0 | 1 |
| raw-body-no-validation | guren | claude-sonnet-5-5 | 1 | PASS | pass | pass (6 pass  0 fail) | 7 | 0.133 | 1 | False | 1 | 0 | 1/0 | 0 | 0 | 0 |
| raw-body-no-validation | void | claude-sonnet-5-5 | 1 | PASS | pass | pass (6 pass  0 fail) | 9 | 0.094 | 2 | True | 0 | 0 | 0/0 | 0 | 0 | 0 |
| scheduled-publish | guren | claude-sonnet-5-5 | 1 | PASS | pass | pass (5 pass  0 fail) | 17 | 0.375 | 6 | True | 3 | 0 | 1/0 | 0 | 0 | 2 |
| scheduled-publish | guren | claude-sonnet-5-5 | 2 | PASS | pass | pass (5 pass  0 fail) | 16 | 0.383 | 4 | True | 2 | 0 | 1/0 | 0 | 0 | 1 |
| scheduled-publish | guren | claude-sonnet-5-5 | 3 | PASS | pass | pass (5 pass  0 fail) | 22 | 0.415 | 4 | True | 6 | 2 | 1/0 | 0 | 0 | 2 |
| scheduled-publish | void | claude-sonnet-5-5 | 1 | PASS | pass | pass (5 pass  0 fail) | 24 | 0.26 | 3 | True | 0 | 0 | 0/0 | 1 | 0 | 2 |
| scheduled-publish | void | claude-sonnet-5-5 | 2 | PASS | pass | pass (5 pass  0 fail) | 14 | 0.223 | 4 | True | 0 | 0 | 0/0 | 1 | 0 | 3 |
| scheduled-publish | void | claude-sonnet-5-5 | 3 | PASS | pass | pass (5 pass  0 fail) | 19 | 0.254 | 3 | True | 0 | 0 | 0/0 | 1 | 0 | 2 |
