# Status

phase: 3
layer: 0
updated: 2026-05-13T00:10:00.000Z

## Wishes

| wish | file | layer | status | time |
|------|------|-------|--------|------|
| nextSearchMode | src/core/search-modes.js | 2 | pass | ad-hoc repair |
| searchModeStatusText | src/core/search-modes.js | 2 | pass | ad-hoc repair |
| ScryPanelApp.activeSearchModeState(): SearchModeState | src/panel/app.js | 2 | pass | ad-hoc repair |
| ScryPanelApp.emptyQuerySortForMode(mode?: SearchMode): 'frecency' | 'recency' | src/panel/app.js | 2 | pass | ad-hoc repair |
| ScryPanelApp.resultMessagesForMode(mode?: SearchMode): { empty: string, noMatches: string, error: string } | src/panel/app.js | 2 | pass | ad-hoc repair |
| ScryPanelApp.loadHistoryMode(state: SearchModeState): Promise<SearchModeState> | src/panel/app.js | 2 | pass | ad-hoc repair |
| ScryPanelApp.loadClosedMode(state: SearchModeState): Promise<SearchModeState> | src/panel/app.js | 2 | pass | ad-hoc repair |
| searchSearchSurfaceModel | src/core/search-modes.js | 1 | pass | ad-hoc repair |
| ScryPanelApp.ensureSearchModeReady(mode?: SearchMode): Promise<SearchModeState> | src/panel/app.js | 1 | pass | ad-hoc repair |
| searchSearchHeaderModel | src/core/search-modes.js | 0 | pass | ad-hoc repair |
| ScryPanelApp.switchSearchMode(mode: SearchMode): Promise<SearchModeState> | src/panel/app.js | 0 | pass | ad-hoc repair |
| ScryPanelApp.cycleSearchMode(direction?: number): Promise<SearchModeState> | src/panel/app.js | 0 | pass | ad-hoc repair |
| ScryPanelApp.loadDefaultSearchMode(): Promise<SearchModeState> | src/panel/app.js | 0 | pass | ad-hoc repair |

## Log

- Stubber created a two-mode `history`/`closed` data-definition plan and wish list.
- Layer dispatch produced correct partial implementations but implementer_post failed while stale tests and later stubs were still failing.
- Ad-hoc implementer repair completed the remaining core/panel models, mode switching, closed loading, and stale test updates.
- Abstractor extracted `ScryPanelApp.loadSearchModeState(state, loadRawEntries)` to share history/closed loading state transitions.
- `npm test`: pass (279 tests).
- `npm run check`: pass.
