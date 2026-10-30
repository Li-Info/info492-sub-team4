# Classroom Feedback Summary: Demo 1 and Demo 2

This LLM-assisted summary is based on Vikram's Team 4 feedback messages dated October 22 and October 26, 2026. The messages summarize 13 peer reviews for Demo 1 and 15 for Demo 2. The individual review forms were not supplied. These are reviewers' observations, not an independent check of the experimental results.

## Demo 1: Feedback posted October 22, 2026

Reviewers valued the controlled comparison. The team froze the corpus, fixed five questions, compared manual search with the agent, and recorded both conditions. Ten of the 13 reviewers found the claim clearly falsifiable; none said it could not lose. All 13 understood that the threshold had been set in advance. Checkable citations also helped reviewers assess the evidence behind an answer.

The main weakness was the definition of accuracy. Reviewers did not consistently understand what counted as correct or whether correctness required both the answer and its citation. The feedback recommended showing question-specific scoring rules and identifying who decided them.

The evaluation also needed to distinguish the retrieval path from the final answer. A correct answer supported by an unrelated passage should not count as successful retrieval. The recordings could help identify this failure. Reviewers also questioned whether the 10% improvement target was too conservative and asked the team to justify it or set a more demanding target for a future test.

## Demo 2: Feedback posted October 26, 2026

Showing the scoring formula made the evaluation easier to understand: accuracy equals passing questions divided by total questions, multiplied by 100%. Peers reported adopting parts of the team's approach. Four reviewers named the document evidence or improved citations as a favorite feature. Reviewers also found the manual-versus-AI comparison under identical scoring criteria convincing.

One of the 15 reviewers did not recall an evaluation framework, while the other 14 did. The feedback interpreted this as a presentation visibility issue and recommended keeping the framework slide visible longer.

The remaining concerns were evidence volume and process evaluation. Two reviewers wanted more test cases behind the 10% target. The feedback again asked the team to grade whether the agent found the right document, rather than judging only its final answer.

## Priorities for the next evaluation

- Show the pass criteria for each question. State whether citation correctness is part of the main accuracy metric or checked separately.
- Score the retrieval path separately from the answer, using the expected evidence and the passages retrieved, supplied to the model, and cited.
- Use more varied fixed test cases and repeated runs before making broader performance claims.
- Show the calculation behind reported figures. Justify the target and freeze it before the next evaluation.
