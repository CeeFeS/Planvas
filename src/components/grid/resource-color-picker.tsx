'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Paintbrush } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useProjectStore, countAllocationsForResourceName } from '@/store/project-store'
import { useTranslation } from '@/lib/language-context'
import { normalizeHexColor } from '@/lib/use-brush-preferences'
import { COLOR_PALETTE } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ColorSwatch } from './brush-editor'

interface ResourceColorPickerProps {
  /** Current resource color; empty/undefined = follows the brush. */
  color?: string
  resourceName: string
  canEdit: boolean
  onChange: (color: string | null, recolorExisting: boolean) => void
}

const MENU_WIDTH = 232
const VIEWPORT_MARGIN = 8

/**
 * Color dot in front of a resource name. Opens a small palette in a portal
 * (position: fixed), so the grid's sticky/overflow cells never clip it.
 */
export function ResourceColorPicker({
  color,
  resourceName,
  canEdit,
  onChange,
}: ResourceColorPickerProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [draft, setDraft] = useState('')
  const [recolorExisting, setRecolorExisting] = useState(false)
  // Read once on open: the scope is every resource sharing this name
  const [scope, setScope] = useState({ resources: 1, allocations: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const currentColor = normalizeHexColor(color) ?? null
  const label = currentColor
    ? `${t('grid', 'resourceColor')}: ${currentColor}`
    : t('grid', 'setResourceColor')

  const customColors = useMemo(() => {
    const raw = user?.preferences?.customColors
    if (!Array.isArray(raw)) return []
    const palette = COLOR_PALETTE as readonly string[]
    const colors = raw.map(normalizeHexColor).filter((c): c is string => !!c && !palette.includes(c))
    return [...new Set(colors)]
  }, [user?.preferences?.customColors])

  // A color set elsewhere (another account, a removed custom color) stays selectable
  const isForeignColor =
    !!currentColor &&
    !(COLOR_PALETTE as readonly string[]).includes(currentColor) &&
    !customColors.includes(currentColor)

  const anchorBelow = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const left = Math.max(VIEWPORT_MARGIN, Math.min(r.left - 6, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN))
    setPos({ top: r.bottom + 4, left })
  }, [])

  const toggleOpen = () => {
    if (!open) {
      anchorBelow()
      setDraft(currentColor ?? '#E6B000')
      setRecolorExisting(false)
      const state = useProjectStore.getState()
      setScope({
        resources: state.resources.filter((r) => r.name === resourceName).length,
        allocations: countAllocationsForResourceName(state, resourceName),
      })
    }
    setOpen((v) => !v)
  }

  // Flip above the trigger when the menu would run off the bottom edge
  useLayoutEffect(() => {
    if (!open || !pos) return
    const menu = menuRef.current
    const r = btnRef.current?.getBoundingClientRect()
    if (!menu || !r) return
    const height = menu.offsetHeight
    if (pos.top + height > window.innerHeight - VIEWPORT_MARGIN && r.top - height - 4 >= VIEWPORT_MARGIN) {
      setPos({ top: r.top - height - 4, left: pos.left })
    }
  }, [open, pos])

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

  // Always forwarded: same-named resources may still differ (older data)
  const select = (next: string | null) => {
    setOpen(false)
    onChange(next, recolorExisting)
  }

  const normalizedDraft = normalizeHexColor(draft)

  if (!canEdit) {
    return currentColor ? (
      <span className="resource-color-trigger" title={label} aria-label={label}>
        <span className="resource-color-dot" style={{ backgroundColor: currentColor }} />
      </span>
    ) : (
      <span className="resource-color-trigger" aria-hidden />
    )
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        className={cn(
          'resource-color-trigger resource-color-trigger-editable',
          !currentColor && !open && 'resource-color-trigger-unset'
        )}
        title={label}
        aria-label={`${label} – ${resourceName}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {currentColor ? (
          <span className="resource-color-dot" style={{ backgroundColor: currentColor }} />
        ) : (
          <span className="resource-color-dot resource-color-dot-empty" />
        )}
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="dialog"
          aria-label={`${t('grid', 'resourceColor')} – ${resourceName}`}
          className="fixed bg-surface rounded-lg shadow-lg border border-paper-lines z-[200] animate-in fade-in slide-in-from-top-2 duration-200"
          style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-paper-lines">
            <span className="text-[11px] uppercase tracking-wide text-ink-faded flex-shrink-0">
              {t('grid', 'resourceColor')}
            </span>
            <span className="text-xs text-ink-light truncate" title={resourceName}>{resourceName}</span>
          </div>

          <div className="p-3 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PALETTE.map((c) => (
                <ColorSwatch key={c} color={c} isActive={currentColor === c} onSelect={() => select(c)} />
              ))}
              {customColors.map((c) => (
                <ColorSwatch key={c} color={c} isActive={currentColor === c} onSelect={() => select(c)} />
              ))}
              {isForeignColor && (
                <ColorSwatch color={currentColor} isActive onSelect={() => select(currentColor)} />
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="color"
                value={normalizedDraft ?? '#000000'}
                onChange={(e) => setDraft(e.target.value.toUpperCase())}
                className="w-7 h-7 p-0 border border-paper-lines rounded cursor-pointer bg-transparent flex-shrink-0"
                aria-label={t('brush', 'pickColor')}
              />
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && normalizedDraft) select(normalizedDraft)
                }}
                className="input-notebook flex-1 min-w-0 font-mono text-xs uppercase"
                placeholder="#RRGGBB"
                maxLength={7}
                aria-label={t('brush', 'pickColor')}
              />
              <button
                type="button"
                onClick={() => normalizedDraft && select(normalizedDraft)}
                disabled={!normalizedDraft}
                className={cn(
                  'p-1.5 rounded text-xs flex-shrink-0',
                  'bg-ink-blue text-white hover:bg-ink-blue/90',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                title={t('grid', 'resourceColorApply')}
                aria-label={t('grid', 'resourceColorApply')}
              >
                <Check size={12} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => select(null)}
              className={cn(
                'flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs transition-colors',
                currentColor
                  ? 'text-ink-light hover:bg-paper-warm hover:text-ink'
                  : 'bg-paper-warm text-ink'
              )}
              aria-pressed={!currentColor}
            >
              <Paintbrush size={12} className="flex-shrink-0" />
              <span className="flex-1 text-left">{t('grid', 'resourceColorNone')}</span>
              {!currentColor && <Check size={12} className="flex-shrink-0" />}
            </button>

            {scope.allocations > 0 && (
              <label className="flex items-center gap-2 text-xs text-ink-light cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={recolorExisting}
                  onChange={(e) => setRecolorExisting(e.target.checked)}
                  className="accent-ink-blue"
                />
                {t('grid', 'resourceColorRecolor').replace('{count}', String(scope.allocations))}
              </label>
            )}
          </div>

          <p className="px-3 py-2 border-t border-paper-lines text-[11px] text-ink-faded leading-relaxed">
            {t('grid', 'resourceColorHint')}
            {scope.resources > 1 && (
              <>
                <br />
                {t('grid', 'resourceColorShared')
                  .replace('{count}', String(scope.resources))
                  .replace('{name}', resourceName)}
              </>
            )}
          </p>
        </div>,
        document.body
      )}
    </>
  )
}
