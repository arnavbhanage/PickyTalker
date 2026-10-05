from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from src.backend_service import rank_candidates
from src.inference import InferenceEngine


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "models"
OUTPUT_PATH = ROOT / "docs" / "findings" / "06_synthetic_user_sanity.csv"
INCOMING = "I will arrive in around ten minutes."
CANDIDATES = [
    "yea ill be there in like 10 mins",
    "I should arrive in approximately ten minutes.",
    "I will arrive in around ten minutes.",
    "I expect to arrive in approximately ten minutes; thank you for your patience.",
    "omw in 10 mins!! 😭",
]
USERS = {
    "informal_lowercase": [
        "yea ill check",
        "nah not yet",
        "send it here",
        "gimme 5 mins",
        "idk probably",
    ],
    "formal_complete": [
        "I will review the document and send you my comments this afternoon.",
        "Thank you for your message. I will respond once I have checked the details.",
        "I appreciate your patience while I confirm the revised schedule.",
        "Please let me know if you require any additional information.",
        "I will arrive at the office at approximately nine o'clock.",
    ],
    "expressive_energetic": [
        "yea absolutely, ill be there soon!! 😊",
        "that sounds great!! cant wait 😭✨",
        "omg yes, ill check it out right now!",
        "thanks so much, youre the best!! 💛",
        "on my way, see you in a few!!",
    ],
}


def evaluate(model_dir: str | Path = MODEL_DIR) -> pd.DataFrame:
    engine = InferenceEngine.load(model_dir)
    rows = []
    for user_type, history in USERS.items():
        ranked = rank_candidates(engine, history, CANDIDATES)
        for result in ranked:
            rows.append({
                "user_type": user_type,
                "history_messages": len(history),
                "incoming": INCOMING,
                **result,
                "contributions_json": json.dumps(
                    result["contributions"],
                    sort_keys=True,
                ),
                "reasons_json": json.dumps(result["reasons"], ensure_ascii=False),
            })
    frame = pd.DataFrame(rows).drop(columns=["contributions", "reasons"])
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(OUTPUT_PATH, index=False)
    return frame


def main() -> int:
    frame = evaluate()
    print(f"Saved {len(frame)} scored synthetic-user rows to {OUTPUT_PATH}.")
    for result in frame[frame["rank"].eq(1)].to_dict("records"):
        print(json.dumps({
            "user_type": result["user_type"],
            "candidate": result["candidate"],
            "ranker_score": result["ranker_score"],
            "style_score": result["style_score"],
        }, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
