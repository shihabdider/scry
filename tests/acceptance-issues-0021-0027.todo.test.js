import test from 'node:test'

// Acceptance-test stubs for the HtDP implementer. These are TODO tests so the
// stubber can record the required coverage without changing current assertions.

test.todo('issue-0021: i focuses the search input from result/navigation mode without changing the query')
test.todo('issue-0021: / focuses the search input from result/navigation mode without changing the query')
test.todo('issue-0021: i and / place the cursor at the end when returning focus to search')
test.todo('issue-0021: i and / type normally when the search input is already focused')
test.todo('issue-0021: / in result/navigation mode does not open or copy the selected result')

test.todo('issue-0024: first Escape from search/input mode enters result/navigation mode and preserves the query')
test.todo('issue-0024: Escape from result/navigation mode calls window.close when available')
test.todo('issue-0024: Escape from result/navigation mode falls back to blur when window.close is unavailable')
test.todo('issue-0024: double Escape closes or leaves even when there are no visible result rows')
test.todo('issue-0024: Escape from a selected result row does not open, copy, or edit the selected result')
test.todo('issue-0024: Command-K startup/toggle contract still begins with search focus')

test.todo('issue-0025: footer key-hint line is absent from popup markup')
test.todo('issue-0025: header row renders Search [recent] history with [recent] as the clickable mode badge')
test.todo('issue-0025: header row renders Search [closed] history with [closed] as the clickable mode badge')
test.todo('issue-0025: header row renders Search [deep] history with [deep] as the clickable mode badge')
test.todo('issue-0025: Tab/Shift+Tab mode-switch hint appears on or adjacent to the mode badge')
test.todo('issue-0025: right-aligned result count excludes synthetic Open typed URL rows')
test.todo('issue-0025: search placeholder uses a space-separated example and includes the focus-search hint')
test.todo('issue-0025: selected real result rows show y copy and c edit URL hints')
test.todo('issue-0025: selected rows without edit capability omit c edit URL while keeping available hints')
test.todo('issue-0025: unselected rows do not show selected-row action hints')
test.todo('issue-0025: pagination keeps h/l hints integrated into previous/next buttons')
test.todo('issue-0025: popup styling remains dense old-Google UI without card chrome')

test.todo('issue-0026: SEARCH_MODES and cache initialization enumerate recent, closed, deep')
test.todo('issue-0026: Tab cycles recent -> closed -> deep -> recent')
test.todo('issue-0026: Shift+Tab cycles recent -> deep -> closed -> recent')
test.todo('issue-0026: clicking the mode badge follows the same forward order as Tab')
test.todo('issue-0026: switching modes preserves the query and resets selection/page position')

test.todo('issue-0027: space-separated URL fragments find the same intended URL as the former starred example')
test.todo('issue-0027: popup placeholder no longer presents * as the primary separator')
test.todo('issue-0027: README/product examples use spaces between URL fragments')
test.todo('issue-0027: automated query/search examples use spaces as the recommended separator')
test.todo('issue-0027: quoted exact phrases continue preserving spaces inside complete quotes')
test.todo('issue-0027: starred input remains tolerated for backward compatibility when tokenization supports it')
