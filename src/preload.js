// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('classiflyer', {
  getConfig: async () => {
    return await ipcRenderer.invoke('config:get');
  },
  setRootPath: async (newRootPath) => {
    return await ipcRenderer.invoke('config:setRootPath', newRootPath);
  },
  chooseDirectory: async () => {
    return await ipcRenderer.invoke('dialog:chooseDirectory');
  },
  // Classeurs API
  listClasseurs: async () => ipcRenderer.invoke('classeurs:list'),
  createClasseur: async (payload) => ipcRenderer.invoke('classeurs:create', payload),
  updateClasseur: async (id, updates) => ipcRenderer.invoke('classeurs:update', id, updates),
  deleteClasseur: async (id) => ipcRenderer.invoke('classeurs:delete', id),
  archiveClasseur: async (id) => ipcRenderer.invoke('classeurs:archive', id),
});
