from src.features.extractor import extract_style_features


def test_extract_style_features_counts_text_signals():
    features = extract_style_features("Thanks! 😊")
    assert features["word_count"] == 1
    assert features["exclamation_count"] == 1
    assert features["emoji_count"] == 1
    assert 0 <= features["formality_score"] <= 1