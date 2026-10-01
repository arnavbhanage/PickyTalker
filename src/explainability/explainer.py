"""Human-readable breakdown of style ranking scores."""

from src.features.extractor import extract_style_features


def explain_response(text: str, profile: dict[str, float]) -> dict[str, float]:
    features = extract_style_features(text)
    dimensions = {
        "text_length": "mean_text_length",
        "word_count": "mean_word_count",
        "emoji_count": "mean_emoji_count",
        "formality_score": "mean_formality_score",
    }
    return {
        feature: round(1.0 - min(abs(float(features[feature]) - float(profile[key])) / max(abs(float(profile[key])), 1.0), 1.0), 4)
        for feature, key in dimensions.items()
        if key in profile
    }