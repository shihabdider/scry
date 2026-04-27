---
id: "0001"
title: "Build Scry history-first URL recall extension"
category: prd
state: ready-for-agent
created: "2026-04-27T01:24:08Z"
updated: "2026-04-27T01:24:08Z"
parent: null
depends_on: []
tags: ["chrome-extension", "manifest-v3", "history-search", "prd"]
---

## Summary

Build Scry, a Manifest V3 Chrome extension that provides a keyboard-first, history-only URL recall experience in the Chrome side panel. Scry should help the user reopen exact previously visited pages by matching remembered URL fragments with high precision, showing confidence metadata, and learning from explicit selections without becoming a general command palette.

## Details

## Problem Statement

The user often wants to quickly reopen a specific page they have visited before, such as a GitHub repo, issue, or deep page, but existing browser search surfaces are too imprecise or too polluted by unrelated sources. Similar names can interfere with each other, causing wrong-target navigation such as opening a similarly named repo instead of the intended one. The user wants to type remembered fragments like a domain, repo name, page type, and issue number, and have the right history URL appear before the full URL is typed.

Existing command palettes and omnibar-style extensions mostly solve a broader problem: searching tabs, bookmarks, history, commands, and web search from one UI. That breadth is a drawback for this product. The user wants a focused history recall tool that is fast, precise, explainable, source-isolated, and optimized for known-target navigation.

## Solution

Scry will be a Chrome Manifest V3 extension centered on a persistent side-panel UI opened and toggled by Cmd/Ctrl+K. It will index recent browser history when the side panel first opens, then provide live, ordered, segment-aware search over normalized history URLs. The default corpus is recent bounded history, with an explicit Deep Search action to search a larger or complete history corpus when needed.

The product will prioritize URL recall over title search. Result rows will show truncated URLs first, page titles second, and compact trust metadata such as visit count and last visited age. The visual style should resemble classic early-2000s Google: sparse, fast, white background, blue/green link colors, Arial-like typography, simple bold highlights, and minimal decoration.

Scry will learn only from explicit selections made in Scry. Selection learning can reorder close candidates but must not override better URL/textual match quality. Time-of-day data may be stored implicitly through selection timestamps, but time-of-day ranking is out of scope for v1.

## User Stories

