# Todos

Use checkboxes only for iterations. `[x]` is complete, `[ ]` is pending, and `depends on` names prerequisites.

## Iteration DAG

- [x] S01 — Reproduce and explain the accidental short-abbreviation ranking
  - depends on: none
  - evidence: supplied screenshots, code inspection, and a deterministic core-search reproduction
- [x] S02 — Approve the bounded matching and ranking correction
  - depends on: S01
  - approved scope: constrained abbreviations, quality-first evidence, same-field coherence, regression coverage
- [x] S03 — Implement search ranking correction
  - depends on: S02
  - write scope: `src/core/search.js`, `tests/scry-core.test.js`
- [x] S04 — Verify and deliver
  - depends on: S03
  - checks: `npm test`, `npm run check`, diff review, commit, push

## Parallelization

The implementation is one coupled search-ranking package with overlapping source and test contracts. Keep it in the current worktree rather than splitting it across agents or worktrees.
