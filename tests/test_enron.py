from src.data.enron import (parse_message, unwrap, build_enron, build_enron_csv,
                            find_maildir_root, load_enron)
from src.data.splits import make_splits


def _mail(body, subject="Hi", frm="a@x.com", to="b@y.com", date="Mon, 14 May 2001 16:39:00 -0700"):
    return f"From: {frm}\nTo: {to}\nSubject: {subject}\nDate: {date}\n\n{body}\n"


def _make_maildir(root, users=2, n=12):
    for owner in [f"u{i}" for i in range(users)]:
        d = root / owner / "_sent_mail"
        d.mkdir(parents=True)
        for i in range(n):
            (d / f"{i}.").write_text(_mail(f"message number {i} from {owner} please review",
                                           frm=f"{owner}@x.com",
                                           date=f"Mon, {i+1} May 2001 10:00:00 -0700"))
        (d / "dup.").write_text(_mail(f"message number 0 from {owner} please review", frm=f"{owner}@x.com"))


def test_reply_is_split_from_quoted_context(tmp_path):
    p = tmp_path / "1."
    p.write_text(_mail("Sure, I will send it today.\n\n-----Original Message-----\nFrom: b\nCan you send the file?",
                       subject="Re: file"))
    r = parse_message(p)
    assert r["message"].startswith("Sure, I will send it today")
    assert "Can you send the file" in r["context"] and r["is_reply"] == 1


def test_pure_forward_and_short_are_dropped(tmp_path):
    p = tmp_path / "2."
    p.write_text(_mail("---------------------- Forwarded by X on 5/14/2001 ----------------------\nstuff here many words"))
    assert parse_message(p) is None
    q = tmp_path / "3."
    q.write_text(_mail("ok"))
    assert parse_message(q) is None


def test_unwrap_joins_lines_but_keeps_paragraphs():
    assert unwrap("this is a long\nwrapped line\n\nnew para") == "this is a long wrapped line\n\nnew para"


def test_build_dedup_and_splits(tmp_path):
    _make_maildir(tmp_path)
    df = build_enron(tmp_path)
    assert df["user_id"].nunique() == 2 and len(df) == 24
    s = make_splits(df, min_msgs=10)
    assert set(s["time_split"]) == {"history", "eval"}
    assert s.groupby("user_id")["user_split"].nunique().max() == 1


def test_nested_maildir_is_found(tmp_path):
    _make_maildir(tmp_path / "Enron" / "maildir" / "maildir")
    assert find_maildir_root(tmp_path / "Enron").name == "maildir"
    assert len(load_enron(tmp_path / "Enron")) == 24


def test_kaggle_csv_layout(tmp_path):
    import pandas as pd
    rows = [{"file": f"u1/_sent_mail/{i}.", "message": _mail(f"message number {i} please review",
                                                            frm="u1@x.com",
                                                            date=f"Mon, {i+1} May 2001 10:00:00 -0700")}
            for i in range(5)]
    rows.append({"file": "u1/inbox/9.", "message": _mail("incoming mail not sent by user")})
    pd.DataFrame(rows).to_csv(tmp_path / "emails.csv", index=False)
    df = load_enron(tmp_path)
    assert len(df) == 5 and df["user_id"].nunique() == 1


def test_missing_data_gives_helpful_error(tmp_path):
    import pytest
    (tmp_path / "junk").mkdir()
    with pytest.raises(FileNotFoundError, match="What is there"):
        load_enron(tmp_path)