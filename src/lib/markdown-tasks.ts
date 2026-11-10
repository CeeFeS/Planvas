/**
 * Helpers for GFM task lists ("- [ ] todo" / "- [x] done") in custom column
 * cells: ticking a box in the rendered view, and list continuation on Enter
 * in the Markdown editor.
 */

/** Marker of a list item that starts at `offset` in the source, up to the box. */
const TASK_AT_OFFSET = /^([ \t]*(?:[-*+]|\d+[.)])[ \t]+\[)([ xX])\]/

/**
 * Flip the checkbox of the task list item whose source starts at `offset`
 * (the list item's start position from the Markdown AST).
 * Returns the new source, or null if there is no task box at that offset.
 */
export function toggleTaskAtOffset(source: string, offset: number): string | null {
  const match = TASK_AT_OFFSET.exec(source.slice(offset))
  if (!match) return null
  const boxIndex = offset + match[1].length
  const next = match[2] === ' ' ? 'x' : ' '
  return source.slice(0, boxIndex) + next + source.slice(boxIndex + 1)
}

/** A task list line: indentation, bullet, box, and the text after it. */
const TASK_LINE = /^([ \t]*(?:>[ \t]?)*[ \t]*)([-*+])([ \t]+)\[[ xX]\][ \t]?/

export interface TextEdit {
  /** Replace source[start, end) with `text` ... */
  start: number
  end: number
  text: string
  /** ... and put the caret here afterwards (absolute, in the new value). */
  caret: number
}

/**
 * Enter inside a task line of the editor:
 * - task with text -> new empty task "- [ ] " on the next line
 *   (text right of the caret moves into the new task)
 * - empty task -> the task marker is removed and the line becomes a plain line
 * Returns null when Enter should behave normally.
 */
export function taskListEnter(value: string, selectionStart: number, selectionEnd: number): TextEdit | null {
  if (selectionStart !== selectionEnd) return null
  const caret = selectionStart

  const lineStart = value.lastIndexOf('\n', caret - 1) + 1
  const nextBreak = value.indexOf('\n', caret)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak
  const line = value.slice(lineStart, lineEnd)

  const match = TASK_LINE.exec(line)
  if (!match) return null

  const prefixLength = match[0].length
  // Caret inside the marker itself: keep the default behavior
  if (caret - lineStart < prefixLength) return null

  const content = line.slice(prefixLength)
  if (!content.trim()) {
    // Empty task -> drop the marker, leaving a normal (empty) line
    const indent = match[1].replace(/[ \t]+$/, '')
    return { start: lineStart, end: lineEnd, text: indent, caret: lineStart + indent.length }
  }

  const [, indent, bullet, gap] = match
  const insert = `\n${indent}${bullet}${gap}[ ] `
  return { start: caret, end: caret, text: insert, caret: caret + insert.length }
}
