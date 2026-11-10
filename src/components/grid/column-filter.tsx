'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ListFilter, Check, Minus, Search, X } from 'lucide-react'
import { useTranslation } from '@/lib/language-context'
import { cn } from '@/lib/utils'

/**
 * Selection of a column filter (Excel semantics):
 * - `null`  -> no filter, every value is shown (all boxes checked)
 * - `Set`   -> only these values are shown; an empty set shows nothing
 */
export type ColumnFilterSelection = Set<string> | null

/** True if `value` passes the filter. */
export function matchesColumnFilter(selection: ColumnFilterSelection, value: string): boolean {
  return selection === null || selection.has(value)
}

interface ColumnFilterProps {
  /** Human readable column title (used for the tooltip/heading). */
  title: string
  /** Distinct values available for this column. */
  values: string[]
  /** Current selection (`null` = no filter, show all). */
  selected: ColumnFilterSelection
  onChange: (next: ColumnFilterSelection) => void
  /** Horizontal anchor of the dropdown relative to the trigger. */
  align?: 'left' | 'right'
}

const MENU_WIDTH = 260

/**
 * Compact, subtle per-column filter: a small funnel button that opens a
 * searchable checkbox dropdown. The dropdown is rendered in a portal
 * (position: fixed) so it is never clipped by the grid's scroll container.
 */
export function ColumnFilter({ title, values, selected, onChange, align = 'left' }: ColumnFilterProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const hasFilter = selected !== null
  // Only count values that still exist (a renamed task leaves a stale entry)
  const selectedCount = useMemo(
    () => (selected === null ? values.length : values.filter((v) => selected.has(v)).length),
    [selected, values]
  )

  const visibleValues = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    if (!q) return values
    return values.filter((v) => v.toLocaleLowerCase().includes(q))
  }, [values, query])

  const computePos = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    let left = align === 'right' ? r.right - MENU_WIDTH : r.left
    left = Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8))
    setPos({ top: r.bottom + 4, left })
  }, [align])

  const toggleOpen = () => {
    if (!open) {
      computePos()
      setQuery('')
    }
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (open) requestAnimationFrame(() => searchRef.current?.focus())
  }, [open])

  // Close on outside click, Escape, or any scroll outside the menu (the fixed
  // menu would otherwise detach from its trigger)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || btnRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onResize = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  /** Collapse "everything selected" back to "no filter". */
  const emit = (next: Set<string>) => {
    const coversAll = values.every((v) => next.has(v))
    onChange(coversAll ? null : next)
  }

  const currentSet = () => new Set(selected === null ? values : selected)

  const toggleValue = (value: string) => {
    const next = currentSet()
    if (next.has(value)) next.delete(value)
    else next.add(value)
    emit(next)
  }

  // Bulk actions apply to the values matching the search only
  const selectAllVisible = () => {
    const next = currentSet()
    for (const v of visibleValues) next.add(v)
    emit(next)
  }

  const deselectAllVisible = () => {
    const next = currentSet()
    for (const v of visibleValues) next.delete(v)
    emit(next)
  }

  const visibleCheckedCount = visibleValues.filter((v) => matchesColumnFilter(selected, v)).length
  const allVisibleChecked = visibleValues.length > 0 && visibleCheckedCount === visibleValues.length
  const noneVisibleChecked = visibleCheckedCount === 0

  const clear = () => onChange(null)

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggleOpen}
        className={cn(
          'inline-flex items-center justify-center rounded p-0.5 transition-colors flex-shrink-0',
          hasFilter
            ? 'text-ink-blue bg-ink-blue/10'
            : 'text-ink-faded hover:text-ink hover:bg-paper-warm'
        )}
        title={`${title} – ${t('grid', 'filterColumn')}`}
        aria-label={`${title} – ${t('grid', 'filterColumn')}`}
        aria-expanded={open}
      >
        <ListFilter size={12} />
        {hasFilter && <span className="ml-0.5 text-[9px] font-mono leading-none">{selectedCount}</span>}
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="fixed bg-surface rounded-lg shadow-lg border border-paper-lines z-[200] py-1 animate-in fade-in slide-in-from-top-2 duration-200"
          style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
        >
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-paper-lines">
            <span className="text-[11px] uppercase tracking-wide text-ink-faded truncate">{title}</span>
            {hasFilter && (
              <button onClick={clear} className="text-[11px] text-ink-blue hover:underline flex-shrink-0 ml-2">
                {t('grid', 'clearFilter')}
              </button>
            )}
          </div>

          {values.length === 0 ? (
            <div className="px-3 py-3 text-xs text-ink-faded italic">{t('grid', 'noFilterValues')}</div>
          ) : (
            <>
              {/* Search */}
              <div className="px-2 pt-2 pb-1">
                <div className="flex items-center gap-1.5 rounded border border-paper-lines bg-paper-cream/40 px-2 py-1 focus-within:border-ink-blue/60">
                  <Search size={12} className="text-ink-faded flex-shrink-0" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      // Escape clears the search first, a second Escape closes
                      if (e.key === 'Escape' && query) {
                        e.preventDefault()
                        e.stopPropagation()
                        e.nativeEvent.stopImmediatePropagation()
                        setQuery('')
                      }
                    }}
                    placeholder={t('grid', 'filterSearch')}
                    aria-label={t('grid', 'filterSearch')}
                    className="flex-1 min-w-0 bg-transparent text-xs text-ink outline-none placeholder:text-ink-faded/70"
                  />
                  {query && (
                    <button
                      onClick={() => {
                        setQuery('')
                        searchRef.current?.focus()
                      }}
                      className="text-ink-faded hover:text-ink flex-shrink-0"
                      aria-label={t('common', 'close')}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Select all / deselect all (scoped to the search results) */}
              <div className="flex items-center gap-1 px-2 pb-1 border-b border-paper-lines">
                <button
                  onClick={selectAllVisible}
                  disabled={allVisibleChecked}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded px-2 py-1 text-[11px] text-ink-light hover:bg-paper-warm hover:text-ink transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-default"
                >
                  <Check size={11} />
                  {t('grid', 'filterSelectAll')}
                </button>
                <button
                  onClick={deselectAllVisible}
                  disabled={noneVisibleChecked}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded px-2 py-1 text-[11px] text-ink-light hover:bg-paper-warm hover:text-ink transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-default"
                >
                  <Minus size={11} />
                  {t('grid', 'filterDeselectAll')}
                </button>
              </div>

              {visibleValues.length === 0 ? (
                <div className="px-3 py-3 text-xs text-ink-faded italic">{t('grid', 'filterNoMatches')}</div>
              ) : (
                <ul className="py-0.5 max-h-64 overflow-y-auto">
                  {visibleValues.map((value) => {
                    const active = matchesColumnFilter(selected, value)
                    return (
                      <li key={value}>
                        <button
                          onClick={() => toggleValue(value)}
                          role="menuitemcheckbox"
                          aria-checked={active}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-ink hover:bg-paper-warm transition-colors text-left"
                          title={value}
                        >
                          <span
                            className={cn(
                              'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                              active ? 'bg-ink-blue border-ink-blue text-white' : 'border-paper-lines'
                            )}
                          >
                            {active && <Check size={11} />}
                          </span>
                          <span className="truncate font-mono text-xs">{value}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
