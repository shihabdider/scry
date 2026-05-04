# Status

phase: 3
layer: 0
updated: 2026-05-04T18:59:11.138Z

## Wishes

| wish | file | layer | status | time |
|------|------|-------|--------|------|
| normalizeWebsiteFilter | src/core/query.js | 2 | pass | 385.3s |
| queryKeyWithWebsiteFilters | src/core/query.js | 2 | pass | 453.1s |
| websiteNameCandidatesForHostname | src/core/url.js | 2 | pass | 469.7s |
| collectWebsiteFilterEvidence | src/core/search.js | 2 | pass | 441.6s |
| selectionIntentKeyParts | src/core/selection-learning.js | 2 | pass | 391.5s |
| parseWebsiteFilters | src/core/query.js | 1 | pass | 401.2s |
| websiteNameCandidatesForUrl | src/core/url.js | 1 | pass | 399.4s |
| entryMatchesWebsiteFilters | src/core/search.js | 1 | pass | 382.7s |
| selectionIntentKeysOverlap | src/core/selection-learning.js | 1 | pass | 433.3s |
| parseQuery | src/core/query.js | 0 | pass | 449.5s |
| buildHistoryIndex | src/core/search.js | 0 | pass | 404.6s |
| applyWebsiteFilters | src/core/search.js | 0 | pass | 413.1s |
| searchParsedHistory | src/core/search.js | 0 | pass | 517.3s |
| recordSelection | src/core/selection-learning.js | 0 | pass | 425.7s |
| selectionBoost | src/core/selection-learning.js | 0 | pass | 434.8s |

## Log

- 13:02:17 stubber complete, 15 wishes, 3 layers
- 13:02:17 stubber_post verification: pass
- 13:02:53 normalizeWebsiteFilter: running
- 13:09:18 normalizeWebsiteFilter: pass (385.3s, $0.5443)
- 13:09:20 implementer_post verification for normalizeWebsiteFilter: pass
- 13:09:25 queryKeyWithWebsiteFilters: running
- 13:16:58 queryKeyWithWebsiteFilters: pass (453.1s, $0.5360)
- 13:17:00 implementer_post verification for queryKeyWithWebsiteFilters: pass
- 13:17:06 websiteNameCandidatesForHostname: running
- 13:24:56 websiteNameCandidatesForHostname: pass (469.7s, $0.7084)
- 13:24:57 implementer_post verification for websiteNameCandidatesForHostname: pass
- 13:25:02 collectWebsiteFilterEvidence: running
- 13:32:24 collectWebsiteFilterEvidence: pass (441.6s, $0.6831)
- 13:32:25 implementer_post verification for collectWebsiteFilterEvidence: pass
- 13:32:30 selectionIntentKeyParts: running
- 13:39:01 selectionIntentKeyParts: pass (391.5s, $0.3918)
- 13:39:03 implementer_post verification for selectionIntentKeyParts: pass
- 13:39:04 layer 2 verification: pass
- 13:39:14 parseWebsiteFilters: running
- 13:45:56 parseWebsiteFilters: pass (401.2s, $0.4880)
- 13:45:57 implementer_post verification for parseWebsiteFilters: pass
- 13:46:02 websiteNameCandidatesForUrl: running
- 13:52:41 websiteNameCandidatesForUrl: pass (399.4s, $0.4707)
- 13:52:43 implementer_post verification for websiteNameCandidatesForUrl: pass
- 13:52:48 entryMatchesWebsiteFilters: running
- 13:59:11 entryMatchesWebsiteFilters: pass (382.7s, $0.4717)
- 13:59:12 implementer_post verification for entryMatchesWebsiteFilters: pass
- 13:59:22 selectionIntentKeysOverlap: running
- 14:06:35 selectionIntentKeysOverlap: pass (433.3s, $0.5969)
- 14:06:36 implementer_post verification for selectionIntentKeysOverlap: pass
- 14:06:37 layer 1 verification: pass
- 14:06:52 parseQuery: running
- 14:14:22 parseQuery: pass (449.5s, $0.5221)
- 14:14:23 implementer_post verification for parseQuery: pass
- 14:14:30 buildHistoryIndex: running
- 14:21:15 buildHistoryIndex: pass (404.6s, $0.5427)
- 14:21:16 implementer_post verification for buildHistoryIndex: pass
- 14:21:21 applyWebsiteFilters: running
- 14:28:14 applyWebsiteFilters: pass (413.1s, $0.4414)
- 14:28:16 implementer_post verification for applyWebsiteFilters: pass
- 14:28:22 recordSelection: running
- 14:35:28 recordSelection: pass (425.7s, $0.3921)
- 14:35:29 implementer_post verification for recordSelection: pass
- 14:35:35 selectionBoost: running
- 14:42:49 selectionBoost: pass (434.8s, $0.5886)
- 14:42:51 implementer_post verification for selectionBoost: pass
- 14:42:57 searchParsedHistory: running
- 14:51:35 searchParsedHistory: pass (517.3s, $0.8676)
- 14:51:36 implementer_post verification for searchParsedHistory: pass
- 14:51:37 layer 0 verification: pass
- 14:59:09 abstractor pass
- 14:59:11 abstractor_post verification: pass
