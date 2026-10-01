"""Parse the Enron maildir into a persistent-user message table.

Output columns: user_id, message_id, timestamp (UTC ISO), message (the reply
text the user wrote), context (quoted incoming text, may be empty),
n_recipients, recipient_id (hashed primary recipient), is_reply.

Only SENT folders are used so authorship is certain. Users and recipients are
pseudonymized with a salted hash. Known limits: signature/quote stripping is
heuristic, and the corpus is corporate English from ~1999-2002.
"""
import email
import hashlib
import os
import re
from datetime import timezone
from email import policy
from email.utils import getaddresses, parsedate_to_datetime
from pathlib import Path

import pandas as pd

SALT = "pickytalker-v1"


def anon(s: str) -> str:
    return hashlib.sha256((SALT + s.lower()).encode()).hexdigest()[:10]


MARKER_RE = re.compile(
    r"^(?:\s*-{2,}\s*(?:original message|forwarded by)"
    r"|\s*on\s.{5,200}\swrote:\s*$"
    r"|\s*>)",
    re.I | re.M,
)
SIG_RE = re.compile(r"\n--\s*\n")
LIST_LINE_RE = re.compile(r"^\s*([-*\u2022]|\d+[.)])\s+")
WORD_RE = re.compile(r"[A-Za-z0-9']+")


def unwrap(text: str) -> str:
    """Re-join hard-wrapped lines (Enron mails are wrapped ~70 chars) but keep
    paragraph breaks and list items, so newlines mean something."""
    paras = re.split(r"\n\s*\n", text.strip())
    out = []
    for p in paras:
        lines = [ln.strip() for ln in p.split("\n") if ln.strip()]
        if any(LIST_LINE_RE.match(ln) for ln in lines):
            out.append("\n".join(lines))
        else:
            out.append(" ".join(lines))
    return "\n\n".join(x for x in out if x)


def _body(msg) -> str:
    try:
        if msg.is_multipart():
            part = msg.get_body(preferencelist=("plain",))
            return part.get_content() if part else ""
        return msg.get_content()
    except Exception:
        payload = msg.get_payload(decode=True)
        return payload.decode("utf-8", errors="ignore") if payload else ""


def parse_message(path, min_words: int = 3, max_words: int = 500):
    try:
        msg = email.message_from_bytes(Path(path).read_bytes(), policy=policy.default)
        dt = parsedate_to_datetime(str(msg["Date"]))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        dt = dt.astimezone(timezone.utc)
    except Exception:
        return None

    body = _body(msg).replace("\r\n", "\n")
    m = MARKER_RE.search(body)
    top, quoted = (body[: m.start()], body[m.start():]) if m else (body, "")
    top = SIG_RE.split("\n" + top)[0]
    top = unwrap(top)
    n_words = len(WORD_RE.findall(top))
    if n_words < min_words or n_words > max_words:   # pure forwards / empty / huge
        return None

    ctx = "\n".join(re.sub(r"^[>\s]+", "", ln) for ln in quoted.split("\n"))
    ctx = unwrap(re.sub(r"^\s*-{2,}.*$", "", ctx, flags=re.M))[:1500]

    from_addr = (getaddresses([str(msg.get("From", ""))]) or [("", "")])[0][1].lower()
    rcpts = sorted({a.lower() for _, a in getaddresses(
        [str(msg.get("To", "")), str(msg.get("Cc", ""))]) if a})
    to_first = (getaddresses([str(msg.get("To", ""))]) or [("", "")])[0][1].lower()
    return {
        "message_id": anon(str(path)),
        "timestamp": dt.isoformat(),
        "message": top,
        "context": ctx,
        "n_recipients": len(rcpts),
        "recipient_id": anon(to_first) if to_first else "",
        "is_reply": int(str(msg.get("Subject", "")).strip().lower().startswith("re:")),
        "from_addr": from_addr,
    }


def build_enron(root, min_words: int = 3, max_words: int = 500) -> pd.DataFrame:
    root = Path(root)
    rows = []
    for dirpath, _, files in os.walk(root):
        p = Path(dirpath)
        rel = p.relative_to(root).parts
        if len(rel) < 2 or "sent" not in rel[1].lower():
            continue
        for f in files:
            r = parse_message(p / f, min_words, max_words)
            if r:
                r["owner"] = rel[0]
                rows.append(r)
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    # keep only mails whose From matches the mailbox owner's most common From
    main_from = df.groupby("owner")["from_addr"].agg(lambda s: s.mode().iat[0])
    df = df[df["from_addr"] == df["owner"].map(main_from)].copy()
    # drop duplicate bodies per user (Enron has many copies across folders)
    norm = df["message"].str.lower().str.replace(r"\W+", "", regex=True)
    df = df.loc[~pd.DataFrame({"o": df["owner"], "n": norm}).duplicated()].copy()
    df["user_id"] = df["owner"].map(anon)
    return df.drop(columns=["owner", "from_addr"]).reset_index(drop=True)