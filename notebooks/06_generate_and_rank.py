# %%
from pathlib import Path
import sys

ROOT = next(path for path in (Path.cwd(), *Path.cwd().parents) if (path / "src").is_dir())
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# %% [markdown]
# # 06 - Generate and rank personalized replies
#
# This notebook compares neutral generation, few-shot examples, and a profile-derived
# instruction. The pilot is capped at 20 held-out items. The 100-item full run stays
# disabled until the pilot has been reviewed and approved.

# %%
import os
import time
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from IPython.display import display

from src.benchmark.evaluate import DEFAULT_FEATURES, StyleSpace
from src.data.splits import make_splits
from src.features.extractor import extract_message, extract_frame
from src.generation.eval_items import select_eval_items
from src.generation.generate import CONDITIONS, generate_candidates
from src.generation.metrics import evaluate_candidates
from src.generation.nim_client import NimClient
from src.ranking.features import candidate_features
from src.ranking.lgbm_ranker import train_ranker
from src.ranking.train_data import build_training_lineups

load_dotenv(ROOT / ".env")
DATA_PATH = ROOT / "data" / "processed" / "enron_messages.csv"
FINDINGS_DIR = ROOT / "docs" / "findings"
FINDINGS_DIR.mkdir(parents=True, exist_ok=True)
N_CANDIDATES = 5
TEMPERATURE = 0.6
PILOT_SIZE = 20
FULL_SIZE = 100
RUN_FULL = False
SEED = 0

if not os.getenv("NIM_MODEL"):
    raise RuntimeError("NIM_MODEL must be configured in the local environment or .env.")
client = NimClient(requests_per_minute=30)
print("Configured model:", client.model)

# %%
df = pd.read_csv(DATA_PATH)
eligible_items = select_eval_items(df)
pilot_items = select_eval_items(df, max_items=PILOT_SIZE, seed=SEED)
full_items = select_eval_items(df, max_items=FULL_SIZE, seed=SEED)
print("Qualified held-out items:", len(eligible_items))
print("Pilot items selected:", len(pilot_items))
print("Full-run items selected:", len(full_items))

# %%
space = StyleSpace(df, DEFAULT_FEATURES)
train_df, train_lineups = build_training_lineups(df, n_neg=9, history_frac=0.7, seed=SEED)
ranker = train_ranker(space, train_lineups, m=10, k=10.0, seed=SEED, n_estimators=60)
print("Train users:", train_df["user_id"].nunique())
print("Training lineups:", len(train_lineups))

# %%
def score_generated_candidates(user_id, item_id, candidates):
    generated_rows = []
    candidate_ids = []
    for index, text in enumerate(candidates):
        candidate_id = f"generated-{item_id}-{index}"
        candidate_ids.append(candidate_id)
        generated_rows.append({
            "message_id": candidate_id,
            "message": text,
            "user_id": user_id,
            "time_split": "eval",
            **extract_message(text),
        })
    if not generated_rows:
        return []

    extended_df = pd.concat([df, pd.DataFrame(generated_rows)], ignore_index=True, sort=False)
    extended_space = StyleSpace(extended_df, DEFAULT_FEATURES)
    features, feature_names = candidate_features(
        extended_space, user_id, candidate_ids, m=10, k=10.0
    )
    trained_names = ranker.feature_names_
    name_to_index = {name: index for index, name in enumerate(feature_names)}
    missing = [name for name in trained_names if name not in name_to_index]
    if missing:
        raise ValueError(f"Generated candidate features are missing trained columns: {missing}")
    ordered = features[:, [name_to_index[name] for name in trained_names]]
    return ranker.predict(ordered).tolist()


