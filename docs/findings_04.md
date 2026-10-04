# Notebook 04 findings

## Question

Does the v1 benchmark keep the real reply competitive while removing the easy central-item attack that existed in the original v0 lineup construction?

## How the benchmark is built

The benchmark evaluates a user's ability to pick their own future message from a lineup of 10 candidate replies (1 true reply + 9 negatives).

The lineups are built in four difficulty tiers:

- random
- length_matched
- content_similar
- content_and_length

The original v0 construction allowed a lineup-center shortcut: the true reply could sit in the middle of the lineup, so an attacker that chose the center tended to do better than chance. The v1 benchmark fixes that by using exchangeable lineup construction, symmetric blocks, and a jittered length window so the truth is not systematically centered.

## Audit: v0 vs v1 lineup attacks

Source: `docs/findings/04_v1_lineup_audit.csv`

| scorer | tier | v0_recall@1 | v1_recall@1 |
|---|---|---:|---:|
| lineup_content_center | content_and_length | 0.5545983040227493 | 0.06115855082312853 |
| lineup_content_center | content_similar | 0.5949869852343993 | 0.05268550155483057 |
| lineup_content_center | length_matched | 0.08792482938750917 | 0.08026786283794071 |
| lineup_content_center | random | 0.08711399678124185 | 0.06376561061429169 |
| lineup_length_center | content_and_length | 0.21995877595898233 | 0.10704190265064806 |
| lineup_length_center | content_similar | 0.08818034034796654 | 0.14074605190040992 |
| lineup_length_center | length_matched | 0.22037669771792223 | 0.09856235062235637 |
| lineup_length_center | random | 0.12652874909952178 | 0.11531614766464005 |
| lineup_style_center | content_and_length | 0.10576272324935458 | 0.07075882128425628 |
| lineup_style_center | content_similar | 0.09010949528690827 | 0.09576296579698176 |
| lineup_style_center | length_matched | 0.0877458278558695 | 0.08500466580138437 |
| lineup_style_center | random | 0.11674703807570011 | 0.08386989427490778 |

Interpretation: in v1, all three lineup_* attackers sit near chance (about 0.10), which is the expected behavior for an exchangeable benchmark. The content-center attacker drops from 0.55-0.59 in v0 to around 0.05-0.06 in v1.

## Baselines on v1

Source: `docs/findings/04_v1_baselines.csv`

| scorer | tier | users | recall@1 | ci_low | ci_high | MRR |
|---|---|---:|---:|---:|---:|---:|
| user_style | random | 28 | 0.2909981553353157 | 0.22513206604263633 | 0.36372830660983174 | 0.4763816636573516 |
| user_length_only | random | 28 | 0.12984138919439056 | 0.08569134758290865 | 0.18696564524805598 | 0.3275255025511404 |
| random | random | 28 | 0.11955168021104379 | 0.09027991148586699 | 0.15053098689425018 | 0.3057290347395804 |
| population | random | 28 | 0.09031995260552785 | 0.05479788845781318 | 0.13432917966779498 | 0.27851539574088385 |
| user_style | length_matched | 28 | 0.24520978147865163 | 0.17994491829281473 | 0.31572941380088204 | 0.4459081575978354 |
| population | length_matched | 28 | 0.12108999980235878 | 0.07785408980701616 | 0.16657567667547507 | 0.302732317368465 |
| user_length_only | length_matched | 28 | 0.10361009303681078 | 0.08681964320575647 | 0.12065151838187498 | 0.27603362420252203 |
| random | length_matched | 28 | 0.08814121483223063 | 0.06410514084717193 | 0.11545947949701126 | 0.2747333344352419 |
| user_style | content_similar | 28 | 0.22126986494423528 | 0.16826446097758843 | 0.2762714512871061 | 0.4208916979742409 |
| population | content_similar | 28 | 0.1156045669529898 | 0.08027361537421077 | 0.15417232900101516 | 0.3191408103520921 |
| random | content_similar | 28 | 0.09367059257681773 | 0.06979252653829567 | 0.11744760579017888 | 0.2901588698423926 |
| user_length_only | content_similar | 28 | 0.09065377347814181 | 0.0630999618804223 | 0.11754574329727031 | 0.2910218868163211 |
| user_style | content_and_length | 28 | 0.21927406648386308 | 0.16980463937745344 | 0.2733970922560278 | 0.4209957865824777 |
| population | content_and_length | 28 | 0.12377716060424028 | 0.0869157981155749 | 0.15989928177422716 | 0.3039536049462593 |
| user_length_only | content_and_length | 28 | 0.11174334875810224 | 0.08977190288286893 | 0.1330134127281862 | 0.27821369022790693 |
| random | content_and_length | 28 | 0.09199647236205713 | 0.06616123777286727 | 0.11928477394291845 | 0.2946650786541993 |

## Paired gain (user_style minus population)

Source: `docs/findings/04_v1_paired_gain.csv`

| tier | users | mean_gain | ci_low | ci_high | share_users_improved |
|---|---:|---:|---:|---:|---:|
| random | 28 | 0.2006782027297878 | 0.11676039870168764 | 0.2893627362742004 | 0.7857142857142857 |
| length_matched | 28 | 0.1241197816762929 | 0.04372171938911769 | 0.21578512090728544 | 0.5357142857142857 |
| content_similar | 28 | 0.10566529799124547 | 0.039321519157817925 | 0.17352122510844994 | 0.6428571428571429 |
| content_and_length | 28 | 0.0954969058796228 | 0.03383064665161962 | 0.1556079305554938 | 0.5714285714285714 |

## Learning curve on v1

Source: `docs/findings/04_v1_learning_curve.csv`

| history_msgs | random | length_matched | content_similar | content_and_length |
|---:|---:|---:|---:|---:|
| 0 | 0.10000000000000002 | 0.10000000000000002 | 0.10000000000000002 | 0.10000000000000002 |
| 1 | 0.17770232031692132 | 0.16044142614601017 | 0.16525183927560838 | 0.16468590831918506 |
| 3 | 0.24052065647990947 | 0.20628183361629882 | 0.1861912846632711 | 0.17685342388228634 |
| 10 | 0.2942840973401245 | 0.24872665534804753 | 0.1975099037917374 | 0.1801546877947557 |
| 30 | 0.32371250707413696 | 0.277306168647425 | 0.2246745897000566 | 0.20090548953027731 |
| 100 | 0.320316921335597 | 0.2733446519524618 | 0.2246745897000566 | 0.20996038483305038 |
| all | 0.3310696095076401 | 0.27249575551782684 | 0.21731748726655345 | 0.20882852292020374 |

## Limitations

- The corpus is Enron sent-mail from 1999-2002, so the language is a specific corporate-email register rather than a general-purpose human communication sample.
- The evaluation uses 28 users for the benchmark results in this notebook run.
- The user model is a diagonal-Gaussian approximation, so it ignores feature correlations between communication traits.
- Emoji usage is not reliable in this Enron setting, so emoji-related signals are effectively unusable here.
- This is a benchmark-driven prototype that measures a narrow communication-style matching task, not a full end-to-end personalization system.

## TODOs

- Save a dedicated v0 baseline table alongside the v1 baseline table, if a future notebook run needs a direct v0-v1 comparison for baseline metrics.
