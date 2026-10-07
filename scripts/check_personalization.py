"""Synthetic, non-benchmark smoke check of two explicit writing styles.

Calls the running local /respond API twice. No account data, training history,
credentials or cached outputs are read. This is not an accuracy evaluation.
"""
import json
import argparse
import time
import urllib.request
import urllib.error


CASES = {
    "casual": [
        "yep gotchu", "nah dw about it", "all good lol", "sounds good to me",
        "no worries :)", "sure thing", "yep that works", "thanks mate",
        "haha glad it helped", "anytime bro",
    ],
    "formal": [
        "Thank you for your message. I appreciate the update and will review the details carefully.",
        "Certainly. Please let me know if any additional information would be helpful for your review.",
        "I appreciate your thoughtful feedback and am pleased that the information was useful.",
        "Thank you for confirming. I look forward to discussing the next steps with you.",
        "That is perfectly acceptable. Thank you for keeping me informed about the change.",
        "You are most welcome. I am glad that the material addressed your questions effectively.",
        "Thank you for sharing the document. I will take the necessary time to review it.",
        "I appreciate your assistance with this matter. Your clarification has been very helpful.",
        "It was a pleasure to assist. Please do not hesitate to reach out with further questions.",
        "Thank you for the update. I understand the situation and appreciate your explanation.",
    ],
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--style", choices=list(CASES))
    parser.add_argument("--n", type=int, choices=range(1, 9), default=5)
    parser.add_argument("--diagnose", action="store_true", help="One uncached request; print only safe format/token diagnostics.")
    arguments = parser.parse_args()
    for label, history in CASES.items():
        if arguments.style and label != arguments.style:
            continue
        started = time.perf_counter()
        if arguments.diagnose:
            from src.generation.generate import generate_candidates, strict_json_failure_reason
            from src.generation.nim_client import NimClient
            candidates, response = generate_candidates(
                NimClient(cache_enabled=False, max_retries=0, thinking_enabled=False),
                "Thanks, that explanation really helped!", history,
                "personalized", arguments.n, 0.2, strict_json=True, return_response=True,
            )
            print(json.dumps({
                "style": label, "elapsed_s": round(time.perf_counter() - started, 2),
                "candidate_count": len(candidates), "finish_reason": response.finish_reason,
                "completion_tokens": response.completion_tokens,
                "content_characters": len(response.text),
                "format_failure": strict_json_failure_reason(response.text, arguments.n),
            }), flush=True)
            continue
        request = urllib.request.Request(
            "http://127.0.0.1:8765/respond",
            data=json.dumps({"history": history, "incoming": "Thanks, that explanation really helped!", "n": arguments.n}).encode(),
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=300) as response:
                result = json.load(response)
        except urllib.error.HTTPError as error:
            # This is the backend's sanitized error contract, not provider text.
            detail = json.load(error).get("detail")
            print(json.dumps({"style": label, "elapsed_s": round(time.perf_counter() - started, 2), "status": error.code, "detail": detail}), flush=True)
            continue
        print(json.dumps({
            "style": label, "elapsed_s": round(time.perf_counter() - started, 2),
            "best": result["best"]["candidate"],
            "candidates": [row["candidate"] for row in result["candidates"]],
            "sample_count": len(history), "llm_calls": result["meta"]["llm_calls"],
        }, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
