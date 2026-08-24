# Domain-Specific Language

## Product terms

- History index — The in-memory, popup-session collection of normalized visited URLs and searchable segments.
- Query token — A normalized unquoted fragment used for ranked search.
- Segment — A token from a candidate's host, path, query string, or title, annotated with its source field and order.
- Match tier — The textual relationship between a query token and segment: exact, prefix, constrained abbreviation, guarded substring, or none.
- Direct match — Exact, prefix, or guarded contiguous substring evidence; unlike abbreviation evidence, query characters are contiguous in the candidate segment.
- Constrained abbreviation — A short ordered-subsequence match whose start and character span are bounded to avoid accidental matches in unrelated text.
- Field priority — The tie-breaking preference among host, path, title, and query fields after textual match quality is considered.
- Same-field coherence — Evidence that multiple query tokens match one candidate field in query order.
- URL coherence — Evidence that query tokens match URL segments in order, with an additional reward for adjacent segments.
- Full coverage — Every query token has match evidence in the candidate.
- Opaque URL token — A machine-oriented alphanumeric URL segment, commonly an identifier or encoded payload, that should not receive broad abbreviation matching.

## Constraints

- Scry remains local-only and uses no external search or network service.
- Existing quoted phrases and website filters retain their current meanings.
- Match explanations remain internal debug data rather than a new UI surface.
