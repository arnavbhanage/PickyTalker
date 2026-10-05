# Generation and ranker evidence

## Scope

This note records the local API smoke tests, the saved 20-item generation pilot,
and an offline re-analysis of the trained LightGBM ranker on the saved v1
benchmark. It does not claim that generated text is semantically safe or that
the learned ranker improves personalization. No 100-item generation evaluation
was run.

## API and generation reliability

The local FastAPI smoke test used synthetic text:

| Route | Outcome |
|---|---|
| `/health` | HTTP 200; local artifacts loaded; no key returned |
| `/profile` | HTTP 200; five history messages processed |
| `/rank` | HTTP 200; five candidates; repeat ordering was deterministic and per-feature contributions summed to the style score |
| `/generate` | HTTP 200; three distinct JSON-validated strings after two provider calls; 64.928 s total latency |
| `/respond` | HTTP 502 after two malformed generation attempts; 123.717 s total latency |

The successful `/generate` response establishes syntactic validity only. The
returned candidates had mixed contextual fit. The failed `/respond` call and
long latencies make generation unsuitable for a larger evaluation at present.
The request path now asks for structured JSON, reads only `message.content`,
requires the exact requested number of distinct candidates, rejects recognized
analysis/task text, and returns a safe error if the retry also fails. The
generation route's token cap is 2,500 to avoid the previous lower cap; this is
not a guarantee against truncation or poor semantic fit.

The existing pilot artifacts contain 20 items and 60 condition calls (neutral,
few-shot, and instruction). Their recorded results are:

| Condition | Calls | Transport failures | Parse failures | Calls returning fewer than 5 | `finish_reason=length` |
|---|---:|---:|---:|---:|---:|
| Neutral | 20 | 0 | 0 | 0 | 2 |
| Few-shot | 20 | 0 | 2 | 2 | 4 |
| Instruction | 20 | 1 | 1 | 2 | 19 |
| **Total** | **60** | **1** | **3** | **4** | **25** |

The short-output count includes the timeout: there were three parse-failure
responses with zero candidates and one timed-out request. The other 22 responses
marked `length` still yielded five parseable candidates; `finish_reason=length`
therefore signals generation truncation, not necessarily an incomplete JSON
candidate list. The one transport failure was an `APITimeoutError` after
120.498 s, on item `037cdba1de` in the instruction condition. No HTTP status
failure is recorded. The stored pilot CSV does not have a per-call
`message.content`-empty field, so an empty-content rate cannot be attributed to
these 60 calls. The cache scan found no empty saved response text across its 158
records, but those records could not all be matched to this pilot.

The current saved artifacts do **not** support the previously mentioned tally
of six failed and seven partial calls. They support one transport timeout,
three parse failures, and 25 truncation finish reasons (with the overlap shown
above). No missing calls or causes are silently filled in.

Examples below are raw pilot metadata, not reconstructed response bodies:

| Recorded cause | Example 1 | Example 2 |
|---|---|---|
| Truncation (`length`) | `887be59175`, instruction, 16.306 s, 5 candidates | `a7c0b4f463`, few-shot, 65.741 s, 0 candidates, parse failure |
| Parse failure | `a7c0b4f463`, few-shot, `length`, 0 candidates | `da501405e0`, few-shot, `length`, 0 candidates |
| Timeout | `037cdba1de`, instruction, `APITimeoutError`, 120.498 s | No second timeout example is recorded |
| HTTP error | None recorded | None recorded |
| Empty `message.content` | Not recorded per pilot call | Not recorded per pilot call |

A marker scan of the broader NIM response cache found reasoning-like markers
inside `response.text` in 20 of 158 records. Those records cannot be reliably
attributed to this pilot, so this is a cache-wide observation, not a pilot rate.
The client uses only the provider's `message.content`; separate reasoning
metadata is not concatenated into candidates. When reasoning-like text is
inside `message.content`, strict validation rejects it rather than returning it
as a candidate.

The saved 20-item pilot predates enabling strict JSON validation in the
`GenerationEvaluator`; it used the legacy permissive parser. The evaluator now
requests structured JSON consistently with its prompt, enforces exactly five
distinct replies, and records a privacy-safe parse-failure category
(`empty_message_content`, `reasoning_text_in_content`, `json_parse_failure`,
candidate-count mismatch, and related validation failures) without saving the
raw rejected response. Existing saved pilot rows are treated as incomplete by
the updated resume check so a future approved pilot refreshes these diagnostics.
That refreshed pilot has not been run.

**Gate:** the saved pilot is not reliable enough to justify the 100-item run.
The full run remains disabled pending explicit approval and a successful,
reviewed reliability check.

## Ranker comparison on v1

The offline analysis used the saved v1 benchmark and the current local ranker
artifact. It evaluates one positive and nine controlled negatives per lineup.
Recall@1 and MRR are averaged per user; confidence intervals bootstrap users.
The pooled summary includes 28 users with benchmark lineups (13 validation and
15 test users), rather than the 29 evaluation users anticipated in earlier
notes.

| Scorer | Users | Recall@1, hardest tier | 95% user-bootstrap CI | MRR |
|---|---:|---:|---:|---:|
| User style | 28 | 0.230 | [0.173, 0.285] | 0.425 |
| Learned ranker | 28 | 0.158 | [0.107, 0.214] | 0.363 |
| Population | 28 | 0.124 | [0.087, 0.160] | 0.304 |
| Random | 28 | 0.099 | [0.075, 0.123] | 0.278 |