1. As a Chrome user, I want to press Cmd/Ctrl+K to open Scry, so that I can start searching history without reaching for the mouse.
2. As a Chrome user, I want Cmd/Ctrl+K to close Scry when it is already open, so that the shortcut behaves like a toggle.
3. As a Chrome user, I want Scry to work on Chrome New Tab, so that I can use it as a primary navigation surface.
4. As a Chrome user, I want Scry to work on restricted pages where content scripts would not run, so that the tool is reliable across browser contexts.
5. As a Chrome user, I want Scry to use the side panel, so that there is enough room to show dense, useful results.
6. As a Chrome user, I want the search input focused immediately when Scry opens, so that I can type without an extra click.
7. As a Chrome user, I want Scry to search browser history only by default, so that bookmarks, tabs, commands, and web search do not pollute results.
8. As a Chrome user, I want no blended all-source mode in v1, so that result ranking stays predictable.
9. As a Chrome user, I want no tab search in v1, so that Scry stays focused on history recall rather than tab management.
10. As a Chrome user, I want recently closed pages to be found through history when possible, so that I do not need a separate recently closed mode in v1.
11. As a Chrome user, I want to type remembered pieces of a URL in order, so that I can find a page without typing its full address.
12. As a Chrome user, I want separators such as spaces, asterisks, slashes, periods, dashes, and underscores to split query tokens, so that I can type naturally.
13. As a Chrome user, I want a query like git skilift issues 13 to match a GitHub issue URL containing those segments, so that deep pages are easy to recall.
14. As a Chrome user, I want a query like git*skilift*issues*13 to behave like ordered token search, so that the asterisk acts as a convenient separator rather than regex syntax.
15. As a Chrome user, I want matching to prioritize URL host and path segments, so that exact URL recall beats noisy page titles.
16. As a Chrome user, I want page titles to still be searchable, so that I can find pages I remember by document or issue title.
17. As a Chrome user, I want exact URL segment matches to rank above prefix matches, so that precise remembered terms win.
18. As a Chrome user, I want URL segment prefix matches to work while I am still typing, so that live filtering surfaces results early.
19. As a Chrome user, I want constrained ordered abbreviation matching, so that gh can match github when the letters appear in order.
20. As a Chrome user, I want abbreviation matches to rank below exact and prefix matches, so that shortcuts do not create surprising results.
21. As a Chrome user, I want substring matching for text tokens of sufficient length, so that remembered middle fragments like lift can find skilift.
22. As a Chrome user, I want short text tokens to avoid broad substring matching, so that tiny fragments do not match everything.
23. As a Chrome user, I want numeric tokens to support prefix matching, so that issue 13 can still surface issue 130 while I may still be typing.
24. As a Chrome user, I want exact numeric URL segment matches to outrank numeric prefix matches, so that issue 13 beats issue 130 when I typed 13.
25. As a Chrome user, I want numeric matching to avoid abbreviation behavior, so that issue IDs remain predictable.
26. As a Chrome user, I want issues 13 to prefer a URL path containing issues followed by 13, so that entity/path coherence matters.
27. As a Chrome user, I want ordered URL matches to beat unordered matches, so that results reflect the structure I typed.
28. As a Chrome user, I want adjacent query tokens matching adjacent URL segments to receive a boost, so that structured URLs rank correctly.
29. As a Chrome user, I want similar repo names like skilift and skitools to be disambiguated by textual evidence, so that I do not open the wrong repo.
30. As a Chrome user, I want visit count to influence ranking only after textual match quality, so that popular but wrong pages do not beat precise matches.
31. As a Chrome user, I want last visited recency to influence ranking only after textual match quality, so that recent but wrong pages do not beat precise matches.
32. As a Chrome user, I want Scry to learn from the results I explicitly select, so that repeated personal patterns become faster.
33. As a Chrome user, I want learned ranking to reorder close candidates only, so that adaptation does not make search mysterious.
34. As a Chrome user, I want selection timestamps stored for future analysis, so that time-of-day prediction can be evaluated later.
35. As a Chrome user, I do not want time-of-day ranking in v1, so that ranking remains explainable.
36. As a Chrome user, I want Scry to store only local selection-learning data, so that it supports personalization without persisting my full history index.
37. As a Chrome user, I want no external network calls, so that my browsing history and queries remain private.
38. As a Chrome user, I want no web search fallback, so that Scry remains a history recall tool rather than another search engine UI.
39. As a Chrome user, I want no built-in alias table in v1, so that terms like git and issue are handled by matching behavior rather than hidden commands.
40. As a Chrome user, I want Scry to show useful results before I type, so that opening the side panel is not a blank experience.
41. As a Chrome user, I want empty-query results ranked by frecency, so that recent and repeatedly useful pages appear first.
42. As a Chrome user, I want frecency to favor the last few days strongly, so that current work is easy to resume.
43. As a Chrome user, I want visit count in default results to be capped or log-scaled, so that stale all-time popular pages do not dominate.
44. As a Chrome user, I want the default index to cover roughly the last 90 days and up to about 10,000 URLs, so that normal search is fast.
45. As a Chrome user, I want a Deep Search action, so that I can search older or larger history when default search is insufficient.
46. As a Chrome user, I want Deep Search to be explicit rather than automatic, so that normal typing remains fast.
47. As a Chrome user, I want Deep Search results to remain live-filterable after loading, so that expanded history search still feels interactive.
48. As a Chrome user, I want Scry to normalize duplicate history URLs conservatively, so that fragments and tracking parameters do not create clutter.
49. As a Chrome user, I want Scry to preserve meaningful query strings, so that web-app pages encoded in query parameters remain findable.
50. As a Chrome user, I want query-string tokens searched at low priority, so that meaningful app URLs can be recalled without query noise dominating.
51. As a Chrome user, I want tracking parameters stripped from matching and deduplication, so that marketing noise does not affect recall.
52. As a Chrome user, I want duplicate normalized URLs aggregated, so that visit count and recency represent the underlying page.
53. As a Chrome user, I want the display URL to preserve the useful original form, so that I can verify what will open.
54. As a Chrome user, I want result rows to show URL first, so that I can verify the exact destination quickly.
55. As a Chrome user, I want result rows to show title second, so that I get context without title noise dominating.
56. As a Chrome user, I want result rows to show visit count, so that I can distinguish familiar pages from one-off visits.
57. As a Chrome user, I want result rows to show human-readable last visited age, so that I can judge whether a result is likely current.
58. As a Chrome user, I want long URLs truncated in the middle, so that side-panel rows remain readable while preserving beginning and end.
59. As a Chrome user, I want matching fragments bolded, so that I can see why a result matched.
60. As a Chrome user, I want a sparse old-Google visual style, so that the tool feels fast, readable, and non-distracting.
61. As a Chrome user, I want no favicons in v1, so that rows stay compact and the UI keeps an old-school search-result feel.
62. As a Chrome user, I want no modern card layout, so that result density stays high.
63. As a Chrome user, I want the selected row to be visually obvious but simple, so that keyboard navigation remains clear.
64. As a Chrome user, I want arrow keys to change the selected result, so that I can navigate without a mouse.
65. As a Chrome user, I want Ctrl+N and Ctrl+P to navigate results, so that familiar keyboard navigation works.
66. As a Chrome user, I want Enter to open the selected result in the current tab, so that Scry behaves like direct navigation.
67. As a Chrome user, I want Cmd/Ctrl+Enter to open the selected result in a new tab, so that I can preserve my current page when needed.
68. As a Chrome user, I want the side panel to remain open after selection, so that repeated navigation remains possible.
69. As a Chrome user, I want opening a result to record selection-learning data, so that repeated query patterns improve over time.
70. As a Chrome user, I want no user-visible options page in v1, so that the product stays focused and simple.
71. As a Chrome user, I want Chrome's built-in shortcut remapping to remain available, so that I can change Cmd/Ctrl+K if necessary.
72. As a Chrome user, I want Scry to be fast over the default index, so that filtering feels live on every keystroke.
73. As a Chrome user, I want loading state if history is not ready, so that I understand why results are not yet appearing.
74. As a Chrome user, I want Scry to keep the index in memory while the side panel is open, so that repeated queries are instant.
75. As a Chrome user, I want the full history index not persisted in v1, so that privacy and staleness risks stay low.
76. As a developer, I want ranking functions to return internal explanations, so that wrong rankings can be debugged without guessing.
77. As a developer, I want debug explanations hidden from normal UI, so that the user-facing experience stays simple.
78. As a developer, I want search, ranking, URL normalization, and storage logic separated from UI components, so that the core behavior can be tested in isolation.
79. As a developer, I want deterministic ranking tests with representative history fixtures, so that precision regressions are caught.
80. As a developer, I want acceptance tests for key user flows, so that shortcut opening, searching, selecting, and navigation remain reliable.

