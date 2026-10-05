from __future__ import annotations

from typing import Sequence

from src.generation.style_instruction import (
    build_profile_from_texts,
    instruction_from_profile,
)
from src.inference import InferenceEngine


def profile_from_history(history: Sequence[str], prior_strength: float) -> dict:
    profile = build_profile_from_texts(history)
    return {
        "profile": profile,
        "instruction": instruction_from_profile(profile),
        "n_messages_used": len(history),
        "confidence": (
            len(history) / (len(history) + prior_strength)
            if history
            else 0.0
        ),
    }


def rank_candidates(
    engine: InferenceEngine,
    history: Sequence[str],
    candidates: Sequence[str],
) -> list[dict]:
    scored = engine.score_candidates(history, candidates)
    order = sorted(
        range(len(candidates)),
        key=lambda index: (-scored.ranker_scores[index], index),
    )
    ranked = []
    for rank, index in enumerate(order, start=1):
        contributions = scored.style_contributions[index]
        strongest = sorted(
            contributions.items(),
            key=lambda item: abs(item[1]),
            reverse=True,
        )[:3]
        reasons = [
            (
                f"{feature.replace('_', ' ')} contributes positively to the match."
                if value >= 0
                else f"{feature.replace('_', ' ')} contributes negatively to the match."
            )
            for feature, value in strongest
        ]
        ranked.append({
            "candidate": candidates[index],
            "rank": rank,
            "ranker_score": scored.ranker_scores[index],
            "style_score": scored.style_scores[index],
            "contributions": contributions,
            "reasons": reasons,
        })
    return ranked
