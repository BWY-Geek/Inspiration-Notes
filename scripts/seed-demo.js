'use strict'

/** 往数据文件里塞示例数据用来截图核对；跑完记得用 --clear 清掉 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const FILE = path.join(process.env.APPDATA, '灵感便签', 'notes.json')
const base = JSON.parse(fs.readFileSync(FILE, 'utf8').replace(/^﻿/, ''))

if (process.argv.includes('--clear')) {
  base.notes = []
  base.groups = []
  fs.writeFileSync(FILE, JSON.stringify(base, null, 2), 'utf8')
  console.log('已清空示例数据')
  process.exit(0)
}

const id = () => crypto.randomUUID()
const min = 60 * 1000
const now = Date.now()

const groups = [
  { id: id(), name: '产品点子', color: '#f59e0b', createdAt: now - 400 * min },
  { id: id(), name: '写作素材', color: '#22d3ee', createdAt: now - 300 * min },
]

const tagsOf = (t) => [...new Set([...t.matchAll(/#([^\s#,.;:!?，。；：！？、]+)/g)].map((m) => m[1]))]

const raw = [
  ['便签的归档应该是「选中几条 → 收成一组」，而不是先建文件夹再往里放。#交互', null, 3],
  ['速记框弹出来的那一下，延迟必须低于 100ms，不然就不会用了 #性能 #交互', null, 26],
  ['写一篇关于「工具的摩擦力」的文章：为什么大部分笔记软件最后都变成了坟场。#选题', 1, 90],
  ['灵感这东西的半衰期大概是 30 秒，记不下来就没了。#选题', 1, 140],
  ['用标签做横切，用分组做归档 —— 两者不冲突，一个是视角一个是归属。#交互', 0, 260],
  ['加个「本周回顾」：把这周攒的灵感一次性过一遍，顺手归档。#功能', 0, 420],
]

const notes = raw.map(([text, gi, ago], i) => ({
  id: id(),
  text,
  tags: tagsOf(text),
  groupId: gi === null ? null : groups[gi].id,
  pinned: i === 0,
  createdAt: now - ago * min,
  updatedAt: now - ago * min,
  deletedAt: null,
}))

base.groups = groups
base.notes = notes
fs.writeFileSync(FILE, JSON.stringify(base, null, 2), 'utf8')
console.log(`已写入 ${notes.length} 条示例灵感、${groups.length} 个分组`)
