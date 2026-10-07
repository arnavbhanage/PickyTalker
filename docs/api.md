# Backend API

The backend is a stateless FastAPI service. It keeps the ranker and its population
statistics in memory, but does not persist request histories, incoming messages,
generated candidates, or replies. Build the local, ignored model artifacts before
using `/rank` or `/respond`.

## Start the service

From the repository root in PowerShell:

```powershell
python -m pip install -r requirements.txt
python -m scripts.build_artifacts

$env:NVIDIA_API_KEY = "<your NVIDIA API key>"
$env:NIM_MODEL = "<an NVIDIA NIM chat model available to your account>"
# Optional: require X-API-Key on every endpoint except /health.
$env:PICKYTALKER_API_KEY = "<choose a local API key>"

python -m uvicorn app.backend.main:app --reload
```

`PICKYTALKER_MODEL_DIR` optionally selects another artifact directory; it defaults
to `models/`. Copy `.env.example` to `.env` for local development. Never commit
`.env`, API keys, or files from `models/`.

The service listens at `http://127.0.0.1:8000`. All request bodies are JSON.
Examples below assume the optional API-key check is enabled:

```powershell
$base = "http://127.0.0.1:8000"
$headers = @{ "X-API-Key" = "<your local API key>" }
```

If API-key protection is not enabled, omit `-Headers $headers`.

## Endpoints

### `GET /health`

No LLM request is made. `artifacts_loaded` indicates whether model artifacts loaded.
`llm_configured` reports whether both NVIDIA variables are configured; `model_name`
contains only the model id, never the key.

```powershell
Invoke-RestMethod -Method Get -Uri "$base/health"
```

Response fields: `status`, `artifact_version`, `artifacts_loaded`,
`llm_configured`, and `model_name`.

### `POST /profile`

Build an interpretable profile from the newest 100 messages in `history`. No model
artifacts or LLM configuration are required.

```powershell
$body = @{
  history = @("I can send that over today.", "Sure, I will check and reply.")
} | ConvertTo-Json -Depth 8
Invoke-RestMethod -Method Post -Uri "$base/profile" -Headers $headers `
  -ContentType "application/json" -Body $body
```

Response fields: `profile` (raw-unit style statistics), `instruction` (the
deterministic profile summary), `n_messages_used`, and `confidence` (`n / (n + 10)`).

### `POST /rank`

Ranks 1–10 supplied candidate replies. This endpoint does not call the LLM.
`incoming` is optional and used only as request context; candidate features are
computed from the candidate text and user history.

```powershell
$body = @{
  history = @("I can send that over today.", "Sure, I will check and reply.")
  incoming = "Could you send the report?"
  candidates = @("Sure, I will send it today.", "I can take a look tomorrow.")
} | ConvertTo-Json -Depth 8
Invoke-RestMethod -Method Post -Uri "$base/rank" -Headers $headers `
  -ContentType "application/json" -Body $body
```

Each ranked item contains `candidate`, `rank`, `ranker_score`, `style_score`,
`contributions` (per-feature likelihood-ratio contributions, which sum to
`style_score`), and up to three `reasons`.

### `POST /generate`

Asks the configured NVIDIA NIM model for 1–8 distinct replies. The default
condition is `instruction`; alternatives are `neutral` and `fewshot`. The API
requests structured JSON and accepts either a complete JSON list of distinct
reply strings or an object containing only a `candidates` list. If the output
is malformed or contains recognizable reasoning/task notes after one retry,
the request fails safely rather than returning that text as a reply.

```powershell
$body = @{
  history = @("I can send that over today.", "Sure, I will check and reply.")
  incoming = "Could you send the report?"
  n = 5
  condition = "instruction"
} | ConvertTo-Json -Depth 8
Invoke-RestMethod -Method Post -Uri "$base/generate" -Headers $headers `
  -ContentType "application/json" -Body $body
```

Response fields: `candidates` and `meta` (`latency_ms`, `llm_calls`,
`cached_calls`, `prompt_tokens`, `completion_tokens`, `model`).

### `POST /respond`

Generates replies with the product-only personalized condition: measured style
instructions plus up to 10 recent quoted, user-authored examples (12,000 total
example characters, when at least three samples exist). Selects with the
interpretable user-style baseline and returns the top choice plus the complete
ranked list. `/rank` retains the experimental learned-ranker ordering; its real
score is still returned by `/respond`, but is not used to select the product reply.
No-history replies retain generator order and are labelled unpersonalized.

```powershell
$body = @{
  history = @("I can send that over today.", "Sure, I will check and reply.")
  incoming = "Could you send the report?"
  n = 5
} | ConvertTo-Json -Depth 8
Invoke-RestMethod -Method Post -Uri "$base/respond" -Headers $headers `
  -ContentType "application/json" -Body $body
```

Response fields: `best`, `candidates` (the ranked list), and the same LLM `meta`
fields as `/generate`.

## Limits and errors

- History: at most 200 messages, each 1–2,000 characters; the newest 100 are used.
- Incoming message: 1–2,000 characters.
- Candidates: 1–10 for `/rank`; generation count `n`: 1–8.
- Empty or whitespace-only history, incoming, and candidate strings are rejected.
- `401`: missing or invalid `X-API-Key` when protection is enabled.
- `422`: invalid request body or a limit violation.
- `502`: upstream model failure or malformed generated output. The response
  includes a short safe message and upstream status code when available; provider
  response bodies and keys are not returned.
- `503`: required model artifacts are missing, or the LLM is not configured.
  Build model artifacts with `python -m scripts.build_artifacts`.
- `500`: an unexpected internal error; the response does not include a traceback.

## Privacy

The service does not save request text or generated replies to disk or logs. It
logs only request identifiers, endpoint names, latency, and status. `/profile`
and `/rank` run locally; they do not call NVIDIA. `/generate` and `/respond` call
the configured NVIDIA API. `neutral` generation sends the incoming message;
`fewshot` also sends up to 10 recent history messages; `instruction` sends the
incoming message and a style instruction summarized from the most recent 100
history messages. `/respond` additionally sends the quoted examples described
above. The frontend separately persists explicitly saved writing samples in the
account database; it never automatically treats incoming messages or generated
replies as the person's writing. Candidate replies returned by NVIDIA are used
in memory for ranking and are not cached by this API.

**Do not send personal data to NVIDIA or any external model provider without the
data subject's informed consent and authorization.** Use only data you are
permitted to process, and check the provider's current retention and privacy
terms.
