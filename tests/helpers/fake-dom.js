export class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase()
    this.ownerDocument = ownerDocument
    this.parentNode = null
    this.children = []
    this.dataset = {}
    this.attributes = new Map()
    this.listeners = new Map()
    this.hidden = false
    this.value = ''
    this.textContent = ''
    this.className = ''
    this.type = ''
    this.id = ''
    this._innerHTML = ''
  }

  set innerHTML(value) {
    this._innerHTML = String(value)
    this.children = []
  }

  get innerHTML() {
    return this._innerHTML
  }

  get childElementCount() {
    return this.children.length
  }

  append(...nodes) {
    for (const node of nodes) {
      if (node == null) continue
      if (node.isFragment) {
        this.append(...node.children)
        node.children = []
        continue
      }
      node.parentNode = this
      this.children.push(node)
    }
  }

  setAttribute(name, value) {
    const stringValue = String(value)
    this.attributes.set(name, stringValue)
    if (name === 'id') {
      this.id = stringValue
      this.ownerDocument?.registerElement(this)
    }
    if (name === 'tabindex') this.tabIndex = Number(stringValue)
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }

  dispatchEvent(event) {
    event.target ??= this
    event.currentTarget = this
    event.defaultPrevented ??= false
    event.preventDefault ??= () => {
      event.defaultPrevented = true
    }

    for (const listener of this.listeners.get(event.type) ?? []) listener(event)
    if (event.bubbles !== false && this.parentNode) this.parentNode.dispatchEvent(event)
    return !event.defaultPrevented
  }

  focus() {
    if (this.ownerDocument) this.ownerDocument.activeElement = this
  }

  blur() {
    if (this.ownerDocument?.activeElement === this) this.ownerDocument.activeElement = null
  }

  closest(selector) {
    if (selector === '[data-result-index]' && this.dataset.resultIndex != null) return this
    return this.parentNode?.closest?.(selector) ?? null
  }

  querySelector(selector) {
    return findInTree(this, selector)
  }
}

class FakeDocumentFragment extends FakeElement {
  constructor(ownerDocument) {
    super('#fragment', ownerDocument)
    this.isFragment = true
  }
}

export class FakeDocument {
  constructor() {
    this.elementsById = new Map()
    this.listeners = new Map()
    this.activeElement = null
    this.body = new FakeElement('body', this)
    this.body.parentNode = this
  }

  createElement(tagName) {
    return new FakeElement(tagName, this)
  }

  createDocumentFragment() {
    return new FakeDocumentFragment(this)
  }

  registerElement(element) {
    if (element.id) this.elementsById.set(element.id, element)
  }

  querySelector(selector) {
    if (selector.startsWith('#')) return this.elementsById.get(selector.slice(1)) ?? null
    return findInTree(this.body, selector)
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }

  dispatchEvent(event) {
    event.target ??= this.activeElement ?? this.body
    event.currentTarget = this
    event.defaultPrevented ??= false
    event.preventDefault ??= () => {
      event.defaultPrevented = true
    }

    for (const listener of this.listeners.get(event.type) ?? []) listener(event)
    return !event.defaultPrevented
  }
}

export function createScryDocument() {
  const document = new FakeDocument()
  for (const id of [
    'status',
    'search-input',
    'message',
    'results',
    'deep-search-button',
    'pagination',
    'previous-page-button',
    'page-status',
    'next-page-button',
  ]) {
    const element = document.createElement(id.endsWith('button') ? 'button' : id === 'results' ? 'ol' : 'section')
    element.setAttribute('id', id)
    document.body.append(element)
  }
  return document
}

export function dispatchInput(element) {
  return element.dispatchEvent({ type: 'input', bubbles: true })
}

export function dispatchKeydown(element, key, options = {}) {
  const event = {
    type: 'keydown',
    key,
    bubbles: true,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...options,
  }
  element.dispatchEvent(event)
  return event
}

function findInTree(root, selector) {
  for (const child of root.children ?? []) {
    if (matches(child, selector)) return child
    const descendant = findInTree(child, selector)
    if (descendant) return descendant
  }
  return null
}

function matches(element, selector) {
  if (selector.startsWith('#')) return element.id === selector.slice(1)
  const resultIndex = selector.match(/^\[data-result-index="?(\d+)"?\]$/)
  if (resultIndex) return element.dataset.resultIndex === resultIndex[1]
  if (selector === '[data-result-index]') return element.dataset.resultIndex != null
  return false
}
