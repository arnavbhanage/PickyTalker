import pytest

from src.generation.metrics import (
    evaluate_candidates,
    lexical_similarity,
    normalized_edit_distance,
    stylometry_similarity,
)


def test_stylometry_similarity_has_known_identity_and_empty_results():
    assert stylometry_similarity("hello there", ["hello there"]) == pytest.approx(1.0)
    assert stylometry_similarity("hello there", []) == 0.0


def test_normalized_edit_distance_known_strings():
    assert normalized_edit_distance("same", "same") == 0.0
    assert normalized_edit_distance("a", "ab") == pytest.approx(0.5)
    assert normalized_edit_distance("", "abc") == 1.0


def test_lexical_similarity_known_strings():
    assert lexical_similarity("yes send report", "send report") == pytest.approx(2 / 3)
    assert lexical_similarity("yes", "no") == 0.0
    assert lexical_similarity("", "") == 1.0


def test_metrics_frame_marks_ranker_as_not_independent():
    result = evaluate_candidates(
        ["Sure, I can send it.", "No, I cannot."],
        ["Sure, I can help with that."],
        "Sure, I can send it.",
        ranker_scores=[0.8, 0.1],
    )

    assert result.iloc[0]["normalized_edit_distance"] == 0.0
    assert result.iloc[0]["lexical_similarity"] == 1.0
    assert result["ranker_score_independent"].eq(False).all()


def test_ranker_score_count_must_match_candidates():
    with pytest.raises(ValueError, match="one value per candidate"):
        evaluate_candidates(["one", "two"], [], "one", ranker_scores=[0.5])