def run_generation(items):
    call_rows = []
    candidate_rows = []
    for item in items.itertuples(index=False):
        for condition in CONDITIONS:
            started = time.perf_counter()
            try:
                candidates, response = generate_candidates(
                    client,
                    incoming_message=item.incoming_message,
                    history_texts=item.history_texts,
                    condition=condition,
                    n=N_CANDIDATES,
                    temperature=TEMPERATURE,
                    return_response=True,
                )
            except Exception as exc:
                elapsed = time.perf_counter() - started
                call_rows.append({
                    "item_id": item.item_id,
                    "user_id": item.user_id,
                    "condition": condition,
                    "cached": False,
                    "latency_s": elapsed,
                    "prompt_tokens": None,
                    "completion_tokens": None,
                    "failed": True,
                    "failure_type": type(exc).__name__,
                    "failure_status_code": getattr(exc, "status_code", None),
                    "parse_failure": False,
                    "returned_candidates": 0,
                })
                continue

            call_rows.append({
                "item_id": item.item_id,
                "user_id": item.user_id,
                "condition": condition,
                "cached": response.cached,
                "latency_s": response.latency_s,
                "prompt_tokens": response.prompt_tokens,
                "completion_tokens": response.completion_tokens,
                "failed": False,
                "failure_type": None,
                "failure_status_code": None,
                "parse_failure": len(candidates) < N_CANDIDATES,
                "returned_candidates": len(candidates),
            })
            if not candidates:
                continue

            ranker_scores = score_generated_candidates(item.user_id, item.item_id, candidates)
            evaluated = evaluate_candidates(
                candidates,
                item.history_texts,
                item.real_reply,
                ranker_scores=ranker_scores,
            )
            evaluated["item_id"] = item.item_id
            evaluated["user_id"] = item.user_id
            evaluated["condition"] = condition
            evaluated["incoming_message"] = item.incoming_message
            evaluated["real_reply"] = item.real_reply
            candidate_rows.extend(evaluated.to_dict("records"))

    calls = pd.DataFrame(call_rows)
    candidates = pd.DataFrame(candidate_rows)
    return calls, candidates


def call_stats(calls):
    rows = []
    for condition in CONDITIONS:
        group = calls[calls["condition"].eq(condition)] if not calls.empty else calls
        call_count = len(group)
        successful = group[~group["failed"]] if call_count else group
        latencies = group["latency_s"].dropna().to_numpy(dtype=float) if call_count else np.array([])
        rows.append({
            "condition": condition,
            "calls": call_count,
            "cached_calls": int(group["cached"].sum()) if call_count else 0,
            "mean_latency_s": float(np.mean(latencies)) if len(latencies) else np.nan,
            "p95_latency_s": float(np.percentile(latencies, 95)) if len(latencies) else np.nan,
            "prompt_tokens": int(group["prompt_tokens"].fillna(0).sum()) if call_count else 0,
            "completion_tokens": int(group["completion_tokens"].fillna(0).sum()) if call_count else 0,
            "failure_rate": float(group["failed"].mean()) if call_count else np.nan,
            "parse_failure_rate": (
                float(successful["parse_failure"].mean()) if len(successful) else np.nan
            ),
        })
    return pd.DataFrame(rows)


def metric_summary(candidates):
    metric_names = [
        "stylometry_similarity",
        "normalized_edit_distance",
        "lexical_similarity",
        "ranker_score",
    ]
    if candidates.empty:
        return pd.DataFrame(columns=["condition", *metric_names, "candidate_count"])
    return (
        candidates.groupby("condition")[metric_names]
        .mean()
        .assign(candidate_count=candidates.groupby("condition").size())
        .reset_index()
    )


def selection_test(candidates):
    rng = np.random.default_rng(SEED)
    rows = []
    instruction_rows = candidates[candidates["condition"].eq("instruction")]
    for item_id, group in instruction_rows.groupby("item_id", sort=True):
        random_index = int(rng.integers(0, len(group)))
        ranker_index = int(group["ranker_score"].to_numpy().argmax())
        picked = {
            "random": group.iloc[random_index],
            "first": group.iloc[0],
            "ranker": group.iloc[ranker_index],
        }
        for picker, selected in picked.items():
            rows.append({
                "item_id": item_id,
                "user_id": selected["user_id"],
                "picker": picker,
                "candidate": selected["candidate"],
                "stylometry_similarity": selected["stylometry_similarity"],
                "normalized_edit_distance": selected["normalized_edit_distance"],
                "lexical_similarity": selected["lexical_similarity"],
                "ranker_score": selected["ranker_score"],
            })
    return pd.DataFrame(rows)


def blind_review_tables(items, candidates):
    review_rows = []
    key_rows = []
    rng = np.random.default_rng(SEED + 10)
    by_item = items.head(10).set_index("item_id")
    for item_id, item in by_item.iterrows():
        group = candidates[candidates["item_id"].eq(item_id)]
        options = []
        for condition in CONDITIONS:
            for candidate in group[group["condition"].eq(condition)]["candidate"].tolist():
                options.append((condition, candidate))
        rng.shuffle(options)
        row = {
            "item_id": item_id,
            "incoming_message": item["incoming_message"],
            "real_reply": item["real_reply"],
        }
        for index, (condition, candidate) in enumerate(options):
            option = f"Option {chr(ord('A') + index)}"
            row[option] = candidate
            key_rows.append({
                "item_id": item_id,
                "option": option,
                "condition": condition,
            })
        review_rows.append(row)
    return pd.DataFrame(review_rows), pd.DataFrame(key_rows)


