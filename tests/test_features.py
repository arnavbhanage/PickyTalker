from src.features.extractor import detokenize, extract_message


def test_detokenize_dailydialog_style():
    assert detokenize("Say , Jim , how about going ?") == "Say, Jim, how about going?"
    assert detokenize("I don \u2019 t know") == "I don\u2019t know"


def test_emoji_and_question():
    f = extract_message("Yep \U0001F44D I'll send it soon.")
    assert f["n_emoji"] == 1 and f["has_emoji"] == 1
    assert extract_message("Really ?")["n_questions"] == 1


def test_empty_message_is_safe():
    f = extract_message("")
    assert f["n_words"] == 0 and f["avg_sent_len"] == 0


def test_length_ordering():
    assert extract_message("ok")["n_words"] < extract_message("ok I will send it now")["n_words"]