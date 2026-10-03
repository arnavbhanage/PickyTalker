from pathlib import Path
from src.data.enron import parse_message, unwrap, build_enron
from src.data.splits import make_splits


def _mail(body, subject="Hi", frm="a@x.com", to="b@y.com", date="Mon, 14 May 2001 16:39:00 -0700"):
    return f"From: {frm}\nTo: {to}\nSubject: {subject}\nDate: {date}\n\n{body}\n"


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


def test_build_dedup_and_owner_filter_and_splits(tmp_path):
    for owner in ["u1", "u2"]:
        d = tmp_path / owner / "_sent_mail"
        d.mkdir(parents=True)
        for i in range(12):
            (d / f"{i}.").write_text(_mail(f"message number {i} from {owner} please review", frm=f"{owner}@x.com",
                                           date=f"Mon, {i+1} May 2001 10:00:00 -0700"))
        (d / "dup.").write_text(_mail("message number 0 from %s please review" % owner, frm=f"{owner}@x.com"))
    df = build_enron(tmp_path)
    assert df["user_id"].nunique() == 2 and len(df) == 24      
    s = make_splits(df, min_msgs=10)
    assert set(s["time_split"]) == {"history", "eval"}
    assert s.groupby("user_id")["user_split"].nunique().max() == 1   # a user never straddles splits