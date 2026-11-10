/**
 * Content-based ("auto fit") column widths for the planning grid.
 *
 * Text is measured with a shared 2D canvas instead of the DOM, so sizing a
 * column costs no layout pass. The numbers below mirror the paddings, gaps and
 * icon sizes used by the grid cells; if those change, adjust them here.
 */

type FontKind = 'sans' | 'hand' | 'mono'

interface FontSpec {
  kind: FontKind
  /** px */
  size: number
  weight?: number
  italic?: boolean
}

let ctx: CanvasRenderingContext2D | null | undefined
const familyCache = new Map<FontKind, string>()
const widthCache = new Map<string, number>()

function getContext(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx
  if (typeof document === 'undefined') return null
  ctx = document.createElement('canvas').getContext('2d')
  return ctx
}

/** Resolve the real font stack (next/font variables) via a probe element. */
function fontFamily(kind: FontKind): string {
  const cached = familyCache.get(kind)
  if (cached) return cached
  const probe = document.createElement('span')
  probe.className = `font-${kind}`
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  document.body.appendChild(probe)
  const family = getComputedStyle(probe).fontFamily || 'sans-serif'
  probe.remove()
  familyCache.set(kind, family)
  return family
}

/** Forget cached measurements, e.g. once the web fonts finished loading. */
export function resetTextMeasureCache() {
  widthCache.clear()
  familyCache.clear()
}

