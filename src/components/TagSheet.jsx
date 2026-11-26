import { useState } from 'react'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default function TagSheet({ allTags, selected, onConfirm, onClose }) {
  const [local, setLocal] = useState(() => new Set(selected))

  const dateTags  = allTags.filter(t =>  DATE_RE.test(t)).sort().reverse()
  const otherTags = allTags.filter(t => !DATE_RE.test(t)).sort()

  function toggle(tag) {
    setLocal(prev => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-t-2xl border-t border-border flex flex-col max-h-[85dvh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border flex-shrink-0">
          <h2 className="font-semibold text-base">Filter by Tags</h2>
          <div className="flex items-center gap-4">
            {local.size > 0 && (
              <button
                onClick={() => setLocal(new Set())}
                className="text-xs text-muted underline underline-offset-2"
              >
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              className="text-muted text-2xl leading-none w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>
        </div>

        {/* Tag groups */}
        <div className="overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {dateTags.length > 0 && (
            <TagGroup label="Dates" tags={dateTags} selected={local} onToggle={toggle} />
          )}
          {otherTags.length > 0 && (
            <TagGroup label="Tags" tags={otherTags} selected={local} onToggle={toggle} />
          )}
        </div>

        {/* Confirm */}
        <div className="px-6 py-4 border-t border-border flex-shrink-0">
          <button
            onClick={() => onConfirm([...local])}
            className="w-full py-3.5 bg-accent rounded-xl font-semibold text-white"
          >
            {local.size > 0 ? `Show ${local.size} tag${local.size > 1 ? 's' : ''}` : 'Show all tags'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TagGroup({ label, tags, selected, onToggle }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted uppercase tracking-wide">{label}</span>
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <button
            key={tag}
            onClick={() => onToggle(tag)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              selected.has(tag)
                ? 'bg-accent border-accent text-white'
                : 'bg-bg border-border text-muted'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  )
}
