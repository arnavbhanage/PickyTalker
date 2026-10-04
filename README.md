# PickyTalker

### AI responses that sound like you.

Most AI assistants are good at answering.

Very few care about **how you would answer**.

**PickyTalker** is a personalized AI response-selection system that learns an individual's communication style and uses it to select responses that better match the way that person naturally communicates.

Instead of treating personalization as a simple personality setting, PickyTalker represents communication as measurable behavioral patterns and uses them to rank candidate responses.

---

## The Idea

Two people can receive exactly the same message and respond completely differently.

For example:

> "Can you send me the report?"

Possible responses:

> "Sure, I'll send it by 5 PM."

> "Absolutely! I'll send the report over by 5 PM 😊"

> "Yep, I'll send it over by 5."

All three are valid.

But only one may actually sound like **you**.

PickyTalker attempts to identify that difference.

---

## How It Works

PickyTalker converts a user's previous messages into a **communication-style profile**.

The initial prototype focuses on four primary characteristics:

| Feature             | Description                                          |
| ------------------- | ---------------------------------------------------- |
| **Formality**       | How formal or casual the user's language tends to be |
| **Emoji Frequency** | How frequently and intensely emojis are used         |
| **Length**          | Typical response length                              |
| **Structure**       | How the user organizes sentences and responses       |

Each characteristic is represented on a normalized `0–1` scale.

Example:

```text
User Communication Profile

Formality          0.82
Emoji Frequency    0.14
Length             0.63
Structure          0.76
```

Candidate responses are represented using the same feature space.

The system then estimates how closely each candidate matches the user's communication profile.

```text
User Profile
      │
      ▼
Incoming Message
      │
      ▼
Candidate Responses
      │
      ▼
Style Feature Extraction
      │
      ▼
Personalized Ranking
      │
      ▼
Best-Matched Response
```

---

## Why Response Selection?

Generating a response and selecting a response are different problems.

A language model may generate several responses that are:

* grammatically correct
* relevant
* fluent
* contextually appropriate

But general quality does not necessarily mean **personal fit**.

PickyTalker focuses on:

> **Which response is most compatible with this user's communication style?**

This makes the project a combination of:

* Natural Language Processing
* Personalization
* Feature Engineering
* Response Ranking
* Explainable Machine Learning

---

## Communication Style as Data

Instead of treating writing style as an abstract concept, PickyTalker attempts to quantify it.

For example:

```text
Formality          ────────────────●── 0.82
Emoji Frequency    ─────●────────────── 0.14
Length             ────────────●─────── 0.63
Structure          ──────────────●───── 0.76
```

This representation allows the system to compare:

**User style**

against

**Candidate response style**

and calculate a compatibility score.

---

## Explainability

PickyTalker is designed to make its decisions interpretable.

For example:

```text
Selected Response

Formality
User:       0.82
Response:   0.78

Emoji Usage
User:       0.14
Response:   0.10

Length
User:       0.63
Response:   0.61

Structure
User:       0.76
Response:   0.73
```

The project will investigate explainability techniques such as feature importance and SHAP to understand which characteristics contribute most strongly to response selection.

The explainability layer is primarily intended to make the model's behavior inspectable and to study whether the learned preferences make sense.

---

## Dataset Strategy

PickyTalker uses publicly available conversational datasets as the foundation for communication-style analysis.

The initial datasets are:

* **DailyDialog**
* **PersonaChat**

These datasets provide conversational text from which communication features can be extracted.

PickyTalker does **not** modify the original datasets.

Original downloaded datasets are stored under:

```text
data/external/
```

Processed datasets and extracted features are stored under:

```text
data/processed/
```

See [`data/DATASETS.md`](data/DATASETS.md) for dataset sources, organization, preprocessing and usage notes.

---

## Project Architecture

```text
                    DATASETS
                       │
                       ▼
               Data Preprocessing
                       │
                       ▼
             Communication Features
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
      Formality      Emoji        Structure
          │            │            │
          └────────────┼────────────┘
                       ▼
               User Style Profile
                       │
                       ▼
                Incoming Message
                       │
                       ▼
              Candidate Responses
                       │
                       ▼
                Response Ranker
                       │
                       ▼
                Selected Response
                       │
                       ▼
                 Explanation
```

---

## Repository Structure

```text
PickyTalker/
│
├── README.md
├── requirements.txt
├── .gitignore
│
├── data/
│   ├── DATASETS.md
│   │
│   ├── external/
│   │   ├── DailyDialog/
│   │   └── PersonaChat/
│   │
│   └── processed/
│
├── notebooks/
│   ├── 01_dataset_exploration.ipynb
│   ├── 02_style_feature_extraction.ipynb
│   ├── 03_user_profile_analysis.ipynb
│   ├── 04_response_ranking.ipynb
│   └── 05_explainability.ipynb
│
├── src/
│   ├── data/
│   │   ├── loader.py
│   │   └── preprocessing.py
│   │
│   ├── features/
│   │   ├── emoji.py
│   │   ├── formality.py
│   │   ├── length.py
│   │   ├── structure.py
│   │   └── extractor.py
│   │
│   ├── profiling/
│   │   └── user_profile.py
│   │
│   ├── ranking/
│   │   ├── scorer.py
│   │   └── ranker.py
│   │
│   ├── generation/
│   │   └── response_generator.py
│   │
│   └── explainability/
│       └── explainer.py
│
├── models/
│
├── evaluation/
│   ├── metrics.py
│   └── experiments.py
│
├── app/
│   └── app.py
│
└── tests/
    ├── test_features.py
    ├── test_profile.py
    └── test_ranker.py
```

