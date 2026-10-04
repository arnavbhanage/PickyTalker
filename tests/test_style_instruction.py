from src.generation.style_instruction import build_profile_from_texts, instruction_from_profile


def test_instruction_is_deterministic_and_word_band_matches_profile():
    texts = [
        "okay sure",
        "yes, I can send that tomorrow.",
        "thanks, I will take a look.",
        "i can follow up on this next week if that works.",
    ]

    profile = build_profile_from_texts(texts)
    instruction = instruction_from_profile(profile)

    assert instruction == instruction_from_profile(profile)
    assert "about 5 to 7 words" in instruction
    assert "rarely asking questions" in instruction


def test_empty_and_tiny_history_are_handled_without_invented_traits():
    empty_profile = build_profile_from_texts([])
    empty_instruction = instruction_from_profile(empty_profile)
    tiny_profile = build_profile_from_texts(["hi!"])
    tiny_instruction = instruction_from_profile(tiny_profile)

    assert empty_profile["message_count"] == 0
    assert "No reliable style history" in empty_instruction
    assert tiny_profile["message_count"] == 1
    assert "very limited" in tiny_instruction


def test_plain_strings_use_existing_feature_extraction():
    texts = ["hello there\nhow are you?", "i am fine!", "That is good."]
    profile = build_profile_from_texts(texts)

    assert profile["message_count"] == 3
    assert profile["question_share"] == 1 / 3
    assert profile["exclamation_rate"] == 1 / 3
    assert profile["starts_lower_share"] == 1 / 3
    assert profile["newline_share"] == 1 / 3
    assert profile["average_sentence_length"] > 0