def example_table(items, candidates):
    rows = []
    for item in items.head(5).itertuples(index=False):
        row = {
            "item_id": item.item_id,
            "incoming_message": item.incoming_message,
            "real_reply": item.real_reply,
        }
        for condition in CONDITIONS:
            replies = candidates[
                candidates["item_id"].eq(item.item_id)
                & candidates["condition"].eq(condition)
            ]["candidate"].tolist()
            row[condition] = "\n---\n".join(replies)
        rows.append(row)
    return pd.DataFrame(rows)

# %% [markdown]
# ## Pilot: 20 held-out items
#
# This section makes one request per item and condition. It reports request failures
# and partial/invalid candidate output separately instead of hiding either case.

# %%
pilot_calls, pilot_candidates = run_generation(pilot_items)
pilot_stats = call_stats(pilot_calls)
pilot_metrics = metric_summary(pilot_candidates)
pilot_selection = selection_test(pilot_candidates)
pilot_selection_summary = (
    pilot_selection.groupby("picker")[
        ["stylometry_similarity", "normalized_edit_distance", "lexical_similarity", "ranker_score"]
    ].mean().reset_index()
    if not pilot_selection.empty
    else pd.DataFrame()
)
pilot_examples = example_table(pilot_items, pilot_candidates)
pilot_blind_review, _blind_condition_key = blind_review_tables(pilot_items, pilot_candidates)

pilot_calls.to_csv(FINDINGS_DIR / "06_pilot_call_stats_raw.csv", index=False)
pilot_stats.to_csv(FINDINGS_DIR / "06_pilot_call_stats.csv", index=False)
pilot_candidates.to_csv(FINDINGS_DIR / "06_pilot_candidate_metrics.csv", index=False)
pilot_metrics.to_csv(FINDINGS_DIR / "06_pilot_metric_summary.csv", index=False)
pilot_selection.to_csv(FINDINGS_DIR / "06_pilot_selection.csv", index=False)
pilot_selection_summary.to_csv(FINDINGS_DIR / "06_pilot_selection_summary.csv", index=False)
pilot_examples.to_csv(FINDINGS_DIR / "06_pilot_examples.csv", index=False)
pilot_blind_review.to_csv(FINDINGS_DIR / "06_pilot_blind_review.csv", index=False)

print("Pilot call and token accounting (token totals are the available cost proxy; monetary cost is not estimated):")
display(pilot_stats.round(3))
print("Pilot independent metrics and ranker score:")
display(pilot_metrics.round(3))
print("Selection test (lower edit distance is better; higher similarities are better):")
display(pilot_selection_summary.round(3))
print("Blind human-check items: real reply is labeled; generated options are shuffled and condition names are hidden.")
display(pilot_blind_review)
print("Five pilot examples, side by side:")
display(pilot_examples)

if not pilot_selection_summary.empty:
    selection_means = pilot_selection_summary.set_index("picker")
    directions = {
        "stylometry_similarity": 1,
        "normalized_edit_distance": -1,
        "lexical_similarity": 1,
    }
    wins = 0
    for metric, direction in directions.items():
        delta = direction * (
            selection_means.loc["ranker", metric] - selection_means.loc["random", metric]
        )
        wins += int(delta > 0)
    if wins == 0:
        print("Pilot selection result: the ranker pick was not better than random on any independent metric.")
    else:
        print(f"Pilot selection result: the ranker pick was better than random on {wins} of 3 independent metrics.")

# %% [markdown]
# ## Full run: 100 held-out items
#
# Keep `RUN_FULL` false until the pilot results and blind review have been approved.

# %%
if RUN_FULL:
    full_calls, full_candidates = run_generation(full_items)
    full_stats = call_stats(full_calls)
    full_metrics = metric_summary(full_candidates)
    full_selection = selection_test(full_candidates)
    full_calls.to_csv(FINDINGS_DIR / "06_full_call_stats_raw.csv", index=False)
    full_stats.to_csv(FINDINGS_DIR / "06_full_call_stats.csv", index=False)
    full_candidates.to_csv(FINDINGS_DIR / "06_full_candidate_metrics.csv", index=False)
    full_metrics.to_csv(FINDINGS_DIR / "06_full_metric_summary.csv", index=False)
    full_selection.to_csv(FINDINGS_DIR / "06_full_selection.csv", index=False)
else:
    print("Full run is gated. Set RUN_FULL=True only after pilot approval.")
