/**
 * Map a point in rendered Markdown back to an offset in its source, so a
 * double-click in the rendered view can open the editor right there.
 *
 * The renderer tags every element with its source range (`data-src-start` /
 * `data-src-end`, see markdown-renderer). Inside the nearest tagged element the
 * rendered text before the click is aligned with the source by matching its
 * characters in order, which skips Markdown syntax (`**`, `[`, `](url)`, `#`,
 * list markers, ...).
 */

interface CaretPoint {
  node: Node
  offset: number
}

function caretFromPoint(x: number, y: number): CaretPoint | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(x, y)
    return pos ? { node: pos.offsetNode, offset: pos.offset } : null
  }
  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(x, y)
    return range ? { node: range.startContainer, offset: range.startOffset } : null
  }
  return null
}

const isSpace = (ch: string) => /\s/.test(ch)

/**
 * Source offset for the viewport point (x, y) inside `root`, or null if the
 * point is not on rendered content.
 */
export function sourceOffsetFromPoint(root: HTMLElement, x: number, y: number, source: string): number | null {
  const caret = caretFromPoint(x, y)
  if (!caret || !root.contains(caret.node)) return null

  const base = caret.node.nodeType === Node.ELEMENT_NODE ? (caret.node as Element) : caret.node.parentElement
  const el = base?.closest<HTMLElement>('[data-src-start]')
  if (!el || !root.contains(el)) return null

  const start = Number(el.dataset.srcStart)
  const end = Math.min(source.length, Number(el.dataset.srcEnd ?? source.length))
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null

  let pos = start
  let matched = 0
  let tail = ''

  // Advance `pos` over the source for rendered text, char by char
  const matchText = (txt: string) => {
    for (const ch of txt) {
      if (isSpace(ch)) continue
      const idx = source.indexOf(ch, pos)
      if (idx === -1 || idx >= end) return
      pos = idx + 1
      matched++
    }
  }

  // Tagged child elements before the click are skipped as a whole (their
  // source range is known) - so e.g. a link's URL is never matched against.
  const skipOrMatch = (child: ChildNode) => {
    if (child instanceof HTMLElement && child.dataset.srcEnd != null) {
      pos = Math.max(pos, Math.min(end, Number(child.dataset.srcEnd)))
      if (child.textContent?.trim()) matched++
    } else {
      matchText(child.textContent ?? '')
    }
  }

  try {
    const children = Array.from(el.childNodes)
    if (caret.node === el) {
      children.slice(0, caret.offset).forEach(skipOrMatch)
    } else {
      for (const child of children) {
        if (child === caret.node || child.contains(caret.node)) {
          const range = document.createRange()
          range.selectNodeContents(child)
          range.setEnd(caret.node, caret.offset)
          tail = range.toString()
          matchText(tail)
          break
        }
        skipOrMatch(child)
      }
    }
  } catch {
    return start
  }

  if (matched === 0) {
    // Click before the first character: jump over the syntax (e.g. "# ",
    // "- [ ] ") to where the text begins
    const firstChar = [...(el.textContent ?? '')].find((ch) => !isSpace(ch))
    if (firstChar) {
      const idx = source.indexOf(firstChar, start)
      if (idx !== -1 && idx < end) return idx
    }
    return start
  }

  // Keep spaces the click was placed after ("foo |bar")
  for (let i = tail.length - 1; i >= 0 && tail[i] === ' ' && source[pos] === ' '; i--) pos++

  return Math.min(pos, end)
}

/** Vertical position (px, from the content top) of `offset` in a textarea. */
export function textareaCaretTop(ta: HTMLTextAreaElement, offset: number): number {
  const style = getComputedStyle(ta)
  const mirror = document.createElement('div')
  const copy = [
    'boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight',
    'tabSize', 'wordSpacing', 'textIndent', 'textTransform',
  ] as const
  for (const prop of copy) mirror.style[prop] = style[prop]
  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.top = '0'
  mirror.style.left = '-9999px'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.overflowWrap = 'break-word'
  mirror.style.borderStyle = 'solid'

  mirror.textContent = ta.value.slice(0, offset)
  const marker = document.createElement('span')
  marker.textContent = ta.value.slice(offset) || '.'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)
  const top = marker.offsetTop
  mirror.remove()
  return top
}
