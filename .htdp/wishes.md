## Wish List

### Layer 1 (implement first)
- `websiteNameCandidatesForLocalFileUrl(url)` in `src/core/url.js`
  Purpose: Return the canonical `WebsiteNameCandidates` value for a parsed local `file:` URL so `file:` website filters can prefix-match the scheme-derived `file` candidate without adding filesystem access.
  Depends on: none

### Layer 0 (implement last)
- `websiteNameCandidatesForUrl(url)` in `src/core/url.js`
  Purpose: Route valid `file:` URLs to the local-file candidate derivation while preserving the existing hostname-derived candidate path for web/domain URLs and safe empty candidates for invalid or non-file hostless URLs.
  Depends on: websiteNameCandidatesForLocalFileUrl

## Data Definitions Created/Modified
- `src/core/url.js`: extended `WebsiteNameCandidates` JSDoc to allow scheme-derived local-file candidates while keeping the existing `hostname`, `rootName`, `labels`, and `matchCandidates` shape.
- `src/core/url.js`: added stub `websiteNameCandidatesForLocalFileUrl(url)` and routed parsed `file:` URLs from `websiteNameCandidatesForUrl` to that stub.
- `.htdp/DSL.json`: updated `website name candidates` vocabulary to include the local-file `file` candidate and the local-only no-filesystem/no-network constraint.

## Assertion Changes Flagged
- None

## Assumptions / Interpretations
- I interpreted the local-file site candidate as reusing the existing `WebsiteNameCandidates` object shape rather than adding fields, so debug evidence, website filters, and selection-learning intent shapes remain unchanged.
- I assumed `file:` matching should be represented by `matchCandidates` containing `file` and `rootName` being `file`, with `hostname` and `labels` empty because local file URLs have no hostname.

## Notes
- `npm run check` and `npm test` pass with the stub because existing tests do not exercise `file:` history entries yet.
