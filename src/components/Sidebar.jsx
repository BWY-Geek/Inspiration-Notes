import { useState } from 'react'
import { cls } from '../lib/util'
import { IconInbox, IconLayers, IconFolder, IconTag, IconTrash, IconPlus, IconX } from './Icons'

export default function Sidebar({
  db, view, onView, counts, tags, onCreateGroup, onRenameGroup, onDeleteGroup, onDropNotes,
}) {
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const [dropTarget, setDropTarget] = useState(null)

  const submitNew = () => {
    const name = draft.trim()
    if (name) onCreateGroup(name)
    setDraft('')
    setCreating(false)
  }

  const submitRename = (id) => {
    const name = editDraft.trim()
    if (name) onRenameGroup(id, name)
    setEditingId(null)
  }

  /** 把灵感拖到分组上 = 归档 */
  const dropProps = (groupId) => ({
    onDragOver: (e) => {
      if (!e.dataTransfer.types.includes('application/x-note-ids')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDropTarget(groupId)
    },
    onDragLeave: () => setDropTarget((t) => (t === groupId ? null : t)),
    onDrop: (e) => {
      e.preventDefault()
      setDropTarget(null)
      try {
        const ids = JSON.parse(e.dataTransfer.getData('application/x-note-ids'))
        if (Array.isArray(ids) && ids.length) onDropNotes(ids, groupId)
      } catch { /* 拖了别的东西进来，忽略 */ }
    },
  })

  const isActive = (type, id) => view.type === type && (id === undefined || view.id === id)

  return (
    <aside className="sidebar">
      <nav className="nav-block">
        <button
          className={cls('nav-item', isActive('inbox') && 'active', dropTarget === null && dropTarget !== undefined && '')}
          onClick={() => onView({ type: 'inbox' })}
          {...dropProps(null)}
          data-drop={dropTarget === null ? 'on' : undefined}
        >
          <IconInbox />
          <span className="nav-label">收件箱</span>
          <span className="nav-count">{counts.inbox || ''}</span>
        </button>

        <button
          className={cls('nav-item', isActive('all') && 'active')}
          onClick={() => onView({ type: 'all' })}
        >
          <IconLayers />
          <span className="nav-label">全部灵感</span>
          <span className="nav-count">{counts.all || ''}</span>
        </button>
      </nav>

      <div className="nav-section">
        <span className="nav-section-title">归档分组</span>
        <button className="icon-btn tiny" title="新建分组" onClick={() => setCreating(true)}>
          <IconPlus width={14} height={14} />
        </button>
      </div>

      <nav className="nav-block scroll-y">
        {db.groups.length === 0 && !creating && (
          <p className="nav-hint">还没有分组。<br />选中几条同类的灵感，点「归档到」就能建一个。</p>
        )}

        {db.groups.map((g) => (
          <div
            key={g.id}
            className={cls('nav-item', isActive('group', g.id) && 'active')}
            data-drop={dropTarget === g.id ? 'on' : undefined}
            onClick={() => editingId !== g.id && onView({ type: 'group', id: g.id })}
            {...dropProps(g.id)}
          >
            <IconFolder style={{ color: g.color }} />
            {editingId === g.id ? (
              <input
                className="inline-input"
                autoFocus
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onBlur={() => submitRename(g.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitRename(g.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
              />
            ) : (
              <span
                className="nav-label"
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  setEditingId(g.id)
                  setEditDraft(g.name)
                }}
                title="双击重命名"
              >
                {g.name}
              </span>
            )}
            <span className="nav-count">{counts.groups[g.id] || ''}</span>
            <button
              className="icon-btn tiny nav-del"
              title="删除分组（里面的灵感退回收件箱）"
              onClick={(e) => { e.stopPropagation(); onDeleteGroup(g) }}
            >
              <IconX width={12} height={12} />
            </button>
          </div>
        ))}

        {creating && (
          <div className="nav-item">
            <IconFolder />
            <input
              className="inline-input"
              autoFocus
              placeholder="分组名称"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={submitNew}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNew()
                if (e.key === 'Escape') { setDraft(''); setCreating(false) }
              }}
            />
          </div>
        )}
      </nav>

      {tags.length > 0 && (
        <>
          <div className="nav-section"><span className="nav-section-title">标签</span></div>
          <div className="tag-cloud">
            {tags.slice(0, 40).map(([tag, n]) => (
              <button
                key={tag}
                className={cls('tag-chip', isActive('tag', tag) && 'active')}
                onClick={() => onView(isActive('tag', tag) ? { type: 'all' } : { type: 'tag', id: tag })}
              >
                <IconTag width={11} height={11} />
                {tag}
                <em>{n}</em>
              </button>
            ))}
          </div>
        </>
      )}

      <nav className="nav-block nav-footer">
        <button
          className={cls('nav-item', isActive('trash') && 'active')}
          onClick={() => onView({ type: 'trash' })}
        >
          <IconTrash />
          <span className="nav-label">回收站</span>
          <span className="nav-count">{counts.trash || ''}</span>
        </button>
      </nav>
    </aside>
  )
}
