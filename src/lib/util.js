/** 相对时间：刚记下的灵感看「3 分钟前」比看时间戳有用 */
export function relTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  if (day === 1) return '昨天'
  if (day < 7) return `${day} 天前`
  return fmtDate(ts)
}

export function fmtDate(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function fmtDateTime(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${fmtDate(ts)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 灵感的第一行当标题用 */
export function titleOf(text) {
  const line = String(text || '').split('\n').find((l) => l.trim())
  return (line || '').trim()
}

export function countTags(notes) {
  const map = new Map()
  for (const n of notes) {
    if (n.deletedAt) continue
    for (const t of n.tags || []) map.set(t, (map.get(t) || 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

/** 把正文切成普通文本和 #标签 两种片段，方便渲染高亮 */
export function splitTags(text) {
  const parts = []
  const re = /#([^\s#,.;:!?，。；：！？、]+)/g
  let last = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', value: text.slice(last, m.index) })
    parts.push({ type: 'tag', value: m[1] })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts
}

export function buildMarkdown(notes, groups) {
  const byGroup = new Map(groups.map((g) => [g.id, []]))
  const inbox = []
  for (const n of notes) {
    if (n.deletedAt) continue
    if (n.groupId && byGroup.has(n.groupId)) byGroup.get(n.groupId).push(n)
    else inbox.push(n)
  }

  const section = (title, list) => {
    if (!list.length) return ''
    const body = list
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((n) => {
        const meta = `<!-- ${fmtDateTime(n.createdAt)} -->`
        return `${meta}\n${n.text.trim()}\n`
      })
      .join('\n---\n\n')
    return `## ${title}\n\n${body}\n`
  }

  const out = [`# 灵感便签\n\n> 导出于 ${fmtDateTime(Date.now())}\n`]
  for (const g of groups) out.push(section(g.name, byGroup.get(g.id) || []))
  out.push(section('收件箱（未归档）', inbox))
  return out.filter(Boolean).join('\n')
}

export function cls(...xs) {
  return xs.filter(Boolean).join(' ')
}