## Implementation Decisions

- Build Scry as a Chrome Manifest V3 extension.
- Use Chrome Side Panel as the primary UI, not an injected page overlay, toolbar popup, separate popup window, or omnibox-first interface.
- Use Cmd/Ctrl+K as the default shortcut and implement it as a side-panel toggle when Chrome Side Panel APIs support both opening and closing.
- Treat New Tab compatibility as required; the UI must be an extension page rather than a content script overlay.
- Keep the side panel open after selecting a result.
- Open selected results in the current tab on Enter.
- Support modified Enter for opening in a new tab.
- Search browser history only in v1.
- Do not include bookmarks, tabs, commands, web search engines, or blended source modes in v1.
- Build the default history index on first side-panel open and keep it in memory while the side panel remains open.
- Default indexing should cover roughly 90 days and up to about 10,000 URLs.
- Add an explicit Deep Search action for larger or complete history search.
- Do not persist the full history index in v1.
- Persist only Scry-specific selection-learning data in local extension storage.
- Store selection-learning aggregates by normalized query identity and normalized URL identity, including count and last selected timestamp.
- Store selection timestamps so time-of-day prediction can be evaluated later, but do not use time-of-day in v1 ranking.
- Use conservative URL normalization for dedupe: lowercase scheme and host, normalize default ports, remove fragments, remove trailing slash except root, strip obvious tracking parameters, and preserve meaningful query strings.
- Aggregate duplicate normalized URLs by combining visit count, retaining most recent visit time, and using a useful recent title/display URL.
- Include query-string keys and values in searchable tokens at lower priority than host/path tokens.
- Use ordered, segment-aware, exact-ish matching as the core search model rather than generic fuzzy search.
- Treat spaces, asterisks, slashes, periods, dashes, underscores, and similar separators as token separators.
- Treat asterisk as a separator only, not a wildcard, glob, or regex operator.
- Prioritize URL host/path matching over title matching.
- Allow title matching as secondary evidence.
- Rank per-token match quality in tiers: exact URL segment, URL segment prefix, constrained ordered abbreviation, guarded URL substring, then title/query fallback matches.
- Do not implement built-in alias expansion in v1.
- Support constrained ordered abbreviation matching for text tokens, such as matching gh against github when characters appear in order.
- Do not apply abbreviation matching to numeric tokens.
- Support guarded substring matching for text tokens with length thresholds.
- Support numeric prefix matching for live filtering.
- Always rank exact numeric URL segment matches above numeric prefix matches for the same token.
- Reward coverage, ordered URL occurrence, URL field priority, per-token match quality, and adjacent path coherence before usage signals.
- Use browser history usage signals such as visit count and last visited recency after textual match quality.
- Use selection learning after textual match quality and history signals, only to reorder close candidates.
- Use frecency for empty-query default results, with strong recent-days bias and capped visit-count influence.
- Use an old-school Google-inspired visual style: sparse white page, dense text rows, simple blue/green link colors, no cards, no favicons, simple bold highlights.
- Show URL first in result rows, title second, and compact trust metadata including visit count and human-readable last visited age.
- Truncate long display URLs in the middle to preserve meaningful beginning and end.
- Use simple bold highlighting for matched fragments.
- Build ranking as a deep, testable module with a small interface that accepts normalized query data, indexed history entries, and selection-learning aggregates, and returns ordered results with debug explanations.
- Build URL normalization and tokenization as deep, testable modules with stable input/output contracts.
- Build selection-learning storage as a small adapter around local extension storage, keeping ranking logic independent from Chrome APIs.
- Build the side-panel UI as a thin layer over the core search/ranking modules.
- Build the Chrome API integration layer separately from pure search logic so most behavior can be tested without Chrome.
- Include internal debug metadata for match/ranking explanations, hidden from normal UI and available for development investigation.

