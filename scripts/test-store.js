'use strict'

/** store.js 的冒烟测试：跑 `node scripts/test-store.js` */

const fs = require('fs')
const os = require('os')
const path = require('path')
const assert = require('assert')

const { Store, extractTags } = require('../electron/store')

const tmp = path.join(os.tmpdir(), 'spark-notes-test-' + process.pid)
fs.mkdirSync(tmp, { recursive: true })
const file = path.join(tmp, 'notes.json')

let passed = 0
const ok = (name, fn) => {
  fn()
  passed++
  console.log('  ✓', name)
}

console.log('store.js')

ok('标签识别：中英文、标点边界', () => {
  assert.deepStrictEqual(extractTags('做个 #工具 顺便试试 #ai-agent，还有 #写作。'),
    ['工具', 'ai-agent', '写作'])
  assert.deepStrictEqual(extractTags('没有标签'), [])
  assert.deepStrictEqual(extractTags('#重复 #重复'), ['重复'])
})

const s = new Store(file)

ok('新灵感进收件箱，标签自动抽出来', () => {
  const n = s.addNote('  用 #电子墨水 做个待办牌  ')
  assert.strictEqual(n.text, '用 #电子墨水 做个待办牌')
  assert.deepStrictEqual(n.tags, ['电子墨水'])
  assert.strictEqual(n.groupId, null)
  assert.strictEqual(s.data.notes.length, 1)
})

ok('空内容不记', () => {
  assert.strictEqual(s.addNote('   \n  '), null)
  assert.strictEqual(s.data.notes.length, 1)
})

ok('最新的排在最前', () => {
  s.addNote('第二条 #硬件')
  assert.strictEqual(s.data.notes[0].text, '第二条 #硬件')
})

const g = s.addGroup('硬件小玩意')

ok('同名分组不会建两个', () => {
  assert.strictEqual(s.addGroup('硬件小玩意').id, g.id)
  assert.strictEqual(s.data.groups.length, 1)
})

ok('归档：一批灵感一起进分组', () => {
  const ids = s.data.notes.map((n) => n.id)
  assert.strictEqual(s.moveToGroup(ids, g.id), 2)
  assert.ok(s.data.notes.every((n) => n.groupId === g.id))
})

ok('改正文会重算标签', () => {
  const n = s.data.notes[0]
  s.updateNote(n.id, { text: '改成 #软件 了' })
  assert.deepStrictEqual(s.data.notes[0].tags, ['软件'])
})

ok('退回收件箱', () => {
  const id = s.data.notes[0].id
  s.moveToGroup([id], null)
  assert.strictEqual(s.data.notes[0].groupId, null)
})

ok('删分组不删灵感，里面的退回收件箱', () => {
  const id = s.data.notes.find((n) => n.groupId === g.id).id
  s.deleteGroup(g.id)
  assert.strictEqual(s.data.groups.length, 0)
  assert.strictEqual(s.data.notes.find((n) => n.id === id).groupId, null)
  assert.strictEqual(s.data.notes.length, 2)
})

ok('回收站：软删除 → 还原 → 彻底删除', () => {
  const id = s.data.notes[0].id
  s.trashNotes([id])
  assert.ok(s.data.notes.find((n) => n.id === id).deletedAt)
  s.restoreNotes([id])
  assert.strictEqual(s.data.notes.find((n) => n.id === id).deletedAt, null)
  s.trashNotes([id])
  s.emptyTrash()
  assert.strictEqual(s.data.notes.length, 1)
})

ok('落盘后能原样读回来', () => {
  s.flushNow()
  const reopened = new Store(file)
  assert.strictEqual(reopened.data.notes.length, s.data.notes.length)
  assert.strictEqual(reopened.data.notes[0].text, s.data.notes[0].text)
  assert.strictEqual(reopened.data.settings.hotkey, 'CommandOrControl+Alt+N')
})

ok('文件损坏时不崩，降级成空库并留备份', () => {
  const badFile = path.join(tmp, 'bad.json')
  fs.writeFileSync(badFile, '{ 这不是 json')
  const broken = new Store(badFile)
  assert.deepStrictEqual(broken.data.notes, [])
  assert.ok(fs.readdirSync(tmp).some((f) => f.startsWith('bad.json.bak')))
})

fs.rmSync(tmp, { recursive: true, force: true })
console.log(`\n${passed} 项通过`)
