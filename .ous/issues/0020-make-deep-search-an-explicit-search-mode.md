---
id: "0020"
title: "Make Deep Search an explicit search mode"
category: enhancement
state: needs-triage
created: "2026-04-27T15:52:29Z"
updated: "2026-04-27T15:52:29Z"
parent: "#0009 (.ous/issues/0009-add-explicit-deep-search-for-expanded-history.md)"
depends_on: []
tags: ["chrome-extension", "scry", "search-mode", "deep-search", "qa"]
---

## Summary

Correct Deep Search so it is an explicit search mode, not a hidden zero-results fallback button. Deep Search should be one mode among current and future search modes.

## Details

## Parent

#0009 (.ous/issues/0009-add-explicit-deep-search-for-expanded-history.md)

## What's wrong

The current implementation only exposes Deep Search when a non-empty query returns zero recent-history results. That prevents users from choosing a deeper corpus when recent-history matches exist but are not the desired target.

## What to build

Model search as an explicit mode selection. Deep Search should preserve the current query when switching modes, make the active mode visible, and run live filtering over the corpus for the active mode.

The exact set of modes, labels, and keyboard/UI treatment still needs product direction.

## Blocked by

Additional product direction for the complete set of search modes and how the mode selector should behave.

## Acceptance Criteria

- [ ] Deep Search is represented as an explicit search mode rather than a zero-results-only fallback button.
- [ ] A user can switch to Deep Search while the current query already has recent-history matches.
- [ ] Switching to Deep Search preserves the current query, selected-result behavior, and keyboard flow.
- [ ] Deep Search expands or reuses the in-memory all-history corpus for the current popup session without persisting a full history index.
- [ ] Live filtering runs against the active search mode's corpus after mode switches.
- [ ] Automated tests cover Deep Search mode availability when bounded search already has results.

## Activity

### 2026-04-27T15:52:29Z — AI

Filed after auditing #0009. User clarified that the current zero-results-only Deep Search affordance is not the correct product model; Deep Search should become an explicit search mode among other modes.
