'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const DEFAULT_SETTINGS = {
  hotkey: 'CommandOrControl+Alt+N',
  autoLaunch: false,
  alwaysOnTop: false,
  glassOpacity: 0.72, // 背景不透明度 0.3 ~ 1，拉满就是纯色背景
}

const GROUP_COLORS = [
  '#f59e0b', '#22d3ee', '#a78bfa', '#34d399',
  '#fb7185', '#60a5fa', '#f472b6', '#facc15',
]

const newId = () => crypto.randomUUID()
const now = () => Date.now()

/** 从正文里抽出 #标签，去重保序 */
function extractTags(text) {
  const out = []
  const re = /#([^\s#,.;:!?，。；：！？、]+)/g
  let m
  while ((m = re.exec(text || '')) !== null) {
    const t = m[1].trim()
    if (t && !out.includes(t)) out.push(t)
  }
  return out
}

class Store {
  constructor(file) {
    this.file = file
    this.tmp = file + '.tmp'
    this.bak = file + '.bak'
    this.data = this._read()
    this._writeTimer = null
  }

  _read() {
    const base = { version: 1, notes: [], groups: [], settings: { ...DEFAULT_SETTINGS } }
    try {
      // 去掉 BOM：用记事本/PowerShell 改过这个文件的话会带上，JSON.parse 认不了
      const raw = fs.readFileSync(this.file, 'utf8').replace(/^﻿/, '')
      const parsed = JSON.parse(raw)
      return {
        ...base,
        ...parsed,
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
        groups: Array.isArray(parsed.groups) ? parsed.groups : [],
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        // 文件坏了也别丢数据，先留个备份再从空白开始
        try { fs.copyFileSync(this.file, this.bak + '.' + Date.now()) } catch {}
      }
      return base
    }
  }

  /** 原子写：先写临时文件再 rename，避免断电/崩溃写出半个 JSON */
  flush() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      fs.writeFileSync(this.tmp, JSON.stringify(this.data, null, 2), 'utf8')
      fs.renameSync(this.tmp, this.file)
    } catch (err) {
      console.error('[store] 写入失败:', err)
    }
  }

  /** 合并短时间内的多次改动，减少磁盘写 */
  save() {
    if (this._writeTimer) clearTimeout(this._writeTimer)
    this._writeTimer = setTimeout(() => {
      this._writeTimer = null
      this.flush()
    }, 250)
  }

  flushNow() {
    if (this._writeTimer) {
      clearTimeout(this._writeTimer)
      this._writeTimer = null
    }
    this.flush()
  }

  getAll() {
    return this.data
  }

  // ---------- 灵感 ----------

  addNote(text, { groupId = null } = {}) {
    const body = String(text || '').trim()
    if (!body) return null
    const note = {
      id: newId(),
      text: body,
      tags: extractTags(body),
      groupId,
      pinned: false,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
    }
    this.data.notes.unshift(note)
    this.save()
    return note
  }

  updateNote(id, patch) {
    const note = this.data.notes.find((n) => n.id === id)
    if (!note) return null
    if (typeof patch.text === 'string') {
      note.text = patch.text
      note.tags = extractTags(patch.text)
    }
    if ('groupId' in patch) note.groupId = patch.groupId
    if ('pinned' in patch) note.pinned = !!patch.pinned
    if (Array.isArray(patch.tags)) note.tags = patch.tags
    note.updatedAt = now()
    this.save()
    return note
  }

  /** 归档：把一批灵感收进同一个分组。groupId 传 null 就是退回收件箱 */
  moveToGroup(ids, groupId) {
    const set = new Set(ids)
    let n = 0
    for (const note of this.data.notes) {
      if (set.has(note.id)) {
        note.groupId = groupId
        note.updatedAt = now()
        n++
      }
    }
    this.save()
    return n
  }

  /** 软删除，先进回收站 */
  trashNotes(ids) {
    const set = new Set(ids)
    for (const note of this.data.notes) {
      if (set.has(note.id)) {
        note.deletedAt = now()
        note.updatedAt = now()
      }
    }
    this.save()
  }

  restoreNotes(ids) {
    const set = new Set(ids)
    for (const note of this.data.notes) {
      if (set.has(note.id)) {
        note.deletedAt = null
        note.updatedAt = now()
      }
    }
    this.save()
  }

  purgeNotes(ids) {
    const set = new Set(ids)
    this.data.notes = this.data.notes.filter((n) => !set.has(n.id))
    this.save()
  }

  emptyTrash() {
    this.data.notes = this.data.notes.filter((n) => !n.deletedAt)
    this.save()
  }

  // ---------- 分组 ----------

  addGroup(name) {
    const label = String(name || '').trim()
    if (!label) return null
    const existing = this.data.groups.find((g) => g.name === label)
    if (existing) return existing
    const group = {
      id: newId(),
      name: label,
      color: GROUP_COLORS[this.data.groups.length % GROUP_COLORS.length],
      createdAt: now(),
    }
    this.data.groups.push(group)
    this.save()
    return group
  }

  updateGroup(id, patch) {
    const group = this.data.groups.find((g) => g.id === id)
    if (!group) return null
    if (typeof patch.name === 'string' && patch.name.trim()) group.name = patch.name.trim()
    if (typeof patch.color === 'string') group.color = patch.color
    this.save()
    return group
  }

  /** 删分组不删灵感，里面的内容退回收件箱 */
  deleteGroup(id) {
    this.data.groups = this.data.groups.filter((g) => g.id !== id)
    for (const note of this.data.notes) {
      if (note.groupId === id) {
        note.groupId = null
        note.updatedAt = now()
      }
    }
    this.save()
  }

  // ---------- 设置 ----------

  updateSettings(patch) {
    this.data.settings = { ...this.data.settings, ...patch }
    this.save()
    return this.data.settings
  }
}

module.exports = { Store, extractTags, DEFAULT_SETTINGS, GROUP_COLORS }
