"""Score candidate responses against an aggregate user style profile."""

from src.features.extractor import extract_style_features


def score_response(text: str, profile: dict[str, float]) -> float:
    features = extract_style_features(text)
    dimensions = {
        "text_length": "mean_text_length",
        "word_count": "mean_word_count",
        "emoji_count": "mean_emoji_count",
        "formality_score": "mean_formality_score",
    }
    distances = []
    for feature, profile_key in dimensions.items():
        if profile_key not in profile:
            continue
        target = float(profile[profile_key])
        value = float(features[feature])
        scale = max(abs(target), 1.0)
        distances.append(min(abs(value - target) / scale, 1.0))
    return 1.0 - (sum(distances) / len(distances)) if distances else 0.0