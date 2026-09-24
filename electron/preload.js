'use strict'

const { contextBridge, ipcRenderer } = require('electron')

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args)

/** 订阅主进程事件，返回取消订阅函数 */
function on(channel, handler) {
  const wrapped = (_e, ...args) => handler(...args)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

contextBridge.exposeInMainWorld('api', {
  db: {
    getAll: () => invoke('db:getAll'),
    addNote: (text, opts) => invoke('db:addNote', text, opts),
    updateNote: (id, patch) => invoke('db:updateNote', id, patch),
    moveToGroup: (ids, groupId) => invoke('db:moveToGroup', ids, groupId),
    trashNotes: (ids) => invoke('db:trashNotes', ids),
    restoreNotes: (ids) => invoke('db:restoreNotes', ids),
    purgeNotes: (ids) => invoke('db:purgeNotes', ids),
    emptyTrash: () => invoke('db:emptyTrash'),
    addGroup: (name) => invoke('db:addGroup', name),
    updateGroup: (id, patch) => invoke('db:updateGroup', id, patch),
    deleteGroup: (id) => invoke('db:deleteGroup', id),
    updateSettings: (patch) => invoke('db:updateSettings', patch),
    onChanged: (handler) => on('db:changed', handler),
  },

  app: {
    dataPath: () => invoke('app:dataPath'),
    revealData: () => invoke('app:revealData'),
    copy: (text) => invoke('app:copy', text),
    exportFile: (payload) => invoke('app:export', payload),
    confirm: (payload) => invoke('app:confirm', payload),
  },

  win: {
    minimize: () => ipcRenderer.send('win:minimize'),
    toggleMaximize: () => ipcRenderer.send('win:toggleMaximize'),
    hide: () => ipcRenderer.send('win:hide'),
    isMaximized: () => ipcRenderer.sendSync('win:isMaximized'),
    onMaximized: (handler) => on('win:maximized', handler),
  },

  quick: {
    hide: () => ipcRenderer.send('quick:hide'),
    resize: (height) => ipcRenderer.send('quick:resize', height),
    openMain: () => ipcRenderer.send('quick:openMain'),
    onOpened: (handler) => on('quick:opened', handler),
    onClosed: (handler) => on('quick:closed', handler),
  },
})