The paired ranker-minus-user-style recall@1 difference on the hardest tier is
**-0.0714** (95% CI **[-0.1269, -0.0146]**); 8/28 users (28.6%) had a positive
ranker gain. On this pooled comparison, the ranker is behind the simpler
user-style scorer.

Validation and test splits, reported separately:

| Split | Users | User style | Ranker | Population | Random |
|---|---:|---:|---:|---:|---:|
| Validation | 13 | 0.166 | 0.117 | 0.088 | 0.123 |
| Test | 15 | 0.285 | 0.194 | 0.155 | 0.079 |

These are point estimates; no split-specific paired confidence intervals were
computed. The validation set is especially small.

### Training-size probe

The ranker was retrained on one deterministic seeded subset at each size and
measured on the same 13 validation users in the hardest tier. The user-style
and population baselines are independent of training size.

| Training users | Training lineups | User style recall@1 | Ranker recall@1 | Population recall@1 |
|---:|---:|---:|---:|---:|
| 17 (25%) | 1,448 | 0.138 | 0.111 | 0.088 |
| 34 (50%) | 2,836 | 0.138 | 0.160 | 0.088 |
| 67 (100%) | 5,620 | 0.138 | 0.117 | 0.088 |

This single-seed curve is non-monotonic and based on only 13 validation users;
it does not show that more training users reliably improve the ranker.

### Feature evidence

The ten highest LightGBM gain features were led by `llr_total` (gain 7,995.5),
`llr_has_newline` (4,682.9), and `llr_starts_lower` (1,897.3). Seven candidate
feature pairs had absolute Pearson correlation at least 0.98 in a seeded sample
of 150 hardest-tier lineups. Examples include `delta_n_questions` with
`std_n_questions` (r=0.999) and `delta_avg_sent_len` with
`std_avg_sent_len` (r=0.995). Several such dependencies are expected from the
feature construction; gain importance is not causal evidence.

An ablation removed the individual per-feature LLR columns while retaining
`llr_total`. On validation users it scored recall@1 0.122 (95% CI
[0.078, 0.164]) versus 0.117 for the full ranker. The intervals overlap widely,
so this small ablation does not establish that the individual LLR columns help
or hurt.

### History-size probe

The user-style scorer's user-weighted hardest-tier recall@1 was:

| History messages | Users | Recall@1 | 95% user-bootstrap CI |
|---:|---:|---:|---:|
| 0 | 28 | 0.100 | [0.100, 0.100] |
| 1 | 28 | 0.165 | [0.132, 0.201] |
| 3 | 28 | 0.175 | [0.142, 0.212] |
| 10 | 28 | 0.187 | [0.147, 0.234] |
| 30 | 28 | 0.212 | [0.162, 0.265] |
| 100 | 28 | 0.214 | [0.165, 0.266] |
| All available | 28 | 0.219 | [0.169, 0.271] |

The implementation averages the three seeded history samples within each user
before bootstrapping users. These results show a modest increase in this
benchmark as more history becomes available, with uncertainty across only 28
users.

## Synthetic-user sanity check

The separate fixed-candidate sanity script scored 15 human-written candidates
for three synthetic histories. The top outputs were:

| Synthetic history | Selected candidate | Ranker score | Style score |
|---|---|---:|---:|
| Informal/lowercase | “yea ill be there in like 10 mins” | 1.4287 | 4.2164 |
| Formal | “I expect to arrive in approximately ten minutes; thank you for your patience.” | 0.7103 | 2.1538 |
| Expressive | “omw in 10 mins!! 😭” | 0.8698 | 4.0009 |

This is a three-profile sanity check over a hand-written candidate set, not an
independent quality evaluation or evidence of user-level generalization.

## Limitations and supported conclusions

- Enron is corporate English email from 1999–2002; it is not representative of
  present-day personal messaging, multilingual use, or all communication
  settings.
- There are 28 benchmarked evaluation users in these saved outputs (13
  validation and 15 test). Estimates are uncertain and user diversity is
  limited.
- The user-style baseline uses a diagonal Gaussian and ignores correlations
  between style features. The ranker also has strongly redundant engineered
  inputs.
- Emoji evidence is inadequate in this corpus/feature set; the synthetic
  expressive example does not validate emoji handling on real held-out users.
- Controlled negatives and stylometric features do not establish semantic
  equivalence or real-world response quality.
- The ranker did not beat user style in the pooled hardest-tier paired
  comparison. The result does not support a claim that learned ranking improves
  this benchmark.
- The small training-size probe is non-monotonic; the LLR ablation is
  inconclusive.
- The generation endpoint enforces a format, not semantic relevance. The
  observed provider latency and malformed response prevent a trustworthy
  generation-quality evaluation.

## Reproduction

With `.venv` active at the repository root:

```powershell
python -m pytest -q
python -m scripts.analyze_ranker
```

The analysis script reads the local processed Enron file, saved
`benchmark_v1.csv`, and local model artifacts. It makes no provider calls and
writes its CSV tables under `docs/findings/` with the `06_` prefix. The
generation pilot was run separately in notebook 06; do not enable the 100-item
section without approval.
