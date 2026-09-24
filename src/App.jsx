import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import NoteCard from './components/NoteCard'
import Composer from './components/Composer'
import GroupMenu from './components/GroupMenu'
import SettingsModal from './components/SettingsModal'
import { cls, countTags } from './lib/util'
import { IconArchive, IconInbox, IconTrash, IconX, IconCheck, IconSpark } from './components/Icons'

const EMPTY_DB = { notes: [], groups: [], settings: {} }

export default function App() {
  const [db, setDb] = useState(EMPTY_DB)
  const [view, setView] = useState({ type: 'inbox' })
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(() => new Set())
  const [menu, setMenu] = useState(null)      // 归档浮层 {x,y,ids,currentGroupId}
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const lastClicked = useRef(null)

  const refresh = useCallback(async () => setDb(await window.api.db.getAll()), [])

  useEffect(() => {
    refresh()
    return window.api.db.onChanged(refresh)
  }, [refresh])

  // 设置里的毛玻璃参数直接喂给 CSS 变量
  useEffect(() => {
    const s = db.settings || {}
    const nativeBlur = !!db.runtime?.blurMode && db.runtime.blurMode !== 'none'
    const root = document.documentElement

    // 没有系统模糊时（Win10 就是这样），滑杆就是字面意义的「背景不透明度」：
    // 拉满就是纯色背景，等于把毛玻璃关掉。
    // Win11 有系统 acrylic 在窗口背后帮着模糊+压暗，页面只补一层很淡的膜。
    const o = s.glassOpacity ?? 0.72
    const alpha = nativeBlur ? 0.1 + o * 0.16 : o

    root.style.setProperty('--glass-a', alpha)
    root.classList.toggle('native-blur', nativeBlur)
  }, [db.settings, db.runtime])

  const flash = (msg) => {
    setToast(msg)
    clearTimeout(flash._t)
    flash._t = setTimeout(() => setToast(null), 1800)
  }

  // ---------------------------------------------------------------- 列表

  const groupsById = useMemo(
    () => Object.fromEntries(db.groups.map((g) => [g.id, g])),
    [db.groups],
  )

  const counts = useMemo(() => {
    const c = { inbox: 0, all: 0, trash: 0, groups: {} }
    for (const n of db.notes) {
      if (n.deletedAt) { c.trash++; continue }
      c.all++
      if (n.groupId && groupsById[n.groupId]) c.groups[n.groupId] = (c.groups[n.groupId] || 0) + 1
      else c.inbox++
    }
    return c
  }, [db.notes, groupsById])

  const tags = useMemo(() => countTags(db.notes), [db.notes])

  const visible = useMemo(() => {
    const inTrash = view.type === 'trash'
    let list = db.notes.filter((n) => (inTrash ? n.deletedAt : !n.deletedAt))

    if (view.type === 'inbox') list = list.filter((n) => !n.groupId || !groupsById[n.groupId])
    if (view.type === 'group') list = list.filter((n) => n.groupId === view.id)
    if (view.type === 'tag') list = list.filter((n) => (n.tags || []).includes(view.id))

    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (n) => n.text.toLowerCase().includes(q) || (n.tags || []).some((t) => t.toLowerCase().includes(q)),
      )
    }

    return [...list].sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt,
    )
  }, [db.notes, groupsById, view, query])

  // 视图一变，之前的选择就没意义了
  useEffect(() => { setSel(new Set()) }, [view.type, view.id])

  // ---------------------------------------------------------------- 操作

  const addNote = async (text) => {
    await window.api.db.addNote(text, {
      groupId: view.type === 'group' ? view.id : null,
    })
  }

  const toggleSelect = (id, e) => {
    setSel((prev) => {
      const next = new Set(prev)
      // Shift 连选，一次框住一整段同类灵感
      if (e?.shiftKey && lastClicked.current) {
        const ids = visible.map((n) => n.id)
        const a = ids.indexOf(lastClicked.current)
        const b = ids.indexOf(id)
        if (a !== -1 && b !== -1) {
          for (const x of ids.slice(Math.min(a, b), Math.max(a, b) + 1)) next.add(x)
          return next
        }
      }
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    lastClicked.current = id
  }

  const openArchiveMenu = (e, ids, currentGroupId) => {
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    setMenu({ x: r.left + r.width / 2, y: r.bottom, ids, currentGroupId })
  }

  const archiveTo = async (ids, groupId) => {
    await window.api.db.moveToGroup(ids, groupId)
    setMenu(null)
    setSel(new Set())
    const name = groupId ? groupsById[groupId]?.name : null
    flash(groupId ? `已归档 ${ids.length} 条到「${name}」` : `${ids.length} 条已退回收件箱`)
  }

  const archiveToNew = async (ids, name) => {
    const group = await window.api.db.addGroup(name)
    if (!group) return
    await window.api.db.moveToGroup(ids, group.id)
    setMenu(null)
    setSel(new Set())
    flash(`已新建「${name}」并归档 ${ids.length} 条`)
    setView({ type: 'group', id: group.id })
  }

  const onDragStart = (e, note) => {
    // 拖被选中的卡 = 拖整批；拖没选中的卡 = 只拖这一张
    const ids = sel.has(note.id) ? [...sel] : [note.id]
    e.dataTransfer.setData('application/x-note-ids', JSON.stringify(ids))
    e.dataTransfer.effectAllowed = 'move'
  }

  const deleteGroup = async (g) => {
    const ok = await window.api.app.confirm({
      title: '删除分组',
      message: `删除分组「${g.name}」？`,
      detail: '分组里的灵感不会丢，会退回收件箱。',
      confirmText: '删除分组',
    })
    if (!ok) return
    await window.api.db.deleteGroup(g.id)
    if (view.type === 'group' && view.id === g.id) setView({ type: 'inbox' })
  }

  const trashSelected = async () => {
    if (!sel.size) return
    await window.api.db.trashNotes([...sel])
    flash(`已移到回收站 ${sel.size} 条`)
    setSel(new Set())
  }

  const emptyTrash = async () => {
    const ok = await window.api.app.confirm({
      title: '清空回收站',
      message: `彻底删除回收站里的 ${counts.trash} 条灵感？`,
      detail: '这一步无法撤销。',
      confirmText: '清空',
    })
    if (ok) await window.api.db.emptyTrash()
  }

  // ---------------------------------------------------------------- 快捷键

  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA)$/.test(e.target.tagName)
      const mod = e.ctrlKey || e.metaKey

      if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        document.getElementById('global-search')?.focus()
      } else if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        document.getElementById('composer')?.focus()
      } else if (mod && e.key.toLowerCase() === 'a' && !typing) {
        e.preventDefault()
        setSel(new Set(visible.map((n) => n.id)))
      } else if (mod && e.key.toLowerCase() === 'g' && sel.size) {
        e.preventDefault()
        setMenu({ x: window.innerWidth / 2, y: window.innerHeight - 160, ids: [...sel] })
      } else if (e.key === 'Escape' && !typing) {
        if (menu) setMenu(null)
        else if (sel.size) setSel(new Set())
      } else if (e.key === 'Delete' && !typing && sel.size) {
        trashSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, sel, menu]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- 渲染

  const heading = {
    inbox: '收件箱',
    all: '全部灵感',
    trash: '回收站',
    group: groupsById[view.id]?.name,
    tag: `#${view.id}`,
  }[view.type] || ''

  const subtitle = {
    inbox: '还没归类的灵感都在这儿。挑出同类的，归档成一组。',
    all: '所有还没删除的灵感。',
    trash: '删掉的灵感会在这里，随时能还原。',
    group: '这一组里的灵感。',
    tag: '带这个标签的灵感。',
  }[view.type]

  return (
    <div className="app">
      <div className="glass-sheen" aria-hidden />

      <TitleBar
        query={query}
        onQuery={setQuery}
        settings={db.settings}
        onSettings={(p) => window.api.db.updateSettings(p)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="shell">
        <Sidebar
          db={db}
          view={view}
          onView={setView}
          counts={counts}
          tags={tags}
          onCreateGroup={(name) => window.api.db.addGroup(name)}
          onRenameGroup={(id, name) => window.api.db.updateGroup(id, { name })}
          onDeleteGroup={deleteGroup}
          onDropNotes={archiveTo}
        />

        <main className="main">
          <div className="main-head">
            <h1>
              {heading}
              <span className="head-count">{visible.length}</span>
            </h1>
            {view.type === 'trash' && counts.trash > 0 && (
              <button className="btn subtle danger" onClick={emptyTrash}>清空回收站</button>
            )}
            {subtitle && view.type !== 'trash' && <p className="head-sub">{subtitle}</p>}
          </div>

          {view.type !== 'trash' && (
            <Composer
              onAdd={addNote}
              placeholder={
                view.type === 'group'
                  ? `记一条灵感到「${heading}」…  用 #标签 顺手打个记号`
                  : '有什么灵感？写下来…  用 #标签 顺手打个记号，Enter 保存'
              }
            />
          )}

          <div className="list scroll-y">
            {visible.length === 0 ? (
              <EmptyState view={view} query={query} />
            ) : (
              visible.map((n) => (
                <NoteCard
                  key={n.id}
                  note={n}
                  group={groupsById[n.groupId]}
                  selected={sel.has(n.id)}
                  selectionMode={sel.size > 0}
                  inTrash={view.type === 'trash'}
                  onToggleSelect={toggleSelect}
                  onSave={(id, text) => window.api.db.updateNote(id, { text })}
                  onPin={(note) => window.api.db.updateNote(note.id, { pinned: !note.pinned })}
                  onArchive={(e, ids) => openArchiveMenu(e, ids, n.groupId ?? null)}
                  onCopy={(text) => { window.api.app.copy(text); flash('已复制') }}
                  onTrash={(id) => window.api.db.trashNotes([id])}
                  onRestore={(id) => window.api.db.restoreNotes([id])}
                  onPurge={(id) => window.api.db.purgeNotes([id])}
                  onTagClick={(t) => setView({ type: 'tag', id: t })}
                  onDragStart={onDragStart}
                />
              ))
            )}
          </div>

          {sel.size > 0 && (
            <div className="action-bar glass-pane">
              <span className="sel-count"><IconCheck width={13} height={13} />已选 {sel.size} 条</span>

              {view.type === 'trash' ? (
                <>
                  <button className="btn" onClick={async () => { await window.api.db.restoreNotes([...sel]); setSel(new Set()) }}>
                    还原
                  </button>
                  <button className="btn danger" onClick={async () => { await window.api.db.purgeNotes([...sel]); setSel(new Set()) }}>
                    彻底删除
                  </button>
                </>
              ) : (
                <>
                  <button className="btn primary" onClick={(e) => openArchiveMenu(e, [...sel])}>
                    <IconArchive width={14} height={14} /> 归档到… <kbd>Ctrl+G</kbd>
                  </button>
                  <button className="btn" onClick={() => archiveTo([...sel], null)}>
                    <IconInbox width={14} height={14} /> 退回收件箱
                  </button>
                  <button className="btn danger" onClick={trashSelected}>
                    <IconTrash width={14} height={14} /> 删除
                  </button>
                </>
              )}

              <button className="icon-btn" title="取消选择 (Esc)" onClick={() => setSel(new Set())}>
                <IconX width={14} height={14} />
              </button>
            </div>
          )}
        </main>
      </div>

      {menu && (
        <GroupMenu
          anchor={menu}
          groups={db.groups}
          count={menu.ids.length}
          currentGroupId={menu.currentGroupId}
          onPick={(gid) => archiveTo(menu.ids, gid)}
          onCreate={(name) => archiveToNew(menu.ids, name)}
          onClose={() => setMenu(null)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          db={db}
          onClose={() => setSettingsOpen(false)}
          onSettings={(p) => window.api.db.updateSettings(p)}
        />
      )}

      {toast && <div className="toast glass-pane">{toast}</div>}
    </div>
  )
}

function EmptyState({ view, query }) {
  if (query) {
    return (
      <div className="empty">
        <IconSpark width={30} height={30} />
        <p>没找到跟「{query}」有关的灵感</p>
      </div>
    )
  }
  const text = {
    inbox: ['收件箱是空的', '按 Ctrl + Alt + N，在任何地方都能记一笔'],
    all: ['还没有灵感', '上面那行就能写，Enter 保存'],
    trash: ['回收站是空的', ''],
    group: ['这个分组还是空的', '把收件箱里同类的灵感拖过来，或者选中后点「归档到」'],
    tag: ['没有带这个标签的灵感', ''],
  }[view.type] || ['空空如也', '']

  return (
    <div className="empty">
      <IconSpark width={30} height={30} />
      <p>{text[0]}</p>
      {text[1] && <small>{text[1]}</small>}
    </div>
  )
}
