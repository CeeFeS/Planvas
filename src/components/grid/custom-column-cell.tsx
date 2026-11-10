'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Trash2, Check, Plus, Pencil, Code2, Eye } from 'lucide-react'
import type { CustomColumn, CustomRowType } from '@/lib/types'
import { useTranslation } from '@/lib/language-context'
import { cn } from '@/lib/utils'
import { MarkdownContent } from '@/components/ui/markdown-content'
import { taskListEnter } from '@/lib/markdown-tasks'
import { sourceOffsetFromPoint, textareaCaretTop } from '@/lib/markdown-source-map'

type EditorViewMode = 'markdown' | 'rendered'

// ==================== Editable Cell ====================

export interface CustomCellEditTarget {
  column: CustomColumn
  rowType: CustomRowType
  rowId: string
  value: string
  canEdit: boolean
}

interface CustomColumnCellProps {
  column: CustomColumn
  rowType: CustomRowType
  rowId: string
  value: string
  canEdit: boolean
  width: number
  /** subtle background tint variant for task (parent) rows */
  variant?: 'task' | 'resource'
  onOpen: (target: CustomCellEditTarget) => void
  /** Save a new value straight from the preview (ticking a "- [ ]" task). */
  onChangeValue?: (columnId: string, rowType: CustomRowType, rowId: string, value: string) => void
}

export function CustomColumnCell({
  column,
  rowType,
  rowId,
  value,
  canEdit,
  width,
  variant = 'resource',
  onOpen,
  onChangeValue,
}: CustomColumnCellProps) {
  const { t } = useTranslation()
  const contentRef = useRef<HTMLDivElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)

  const checkTruncation = useCallback(() => {
    const el = contentRef.current
    if (!el || !value) {
      setIsTruncated(false)
      return
    }
    setIsTruncated(el.scrollHeight > el.clientHeight + 1)
  }, [value])

  useEffect(() => {
    checkTruncation()
    const el = contentRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => checkTruncation())
    ro.observe(el)
    return () => ro.disconnect()
  }, [checkTruncation])

  const handleOpen = () => {
    onOpen({ column, rowType, rowId, value, canEdit })
  }

  const handleTaskToggle = useCallback(
    (next: string) => onChangeValue?.(column.id, rowType, rowId, next),
    [onChangeValue, column.id, rowType, rowId]
  )

  return (
    <td
      className={cn(
        'border-r border-paper-lines align-top p-0',
        variant === 'task' ? 'bg-paper-warm/30' : ''
      )}
      style={{ width }}
    >
      <div
        className={cn(
          'px-2 py-1.5 h-full min-h-[34px]',
          (canEdit || !!value) && 'cursor-pointer hover:bg-ink-blue/5 transition-colors'
        )}
        onClick={() => (canEdit || value) && handleOpen()}
        title={
          canEdit
            ? t('customColumns', 'clickToEdit')
            : value
              ? t('customColumns', 'clickToView')
              : undefined
        }
      >
        {value ? (
          <>
            <MarkdownContent
              ref={contentRef}
              content={value}
              className="markdown-clamp"
              onContentChange={canEdit && onChangeValue ? handleTaskToggle : undefined}
              taskToggleLabel={t('customColumns', 'toggleTask')}
            />
            {isTruncated && (
              <span className="markdown-clamp-more">{t('customColumns', 'clickForMore')}</span>
            )}
          </>
        ) : (
          canEdit && (
            <span className="text-ink-faded/60 text-xs italic inline-flex items-center gap-1">
              <Pencil size={10} /> {t('customColumns', 'empty')}
            </span>
          )
        )}
      </div>
    </td>
  )
}

// ==================== Bottom Split Editor ====================

const EDITOR_HEIGHT_KEY = 'planvas-custom-editor-height'
const MIN_EDITOR_HEIGHT = 160
/** Space that always stays visible for the grid above the pane. */
const MIN_GRID_SPACE = 120
const KEYBOARD_RESIZE_STEP = 24

function defaultEditorHeight(): number {
  return Math.min(Math.round(window.innerHeight * 0.42), 420)
}

function loadEditorHeight(): number {
  if (typeof window === 'undefined') return 420
  try {
    const saved = Number(localStorage.getItem(EDITOR_HEIGHT_KEY))
    if (Number.isFinite(saved) && saved >= MIN_EDITOR_HEIGHT) return saved
  } catch {
    /* ignore */
  }
  return defaultEditorHeight()
}

