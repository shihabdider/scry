# Iteration

## Current slice

Correct accidental short-abbreviation ranking in history search.

## Customer-facing goal

Typing `atri hera` should surface visited Atrioc/Hera pages rather than unrelated URLs matched only through accidental ordered subsequences in machine-oriented URL components.

## Included scope

- Constrain two-to-four-character ordered abbreviations while preserving `gh` to `github`.
- Select per-token evidence by textual quality before field priority.
- Rank aggregate textual fidelity before ordered URL coherence.
- Reward coherent multi-token evidence in one field.
- Add regression tests for the reported behavior and preserved matching contracts.

## Non-goals

- Parser, quote, or website-filter syntax changes.
- Edit-distance typo correction or generalized fuzzy matching.
- UI, persistence, permissions, data-source, or network changes.
- Search-library adoption or broad refactoring.

## Acceptance checks

- An unrelated URL with weak path abbreviations no longer outranks a title containing `Atrioc` and `Hera` for `atri hera`.
- `atrioc hera` continues to return the intended title.
- `gh` continues to abbreviate `github`.
- Numeric and guarded substring behavior remains passing.
- `npm test` and `npm run check` pass.

## Implementation result

- Ordered abbreviations now require alphabetic query and candidate tokens, a candidate-start match, and no more than two omitted characters within the matched span.
- Per-token evidence now compares match tier before field priority.
- Aggregate ranking compares textual tier quality, same-field coherence, URL coherence, field evidence, then usage and selection learning.
- Internal debug evidence now includes the strongest same-field match and coverage.

## Verification

- `npm test`: 437 passing tests.
- `npm run check`: passing.
- `autocode verify`: both configured blocking checks passing.
- Synthetic 14,540-entry search benchmark: approximately 21 ms median for `atri hera` on the development machine.

## Status

Implemented and verified; ready for commit and push.
