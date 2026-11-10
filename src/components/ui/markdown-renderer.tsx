'use client'

import { createContext, useContext, useMemo, type ComponentPropsWithoutRef } from 'react'
import ReactMarkdown, { type Components, type ExtraProps } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { toggleTaskAtOffset } from '@/lib/markdown-tasks'

interface MarkdownRendererProps {
  content: string
  /**
   * When set, task list checkboxes ("- [ ]") are clickable and report the
   * updated Markdown source. Without it they stay read-only.
   */
  onContentChange?: (next: string) => void
  /** Accessible label for the clickable checkboxes. */
  taskToggleLabel?: string
  /**
   * Tag elements with their source range (`data-src-start`/`data-src-end`),
   * used to place the editor caret where the rendered text was double-clicked.
   */
  sourcePositions?: boolean
}

interface HastLikeNode {
  type: string
  position?: { start: { offset?: number }; end: { offset?: number } }
  properties?: Record<string, unknown>
  children?: HastLikeNode[]
}

/** Rehype plugin: copy each element's source offsets into data attributes. */
function rehypeSourcePositions() {
  return (tree: HastLikeNode) => {
    const walk = (node: HastLikeNode) => {
      if (node.type === 'element' && node.position) {
        const { start, end } = node.position
        if (start.offset != null && end.offset != null) {
          node.properties = { ...node.properties, dataSrcStart: start.offset, dataSrcEnd: end.offset }
        }
      }
      node.children?.forEach(walk)
    }
    walk(tree)
  }
}

const REMARK_PLUGINS = [remarkGfm, remarkBreaks]
const REHYPE_SOURCE_PLUGINS = [rehypeSourcePositions]

interface TaskToggleState {
  toggle: (offset: number) => void
  label?: string
}

const TaskToggleContext = createContext<TaskToggleState | null>(null)
/** Source offset of the enclosing task list item. */
const TaskItemOffsetContext = createContext<number | null>(null)

function TaskListItem({ node, children, ...props }: ComponentPropsWithoutRef<'li'> & ExtraProps) {
  const offset = node?.position?.start.offset
  const isTask = String(props.className ?? '').includes('task-list-item')
  const li = <li {...props}>{children}</li>
  if (!isTask || offset == null) return li
  return <TaskItemOffsetContext.Provider value={offset}>{li}</TaskItemOffsetContext.Provider>
}

function TaskCheckbox({ node, ...props }: ComponentPropsWithoutRef<'input'> & ExtraProps) {
  const toggleState = useContext(TaskToggleContext)
  const offset = useContext(TaskItemOffsetContext)
  if (props.type !== 'checkbox' || !toggleState || offset == null) return <input {...props} />

  return (
    <input
      type="checkbox"
      checked={!!props.checked}
      onChange={() => toggleState.toggle(offset)}
      // Cells open the editor on click - ticking a box must not
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      aria-label={toggleState.label}
      className="markdown-task-toggle"
    />
  )
}

const components: Components = {
  // Open links in a new tab
  a: ({ node, ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer" />
  ),
  li: TaskListItem,
  input: TaskCheckbox,
}

/**
 * The actual react-markdown pipeline. Kept in its own module so it can be
 * loaded on demand - remark + its plugins are by far the heaviest dependency in
 * the app, and most projects never open a markdown cell.
 */
export function MarkdownRenderer({
  content,
  onContentChange,
  taskToggleLabel,
  sourcePositions = false,
}: MarkdownRendererProps) {
  const toggleState = useMemo<TaskToggleState | null>(() => {
    if (!onContentChange) return null
    return {
      label: taskToggleLabel,
      toggle: (offset) => {
        const next = toggleTaskAtOffset(content, offset)
        if (next !== null) onContentChange(next)
      },
    }
  }, [content, onContentChange, taskToggleLabel])

  return (
    <TaskToggleContext.Provider value={toggleState}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={sourcePositions ? REHYPE_SOURCE_PLUGINS : undefined}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </TaskToggleContext.Provider>
  )
}
