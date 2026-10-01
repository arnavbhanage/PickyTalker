"""Parse the Enron corpus into a persistent-user message table.

Supports two layouts, auto-detected by `load_enron`:
  1. maildir folders:  <root>/<mailbox>/<folder>/<files>   (original CMU release)
  2. a single CSV with columns `file`, `message`           (the common Kaggle copy)

Output columns: user_id, message_id, timestamp (UTC ISO), message (reply text the
user wrote), context (quoted incoming text, may be empty), n_recipients,
recipient_id (hashed primary recipient), is_reply.

Only SENT folders are used so authorship is certain. Users and recipients are
pseudonymized with a salted hash. Known limits: signature/quote stripping is
heuristic; corpus is corporate English from ~1999-2002.
"""
import email
import hashlib
import os
import re
from collections import Counter
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
    """Re-join hard-wrapped lines but keep paragraph breaks and list items."""
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


def _count(stats, key):
    if stats is not None:
        stats[key] += 1


def parse_raw(raw: bytes, key: str, min_words: int = 3, max_words: int = 500, stats=None):
    """Parse one raw email (bytes). `key` identifies it (path) for the message id."""
    try:
        msg = email.message_from_bytes(raw, policy=policy.default)
        dt = parsedate_to_datetime(str(msg["Date"]))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        dt = dt.astimezone(timezone.utc)
    except Exception:
        _count(stats, "rejected_bad_header_or_date")
        return None

    body = _body(msg).replace("\r\n", "\n")
    m = MARKER_RE.search(body)
    top, quoted = (body[: m.start()], body[m.start():]) if m else (body, "")
    top = unwrap(SIG_RE.split("\n" + top)[0])
    n_words = len(WORD_RE.findall(top))
    if n_words < min_words:
        _count(stats, "rejected_too_short_or_pure_forward")
        return None
    if n_words > max_words:
        _count(stats, "rejected_too_long")
        return None

    ctx = "\n".join(re.sub(r"^[>\s]+", "", ln) for ln in quoted.split("\n"))
    ctx = unwrap(re.sub(r"^\s*-{2,}.*$", "", ctx, flags=re.M))[:1500]

    from_addr = (getaddresses([str(msg.get("From", ""))]) or [("", "")])[0][1].lower()
    rcpts = sorted({a.lower() for _, a in getaddresses(
        [str(msg.get("To", "")), str(msg.get("Cc", ""))]) if a})
    to_first = (getaddresses([str(msg.get("To", ""))]) or [("", "")])[0][1].lower()
    _count(stats, "parsed_ok")
    return {
        "message_id": anon(key),
        "timestamp": dt.isoformat(),
        "message": top,
        "context": ctx,
        "n_recipients": len(rcpts),
        "recipient_id": anon(to_first) if to_first else "",
        "is_reply": int(str(msg.get("Subject", "")).strip().lower().startswith("re:")),
        "from_addr": from_addr,
    }


def parse_message(path, min_words: int = 3, max_words: int = 500, stats=None):
    try:
        raw = Path(path).read_bytes()
    except OSError:
        _count(stats, "rejected_unreadable_file")
        return None
    return parse_raw(raw, str(path), min_words, max_words, stats)


def _finalize(rows) -> pd.DataFrame:
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


def build_enron(root, min_words: int = 3, max_words: int = 500, stats=None) -> pd.DataFrame:
    """Maildir layout: <root>/<mailbox>/<folder>/<files>."""
    root = Path(root)
    rows, seen = [], 0
    for dirpath, _, files in os.walk(root):
        p = Path(dirpath)
        rel = p.relative_to(root).parts
        if len(rel) < 2 or "sent" not in rel[1].lower():
            continue
        for f in files:
            _count(stats, "sent_files_seen")
            seen += 1
            if seen % 20000 == 0:
                print(f"  ...{seen:,} sent files read")
            r = parse_message(p / f, min_words, max_words, stats)
            if r:
                r["owner"] = rel[0]
                rows.append(r)
    return _finalize(rows)


def build_enron_csv(csv_path, min_words: int = 3, max_words: int = 500,
                    stats=None, chunksize: int = 50000) -> pd.DataFrame:
    """CSV layout: columns `file` (e.g. 'allen-p/_sent_mail/1.') and `message` (raw email)."""
    rows, seen = [], 0
    for chunk in pd.read_csv(csv_path, usecols=["file", "message"], dtype=str,
                             chunksize=chunksize):
        for file, raw in zip(chunk["file"], chunk["message"]):
            parts = str(file).replace("\\", "/").split("/")
            if len(parts) < 3 or "sent" not in parts[1].lower():
                continue
            _count(stats, "sent_files_seen")
            seen += 1
            if seen % 20000 == 0:
                print(f"  ...{seen:,} sent messages read")
            r = parse_raw(str(raw).encode("utf-8", "ignore"), str(file),
                          min_words, max_words, stats)
            if r:
                r["owner"] = parts[0]
                rows.append(r)
    return _finalize(rows)


# ---------- auto-detection ----------
def _looks_like_maildir(p: Path) -> bool:
    try:
        for mb in p.iterdir():
            if mb.is_dir():
                for sub in mb.iterdir():
                    if sub.is_dir() and "sent" in sub.name.lower():
                        return True
    except OSError:
        pass
    return False


def find_maildir_root(base, max_depth: int = 4):
    """Shallowest folder under `base` that directly contains mailboxes with sent folders."""
    level = [Path(base)]
    for _ in range(max_depth + 1):
        for p in level:
            if p.is_dir() and _looks_like_maildir(p):
                return p
        nxt = []
        for p in level:
            try:
                nxt += [c for c in p.iterdir() if c.is_dir()]
            except OSError:
                pass
        level = nxt
    return None


def find_enron_csv(base):
    for p in Path(base).rglob("*.csv"):
        try:
            cols = set(pd.read_csv(p, nrows=0).columns)
        except Exception:
            continue
        if {"file", "message"} <= cols:
            return p
    return None


def _tree_preview(base: Path, limit: int = 12) -> str:
    lines = []
    try:
        for c in sorted(base.iterdir())[:limit]:
            lines.append(f"  {c.name}{'/' if c.is_dir() else ''}")
            if c.is_dir():
                for g in sorted(c.iterdir())[:5]:
                    lines.append(f"      {g.name}{'/' if g.is_dir() else ''}")
    except OSError:
        pass
    return "\n".join(lines) or "  (empty)"


def load_enron(base, min_words: int = 3, max_words: int = 500, stats=None) -> pd.DataFrame:
    base = Path(base)
    if not base.exists():
        raise FileNotFoundError(f"Folder not found: {base.resolve()}")
    root = find_maildir_root(base)
    if root is not None:
        print(f"Using maildir folders at: {root.resolve()}")
        return build_enron(root, min_words, max_words, stats)
    csv = find_enron_csv(base)
    if csv is not None:
        print(f"Using CSV file: {csv.resolve()}")
        return build_enron_csv(csv, min_words, max_words, stats)
    raise FileNotFoundError(
        f"Found neither maildir folders (<mailbox>/<folder with 'sent' in its name>/files) "
        f"nor a CSV with columns 'file' and 'message' under {base.resolve()}.\n"
        f"What is there:\n{_tree_preview(base)}\n"
        "If the extraction looks incomplete, re-extract with 7-Zip (original files have "
        "names ending in a dot, which some Windows tools mishandle)."
    )