interface CustomValueEditorProps {
  columnName: string
  initialValue: string
  canEdit: boolean
  onCancel: () => void
  onSave: (value: string) => void
  /** Save without closing (used when a task is ticked in the rendered view). */
  onPersist?: (value: string) => void
}

export function CustomValueEditor({
  columnName,
  initialValue,
  canEdit,
  onCancel,
  onSave,
  onPersist,
}: CustomValueEditorProps) {
  const { t } = useTranslation()
  const [text, setText] = useState(initialValue)
  // Content is shown rendered first; only empty cells open straight in the editor
  const [viewMode, setViewMode] = useState<EditorViewMode>(
    canEdit && !initialValue.trim() ? 'markdown' : 'rendered'
  )
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const paneRef = useRef<HTMLDivElement>(null)
  const renderedRef = useRef<HTMLDivElement>(null)
  // Caret position to restore when switching to the editor (double-click)
  const pendingCaretRef = useRef<number | null>(null)
  const isDirty = canEdit && text !== initialValue
  const showSaveActions = canEdit && (viewMode === 'markdown' || isDirty)

  // Adopt outside changes (other users, a box ticked in the grid) - but only
  // while there are no unsaved local edits, which must never be overwritten.
  const lastInitialRef = useRef(initialValue)
  useEffect(() => {
    const previous = lastInitialRef.current
    lastInitialRef.current = initialValue
    setText((current) => (current === previous ? initialValue : current))
  }, [initialValue])

  useEffect(() => {
    if (!canEdit || viewMode !== 'markdown') return
    const ta = textareaRef.current
    if (!ta) return
    ta.focus()
    const caret = pendingCaretRef.current
    pendingCaretRef.current = null
    if (caret == null) return
    const offset = Math.min(caret, ta.value.length)
    ta.setSelectionRange(offset, offset)
    // Scroll the caret into view (roughly a third from the top)
    const top = textareaCaretTop(ta, offset)
    ta.scrollTop = Math.max(0, top - ta.clientHeight / 3)
  }, [canEdit, viewMode])

  // Double-click in the rendered view: open the editor at that very spot
  const handleRenderedDoubleClick = (e: React.MouseEvent) => {
    if (!canEdit) return
    const root = renderedRef.current
    const offset = root ? sourceOffsetFromPoint(root, e.clientX, e.clientY, text) : null
    // Outside of any text (e.g. below the content): end of the text
    pendingCaretRef.current = offset ?? text.length
    window.getSelection()?.removeAllRanges()
    setViewMode('markdown')
  }

  // ---------- Resizable pane (drag the top edge) ----------
  const [paneHeight, setPaneHeight] = useState(loadEditorHeight)
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartRef = useRef<{ y: number; height: number } | null>(null)

  const maxPaneHeight = () => {
    const available = paneRef.current?.parentElement?.getBoundingClientRect().height ?? window.innerHeight
    return Math.max(MIN_EDITOR_HEIGHT, available - MIN_GRID_SPACE)
  }
  const clampHeight = (h: number) => Math.round(Math.min(maxPaneHeight(), Math.max(MIN_EDITOR_HEIGHT, h)))

  const persistHeight = (h: number | null) => {
    try {
      if (h == null) localStorage.removeItem(EDITOR_HEIGHT_KEY)
      else localStorage.setItem(EDITOR_HEIGHT_KEY, String(h))
    } catch {
      /* ignore */
    }
  }

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    resizeStartRef.current = { y: e.clientY, height: paneRef.current?.offsetHeight ?? paneHeight }
    setIsResizing(true)
  }

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = resizeStartRef.current
    if (!start) return
    // Dragging up makes the pane taller
    setPaneHeight(clampHeight(start.height + (start.y - e.clientY)))
  }

  const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeStartRef.current) return
    resizeStartRef.current = null
    setIsResizing(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    persistHeight(paneRef.current?.offsetHeight ?? paneHeight)
  }

  const handleResizeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowUp' ? KEYBOARD_RESIZE_STEP : e.key === 'ArrowDown' ? -KEYBOARD_RESIZE_STEP : 0
    if (!step) return
    e.preventDefault()
    const next = clampHeight(paneHeight + step)
    setPaneHeight(next)
    persistHeight(next)
  }

  const resetPaneHeight = () => {
    setPaneHeight(clampHeight(defaultEditorHeight()))
    persistHeight(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (canEdit && (e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      onSave(text)
    }
  }

  const displayValue = canEdit ? text : initialValue

  // Ticking a task in the rendered view: saved right away, unless there are
  // other unsaved edits - then it simply becomes part of them.
  const handleTaskToggle = (next: string) => {
    const wasDirty = text !== initialValue
    setText(next)
    if (!wasDirty && onPersist) onPersist(next)
  }

  // Enter in a task line continues the task list; Enter in an empty task
  // removes the marker again (see taskListEnter).
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.nativeEvent.isComposing
    ) {
      const ta = e.currentTarget
      const edit = taskListEnter(ta.value, ta.selectionStart, ta.selectionEnd)
      if (edit) {
        e.preventDefault()
        applyTextEdit(ta, edit, setText)
      }
    }
    // Escape / Ctrl+Enter bubble up to the editor container's handler
  }

  return (
    <div
      ref={paneRef}
      className="relative flex-none border-t border-paper-lines bg-surface flex flex-col shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
      // max-height keeps the grid visible when the window gets smaller
      style={{ height: paneHeight, maxHeight: `calc(100% - ${MIN_GRID_SPACE}px)`, minHeight: MIN_EDITOR_HEIGHT }}
      onKeyDown={handleKeyDown}
    >
      {/* Resize handle on the top edge: drag up/down, double-click resets */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={t('customColumns', 'resizePane')}
        aria-valuemin={MIN_EDITOR_HEIGHT}
        aria-valuenow={paneHeight}
        tabIndex={0}
        title={t('customColumns', 'resizePane')}
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        onPointerCancel={handleResizePointerUp}
        onDoubleClick={resetPaneHeight}
        onKeyDown={handleResizeKeyDown}
        className={cn(
          'group/pane-resize absolute inset-x-0 top-0 h-2.5 z-20 cursor-row-resize touch-none flex items-center justify-center outline-none',
          'focus-visible:bg-ink-blue/10'
        )}
      >
        <span
          className={cn(
            'h-1 w-10 rounded-full transition-colors',
            isResizing ? 'bg-ink-blue/70' : 'bg-paper-lines group-hover/pane-resize:bg-ink-blue/50'
          )}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-paper-lines bg-paper-warm/50 flex-none gap-3">
        <div className="min-w-0">
          <h2 className="font-hand text-lg text-ink truncate">{columnName}</h2>
          <p className="text-xs text-ink-faded">
            {!canEdit
              ? t('customColumns', 'viewOnlyHint')
              : viewMode === 'markdown'
                ? t('customColumns', 'markdownHint')
                : t('customColumns', 'renderedHint')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {showSaveActions ? (
            <>
              <button onClick={onCancel} className="btn-notebook text-sm">
                {t('common', 'cancel')}
              </button>
              <button onClick={() => onSave(text)} className="btn-notebook btn-notebook-primary text-sm">
                <Check size={16} />
                {t('common', 'save')}
              </button>
            </>
          ) : canEdit ? (
            <button
              onClick={() => setViewMode('markdown')}
              className="btn-notebook btn-notebook-primary text-sm"
            >
              <Pencil size={14} />
              {t('customColumns', 'modeEdit')}
            </button>
          ) : (
            <button onClick={onCancel} className="btn-notebook text-sm">
              {t('common', 'close')}
            </button>
          )}
          <button onClick={onCancel} className="btn-icon hover:bg-red-50 hover:text-red-500" aria-label={t('common', 'close')}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* View mode toggle */}
      <div className="flex items-center gap-1 px-4 border-b border-paper-lines flex-none">
        <button
          type="button"
          onClick={() => setViewMode('rendered')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors',
            viewMode === 'rendered'
              ? 'border-ink-blue text-ink font-medium'
              : 'border-transparent text-ink-faded hover:text-ink'
          )}
        >
          <Eye size={14} />
          {t('customColumns', 'modeView')}
        </button>
        <button
          type="button"
          onClick={() => setViewMode('markdown')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors',
            viewMode === 'markdown'
              ? 'border-ink-blue text-ink font-medium'
              : 'border-transparent text-ink-faded hover:text-ink'
          )}
        >
          <Code2 size={14} />
          {canEdit ? t('customColumns', 'modeEdit') : t('customColumns', 'modeSource')}
        </button>
      </div>

      {/* Single pane: Markdown source or rendered view */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {viewMode === 'markdown' ? (
          canEdit ? (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder={t('customColumns', 'placeholder')}
              className="flex-1 w-full min-h-0 resize-none bg-transparent px-4 py-3 text-sm font-mono text-ink outline-none leading-relaxed"
              spellCheck={false}
            />
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
              {displayValue.trim() ? (
                <pre className="text-sm font-mono text-ink whitespace-pre-wrap break-words leading-relaxed">
                  {displayValue}
                </pre>
              ) : (
                <span className="text-ink-faded text-sm italic">{t('customColumns', 'emptyContent')}</span>
              )}
            </div>
          )
        ) : (
          <div
            ref={renderedRef}
            className="flex-1 min-h-0 overflow-y-auto px-4 py-3"
            onDoubleClick={canEdit ? handleRenderedDoubleClick : undefined}
          >
            {displayValue.trim() ? (
              <MarkdownContent
                content={displayValue}
                onContentChange={canEdit ? handleTaskToggle : undefined}
                taskToggleLabel={t('customColumns', 'toggleTask')}
                sourcePositions={canEdit}
              />
            ) : (
              <span className="text-ink-faded text-sm italic">{t('customColumns', 'emptyContent')}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Apply an edit to the textarea. `execCommand('insertText')` keeps the
 * browser's undo history intact (Ctrl+Z works as expected) and fires the
 * regular input event, so React's onChange picks it up. Falls back to a plain
 * state update where the command is unavailable.
 */
function applyTextEdit(
  ta: HTMLTextAreaElement,
  edit: { start: number; end: number; text: string; caret: number },
  setText: (value: string) => void
) {
  ta.focus()
  ta.setSelectionRange(edit.start, edit.end)
  let applied = false
  try {
    applied =
      edit.text === ''
        ? edit.start === edit.end || document.execCommand('delete')
        : document.execCommand('insertText', false, edit.text)
  } catch {
    applied = false
  }
  if (applied) {
    ta.setSelectionRange(edit.caret, edit.caret)
    return
  }
  setText(ta.value.slice(0, edit.start) + edit.text + ta.value.slice(edit.end))
  requestAnimationFrame(() => ta.setSelectionRange(edit.caret, edit.caret))
}

// ==================== Header Cell ====================

interface CustomColumnHeaderCellProps {
  column: CustomColumn
  canEdit: boolean
  width: number
  onRename: (name: string) => void
  onDelete: () => void
  /** Optional resize handle rendered at the right edge (drag to change width). */
  resizer?: React.ReactNode
}

export function CustomColumnHeaderCell({ column, canEdit, width, onRename, onDelete, resizer }: CustomColumnHeaderCellProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(column.name)

  useEffect(() => {
    setName(column.name)
  }, [column.name])

  const handleSave = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== column.name) {
      onRename(trimmed)
    } else {
      setName(column.name)
    }
    setEditing(false)
  }

  return (
    <th
      className="bg-paper-cream z-10 border-r border-paper-lines text-left px-2 py-2 align-middle group/col relative"
      style={{ width }}
    >
      <div className="flex items-center gap-1 min-w-0 pr-1">
        {editing && canEdit ? (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') { setName(column.name); setEditing(false) }
            }}
            className="input-inline-edit font-hand text-xs text-ink-light text-left min-w-0 flex-1"
            autoFocus
          />
        ) : (
          <button
            onClick={() => canEdit && setEditing(true)}
            className={cn(
              'font-hand text-xs text-ink-light truncate min-w-0 flex-1 text-left',
              canEdit && 'editable-text'
            )}
            title={canEdit ? t('customColumns', 'renameColumn') : column.name}
            disabled={!canEdit}
          >
            {column.name}
          </button>
        )}

        {canEdit && (
          <button
            onClick={() => {
              if (confirm(t('customColumns', 'deleteConfirm').replace('{name}', column.name))) {
                onDelete()
              }
            }}
            className="p-0.5 rounded opacity-0 group-hover/col:opacity-100 hover:bg-red-100 hover:text-red-600 transition-all flex-shrink-0"
            title={t('customColumns', 'deleteColumn')}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
      {resizer}
    </th>
  )
}

// ==================== Add Column Button (header) ====================

interface AddColumnHeaderProps {
  width: number
  onAdd: () => void
}

export function AddColumnHeader({ width, onAdd }: AddColumnHeaderProps) {
  const { t } = useTranslation()
  return (
    <th
      className="bg-paper-cream z-10 border-l border-paper-lines text-center align-middle p-0"
      style={{ width }}
    >
      <button
        onClick={onAdd}
        className="w-full h-full flex items-center justify-center py-2 text-ink-faded hover:text-ink-blue hover:bg-paper-warm transition-colors"
        title={t('customColumns', 'addColumn')}
      >
        <Plus size={16} />
      </button>
    </th>
  )
}
