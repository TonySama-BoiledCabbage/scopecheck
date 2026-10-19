# Maintenance and algorithm evaluation

## Submission boundary

Product: Manage Your Tasks. Repository: scopecheck. Current runtime source baseline: `6f3d3f5b96dd10820e54de5ac68dcf3126341893`. The `hackathon-week2-candidate-v1` tag freezes the candidate source and maintenance notes; it does not assert that a DEV entry has been published. Record the final entry/video URL when available. Do not move a published snapshot tag; create a new version instead.

Week 2 deadline: 2026-10-19 06:59 UTC / 02:59 America/Toronto. The challenge FAQ requires post-deadline commits to be noted in README. Future maintainers should add a dated row there identifying their commit, behaviour changed and whether the recorded demo includes it. Continue in a feature branch and review before merging; no history rewrite or new storage architecture is needed.

## Current algorithm, not a quality claim

1. `scripts/extract.py` parses saved originals into source units.
2. `src/lib/request-excerpt.ts` uses request-wording patterns to find an eligible sentence. Units that fail this guard do not reach Qwen.
3. `scripts/local-ai-plugin.ts` calls local Ollama chat for an `actionable` boolean. Schema, source and numeric validation remain required. Title excerpts have a 160-character ceiling; full evidence remains in the description/quote.
4. `src/lib/ai-batches.ts` groups small sequential batches and preserves global source indices; `src/lib/ingest.ts` coordinates validation/persistence.
5. `src/domain/capture.ts` and the existing domain commands preserve manual review and formal approval boundaries.

Known weaknesses: the wording guard can reject indirect requests before inference; a segment may contain several requests but yield one candidate; sentence selection and truncation can omit a qualification from the title; small-model boolean judgments can be inconsistent or wrong. Negations, reversals and multilingual wording need explicit evaluation. A request to stop work is still actionable but is not authorisation to start it. A quoted deadline is not approval. Source-only views allow checking omissions but do not fix model recall.

Existing tests prove selected storage, evidence and approval invariants. They do not establish representative semantic accuracy, prompt-injection immunity, or production readiness. Historical model logs may use an earlier protocol; compare only matching code/model/prompt versions.

## Minimum next evaluation

`tests/fixtures/request-selection.jsonl` contains 12 manually drafted, synthetic, provisional labels. It is a smoke set, not a representative benchmark or model-generated ground truth. No performance score has been measured on it. Review labels with a second human before using them as an acceptance gate. Keep future held-out examples separate from prompt examples.

Evaluate the complete current path, including the wording guard, rather than scoring only the segments that reach Qwen. Record code SHA, model name/digest, prompt version, guard version, language, unit text, expected label, returned label, skipped-by-guard, latency, timeout/schema failure and evidence-validation failure. A skipped true request counts as a false negative. A request described in a quote is not approval, irrespective of the actionable label.

Report true/false positives/negatives, precision, recall and F1 with the actual denominators. Report per-language and cancellation/date-change slices as well as aggregate values. Report median and p95 latency on stated hardware. Keep accuracy measures separate from evidence validity and formal approval tests. Do not claim improvement from one successful demo or candidate counts.

## Order of work

| Priority | Change | Acceptance evidence |
| --- | --- | --- |
| P0 | Review-to-work-item save routing fixed on `fix/review-to-timeline`; direct empty-timeline creation still deferred | User reproduction plus a task visible after save/reload; formal nodes still require domain review. Deferred for submission. |
| P1 | Human-review labelled data, expand beyond this smoke set, establish baseline | Measured full-path confusion matrix, omissions and false positives listed; independent held-out set. |
| P2 | Compare prompt/guard changes one at a time | Same model/data/hardware; full-path recall and precision compared; no loss of evidence/approval invariants. |
| P3 | Compare a stronger already-installed model if resources allow | Same held-out data, latency/memory trade-off recorded. Do not auto-download models or make a new default from one demo. |
| P4 | Multi-request splitting and better uncertainty review | Preserved original offsets, cancellation/negation cases, no fabricated approval or silent task creation. |

The current gate being too restrictive is a hypothesis to measure. Moving or weakening it may improve recall and may increase false positives. A larger model is not a replacement for evaluation. Fine-tuning is not implemented and is not the first required step.

## Change boundaries

- UI binding: `src/adapter.ts`, `src/adapter.css`, `src/i18n.ts`; preserve the original prototype. Do not restart a frontend rewrite to change the classifier.
- AI/extraction: plugin, batching and excerpt files above. Keep the existing endpoint and explicit engine labels until a reviewed API change is necessary.
- Domain/store: `src/domain/`, `src/store/project.ts`, `src/lib/media-db.ts`. Changing the model must not bypass formal review, rewrite baselines or migrate local data.
- Failure behaviour: preserve originals and user input; reject invalid responses; retain human edits on reprocessing; never relabel fallback rules as AI.

For each behaviour change, add one reproducing case, run the relevant existing test and then the standard checks (`npm run typecheck`, `npm test`, `npm run build`). Use `/tests/interactions.html` for affected navigation/form flows. Use an isolated test project for persistence checks. `/clear` resets project metadata, not models; it is not an algorithm test setup command.

## Contribution workflow

DD998855 is credited in README; GitHub write invitation was sent and may require acceptance. Do not attribute generated commits to another person. Pick one failure, reproduce it, fix the narrowest layer, record evaluation evidence, and open a PR. Keep original prototype provenance and MIT attribution. Suggested PR body: observed input, expected/actual result, changed layer, test/evaluation result, data/approval impact.

Sources: [challenge FAQ and cutoff](https://dev.to/challenges/hacktoberfest-week2-2026-10-12), [entry requirements](https://dev.to/page/hacktoberfest-week2-2026-10-12-contest-rules).

## Date-extraction follow-up

On the fix branch, Qwen also locates an exact date phrase. `src/lib/date-hint.ts` resolves a conservative subset of dates against source-message metadata; `validateAiSuggestions` verifies the result again before `saveAiSuggestions` fills a system placement. Existing manual placements are retained. Date-only hints reuse the original materialisation form and never approve formal changes. The v1 tag predates this feature and is unchanged. Evaluate temporal extraction separately from request recall; ambiguous or unsupported date syntax is intentionally left for manual review. Live model checks: `scripts/verify-ai-dates.mjs`; end-to-end browser mode: `/tests/review-timeline.html?ai-dates`. Current support does not include hourly scheduling, arbitrary date ranges or business-day calendars.
