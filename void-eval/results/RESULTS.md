# void-eval results

| model | arm | cells | pass | med turns | med cost (USD) | total cost (USD) | typecheck after last edit | ran typecheck at all | ran tests | guren gate CLI | stop-hook runs / blocks | Void docs reads (med) | Skill uses | denials |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | guren | 4 | 4/4 | 6.5 | 0.14 | 0.74 | 2/4 | 4/4 | 4/4 | 0/4 | 4 / 0 | 0.0 | 0 | 1 |
| claude-sonnet-5-5 | void | 4 | 4/4 | 7.5 | 0.09 | 0.35 | 4/4 | 4/4 | 0/4 | 0/4 | 0 / 0 | 0.0 | 0 | 1 |

## Per cell

| task | arm | model | trial | status | typecheck | suite | turns | cost | tc runs | tc after last edit | tests | gate | stop runs/blocks | docs reads | skills | denials |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| api-posts-contract | guren | claude-sonnet-5-5 | 1 | PASS | pass | pass (8 pass  0 fail) | 19 | 0.339 | 1 | False | 3 | 0 | 1/0 | 0 | 0 | 1 |
| api-posts-contract | void | claude-sonnet-5-5 | 1 | PASS | pass | pass (8 pass  0 fail) | 6 | 0.107 | 2 | True | 0 | 0 | 0/0 | 2 | 0 | 1 |
| missing-authorize-destroy | guren | claude-sonnet-5-5 | 1 | PASS | pass | pass (3 pass  0 fail) | 5 | 0.129 | 1 | True | 1 | 0 | 1/0 | 0 | 0 | 0 |
| missing-authorize-destroy | void | claude-sonnet-5-5 | 1 | PASS | pass | pass (3 pass  0 fail) | 6 | 0.066 | 1 | True | 0 | 0 | 0/0 | 0 | 0 | 0 |
| pagination-skips-page | guren | claude-sonnet-5-5 | 1 | PASS | pass | pass (6 pass  0 fail) | 6 | 0.139 | 2 | True | 2 | 0 | 1/0 | 0 | 0 | 0 |
| pagination-skips-page | void | claude-sonnet-5-5 | 1 | PASS | pass | pass (6 pass  0 fail) | 9 | 0.083 | 1 | True | 0 | 0 | 0/0 | 0 | 0 | 0 |
| raw-body-no-validation | guren | claude-sonnet-5-5 | 1 | PASS | pass | pass (6 pass  0 fail) | 7 | 0.133 | 1 | False | 1 | 0 | 1/0 | 0 | 0 | 0 |
| raw-body-no-validation | void | claude-sonnet-5-5 | 1 | PASS | pass | pass (6 pass  0 fail) | 9 | 0.094 | 2 | True | 0 | 0 | 0/0 | 0 | 0 | 0 |
