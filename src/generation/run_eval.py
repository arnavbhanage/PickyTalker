from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path
from typing import Sequence

import numpy as np
import pandas as pd
from dotenv import load_dotenv

from src.benchmark.evaluate import DEFAULT_FEATURES, StyleSpace
from src.features.extractor import extract_message
from src.generation.eval_items import select_eval_items
from src.generation.generate import (
    CONDITIONS,
    generate_candidates,
    strict_json_failure_reason,
)
from src.generation.metrics import evaluate_candidates
from src.generation.nim_client import NimClient
from src.ranking.features import candidate_features
from src.ranking.lgbm_ranker import train_ranker
from src.ranking.train_data import build_training_lineups


ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data" / "processed" / "enron_messages.csv"
FINDINGS_DIR = ROOT / "docs" / "findings"
PILOT_SIZE = 20
FULL_SIZE = 100
N_CANDIDATES = 5
TEMPERATURE = 0.6
MAX_TOKENS = 2500
REQUESTS_PER_MINUTE = 30
PER_CALL_TIMEOUT_S = 120.0


def _atomic_csv(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    frame.to_csv(temporary, index=False)
    temporary.replace(path)


def _read_frame(path: Path) -> pd.DataFrame:
    return pd.read_csv(path) if path.exists() else pd.DataFrame()


def _safe_error(exc: Exception) -> str:
    status_code = getattr(exc, "status_code", None)
    if type(exc).__name__ in {"APITimeoutError", "ConnectTimeout", "ReadTimeout", "Timeout"}:
        return "upstream_timeout"
    if status_code == 429:
        return "upstream_rate_limited"
    if isinstance(status_code, int):
        return f"upstream_http_{status_code}"
    return "upstream_request_failed"


class GenerationEvaluator:
    def __init__(
        self,
        df: pd.DataFrame,
        ranker,
        client,
        n_candidates: int = N_CANDIDATES,
        temperature: float = TEMPERATURE,
        max_tokens: int = MAX_TOKENS,
    ):
        self.df = df
        self.ranker = ranker
        self.client = client
        self.n_candidates = n_candidates
        self.temperature = temperature
        self.max_tokens = max_tokens

    def _rank_candidates(self, user_id, item_id, candidates) -> list[float]:
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

        extended = pd.concat(
            [self.df, pd.DataFrame(generated_rows)],
            ignore_index=True,
            sort=False,
        )
        space = StyleSpace(extended, DEFAULT_FEATURES)
        features, feature_names = candidate_features(
            space, user_id, candidate_ids, m=10, k=10.0
        )
        trained_names = self.ranker.feature_names_
        positions = {name: index for index, name in enumerate(feature_names)}
        missing = [name for name in trained_names if name not in positions]
        if missing:
            raise ValueError(f"Generated candidate features are missing trained columns: {missing}")
        matrix = features[:, [positions[name] for name in trained_names]]
        return self.ranker.predict(matrix).tolist()

    def _item_complete(self, calls: pd.DataFrame, item_id: str) -> bool:
        if calls.empty or "item_id" not in calls.columns:
            return False
        existing = calls[calls["item_id"].astype(str).eq(str(item_id))]
        if "parse_failure_reason" not in existing.columns:
            return False
        if set(existing["condition"]) != set(CONDITIONS) or len(existing) != len(CONDITIONS):
            return False
        return bool(
            (~existing["failed"].astype(bool)).all()
            and existing["returned_candidates"].astype(int).eq(self.n_candidates).all()
        )

    def run(
        self,
        items: pd.DataFrame,
        output_prefix: str,
        checkpoint_every: int = 10,
        resume: bool = True,
        progress_stream=None,
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        if checkpoint_every < 1:
            raise ValueError("checkpoint_every must be at least 1.")
        output_dir = FINDINGS_DIR
        call_path = output_dir / f"{output_prefix}_call_stats_raw.csv"
        candidate_path = output_dir / f"{output_prefix}_candidate_metrics.csv"
        calls = _read_frame(call_path) if resume else pd.DataFrame()
        candidates = _read_frame(candidate_path) if resume else pd.DataFrame()
        if not calls.empty:
            calls["failed"] = calls["failed"].astype(bool)
            calls["returned_candidates"] = pd.to_numeric(
                calls["returned_candidates"], errors="coerce"
            ).fillna(0).astype(int)

        started = time.perf_counter()
        processed_since_checkpoint = 0
        total = len(items)
        attempted_calls = int(len(calls))
        stream = progress_stream or sys.stdout

        for item_number, item in enumerate(items.itertuples(index=False), start=1):
            if resume and self._item_complete(calls, item.item_id):
                print(
                    f"item {item_number} of {total}, calls so far {attempted_calls}, "
                    f"elapsed {time.perf_counter() - started:.1f}s (complete; reused results)",
                    file=stream,
                    flush=True,
                )
                continue

            if "item_id" in calls.columns:
                calls = calls[~calls["item_id"].astype(str).eq(str(item.item_id))]
            if not candidates.empty and "item_id" in candidates.columns:
                candidates = candidates[
                    ~candidates["item_id"].astype(str).eq(str(item.item_id))
                ]
            item_calls = []
            item_candidates = []
            for condition in CONDITIONS:
                request_started = time.perf_counter()
                failure_type = None
                parse_failure_reason = None
                try:
                    generated, response = generate_candidates(
                        self.client,
                        incoming_message=item.incoming_message,
                        history_texts=item.history_texts,
                        condition=condition,
                        n=self.n_candidates,
                        temperature=self.temperature,
                        max_tokens=self.max_tokens,
                        return_response=True,
                        strict_json=True,
                    )
                    if len(generated) != self.n_candidates:
                        parse_failure_reason = strict_json_failure_reason(
                            response.text,
                            self.n_candidates,
                        )
                    error_message = None
                    failed = False
                    status_code = None
                    latency = response.latency_s
                    prompt_tokens = response.prompt_tokens
                    completion_tokens = response.completion_tokens
                    cached = response.cached
                    finish_reason = response.finish_reason
                except Exception as exc:
                    generated = []
                    failed = True
                    failure_type = type(exc).__name__
                    error_message = _safe_error(exc)
                    status_code = getattr(exc, "status_code", None)
                    latency = time.perf_counter() - request_started
                    prompt_tokens = None
                    completion_tokens = None
                    cached = False
                    finish_reason = None

                item_calls.append({
                    "item_id": str(item.item_id),
                    "user_id": item.user_id,
                    "condition": condition,
                    "cached": cached,
                    "latency_s": latency,
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "finish_reason": finish_reason,
                    "truncated_output": finish_reason == "length",
                    "failed": failed,
                    "failure_type": failure_type,
                    "failure_status_code": status_code,
                    "failure_message": error_message,
                    "parse_failure": not failed and len(generated) < self.n_candidates,
                    "parse_failure_reason": parse_failure_reason,
                    "returned_candidates": len(generated),
                })
                attempted_calls += 1
                if not generated:
                    continue

                scores = self._rank_candidates(item.user_id, item.item_id, generated)
                evaluated = evaluate_candidates(
                    generated,
                    item.history_texts,
                    item.real_reply,
                    ranker_scores=scores,
                )
                evaluated["item_id"] = str(item.item_id)
                evaluated["user_id"] = item.user_id
                evaluated["condition"] = condition
                evaluated["incoming_message"] = item.incoming_message
                evaluated["real_reply"] = item.real_reply
                item_candidates.extend(evaluated.to_dict("records"))

            calls = pd.concat([calls, pd.DataFrame(item_calls)], ignore_index=True)
            if item_candidates:
                candidates = pd.concat(
                    [candidates, pd.DataFrame(item_candidates)],
                    ignore_index=True,
                )
            processed_since_checkpoint += 1
            if processed_since_checkpoint >= checkpoint_every or item_number == total:
                _atomic_csv(calls, call_path)
                _atomic_csv(candidates, candidate_path)
                processed_since_checkpoint = 0
            print(
                f"item {item_number} of {total}, calls so far {attempted_calls}, "
                f"elapsed {time.perf_counter() - started:.1f}s",
                file=stream,
                flush=True,
            )

        _atomic_csv(calls, call_path)
        _atomic_csv(candidates, candidate_path)
        return calls, candidates


def _summary_tables(calls: pd.DataFrame, candidates: pd.DataFrame, prefix: str) -> None:
    stats = []
    for condition in CONDITIONS:
        group = calls[calls["condition"].eq(condition)]
        successful = group[~group["failed"].astype(bool)]
        latencies = pd.to_numeric(group["latency_s"], errors="coerce").dropna().to_numpy()
        stats.append({
            "condition": condition,
            "calls": len(group),
            "cached_calls": int(group["cached"].astype(bool).sum()),
            "mean_latency_s": float(np.mean(latencies)) if len(latencies) else np.nan,
            "p95_latency_s": float(np.percentile(latencies, 95)) if len(latencies) else np.nan,
            "prompt_tokens": int(pd.to_numeric(group["prompt_tokens"], errors="coerce").fillna(0).sum()),
            "completion_tokens": int(pd.to_numeric(group["completion_tokens"], errors="coerce").fillna(0).sum()),
            "failure_rate": float(group["failed"].astype(bool).mean()) if len(group) else np.nan,
            "parse_failure_rate": float(successful["parse_failure"].astype(bool).mean()) if len(successful) else np.nan,
        })
    _atomic_csv(pd.DataFrame(stats), FINDINGS_DIR / f"{prefix}_call_stats.csv")

    metric_names = [
        "stylometry_similarity",
        "normalized_edit_distance",
        "lexical_similarity",
        "ranker_score",
    ]
    if candidates.empty:
        metric_summary = pd.DataFrame(columns=["condition", *metric_names, "candidate_count"])
    else:
        metric_summary = (
            candidates.groupby("condition")[metric_names]
            .mean()
            .assign(candidate_count=candidates.groupby("condition").size())
            .reset_index()
        )
    _atomic_csv(metric_summary, FINDINGS_DIR / f"{prefix}_metric_summary.csv")


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Resumable NVIDIA generation/ranker evaluation.")
    run_group = parser.add_mutually_exclusive_group()
    run_group.add_argument("--pilot", action="store_true", help="Run/resume the 20-item pilot (default).")
    run_group.add_argument("--full", action="store_true", help="Run/resume the 100-item evaluation.")
    parser.add_argument("--data", type=Path, default=DATA_PATH)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--no-resume", action="store_true")
    args = parser.parse_args(argv)

    load_dotenv(ROOT / ".env")
    if not os.getenv("NIM_MODEL"):
        raise RuntimeError("NIM_MODEL must be configured in the environment or repo .env.")

    limit = FULL_SIZE if args.full else PILOT_SIZE
    prefix = "06_full" if args.full else "06_pilot"
    df = pd.read_csv(args.data)
    eligible = select_eval_items(df)
    items = select_eval_items(df, max_items=limit, seed=args.seed)
    print(f"Qualified items: {len(eligible)}; selected for {prefix}: {len(items)}")

    space = StyleSpace(df, DEFAULT_FEATURES)
    train_df, train_lineups = build_training_lineups(df, n_neg=9, history_frac=0.7, seed=args.seed)
    ranker = train_ranker(
        space,
        train_lineups,
        m=10,
        k=10.0,
        seed=args.seed,
        n_estimators=60,
    )
    print(f"Training users: {train_df['user_id'].nunique()}; lineups: {len(train_lineups)}")

    client = NimClient(
        requests_per_minute=REQUESTS_PER_MINUTE,
        timeout_s=PER_CALL_TIMEOUT_S,
    )
    runner = GenerationEvaluator(df, ranker, client)
    calls, candidates = runner.run(
        items,
        output_prefix=prefix,
        checkpoint_every=10,
        resume=not args.no_resume,
    )
    _summary_tables(calls, candidates, prefix)
    print(f"Completed {prefix}: {len(items)} items, {len(calls)} call records, {len(candidates)} candidate rows.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