export function measureText(text: string, font: FontSpec): number {
  if (!text) return 0
  const context = getContext()
  if (!context) return text.length * font.size * 0.55
  const css = `${font.italic ? 'italic ' : ''}${font.weight ?? 400} ${font.size}px ${fontFamily(font.kind)}`
  const key = `${css}|${text}`
  const cached = widthCache.get(key)
  if (cached !== undefined) return cached
  context.font = css
  const width = context.measureText(text).width
  widthCache.set(key, width)
  return width
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

// Small reserve for sub-pixel rounding and the hover pencil of `.editable-text`
const SAFETY = 10

// ==================== Task / resource columns ====================

export interface TaskNameEntry {
  name: string
  isSubtask: boolean
}

export function autoTaskColumnWidth(opts: {
  tasks: TaskNameEntry[]
  headerLabel: string
  canEdit: boolean
  hasFilter: boolean
  min: number
  max: number
}): number {
  const { tasks, headerLabel, canEdit, hasFilter, min, max } = opts

  // th: px-3 | label | gap-2 | filter (+count) | gap-2 | expand/collapse (2×22 + gap-1) | mr-2
  let widest =
    24 + measureText(headerLabel, { kind: 'hand', size: 16, weight: 600 }) + 8 + 16 + (hasFilter ? 14 : 0) + 8 + 48 + 8

  for (const task of tasks) {
    // td: px-2
    let w = 16
    if (task.isSubtask) {
      // indent pl-1.5 | guide w-0.5 + mr-1.5 | chevron 14 + p-0.5 | gap-1 | text-sm
      w += 6 + 8 + 18 + 4 + measureText(task.name, { kind: 'sans', size: 14 })
      // delete button
      if (canEdit) w += 4 + 22
    } else {
      // chevron 16 + p-0.5 | gap-1 | font-medium
      w += 20 + 4 + measureText(task.name, { kind: 'sans', size: 16, weight: 500 })
      // add-subtask + delete buttons
      if (canEdit) w += 4 + 22 + 4 + 22
    }
    widest = Math.max(widest, w)
  }

  return Math.round(clamp(widest + SAFETY, min, max))
}

export interface ResourceNameEntry {
  name: string
  indent: boolean
}

export function autoResourceColumnWidth(opts: {
  resources: ResourceNameEntry[]
  headerLabel: string
  canEdit: boolean
  hasFilter: boolean
  min: number
  max: number
}): number {
  const { resources, headerLabel, canEdit, hasFilter, min, max } = opts

  // th: px-3 | label | gap-2 | filter (+count)
  let widest = 24 + measureText(headerLabel, { kind: 'hand', size: 16, weight: 600 }) + 8 + 16 + (hasFilter ? 14 : 0)

  for (const resource of resources) {
    // td: px-3 | pl-0 / pl-2 | color slot 16 + 4 | text-sm | gap-2 + delete button
    const w =
      24 + (resource.indent ? 28 : 20) + measureText(resource.name, { kind: 'sans', size: 14 }) + (canEdit ? 8 + 16 : 0)
    widest = Math.max(widest, w)
  }

  return Math.round(clamp(widest + SAFETY, min, max))
}

// ==================== Custom (Markdown) columns ====================

const MD_SIZE = 13 // .markdown-body font-size (0.8125rem)
const HEADING_SIZES = [20, 17.6, 16, 14.4, 13, 13]

/** Width of one inline Markdown line, honoring **bold** and `code` spans. */
function measureInline(line: string, size: number, kind: FontKind, baseWeight: number): number {
  const text = line
    // images take the cell width anyway; only keep the alt text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    // links -> link text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<(https?:\/\/[^>]+)>/g, '$1')
    // escaped characters
    .replace(/\\([\\`*_{}[\]()#+\-.!|~])/g, '$1')
    .replace(/~~/g, '')

  let width = 0
  // Split into code spans and the rest
  const parts = text.split(/(`[^`]+`)/g)
  for (const part of parts) {
    if (!part) continue
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
      // code: mono 0.85em + padding 0.35em × 2 + border
      width += measureText(part.slice(1, -1), { kind: 'mono', size: size * 0.85 }) + size * 0.7 + 2
      continue
    }
    // Bold segments (** or __) toggle the weight
    const boldParts = part.split(/(\*\*|__)/g)
    let bold = false
    for (const seg of boldParts) {
      if (seg === '**' || seg === '__') {
        bold = !bold
        continue
      }
      const plain = seg.replace(/(^|[^\w])[*_]+|[*_]+(?=[^\w]|$)/g, '$1')
      width += measureText(plain, { kind, size, weight: bold ? Math.max(700, baseWeight) : baseWeight })
    }
  }
  return width
}

/** Natural (unwrapped) width of rendered Markdown content. */
export function measureMarkdownWidth(markdown: string): number {
  let widest = 0
  let inFence = false

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.replace(/\t/g, '    ')

    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) {
      // pre: padding 0.8em × 2 + border, code mono 0.85em
      widest = Math.max(widest, measureText(line, { kind: 'mono', size: MD_SIZE * 0.85 }) + MD_SIZE * 1.6 + 2)
      continue
    }
    if (!line.trim()) continue

    let rest = line
    let extra = 0

    // Blockquotes: border 3px + padding 0.75em per level
    let bq: RegExpMatchArray | null
    while ((bq = rest.match(/^\s*>\s?/))) {
      extra += 3 + MD_SIZE * 0.75
      rest = rest.slice(bq[0].length)
    }

    const heading = rest.match(/^\s*(#{1,6})\s+(.*)$/)
    if (heading) {
      const size = HEADING_SIZES[heading[1].length - 1]
      widest = Math.max(widest, extra + measureInline(heading[2], size, 'hand', 700))
      continue
    }

    // Horizontal rule / table separator lines don't need width
    if (/^\s*([-*_]\s*){3,}$/.test(rest) || /^\s*\|?\s*:?-{2,}/.test(rest)) continue

    // List items: padding-left 1.25em per nesting level, task checkbox
    const list = rest.match(/^(\s*)([-*+]|\d+[.)])\s+/)
    if (list) {
      const level = Math.floor(list[1].length / 2) + 1
      extra += level * MD_SIZE * 1.25
      rest = rest.slice(list[0].length)
      const task = rest.match(/^\[[ xX]\]\s+/)
      if (task) {
        // checkbox sits in the bullet gutter (see globals.css); only its
        // overhang + margin-right remain
        extra += 4
        rest = rest.slice(task[0].length)
      }
    }

    // Tables: cell padding 0.5em × 2 + border per column
    if (/^\s*\|.*\|\s*$/.test(rest)) {
      const cells = rest.trim().slice(1, -1).split('|')
      const tableWidth = cells.reduce(
        (sum, cell) => sum + measureInline(cell.trim(), MD_SIZE * 0.95, 'sans', 400) + MD_SIZE * 0.95 + 1,
        1
      )
      widest = Math.max(widest, extra + tableWidth)
      continue
    }

    widest = Math.max(widest, extra + measureInline(rest.trim(), MD_SIZE, 'sans', 400))
  }

  return widest
}

export function autoCustomColumnWidth(opts: {
  values: string[]
  headerLabel: string
  canEdit: boolean
  emptyLabel: string
  min: number
  max: number
}): number {
  const { values, headerLabel, canEdit, emptyLabel, min, max } = opts

  // th: px-2 | name (font-hand text-xs) | pr-1 | delete button
  let widest = 16 + measureText(headerLabel, { kind: 'hand', size: 12, weight: 600 }) + 4 + (canEdit ? 4 + 16 : 0)

  // Placeholder of empty cells: pencil 10 + gap-1 + text-xs italic
  if (canEdit) {
    widest = Math.max(widest, 16 + 10 + 4 + measureText(emptyLabel, { kind: 'sans', size: 12, italic: true }))
  }

  for (const value of values) {
    if (!value.trim()) continue
    // td: px-2
    widest = Math.max(widest, 16 + measureMarkdownWidth(value))
    if (widest >= max) break
  }

  return Math.round(clamp(widest + SAFETY, min, max))
}
