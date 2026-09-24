import { useEffect, useRef, useState } from 'react'
import { cls, relTime, splitTags, fmtDateTime } from '../lib/util'
import { IconPin, IconArchive, IconCopy, IconTrash, IconCheck, IconRestore, IconX } from './Icons'

export default function NoteCard({
  note, group, selected, selectionMode, inTrash,
  onToggleSelect, onSave, onPin, onArchive, onCopy, onTrash, onRestore, onPurge, onTagClick, onDragStart,
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.text)
  const ref = useRef(null)

  useEffect(() => {
    if (!editing) setDraft(note.text)
  }, [note.text, editing])

  useEffect(() => {
    if (!editing || !ref.current) return
    const el = ref.current
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [editing])

  const commit = () => {
    setEditing(false)
    const next = draft.trim()
    if (next && next !== note.text) onSave(note.id, next)
  }

  return (
    <article
      className={cls('note', selected && 'selected', note.pinned && 'pinned', editing && 'editing')}
      style={group ? { '--accent': group.color } : undefined}
      draggable={!editing && !inTrash}
      onDragStart={(e) => onDragStart(e, note)}
      onClick={(e) => {
        // 选择模式下整卡可点选，方便一口气挑一批归档
        if (!selectionMode || editing) return
        if (e.target.closest('button, textarea, a')) return
        onToggleSelect(note.id, e)
      }}
    >
      <button
        className={cls('check', selected && 'on')}
        title={selected ? '取消选择' : '选中（可批量归档）'}
        onClick={(e) => { e.stopPropagation(); onToggleSelect(note.id, e) }}
      >
        {selected && <IconCheck width={12} height={12} />}
      </button>

      <div className="note-body">
        {editing ? (
          <textarea
            ref={ref}
            className="note-edit"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setDraft(note.text); setEditing(false) }
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commit()
            }}
          />
        ) : (
          <div
            className="note-text"
            onDoubleClick={() => !inTrash && setEditing(true)}
            title={inTrash ? '' : '双击编辑'}
          >
            {splitTags(note.text).map((p, i) =>
              p.type === 'tag' ? (
                <button
                  key={i}
                  className="inline-tag"
                  onClick={(e) => { e.stopPropagation(); onTagClick(p.value) }}
                >
                  #{p.value}
                </button>
              ) : (
                <span key={i}>{p.value}</span>
              ),
            )}
          </div>
        )}

        <footer className="note-foot">
          {group && (
            <span className="group-chip" style={{ '--accent': group.color }}>
              {group.name}
            </span>
          )}
          <time title={fmtDateTime(note.createdAt)}>{relTime(note.createdAt)}</time>

          <div className="note-actions">
            {inTrash ? (
              <>
                <button className="icon-btn tiny" title="还原" onClick={() => onRestore(note.id)}>
                  <IconRestore width={14} height={14} />
                </button>
                <button className="icon-btn tiny danger" title="彻底删除" onClick={() => onPurge(note.id)}>
                  <IconX width={14} height={14} />
                </button>
              </>
            ) : (
              <>
                <button
                  className={cls('icon-btn tiny', note.pinned && 'on')}
                  title={note.pinned ? '取消置顶' : '置顶'}
                  onClick={() => onPin(note)}
                >
                  <IconPin width={14} height={14} />
                </button>
                <button
                  className="icon-btn tiny"
                  title="归档到分组"
                  onClick={(e) => onArchive(e, [note.id])}
                >
                  <IconArchive width={14} height={14} />
                </button>
                <button className="icon-btn tiny" title="复制内容" onClick={() => onCopy(note.text)}>
                  <IconCopy width={14} height={14} />
                </button>
                <button className="icon-btn tiny danger" title="移到回收站" onClick={() => onTrash(note.id)}>
                  <IconTrash width={14} height={14} />
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
    </article>
  )
}
