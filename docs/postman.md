# Postman quick start

This guide sends requests only to the local PickyTalker server. It contains no
API key, provider credential, export, or production URL.

## Start the API

Open PowerShell at the repository root and activate `.venv`:

```powershell
.\.venv\Scripts\Activate.ps1
python -m scripts.build_artifacts
$env:NVIDIA_API_KEY = "<your NVIDIA API key>"
$env:NIM_MODEL = "<NIM model available to your account>"
# Optional: protect every route except /health.
$env:PICKYTALKER_API_KEY = "<your local API key>"
python -m uvicorn app.backend.main:app --reload
```

Do not paste an API key into a Postman collection or save it in a shared
environment. If the optional `PICKYTALKER_API_KEY` is set, add a Postman
environment variable named `pickyTalkerApiKey` and set it only in your local,
unshared environment. Every request below except `/health` then uses:

```text
Header: X-API-Key
Value:  {{pickyTalkerApiKey}}
```

Set `baseUrl` to `http://127.0.0.1:8000`. Use `Content-Type: application/json`
for every POST request. Postman response examples below describe shape, not
fixed score values.

## Recommended testing order

Start with `/health`, then `/profile`, then `/rank`. Those routes are local and
do not require an LLM. Test `/generate` next. Only if it returns exactly the
requested number of clean replies should you test `/respond`, which also invokes
the ranker. Generation calls send request text to the configured NVIDIA NIM
provider; never use real personal messages without the user's informed consent.

## 1. Health

Create a GET request:

```text
GET {{baseUrl}}/health
```

Expected status: `200`. The JSON response includes `status`, `artifact_version`,
`artifacts_loaded`, `llm_configured`, and `model_name`. It never includes the
NVIDIA key. An unloaded artifact set appears as `artifacts_loaded: false`;
`/rank` and `/respond` then return `503`.

## 2. Profile

Create a POST request:

```text
POST {{baseUrl}}/profile
```

Raw JSON body:

```json
{
  "history": [
    "bro im gonna be late 😭",
    "send it when ur done",
    "nah thats actually insane",
    "yea ill check",
    "wait what happened"
  ]
}
```

Expected status: `200`. The response contains `profile`, `instruction`,
`n_messages_used`, and `confidence`. This route is local and does not need model
artifacts or an NVIDIA request.

## 3. Rank

Create a POST request:

```text
POST {{baseUrl}}/rank
```

Raw JSON body:

```json
{
  "history": [
    "bro im gonna be late 😭",
    "send it when ur done",
    "nah thats actually insane",
    "yea ill check",
    "wait what happened"
  ],
  "incoming": "I will arrive in around ten minutes.",
  "candidates": [
    "yea ill be there in like 10 mins",
    "I should arrive in approximately ten minutes.",
    "I will arrive in around ten minutes.",
    "I expect to arrive in approximately ten minutes; thank you for your patience.",
    "omw in 10!! 😭"
  ]
}
```

Expected status: `200`. `candidates` is sorted best first. Every entry includes
`candidate`, `rank`, `ranker_score`, `style_score`, per-feature `contributions`,
and up to three `reasons`. Contributions sum to `style_score`. No LLM is called.
Send the same body twice to confirm ordering is deterministic.

## 4. Generate

Create a POST request:

```text
POST {{baseUrl}}/generate
```

Raw JSON body:

```json
{
  "history": [
    "bro im gonna be late 😭",
    "send it when ur done",
    "nah thats actually insane",
    "yea ill check",
    "wait what happened"
  ],
  "incoming": "I will arrive in around ten minutes.",
  "n": 5,
  "condition": "instruction"
}
```

Expected status: `200` with exactly five distinct reply strings in `candidates`,
plus `meta` with latency, call/cache counts, token usage, and model id. If the
provider returns malformed output twice, the API returns a safe `502` instead
of candidate-like analysis text.

## 5. Respond

Only use this after `/generate` has returned usable replies. Create a POST request:

```text
POST {{baseUrl}}/respond
```

Raw JSON body:

```json
{
  "history": [
    "bro im gonna be late 😭",
    "send it when ur done",
    "nah thats actually insane",
    "yea ill check",
    "wait what happened"
  ],
  "incoming": "I will arrive in around ten minutes.",
  "n": 5
}
```

Expected status: `200`. The response contains `best`, the complete ranked
`candidates` array with scores and reasons, and the same LLM `meta` object as
`/generate`.

## Common errors

- `401`: optional `X-API-Key` is missing or incorrect.
- `422`: request fields, string lengths, history size, candidate count, or `n`
  violate validation limits.
- `502`: NVIDIA request failed or generated output did not pass strict validation.
  The response does not expose provider bodies or credentials.
- `503`: model artifacts are missing or the LLM is not configured. Build local
  model artifacts with `python -m scripts.build_artifacts`.
- `500`: unexpected internal error; no traceback is returned to the client.

For endpoint fields, privacy details, and PowerShell examples, see
[`api.md`](./api.md).
