# Status

phase: 2
layer: 1
updated: 2026-04-27T20:46:05.861Z

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
| buildVisibleRows | src/core/rows.js | 3 | pass | 170.6s |
| selectedVisibleRow | src/panel/app.js | 3 | pass | 170.8s |
| ensureSearchModeReady | src/panel/app.js | 3 | pass | 211.3s |
| renderModeIndicator | src/panel/app.js | 3 | pass | 183.2s |
| searchHistory | src/core/search.js | 2 | pass | 120.1s |
| recordSelection | src/core/selection-learning.js | 2 | pass | 165.9s |
| updateVisibleRows | src/panel/app.js | 2 | pass | 109.8s |
| copySelectedRow | src/panel/app.js | 2 | pass | 260.6s |
| changeSelectedRowToSearch | src/panel/app.js | 2 | pass | 200.8s |
| switchSearchMode | src/panel/app.js | 2 | pass | 223.4s |
| loadHistory | src/panel/app.js | 2 | pass | 213.9s |
| openSelected | src/panel/app.js | 2 | pass | 223.8s |
| updateResults | src/panel/app.js | 1 | pass | 250.5s |
| pageCount | src/panel/app.js | 1 | pass | 188.3s |
| pageStart | src/panel/app.js | 1 | pass | 104.5s |
| clampPageIndex | src/panel/app.js | 1 | pass | 129.8s |
| ensureSelectedVisible | src/panel/app.js | 1 | pass | 172.7s |
| moveSelection | src/panel/app.js | 1 | pass | 150.8s |
| movePage | src/panel/app.js | 1 | pass | 176.2s |
| focusSelectedResult | src/panel/app.js | 1 | pass | 310.3s |
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
- 15:37:44 buildVisibleRows: running
- 15:40:35 buildVisibleRows: pass (170.6s, $0.8993)
- 15:40:36 implementer_post verification for buildVisibleRows: pass
- 15:40:45 selectedVisibleRow: running
- 15:43:36 selectedVisibleRow: pass (170.8s, $0.7909)
- 15:43:37 implementer_post verification for selectedVisibleRow: pass
- 15:43:42 ensureSearchModeReady: running
- 15:47:14 ensureSearchModeReady: pass (211.3s, $0.8153)
- 15:47:15 implementer_post verification for ensureSearchModeReady: pass
- 15:47:22 renderModeIndicator: running
- 15:50:26 renderModeIndicator: pass (183.2s, $0.8144)
- 15:50:27 implementer_post verification for renderModeIndicator: pass
- 15:50:28 layer 3 verification: pass
- 15:50:45 searchHistory: running
- 15:52:45 searchHistory: pass (120.1s, $0.3966)
- 15:52:47 implementer_post verification for searchHistory: pass
- 15:52:52 recordSelection: running
- 15:55:38 recordSelection: pass (165.9s, $0.7182)
- 15:55:40 implementer_post verification for recordSelection: pass
- 15:55:45 updateVisibleRows: running
- 15:57:34 updateVisibleRows: pass (109.8s, $0.6077)
- 15:57:36 implementer_post verification for updateVisibleRows: pass
- 15:57:40 copySelectedRow: running
- 16:02:01 copySelectedRow: pass (260.6s, $1.5330)
- 16:02:02 implementer_post verification for copySelectedRow: pass
- 16:02:07 changeSelectedRowToSearch: running
- 16:05:28 changeSelectedRowToSearch: pass (200.8s, $0.8007)
- 16:05:29 implementer_post verification for changeSelectedRowToSearch: pass
- 16:05:35 switchSearchMode: running
- 16:09:19 switchSearchMode: pass (223.4s, $1.3449)
- 16:09:20 implementer_post verification for switchSearchMode: pass
- 16:09:26 loadHistory: running
- 16:12:59 loadHistory: pass (213.9s, $1.5750)
- 16:13:01 implementer_post verification for loadHistory: pass
- 16:13:08 openSelected: running
- 16:16:52 openSelected: pass (223.8s, $0.8850)
- 16:16:53 implementer_post verification for openSelected: pass
- 16:16:54 layer 2 verification: pass
- 16:17:01 updateResults: running
- 16:21:12 updateResults: pass (250.5s, $1.6260)
- 16:21:13 implementer_post verification for updateResults: pass
- 16:21:21 pageCount: running
- 16:24:29 pageCount: pass (188.3s, $0.7649)
- 16:24:30 implementer_post verification for pageCount: pass
- 16:24:36 pageStart: running
- 16:27:51 pageStart: pass (194.6s, $0.9921)
- 16:27:52 implementer_post verification for pageStart: fail
- 16:28:07 pageStart: running
- 16:29:52 pageStart: pass (104.5s, $0.4224)
- 16:29:53 implementer_post verification for pageStart: pass
- 16:29:58 clampPageIndex: running
- 16:32:08 clampPageIndex: pass (129.8s, $0.6205)
- 16:32:09 implementer_post verification for clampPageIndex: pass
- 16:32:16 ensureSelectedVisible: running
- 16:35:08 ensureSelectedVisible: pass (172.7s, $0.7921)
- 16:35:10 implementer_post verification for ensureSelectedVisible: pass
- 16:35:15 moveSelection: running
- 16:37:45 moveSelection: pass (150.8s, $0.6609)
- 16:37:47 implementer_post verification for moveSelection: pass
- 16:37:52 movePage: running
- 16:40:48 movePage: pass (176.2s, $0.9276)
- 16:40:49 implementer_post verification for movePage: pass
- 16:40:54 focusSelectedResult: running
- 16:46:04 focusSelectedResult: pass (310.3s, $1.7059)
- 16:46:05 implementer_post verification for focusSelectedResult: pass
