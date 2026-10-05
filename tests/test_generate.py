import pytest

from src.generation.generate import (
    _parse_strict_json_candidates,
    generate_candidates,
    strict_json_failure_reason,
)
from src.generation.nim_client import FakeLLM


def _generate(text, condition="neutral", history=None, n=5):
    fake = FakeLLM([text])
    candidates = generate_candidates(
        fake,
        incoming_message="Can you send the report?",
        history_texts=history or [],
        condition=condition,
        n=n,
        temperature=0.3,
    )
    return candidates, fake


def test_parses_json_list_in_one_request():
    candidates, fake = _generate('["Sure, I will send it.", "I can send it today."]')

    assert candidates == ["Sure, I will send it.", "I can send it today."]
    assert len(fake.calls) == 1
    assert fake.calls[0]["max_tokens"] == 2500


def test_parses_fenced_json_and_plain_lines():
    fenced, _ = _generate('```json\n["Okay.", "I will do that."]\n```')
    lines, _ = _generate("- Okay.\n- I will do that.")

    assert fenced == ["Okay.", "I will do that."]
    assert lines == ["Okay.", "I will do that."]


def test_drops_duplicates_empty_values_and_non_string_items():
    candidates, _ = _generate('["Yes.", "", " yes. ", null, "No."]')

    assert candidates == ["Yes.", "No."]


def test_partial_malformed_output_keeps_usable_candidates():
    candidates, _ = _generate('["Yes.",\nnot valid json\n"No."]')

    assert candidates == ["Yes.", "not valid json", "No."]


def test_truncated_json_list_recovers_only_complete_string_entries():
    candidates, _ = _generate('["first reply", "second reply", "unterminated')

    assert candidates == ["first reply", "second reply"]


@pytest.mark.parametrize(
    "text",
    [
        '<think>Let me think through this.</think> ["safe-looking reply"]',
        'Analysis: I should answer politely.\n["safe-looking reply"]',
        '["safe-looking reply", "Let me think through the answer"]',
    ],
)
def test_reasoning_text_never_leaks_into_candidates(text):
    candidates, _ = _generate(text)

    assert candidates == []


def test_empty_output_returns_no_candidates():
    candidates, _ = _generate(" \n ")

    assert candidates == []


def test_strict_json_rejects_analysis_and_requires_distinct_complete_candidates():
    assert _parse_strict_json_candidates(
        'Here is a thinking process:\n["reply one", "reply two"]',
        2,
    ) == []
    assert _parse_strict_json_candidates('["reply one", "reply one"]', 2) == []
    assert _parse_strict_json_candidates('["reply one"]', 2) == []
    assert _parse_strict_json_candidates('["reply one", "reply two"]', 2) == [
        "reply one",
        "reply two",
    ]
    assert _parse_strict_json_candidates(
        '{"candidates":["reply one","reply two"]}',
        2,
    ) == ["reply one", "reply two"]
    assert _parse_strict_json_candidates('["Sure!","sure"]', 2) == []
    assert _parse_strict_json_candidates('["As an AI, I would say yes.","No."]', 2) == []


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        (" ", "empty_message_content"),
        ('["one",]', "json_parse_failure"),
        ('{"other":["one","two"]}', "invalid_json_shape"),
        ('{"candidates":["one"]}', "candidate_count_mismatch"),
        ('{"candidates":["one","one"]}', "duplicate_candidates"),
        (
            '{"candidates":["<think>analysis</think>","reply"]}',
            "reasoning_text_in_content",
        ),
    ],
)
def test_strict_json_failure_reason_is_specific_and_does_not_return_content(
    text,
    expected,
):
    assert strict_json_failure_reason(text, 2) == expected


def test_strict_json_prompt_matches_structured_response_format():
    fake = FakeLLM(['{"candidates":["reply one","reply two"]}'])
    generate_candidates(
        fake,
        "hello",
        [],
        "neutral",
        2,
        0.2,
        strict_json=True,
    )

    prompt = fake.calls[0]["messages"][0]["content"]
    assert "JSON object" in prompt
    assert "JSON list" not in prompt
    assert fake.calls[0]["response_format"] == {"type": "json_object"}


def test_api_generation_requests_json_object_mode():
    fake = FakeLLM(['{"candidates":["reply one","reply two"]}'])
    candidates = generate_candidates(
        fake,
        "hello",
        [],
        "instruction",
        2,
        0.2,
        strict_json=True,
    )
    assert candidates == ["reply one", "reply two"]
    assert fake.calls[0]["response_format"] == {"type": "json_object"}


def test_generation_failure_is_not_hidden():
    fake = FakeLLM([RuntimeError("service unavailable")])

    with pytest.raises(RuntimeError, match="service unavailable"):
        generate_candidates(fake, "hello", [], "neutral", 2, 0.2)


def test_can_return_call_metadata_for_cost_and_latency_accounting():
    fake = FakeLLM(['["ok"]'])

    candidates, response = generate_candidates(
        fake,
        "hello",
        [],
        "neutral",
        1,
        0.2,
        return_response=True,
    )

    assert candidates == ["ok"]
    assert response.cached is False
    assert response.latency_s == 0.0


def test_fewshot_and_instruction_conditions_use_only_their_own_style_context():
    history = [f"past message {index}" for index in range(12)]
    _, fewshot = _generate('["ok"]', condition="fewshot", history=history, n=1)
    _, instruction = _generate('["ok"]', condition="instruction", history=history, n=1)
    fewshot_prompt = fewshot.calls[0]["messages"][1]["content"]
    instruction_prompt = instruction.calls[0]["messages"][1]["content"]

    assert "past message 2" in fewshot_prompt
    assert "past message 11" in fewshot_prompt
    assert "Style instruction:" not in fewshot_prompt
    assert "Style instruction:" in instruction_prompt
    assert "Examples of the user's past messages" not in instruction_prompt
