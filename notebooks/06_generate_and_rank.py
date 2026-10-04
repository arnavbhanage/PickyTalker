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
from src.generation.generate import CONDITIONS
from src.generation.nim_client import NimClient
from src.generation.run_eval import GenerationEvaluator
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
client = NimClient(requests_per_minute=30, timeout_s=120)
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

def run_generation(items, output_prefix):
    runner = GenerationEvaluator(df, ranker, client, max_tokens=2500)
    return runner.run(
        items,
        output_prefix=output_prefix,
        checkpoint_every=10,
        resume=True,
    )


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


def user_level_summary(frame, group_column, metric_names, n_boot=1000, seed=SEED):
    rng = np.random.default_rng(seed)
    rows = []
    for group_value, group in frame.groupby(group_column, sort=True):
        user_means = group.groupby("user_id")[metric_names].mean()
        values = user_means.to_numpy(dtype=float)
        users = len(values)
        if users == 0:
            continue
        boot_means = np.array([
            values[rng.integers(0, users, users)].mean(axis=0)
            for _ in range(n_boot)
        ])
        row = {group_column: group_value, "users": users}
        for index, metric in enumerate(metric_names):
            row[f"mean_{metric}"] = float(values[:, index].mean())
            row[f"ci_low_{metric}"] = float(np.percentile(boot_means[:, index], 2.5))
            row[f"ci_high_{metric}"] = float(np.percentile(boot_means[:, index], 97.5))
        rows.append(row)
    return pd.DataFrame(rows)


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
pilot_calls, pilot_candidates = run_generation(pilot_items, "06_pilot")
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
# Keep the full 100-item run gated until a fresh pilot has been approved.

# %%
if RUN_FULL:
    full_calls, full_candidates = run_generation(full_items, "06_full")
    full_stats = call_stats(full_calls)
    full_metrics = metric_summary(full_candidates)
    independent_metrics = [
        "stylometry_similarity",
        "normalized_edit_distance",
        "lexical_similarity",
        "ranker_score",
    ]
    full_metrics_user_ci = user_level_summary(
        full_candidates, "condition", independent_metrics
    )
    full_selection = selection_test(full_candidates)
    full_selection_user_ci = user_level_summary(
        full_selection,
        "picker",
        ["stylometry_similarity", "normalized_edit_distance", "lexical_similarity", "ranker_score"],
    )
    full_calls.to_csv(FINDINGS_DIR / "06_full_call_stats_raw.csv", index=False)
    full_stats.to_csv(FINDINGS_DIR / "06_full_call_stats.csv", index=False)
    full_candidates.to_csv(FINDINGS_DIR / "06_full_candidate_metrics.csv", index=False)
    full_metrics.to_csv(FINDINGS_DIR / "06_full_metric_summary.csv", index=False)
    full_metrics_user_ci.to_csv(FINDINGS_DIR / "06_full_metric_user_ci.csv", index=False)
    full_selection.to_csv(FINDINGS_DIR / "06_full_selection.csv", index=False)
    full_selection_user_ci.to_csv(FINDINGS_DIR / "06_full_selection_user_ci.csv", index=False)
    print("Full-run call and token accounting:")
    display(full_stats.round(3))
    print("Full-run candidate metrics with user-level 95% confidence intervals:")
    display(full_metrics_user_ci.round(3))
    print("Full-run selection test with user-level 95% confidence intervals:")
    display(full_selection_user_ci.round(3))
else:
    print("Full run is gated. Set RUN_FULL=True only after pilot approval.")