## Testing Decisions

- Good tests should assert externally observable behavior: returned result order, displayed metadata, URL normalization outcomes, stored learning effects, keyboard behavior, and navigation intent.
- Tests should not assert incidental implementation details such as internal loop structure, exact numeric score constants, or private helper names unless those are part of a public module contract.
- Unit test URL normalization and deduplication with raw history entries containing fragments, tracking parameters, trailing slashes, default ports, meaningful query strings, and duplicate normalized URLs.
- Unit test query tokenization with spaces, asterisks, slashes, periods, dashes, underscores, and mixed separators.
- Unit test ordered segment matching with representative GitHub URLs, including repo pages, issue pages, pull request pages, and similar repo names.
- Unit test constrained abbreviation matching, including gh against github and cases that should not match because character order is wrong.
- Unit test guarded substring matching, including tokens that are long enough to match and short tokens that should not broadly match.
- Unit test numeric matching so exact issue 13 outranks issue 130 for query token 13, while prefix matching still allows live discovery.
- Unit test path coherence so issues 13 matching an adjacent path sequence outranks weaker scattered matches.
- Unit test URL-primary ranking so URL segment evidence beats title-only evidence.
- Unit test query-string low-priority matching so meaningful query params can match but do not beat path matches.
- Unit test frecency default ranking so recent recurring pages beat stale popular pages and one-off recent pages do not always dominate.
- Unit test selection learning so repeated explicit selections can reorder close candidates but cannot override clearly better exact/prefix URL matches.
- Unit test human-readable age formatting for minutes, hours, days, months, and years.
- Unit test middle URL truncation so beginning and end are preserved.
- Unit test result highlighting for exact, prefix, substring, and abbreviation matches at the display-contract level.
- Integration test the side-panel search flow with mocked Chrome APIs: initial loading, indexed results, typing, keyboard selection, Enter navigation, and selection recording.
- Integration test Deep Search behavior with mocked bounded and expanded history providers.
- Integration test Cmd/Ctrl+K toggle behavior where the relevant Side Panel open and close APIs are available.
- Integration test graceful behavior when side-panel close is unavailable, if supporting older Chrome versions.
- End-to-end browser tests are useful after the core modules exist, especially for verifying side-panel opening on New Tab and current-tab navigation.
- There is no existing codebase test prior art because the repository is currently empty.
- Prefer pure deterministic fixtures for ranking tests so failures clearly indicate search-quality regressions.