---

## Development Roadmap

### Phase 1 — Dataset & Exploration

* Acquire conversational datasets
* Understand their structure
* Clean and preprocess conversations
* Identify usable speaker/conversation information

### Phase 2 — Communication Style

Develop feature extraction for:

* Formality
* Emoji frequency
* Length
* Structure

Convert messages into numerical feature vectors.

### Phase 3 — User Profiling

Aggregate historical communication features to construct user-specific profiles.

Example:

```text
User A
Formality:       0.82
Emoji:           0.14
Length:          0.63
Structure:       0.76
```

### Phase 4 — Response Ranking

* Generate or obtain candidate responses
* Extract their communication-style features
* Compare candidate style against the user profile
* Rank candidates according to compatibility

### Phase 5 — Explainability

Investigate:

* Feature importance
* SHAP explanations
* Local response-selection explanations
* Model behavior across different communication styles

### Phase 6 — Evaluation

Compare personalized ranking against a non-personalized baseline.

Potential evaluation metrics include:

* Top-1 accuracy
* Top-k accuracy
* Mean Reciprocal Rank
* Ranking metrics
* User preference agreement
* Response editing rate
* Style similarity

---

## Future Direction

The initial model treats communication style as relatively stable.

A future version could model communication as:

```text
User × Context × Relationship
```

A person may communicate differently with:

* Friends
* Professors
* Colleagues
* Family
* Professional contacts

This would allow PickyTalker to learn not only:

> **"How does this person communicate?"**

but:

> **"How does this person communicate in this particular situation?"**

---

## Project Status

**Early-stage NLP/ML research prototype**

Current focus:

**Communication-style extraction → User profiling → Personalized response ranking → Explainability**

---

## Goal

PickyTalker aims to explore whether measurable communication preferences can improve the selection of AI-generated responses for individual users.

> **Don't just generate a good response. Generate the response that feels like yours.**

````

### `data/DATASETS.md`

:::writing{variant="document" id="31847" title="PickyTalker Dataset Documentation"}
# PickyTalker Dataset Documentation

This document describes the datasets used for developing and evaluating PickyTalker.

---

## 1. Dataset Overview

PickyTalker initially uses publicly available conversational datasets to study communication patterns and develop its response-personalization pipeline.

### Current datasets

| Dataset | Primary purpose |
|---|---|
| **DailyDialog** | General conversational language and dialogue analysis |
| **PersonaChat** | Persona-oriented conversation and personalization research |

The datasets are used as sources of conversational text from which PickyTalker extracts communication-style features.

---

# 2. Directory Structure

Original datasets should be stored without modification under:

```text
data/
└── external/
    ├── DailyDialog/
    │   └── [original dataset files]
    │
    └── PersonaChat/
        └── [original dataset files]
````

The exact filenames and internal directory structures should remain as provided by the respective dataset distributions.

Do **not** rename or modify the original dataset files solely to match the PickyTalker repository structure.

Processed files created by PickyTalker should be stored separately:

```text
data/
└── processed/
    ├── dailydialog_features.csv
    ├── personachat_features.csv
    ├── user_profiles.csv
    └── ranking_dataset.csv
```

---

# 3. DailyDialog

**DailyDialog** is a multi-turn dialogue dataset containing conversations intended to represent everyday communication.

### Intended use in PickyTalker

DailyDialog will primarily be used for:

* Conversational language analysis
* Communication-style feature extraction
* Dialogue context analysis
* Testing feature-engineering methods
* Building initial style representations

### Features to investigate

PickyTalker will derive features such as:

* Message length
* Sentence count
* Emoji usage, where present
* Punctuation patterns
* Structural characteristics
* Formality
* Other linguistic features added during development

The original dataset will remain unchanged.

---

# 4. PersonaChat

**PersonaChat** is a conversational dataset involving persona information and dialogue between participants.

### Intended use in PickyTalker

PersonaChat will primarily be investigated for:

* Personalization experiments
* Speaker-level analysis
* Persona-related conversational behavior
* User-profile modelling
* Testing whether communication patterns can be associated with individual conversational behavior

Persona information will be treated separately from communication-style features.

The presence of a persona does **not** automatically mean that it represents a user's writing style.

---

# 5. Data Processing Pipeline

The datasets will follow the following pipeline:

```text
Original Dataset
      │
      ▼
