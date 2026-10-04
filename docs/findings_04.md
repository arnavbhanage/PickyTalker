# Notebook 04 findings

## Question

Does the v1 benchmark keep the real reply competitive while avoiding the central-item shortcut that made the original v0 lineups easy to attack?

## How the benchmark is built

The benchmark evaluates a user's ability to pick their own future message from a lineup of 10 candidate replies (1 true reply + 9 negatives).

The lineups are built in four difficulty tiers:

- random
- length_matched
- content_similar
- content_and_length

The original v0 construction allowed a lineup-center shortcut: the true reply could sit in the middle of the lineup, so a user-free “pick the center” attacker could do better than chance. The v1 construction adds a noncentral-length guard so that the real reply is not systematically median-length within the candidate set.

## Audit: v0 vs v1 lineup attacks

Source: `docs/findings/04_v1_lineup_audit.csv`

| scorer | tier | v0_recall@1 | v1_recall@1 |
|---|---|---:|---:|
| lineup_content_center | content_and_length | 0.5545983040227493 | 0.06115855082312853 |
| lineup_content_center | content_similar | 0.5949869852343993 | 0.06366427834783252 |
| lineup_content_center | length_matched | 0.08792482938750917 | 0.08026786283794071 |
| lineup_content_center | random | 0.08711399678124185 | 0.06376561061429169 |
| lineup_length_center | content_and_length | 0.21995877595898233 | 0.10704190265064806 |
| lineup_length_center | content_similar | 0.08818034034796654 | 0.022732733318577707 |
| lineup_length_center | length_matched | 0.22037669771792223 | 0.09856235062235637 |
| lineup_length_center | random | 0.12652874909952178 | 0.11531614766464005 |
| lineup_style_center | content_and_length | 0.10576272324935458 | 0.07075882128425628 |
| lineup_style_center | content_similar | 0.09010949528690827 | 0.08509695331462596 |
| lineup_style_center | length_matched | 0.0877458278558695 | 0.08500466580138437 |
| lineup_style_center | random | 0.11674703807570011 | 0.08386989427490778 |

Interpretation: the v1 audit is much closer to chance, and the suspicious length-center attack drops from 0.088 in v0 to 0.0227 in the hardest content_similar tier. No v1 user-level attack exceeds 0.14.

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
| user_style | content_similar | 28 | 0.2505072480092491 | 0.19875780942135375 | 0.30237268210523816 | 0.4465735665840068 |
| population | content_similar | 28 | 0.1746797723992583 | 0.12423233579078092 | 0.2254335682237085 | 0.3727727887561034 |
| user_length_only | content_similar | 28 | 0.1466879728616928 | 0.10546217755809333 | 0.19018181286931887 | 0.3495686604342011 |
| random | content_similar | 28 | 0.09367059257681773 | 0.06979252653829567 | 0.11744760579017888 | 0.2901588698423926 |
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
| content_similar | 28 | 0.075827 | -0.001034 | 0.148658 | 0.571429 |
| content_and_length | 28 | 0.095497 | 0.033831 | 0.155608 | 0.571429 |

## Learning curve on v1

Source: `docs/findings/04_v1_learning_curve.csv`

| history_msgs | random | length_matched | content_similar | content_and_length |
|---:|---:|---:|---:|---:|
| 0 | 0.10000000000000002 | 0.10000000000000002 | 0.10000000000000002 | 0.10000000000000002 |
| 1 | 0.17770232031692132 | 0.16044142614601017 | 0.21731666666666668 | 0.16468590831918506 |
| 3 | 0.24052065647990947 | 0.20628183361629882 | 0.22354394542026365 | 0.17685342388228634 |
| 10 | 0.2942840973401245 | 0.24872665534804753 | 0.24278418639024796 | 0.1801546877947557 |
| 30 | 0.32371250707413696 | 0.277306168647425 | 0.2648557570652918 | 0.20090548953027731 |
| 100 | 0.320316921335597 | 0.2733446519524618 | 0.268250967541449 | 0.20996038483305038 |
| all | 0.3310696095076401 | 0.27249575551782684 | 0.2563666427381217 | 0.20882852292020374 |

## Limitations

- The corpus is Enron sent-mail from 1999-2002, so the language is a specific corporate-email register rather than a general-purpose human communication sample.
- The evaluation uses 28 users for the benchmark results in this notebook run.
- The user model is a diagonal-Gaussian approximation, so it ignores feature correlations between communication traits.
- Emoji usage is not reliable in this Enron setting, so emoji-related signals are effectively unusable here.
- This is a benchmark-driven prototype that measures a narrow communication-style matching task, not a full end-to-end personalization system.

## TODOs

- None at this point: the v1 audit gate is now back within the expected near-chance range after the noncentral-length fix.
