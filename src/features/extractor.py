
import re
import numpy as np
import pandas as pd

try:  # preferred: full emoji coverage
    import emoji as _emoji

    def _emoji_list(s: str):
        return [e["emoji"] for e in _emoji.emoji_list(s)]
except ImportError:  # fallback: main emoji unicode blocks
    _EMOJI_RE = re.compile("[\U0001F300-\U0001FAFF\U0001F000-\U0001F2FF\u2600-\u27BF]")

    def _emoji_list(s: str):
        return _EMOJI_RE.findall(s)

EMOTICON_RE = re.compile(r"(?::|;|=)-?[)(DPpOo/\\|]|<3|\bxD\b")
SENT_RE = re.compile(r"[^.!?]+[.!?]*")
LIST_RE = re.compile(r"(^|\n)\s*([-*\u2022]|\d+[.)])\s+")
WORD_RE = re.compile(r"[A-Za-z0-9']+")
PUNCT = set(".,!?;:-\u2014\u2026\"'()")


def detokenize(s: str) -> str:
    """Undo the space-before-punctuation tokenization seen in DailyDialog.

    Without this, punctuation/length features would measure the *dataset's
    preprocessing*, not the speaker. Light regex on purpose; verify on samples.
    """
    s = str(s)
    s = re.sub(r"\s+([.,!?;:%)\]])", r"\1", s)
    s = re.sub(r"([(\[])\s+", r"\1", s)
    s = re.sub(r"\s*([\u2019'])\s*(s|t|m|d|re|ve|ll)\b", r"\1\2", s)
    return re.sub(r"[ \t]+", " ", s).strip()


FEATURES = [
    # length
    "n_words", "n_chars", "log_words",
    # emoji
    "n_emoji", "has_emoji", "emoji_per_word", "n_emoticon",
    # structure
    "n_sentences", "avg_sent_len", "punct_density", "n_questions",
    "n_exclam", "has_ellipsis", "caps_ratio", "starts_lower",
    "has_newline", "has_list",
]


def extract_message(raw: str) -> dict:
    t = detokenize(raw)
    words = WORD_RE.findall(t)
    n_words, n_chars = len(words), len(t)
    sents = [x for x in SENT_RE.findall(t) if re.search(r"\w", x)]
    n_sent = max(len(sents), 1)
    emo = _emoji_list(t)
    letters = [c for c in t if c.isalpha()]
    return {
        "n_words": n_words,
        "n_chars": n_chars,
        "log_words": float(np.log1p(n_words)),
        "n_emoji": len(emo),
        "has_emoji": int(len(emo) > 0),
        "emoji_per_word": len(emo) / max(n_words, 1),
        "n_emoticon": len(EMOTICON_RE.findall(t)),
        "n_sentences": len(sents),
        "avg_sent_len": n_words / n_sent,
        "punct_density": sum(c in PUNCT for c in t) / max(n_chars, 1),
        "n_questions": t.count("?"),
        "n_exclam": t.count("!"),
        "has_ellipsis": int("..." in t or "\u2026" in t),
        "caps_ratio": sum(c.isupper() for c in letters) / max(len(letters), 1),
        "starts_lower": int(bool(t) and t[0].islower()),
        "has_newline": int("\n" in str(raw)),
        "has_list": int(bool(LIST_RE.search(str(raw)))),
    }


def extract_frame(df: pd.DataFrame, text_col: str = "message") -> pd.DataFrame:
    feats = pd.DataFrame([extract_message(m) for m in df[text_col].fillna("")],
                         index=df.index)
    return pd.concat([df, feats], axis=1)