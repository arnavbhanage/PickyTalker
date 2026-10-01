from src.ranking.ranker import rank_responses


def test_rank_responses_orders_closest_style_first():
    profile = {
        "mean_text_length": 9,
        "mean_word_count": 2,
        "mean_emoji_count": 0,
        "mean_formality_score": 1,
    }
    ranked = rank_responses(["ok", "Thank you"], profile)
    assert ranked[0][0] == "Thank you"
    assert ranked[0][1] >= ranked[1][1]