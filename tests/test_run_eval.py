import io

import pandas as pd

from src.generation.nim_client import FakeLLM
from src.generation.run_eval import GenerationEvaluator


def _items():
    return pd.DataFrame([{
        "item_id": "heldout-1",
        "user_id": "u1",
        "timestamp": "2001-01-02T00:00:00Z",
        "incoming_message": "Can you send the report?",
        "real_reply": "Sure, I will send it.",
        "history_texts": ["Sure, I can help.", "I will send that today."],
    }])


def _response(prefix):
    return "[" + ", ".join(f'"{prefix} reply {index}"' for index in range(5)) + "]"


def _runner(tmp_path, monkeypatch, responses):
    import src.generation.run_eval as run_eval

    monkeypatch.setattr(run_eval, "FINDINGS_DIR", tmp_path)
    client = FakeLLM(responses)
    runner = GenerationEvaluator(
        df=pd.DataFrame(),
        ranker=object(),
        client=client,
    )
    runner._rank_candidates = lambda user_id, item_id, candidates: list(range(len(candidates)))
    return runner, client


def test_run_saves_item_results_and_resume_skips_completed_item(tmp_path, monkeypatch):
    runner, client = _runner(
        tmp_path,
        monkeypatch,
        [_response("neutral"), _response("fewshot"), _response("instruction")],
    )
    progress = io.StringIO()

    calls, candidates = runner.run(
        _items(),
        output_prefix="06_pilot",
        checkpoint_every=1,
        progress_stream=progress,
    )
    assert len(calls) == 3
    assert len(candidates) == 15
    assert len(client.calls) == 3
    assert (tmp_path / "06_pilot_call_stats_raw.csv").exists()
    assert (tmp_path / "06_pilot_candidate_metrics.csv").exists()
    assert "item 1 of 1, calls so far 3" in progress.getvalue()

    resumed_calls, resumed_candidates = runner.run(
        _items(),
        output_prefix="06_pilot",
        checkpoint_every=1,
    )

    assert len(resumed_calls) == 3
    assert len(resumed_candidates) == 15
    assert len(client.calls) == 3


def test_failed_item_is_retried_and_old_partial_rows_are_replaced(tmp_path, monkeypatch):
    runner, client = _runner(
        tmp_path,
        monkeypatch,
        [
            RuntimeError("temporary failure"),
            _response("fewshot"),
            _response("instruction"),
            _response("neutral-retry"),
            _response("fewshot-retry"),
            _response("instruction-retry"),
        ],
    )

    first_calls, _ = runner.run(
        _items(),
        output_prefix="06_retry",
        checkpoint_every=1,
    )
    assert first_calls["failed"].astype(bool).sum() == 1

    retried_calls, retried_candidates = runner.run(
        _items(),
        output_prefix="06_retry",
        checkpoint_every=1,
    )

    assert len(client.calls) == 6
    assert len(retried_calls) == 3
    assert not retried_calls["failed"].astype(bool).any()
    assert len(retried_candidates) == 15