## Out of Scope

- Bookmark search.
- Open tab search.
- Recently closed tab/session stack search beyond what is already present in browser history.
- Blended all-source mode.
- Surfingkeys-style browser command suite.
- Web search fallback or custom search engines.
- Omnibox as the primary UI.
- Injected page overlay.
- Toolbar popup as the primary UI.
- Separate centered popup window.
- User-visible options page.
- Built-in alias configuration or user-defined aliases.
- Time-of-day ranking in v1.
- Persisting the full browser history index.
- External telemetry, analytics, or network calls.
- Favicons.
- Dark theme.
- Rich cards, icons, or modern command-palette visual styling.
- Cross-browser support beyond Chrome MV3 in v1.

## Further Notes

Prior-art review found several existing tools that overlap with a general tabs/bookmarks/history command palette: Search Bookmarks, History and Tabs, Omni, Chikamichi, Chrome Spotlight, Chrome Palette, and Surfingkeys. Scry is justified only if it remains focused on precise, history-first URL recall rather than becoming another broad command palette.

Chrome omnibox integration is technically possible as a secondary entry point, but it is not suitable as the primary UI because it requires a keyword mode, cannot replace the native address bar globally, and cannot render rich old-Google-style rows with visit count and last visited metadata.

Chrome Side Panel close and open event APIs are version-dependent. The target behavior is true Cmd/Ctrl+K toggle on modern Chrome. If supporting older Chrome versions, the fallback should be documented and should not compromise the core search experience.

## Acceptance Criteria

- [ ] Cmd/Ctrl+K opens the Scry side panel from a normal page.
- [ ] Cmd/Ctrl+K opens the Scry side panel from Chrome New Tab.
- [ ] Cmd/Ctrl+K closes the Scry side panel when the required Chrome Side Panel close API is available.
- [ ] The search input is focused when the side panel opens.
- [ ] The default index loads recent bounded history on first open and stays in memory while the side panel is open.
- [ ] Empty query shows frecency-ranked history results.
- [ ] Query tokens are split on spaces, asterisks, slashes, periods, dashes, underscores, and similar separators.
- [ ] A query shaped like git*skilift*issues*13 can find a matching visited GitHub issue URL.
- [ ] A query shaped like gh*issu can match github and issues through constrained abbreviation/prefix behavior.
- [ ] Similar URL targets such as skilift and skitools are ranked according to exact/prefix URL evidence rather than loose fuzzy similarity.
- [ ] For a query containing numeric token 13, a URL segment exactly equal to 13 outranks a URL segment beginning with 13 but continuing with more digits.
- [ ] URL host/path evidence outranks title-only evidence.
- [ ] Query-string evidence is searchable but lower priority than host/path evidence.
- [ ] Result rows show URL first, title second, visit count, and human-readable last visited age.
- [ ] Long URLs are truncated in the middle while preserving useful beginning and end.
- [ ] Matched fragments are highlighted with simple bold styling.
- [ ] The UI has a sparse old-Google-inspired visual style with no favicons and no card layout.
- [ ] Arrow keys and Ctrl+N/Ctrl+P move the selected result.
- [ ] Enter opens the selected result in the current tab.
- [ ] Cmd/Ctrl+Enter opens the selected result in a new tab.
- [ ] Selecting a result records local selection-learning data.
- [ ] Selection learning can improve repeated close candidates without overriding better exact/prefix URL matches.
- [ ] Deep Search can be triggered explicitly when default search is insufficient.
- [ ] No web search fallback is shown or executed.
- [ ] No bookmarks, tabs, or command results appear in v1 search results.
- [ ] No external network calls are made by the extension.
- [ ] Ranking functions expose internal debug explanations for development without rendering them in normal UI.
- [ ] Core URL normalization, tokenization, matching, ranking, frecency, selection-learning, age formatting, truncation, and highlighting behavior is covered by automated tests.

## Activity

### 2026-04-27T01:24:08Z — AI

> *This was generated by AI from the Scry design grilling session.*

Created the initial PRD for the history-first Scry Chrome extension. The current repository is empty, so the PRD also captures the proposed module boundaries and testing strategy for a greenfield implementation.
