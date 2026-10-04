from __future__ import annotations

import re
from collections.abc import Sequence

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


WORD_RE = re.compile(r"[A-Za-z0-9']+")


def stylometry_similarity(candidate: str, history_texts: Sequence[str]) -> float:
    """Mean character 2-4-gram TF-IDF cosine similarity to the user's history."""
    history = [str(text) for text in history_texts if str(text).strip()]
    if not candidate.strip() or not history:
        return 0.0
    corpus = history + [candidate]
    if not any(len(text) >= 2 for text in corpus):
        return 0.0
    vectorizer = TfidfVectorizer(analyzer="char", ngram_range=(2, 4), lowercase=True)
    matrix = vectorizer.fit_transform(corpus)
    similarities = cosine_similarity(matrix[-1], matrix[:-1]).ravel()
    return float(np.mean(similarities))


def normalized_edit_distance(candidate: str, real_reply: str) -> float:
    """Levenshtein edit distance divided by the longer string length."""
    left, right = candidate.casefold(), real_reply.casefold()
    if left == right:
        return 0.0
    if not left or not right:
        return 1.0
    previous = list(range(len(right) + 1))
    for i, left_char in enumerate(left, start=1):
        current = [i]
        for j, right_char in enumerate(right, start=1):
            current.append(min(
                current[-1] + 1,
                previous[j] + 1,
                previous[j - 1] + (left_char != right_char),
            ))
        previous = current
    return float(previous[-1] / max(len(left), len(right)))


def lexical_similarity(candidate: str, real_reply: str) -> float:
    """Jaccard overlap of normalized word sets against the real reply."""
    candidate_words = {word.casefold() for word in WORD_RE.findall(candidate)}
    real_words = {word.casefold() for word in WORD_RE.findall(real_reply)}
    if not candidate_words and not real_words:
        return 1.0
    union = candidate_words | real_words
    return float(len(candidate_words & real_words) / len(union))


def evaluate_candidates(
    candidates: Sequence[str],
    history_texts: Sequence[str],
    real_reply: str,
    ranker_scores: Sequence[float] | None = None,
) -> pd.DataFrame:
    if ranker_scores is not None and len(ranker_scores) != len(candidates):
        raise ValueError("ranker_scores must have one value per candidate.")
    scores = list(ranker_scores) if ranker_scores is not None else [np.nan] * len(candidates)
    rows = []
    for index, (candidate, ranker_score) in enumerate(zip(candidates, scores)):
        rows.append({
            "candidate_index": index,
            "candidate": candidate,
            "stylometry_similarity": stylometry_similarity(candidate, history_texts),
            "normalized_edit_distance": normalized_edit_distance(candidate, real_reply),
            "lexical_similarity": lexical_similarity(candidate, real_reply),
            "ranker_score": ranker_score,
            "ranker_score_independent": False,
        })
    return pd.DataFrame(rows, columns=[
        "candidate_index",
        "candidate",
        "stylometry_similarity",
        "normalized_edit_distance",
        "lexical_similarity",
        "ranker_score",
        "ranker_score_independent",
    ])
