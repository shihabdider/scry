# Status

phase: 2
layer: 4
updated: 2026-04-27T19:05:45.002Z

## Wishes

| wish | file | layer | status | time |
|------|------|-------|--------|------|
| normalizeExactPhrase | src/core/query.js | 4 | pass | 110.0s |
| collectExactPhraseEvidence | src/core/search.js | 4 | pass | 220.4s |
| compareQuoteEvidence | src/core/search.js | 4 | pass | 136.4s |
| toResult | src/core/search.js | 4 | pass | 210.0s |
| createTypedUrlCandidate | src/core/url.js | 4 | pass | 300.2s |
| rowOpenUrl | src/core/rows.js | 4 | pass | 134.8s |
| rowSelectionLearningKey | src/core/rows.js | 4 | pass | 81.4s |
| rowEditableText | src/core/rows.js | 4 | pass | 108.3s |
| isCopiedFeedbackVisible | src/core/rows.js | 4 | pending | - |
| createModeCache | src/core/search-modes.js | 4 | pending | - |
| cycleSearchMode | src/core/search-modes.js | 4 | pending | - |
| modeIndicatorModel | src/core/search-modes.js | 4 | pending | - |
| fetchRecentlyClosed | src/platform/sessions-provider.js | 4 | pending | - |
| flattenClosedSessions | src/platform/sessions-provider.js | 4 | pending | - |
| writeClipboardText | src/platform/clipboard.js | 4 | pending | - |
| resetSelectionForModeSwitch | src/panel/app.js | 4 | pending | - |
| focusSearch | src/panel/app.js | 4 | pending | - |
| docs/action-popup-alignment.md | docs/action-popup-alignment.md | 4 | pending | - |
| parseExactPhrases | src/core/query.js | 3 | pending | - |
| parseQuery | src/core/query.js | 3 | pending | - |
| searchParsedHistory | src/core/search.js | 3 | pending | - |
| buildVisibleRows | src/core/rows.js | 3 | pending | - |
| selectedVisibleRow | src/panel/app.js | 3 | pending | - |
| ensureSearchModeReady | src/panel/app.js | 3 | pending | - |
| renderModeIndicator | src/panel/app.js | 3 | pending | - |
| searchHistory | src/core/search.js | 2 | pending | - |
| recordSelection | src/core/selection-learning.js | 2 | pending | - |
| updateVisibleRows | src/panel/app.js | 2 | pending | - |
| copySelectedRow | src/panel/app.js | 2 | pending | - |
| changeSelectedRowToSearch | src/panel/app.js | 2 | pending | - |
| switchSearchMode | src/panel/app.js | 2 | pending | - |
| loadHistory | src/panel/app.js | 2 | pending | - |
| openSelected | src/panel/app.js | 2 | pending | - |
| updateResults | src/panel/app.js | 1 | pending | - |
| pageCount | src/panel/app.js | 1 | pending | - |
| pageStart | src/panel/app.js | 1 | pending | - |
| clampPageIndex | src/panel/app.js | 1 | pending | - |
| ensureSelectedVisible | src/panel/app.js | 1 | pending | - |
| moveSelection | src/panel/app.js | 1 | pending | - |
| movePage | src/panel/app.js | 1 | pending | - |
| focusSelectedResult | src/panel/app.js | 1 | pending | - |
| renderPagination | src/panel/app.js | 1 | pending | - |
| renderResults | src/panel/app.js | 1 | pending | - |
| renderLoading | src/panel/app.js | 1 | pending | - |
| start | src/panel/app.js | 0 | pending | - |
| bindEvents | src/panel/app.js | 0 | pending | - |
| handlePanelKeydown | src/panel/app.js | 0 | pending | - |
| manifest.permissions: string[] | manifest.json | 0 | pending | - |
| popup mode indicator/footer markup | popup.html | 0 | pending | - |
| popup row/action styles | src/panel/styles.css | 0 | pending | - |

## Log

- 14:37:36 stubber complete, 50 wishes, 5 layers
- 14:37:36 stubber_post verification: pass
- 14:42:58 normalizeExactPhrase: running
- 14:44:48 normalizeExactPhrase: pass (110.0s, $0.5573)
- 14:44:49 implementer_post verification for normalizeExactPhrase: pass
- 14:44:57 collectExactPhraseEvidence: running
- 14:48:38 collectExactPhraseEvidence: pass (220.4s, $0.9538)
- 14:48:40 implementer_post verification for collectExactPhraseEvidence: pass
- 14:48:53 compareQuoteEvidence: running
- 14:51:09 compareQuoteEvidence: pass (136.4s, $0.5578)
- 14:51:10 implementer_post verification for compareQuoteEvidence: pass
- 14:51:16 toResult: running
- 14:54:46 toResult: pass (210.0s, $0.8193)
- 14:54:47 implementer_post verification for toResult: pass
- 14:54:53 createTypedUrlCandidate: running
- 14:59:53 createTypedUrlCandidate: pass (300.2s, $1.4456)
- 14:59:54 implementer_post verification for createTypedUrlCandidate: pass
- 15:00:03 rowOpenUrl: running
- 15:02:18 rowOpenUrl: pass (134.8s, $0.4764)
- 15:02:19 implementer_post verification for rowOpenUrl: pass
- 15:02:27 rowSelectionLearningKey: running
- 15:03:49 rowSelectionLearningKey: pass (81.4s, $0.2946)
- 15:03:50 implementer_post verification for rowSelectionLearningKey: pass
- 15:03:55 rowEditableText: running
- 15:05:43 rowEditableText: pass (108.3s, $0.5195)
- 15:05:45 implementer_post verification for rowEditableText: pass
