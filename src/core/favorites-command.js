/**
 * A FavoritesCommandParse is one of:
 * - { kind: "enter-favorites", raw: string, commandText: string }
 * - { kind: "not-favorites-command", raw: string }
 *
 * Interpretation:
 * Represents whether a submitted search input is the hidden favorites entry command. The accepted
 * commandText values are the prefixes ":f", ":fa", ":fav", ":favo", ":favor", ":favori",
 * ":favorit", and ":favorite". The command is intentionally hidden from public mode cycling and
 * is acted on only when the user presses Enter.
 *
 * Examples:
 * - { kind: "enter-favorites", raw: ":f", commandText: ":f" } represents the shortest favorites command.
 * - { kind: "enter-favorites", raw: "  :favorite  ", commandText: ":favorite" } represents the full command with surrounding whitespace.
 * - { kind: "not-favorites-command", raw: ":favorites" } represents a non-command input that should remain ordinary search text.
 *
 * @typedef {{ kind: 'enter-favorites', raw: string, commandText: string } | { kind: 'not-favorites-command', raw: string }} FavoritesCommandParse
 */

/**
 * string -> FavoritesCommandParse
 *
 * Parses a submitted input value as the hidden favorites entry command when it is exactly ":f"
 * through ":favorite" after trimming whitespace.
 *
 * Functional Examples:
 * - parseFavoritesCommand(":f") should produce { kind: "enter-favorites", raw: ":f", commandText: ":f" }.
 * - parseFavoritesCommand(" :fav ") should produce { kind: "enter-favorites", raw: " :fav ", commandText: ":fav" }.
 * - parseFavoritesCommand(":favorite") should produce { kind: "enter-favorites", raw: ":favorite", commandText: ":favorite" }.
 * - parseFavoritesCommand(":favorites") should produce { kind: "not-favorites-command", raw: ":favorites" }.
 * - parseFavoritesCommand("git issues") should produce { kind: "not-favorites-command", raw: "git issues" }.
 *
 * Template:
 * Follow the string structure:
 * - coerce the raw input to string
 * - trim surrounding whitespace to get commandText
 * - branch on commandText being a valid prefix of ":favorite" with at least ":f"
 * - produce the matching FavoritesCommandParse variant
 */
export function parseFavoritesCommand(input) {
  const raw = String(input ?? '')
  const commandText = raw.trim()
  const isFavoritesCommand = commandText.startsWith(':f') && ':favorite'.startsWith(commandText)

  if (isFavoritesCommand) {
    return { kind: 'enter-favorites', raw, commandText }
  }

  return { kind: 'not-favorites-command', raw }
}
