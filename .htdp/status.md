# Status

phase: 2
layer: 3
updated: 2026-04-27T19:37:36.059Z

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
| isCopiedFeedbackVisible | src/core/rows.js | 4 | pass | 148.2s |
| createModeCache | src/core/search-modes.js | 4 | pass | 113.0s |
| cycleSearchMode | src/core/search-modes.js | 4 | pass | 73.9s |
| modeIndicatorModel | src/core/search-modes.js | 4 | pass | 187.6s |
| fetchRecentlyClosed | src/platform/sessions-provider.js | 4 | pass | 92.6s |
| flattenClosedSessions | src/platform/sessions-provider.js | 4 | pass | 84.9s |
| writeClipboardText | src/platform/clipboard.js | 4 | pass | 106.6s |
| resetSelectionForModeSwitch | src/panel/app.js | 4 | pass | 98.5s |
| focusSearch | src/panel/app.js | 4 | pass | 151.8s |
| docs/action-popup-alignment.md | docs/action-popup-alignment.md | 4 | pending | - |
| parseExactPhrases | src/core/query.js | 3 | pass | 177.3s |
| parseQuery | src/core/query.js | 3 | pass | 95.2s |
| searchParsedHistory | src/core/search.js | 3 | pass | 253.1s |
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
- 15:05:52 isCopiedFeedbackVisible: running
- 15:08:20 isCopiedFeedbackVisible: pass (148.2s, $0.6153)
- 15:08:21 implementer_post verification for isCopiedFeedbackVisible: pass
- 15:08:28 createModeCache: running
- 15:10:21 createModeCache: pass (113.0s, $0.4981)
- 15:10:22 implementer_post verification for createModeCache: pass
- 15:10:27 cycleSearchMode: running
- 15:11:41 cycleSearchMode: pass (73.9s, $0.2899)
- 15:11:42 implementer_post verification for cycleSearchMode: pass
- 15:11:47 modeIndicatorModel: running
- 15:14:55 modeIndicatorModel: pass (187.6s, $0.9389)
- 15:14:56 implementer_post verification for modeIndicatorModel: pass
- 15:15:04 fetchRecentlyClosed: running
- 15:16:36 fetchRecentlyClosed: pass (92.6s, $0.5368)
- 15:16:38 implementer_post verification for fetchRecentlyClosed: pass
- 15:16:45 flattenClosedSessions: running
- 15:18:10 flattenClosedSessions: pass (84.9s, $0.3186)
- 15:18:11 implementer_post verification for flattenClosedSessions: pass
- 15:18:15 writeClipboardText: running
- 15:20:02 writeClipboardText: pass (106.6s, $0.5390)
- 15:20:03 implementer_post verification for writeClipboardText: pass
- 15:20:10 resetSelectionForModeSwitch: running
- 15:21:48 resetSelectionForModeSwitch: pass (98.5s, $0.4343)
- 15:21:50 implementer_post verification for resetSelectionForModeSwitch: pass
- 15:21:58 focusSearch: running
- 15:24:30 focusSearch: pass (151.8s, $0.7187)
- 15:24:31 implementer_post verification for focusSearch: pass
- 15:28:32 parseExactPhrases: running
- 15:31:29 parseExactPhrases: pass (177.3s, $0.9280)
- 15:31:31 implementer_post verification for parseExactPhrases: pass
- 15:31:36 parseQuery: running
- 15:33:11 parseQuery: pass (95.2s, $0.4819)
- 15:33:13 implementer_post verification for parseQuery: pass
- 15:33:21 searchParsedHistory: running
- 15:37:34 searchParsedHistory: pass (253.1s, $1.1298)
- 15:37:36 implementer_post verification for searchParsedHistory: pass