Dataset Loader
      │
      ▼
Cleaning & Preprocessing
      │
      ▼
Message-Level Data
      │
      ▼
Feature Extraction
      │
      ├── Formality
      ├── Emoji Frequency
      ├── Length
      └── Structure
      │
      ▼
Feature Dataset
      │
      ▼
User / Speaker Profiles
      │
      ▼
Response Ranking Dataset
```

---

# 6. Feature Representation

Each message will eventually be represented using a feature vector.

Initial feature set:

```text
[
    formality,
    emoji_frequency,
    length,
    structure
]
```

Each feature will initially be normalized to a `0–1` range where appropriate.

Example:

```text
Message:
"Sure! I'll send it over by 5 PM 😊"

Features:

Formality        = 0.68
Emoji Frequency  = 0.12
Length           = 0.42
Structure        = 0.61
```

These values are **PickyTalker's derived features**, not labels supplied by the original datasets.

---

# 7. Processed Dataset Files

The following files may be generated during development.

### `dailydialog_features.csv`

Contains DailyDialog messages and extracted communication-style features.

Possible columns:

```text
conversation_id
speaker_id
message_id
message
formality
emoji_frequency
length
structure
```

### `personachat_features.csv`

Contains PersonaChat messages and extracted features.

Possible columns:

```text
conversation_id
speaker_id
message_id
message
formality
emoji_frequency
length
structure
```

### `user_profiles.csv`

Aggregated communication-style profiles.

Possible columns:

```text
speaker_id
avg_formality
avg_emoji_frequency
avg_length
avg_structure
message_count
```

### `ranking_dataset.csv`

Dataset for training/evaluating the response-ranking component.

Possible columns:

```text
user_id
context
candidate_response
candidate_formality
candidate_emoji_frequency
candidate_length
candidate_structure
style_compatibility
preference_label
```

The exact schema may change during development.

---

# 8. Data Integrity

The original datasets under:

```text
data/external/
```

should be treated as immutable source data.

All cleaning, transformations and feature extraction should produce new files under:

```text
data/processed/
```

This allows experiments to be reproduced without modifying the original source data.

---

# 9. Dataset Licensing & Attribution

The original datasets remain subject to their respective licenses and terms of use.

Before redistributing the datasets, verify the licensing conditions of each source.

For the PickyTalker repository, the preferred approach is:

```text
Repository
│
├── Code
├── Documentation
├── Feature extraction pipeline
└── Dataset download instructions
```

rather than committing third-party datasets directly to the repository.

Dataset attribution and official source links should be maintained here as the project is finalized.

---

# 10. Important Limitation

The public conversational datasets were **not originally collected specifically for PickyTalker's research question**.

Therefore, extracted features such as:

* Formality
* Emoji frequency
* Structure
* Communication style

are derived by PickyTalker rather than being guaranteed ground-truth annotations.

A later stage of the project may introduce a small human-preference dataset to evaluate whether the system's inferred communication profiles correspond to actual response preferences.

This distinction will be maintained during evaluation.

---

## Dataset Status

| Dataset              | Status             | Role                            |
| -------------------- | ------------------ | ------------------------------- |
| DailyDialog          | Planned / Acquired | Conversational feature analysis |
| PersonaChat          | Planned / Acquired | Speaker/persona personalization |
| User Preference Data | Future             | Response-selection evaluation   |

---

## PickyTalker Data Philosophy

**Source data stays untouched.**

**Derived features remain reproducible.**

**User preferences are treated as observations, not assumptions.**

---

## How to reproduce

1. Create or activate the local virtual environment in `.venv`.
2. Install the Python requirements with `python -m pip install -r requirements.txt`.
3. Install LightGBM when you need the learned-ranker notebook: `python -m pip install lightgbm`.
4. Put the Enron sent-mail corpus at `data/processed/enron_messages.csv`.
5. Run the project notebooks in order: `02_style_feature_extraction.ipynb`, `03_user_profile_analysis.ipynb`, `04_benchmark_and_baselines.ipynb`, then `05_learned_ranker.ipynb`.
6. Run the test suite from the repo root with `python -m pytest -q`.

The benchmark findings are saved under `docs/findings/` with names like `04_*.csv` and the learned-ranker outputs use names starting with `05_`.

---

## Notebook 05: learned ranker

To reproduce the learned-ranker workflow:

1. Create or activate the project virtual environment in `.venv`.
2. Install dependencies with `python -m pip install -r requirements.txt` and `python -m pip install lightgbm`.
3. Put the Enron corpus at `data/processed/enron_messages.csv`.
4. Run notebooks in order: `02_style_feature_extraction.ipynb`, `03_user_profile_analysis.ipynb`, `04_benchmark_and_baselines.ipynb`, then `05_learned_ranker.ipynb`.
5. Run tests from the repo root with `python -m pytest -q`.

The learned-ranker notebook saves result tables under `docs/findings/` with names starting `05_`.
