"""Order candidate responses by style compatibility."""

from src.ranking.scorer import score_response


def rank_responses(candidates: list[str], profile: dict[str, float]) -> list[tuple[str, float]]:
    """Return candidate and score pairs, highest score first; preserve ties' input order."""
    scored = [(candidate, score_response(candidate, profile)) for candidate in candidates]
    return sorted(scored, key=lambda item: item[1], reverse=True)