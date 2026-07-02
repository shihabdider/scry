export const SCRY_SETTINGS_STORAGE_KEY = 'scry.settings'
export const SCRY_SETTINGS_VERSION = 1

export const SCRY_SHORTCUT_IDS = Object.freeze([
  'switchMode',
  'moveNext',
  'movePrevious',
  'copySelected',
  'editSelectedUrl',
  'nextPage',
  'previousPage',
  'openSelected',
  'leavePanelFocus',
  'removeSelectedFavorite',
  'undoFavoriteRemoval',
])

/**
 * @typedef {'switchMode'|'moveNext'|'movePrevious'|'copySelected'|'editSelectedUrl'|'nextPage'|'previousPage'|'openSelected'|'leavePanelFocus'|'removeSelectedFavorite'|'undoFavoriteRemoval'} ScryShortcutId
 */

/**
 * @typedef {object} ScryShortcuts
 * @property {string} switchMode
 * @property {string} moveNext
 * @property {string} movePrevious
 * @property {string} copySelected
 * @property {string} editSelectedUrl
 * @property {string} nextPage
 * @property {string} previousPage
 * @property {string} openSelected
 * @property {string} leavePanelFocus
 * @property {string} removeSelectedFavorite
 * @property {string} undoFavoriteRemoval
 */

/**
 * @typedef {object} ScrySettings
 * @property {1} version
 * @property {ScryShortcuts} shortcuts
 */

export const DEFAULT_SCRY_SHORTCUTS = Object.freeze({
  switchMode: 'Ctrl+Q',
  moveNext: 'Tab',
  movePrevious: 'Shift+Tab',
  copySelected: 'Ctrl+Y',
  editSelectedUrl: 'Ctrl+E',
  nextPage: 'Ctrl+D',
  previousPage: 'Ctrl+U',
  openSelected: 'Enter',
  leavePanelFocus: 'Escape',
  removeSelectedFavorite: 'x',
  undoFavoriteRemoval: 'u',
})

export const DEFAULT_SCRY_SETTINGS = Object.freeze({
  version: SCRY_SETTINGS_VERSION,
  shortcuts: DEFAULT_SCRY_SHORTCUTS,
})

const MODIFIER_ORDER = Object.freeze(['Ctrl', 'Alt', 'Shift', 'Command'])
const MODIFIER_KEYS = Object.freeze({
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  meta: 'Command',
  cmd: 'Command',
  command: 'Command',
})
const KEY_ALIASES = Object.freeze({
  esc: 'Escape',
  escape: 'Escape',
  return: 'Enter',
  enter: 'Enter',
  tab: 'Tab',
  space: 'Space',
  spacebar: 'Space',
  ' ': 'Space',
  arrowup: 'ArrowUp',
  up: 'ArrowUp',
  arrowdown: 'ArrowDown',
  down: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  left: 'ArrowLeft',
  arrowright: 'ArrowRight',
  right: 'ArrowRight',
  backspace: 'Backspace',
  delete: 'Delete',
  del: 'Delete',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
})

const NAMED_KEYS = new Set([
  ...Object.values(KEY_ALIASES),
  'Insert',
  'CapsLock',
])

export function defaultScrySettings() {
  return {
    version: SCRY_SETTINGS_VERSION,
    shortcuts: { ...DEFAULT_SCRY_SHORTCUTS },
  }
}

function modifierName(part) {
  return MODIFIER_KEYS[String(part).trim().toLowerCase()] ?? null
}

function normalizeShortcutKey(keyText, hasModifier) {
  const text = String(keyText ?? '').trim()
  if (!text) throw new Error('Shortcut key is missing')

  const alias = KEY_ALIASES[text.toLowerCase()]
  if (alias) return alias

  if (/^f(?:[1-9]|1\d|2[0-4])$/i.test(text)) return text.toUpperCase()
  if (NAMED_KEYS.has(text)) return text

  if (text.length === 1) {
    if (/^[a-z]$/i.test(text)) return hasModifier ? text.toUpperCase() : text.toLowerCase()
    return text
  }

  throw new Error(`Unknown shortcut key: ${text}`)
}

function parseShortcutChord(chord) {
  if (typeof chord !== 'string') throw new Error('Shortcut must be text')

  const parts = chord
    .trim()
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) throw new Error('Shortcut is empty')

  const modifiers = {
    Ctrl: false,
    Alt: false,
    Shift: false,
    Command: false,
  }
  let rawKey = null

  for (const part of parts) {
    const modifier = modifierName(part)
    if (modifier) {
      if (modifiers[modifier]) throw new Error(`Duplicate shortcut modifier: ${modifier}`)
      modifiers[modifier] = true
      continue
    }

    if (rawKey !== null) throw new Error('Shortcut can only have one non-modifier key')
    rawKey = part
  }

  if (rawKey === null) throw new Error('Shortcut must include a non-modifier key')

  const hasModifier = Object.values(modifiers).some(Boolean)
  const key = normalizeShortcutKey(rawKey, hasModifier)

  return { modifiers, key }
}

function labelForParsedShortcut({ modifiers, key }) {
  return [...MODIFIER_ORDER.filter((modifier) => modifiers[modifier]), key].join('+')
}

export function normalizeShortcutChord(chord) {
  return labelForParsedShortcut(parseShortcutChord(chord))
}

function normalizedEventKey(eventKey, hasModifier) {
  if (eventKey === ' ') return 'Space'
  return normalizeShortcutKey(eventKey, hasModifier)
}

export function keyboardEventMatchesShortcut(event, shortcut) {
  try {
    const parsed = parseShortcutChord(shortcut)
    const hasModifier = Object.values(parsed.modifiers).some(Boolean)
    const eventKey = normalizedEventKey(event?.key, hasModifier)

    return eventKey === parsed.key
      && Boolean(event?.ctrlKey) === parsed.modifiers.Ctrl
      && Boolean(event?.altKey) === parsed.modifiers.Alt
      && Boolean(event?.shiftKey) === parsed.modifiers.Shift
      && Boolean(event?.metaKey) === parsed.modifiers.Command
  } catch {
    return false
  }
}

export function normalizeScrySettings(rawSettings) {
  const defaults = defaultScrySettings()
  if (!rawSettings || typeof rawSettings !== 'object') return defaults
  if ('version' in rawSettings && rawSettings.version !== SCRY_SETTINGS_VERSION) return defaults

  const rawShortcuts = rawSettings.shortcuts && typeof rawSettings.shortcuts === 'object'
    ? rawSettings.shortcuts
    : {}
  const shortcuts = { ...defaults.shortcuts }

  for (const id of SCRY_SHORTCUT_IDS) {
    const rawShortcut = rawShortcuts[id]
    if (typeof rawShortcut !== 'string') continue

    try {
      shortcuts[id] = normalizeShortcutChord(rawShortcut)
    } catch {
      shortcuts[id] = defaults.shortcuts[id]
    }
  }

  return {
    version: SCRY_SETTINGS_VERSION,
    shortcuts,
  }
}

export function shortcutLabel(settings, shortcutId) {
  if (!SCRY_SHORTCUT_IDS.includes(shortcutId)) return ''

  return normalizeScrySettings(settings).shortcuts[shortcutId] ?? DEFAULT_SCRY_SHORTCUTS[shortcutId] ?? ''
}
