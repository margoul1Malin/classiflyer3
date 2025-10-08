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
  chooseFiles: async () => {
    return await ipcRenderer.invoke('dialog:chooseFiles');
  },
  // Classeurs API
  listClasseurs: async () => ipcRenderer.invoke('classeurs:list'),
  createClasseur: async (payload) => ipcRenderer.invoke('classeurs:create', payload),
  createClasseurFromFolder: async (payload) => ipcRenderer.invoke('classeurs:createFromFolder', payload),
  updateClasseur: async (id, updates) => ipcRenderer.invoke('classeurs:update', id, updates),
  deleteClasseur: async (id) => ipcRenderer.invoke('classeurs:delete', id),
  archiveClasseur: async (id, archiveFolderId = null) => ipcRenderer.invoke('classeurs:archive', id, archiveFolderId),
  // Dossiers de Classeurs API
  listClasseurFolders: async () => ipcRenderer.invoke('classeurFolders:list'),
  createClasseurFolder: async (name) => ipcRenderer.invoke('classeurFolders:create', name),
  renameClasseurFolder: async (folderId, newName) => ipcRenderer.invoke('classeurFolders:rename', folderId, newName),
  deleteClasseurFolder: async (folderId) => ipcRenderer.invoke('classeurFolders:delete', folderId),
  moveClasseurToFolder: async (classeurId, folderId = null) => ipcRenderer.invoke('classeurFolders:moveClasseur', classeurId, folderId),
  // Classeur FS ops
  getClasseur: async (id) => ipcRenderer.invoke('classeur:get', id),
  createFolder: async (id, name, parentFolderId = null) => ipcRenderer.invoke('classeur:createFolder', id, name, parentFolderId),
  uploadFiles: async (id, folderId, files) => ipcRenderer.invoke('classeur:uploadFiles', id, folderId, files),
  updateFolder: async (id, folderId, updates) => ipcRenderer.invoke('classeur:updateFolder', id, folderId, updates),
  deleteFolder: async (id, folderId) => ipcRenderer.invoke('classeur:deleteFolder', id, folderId),
  moveFile: async (id, filePath, targetFolderId = null) => ipcRenderer.invoke('classeur:moveFile', id, filePath, targetFolderId),
  // Archives API
  listArchives: async () => ipcRenderer.invoke('archives:list'),
  unarchiveClasseur: async (id) => ipcRenderer.invoke('archives:unarchive', id),
  deleteArchivedClasseur: async (id) => ipcRenderer.invoke('archives:delete', id),
  createArchiveFolder: async (name, parentId = null) => ipcRenderer.invoke('archives:createFolder', name, parentId),
  listArchiveFolders: async () => ipcRenderer.invoke('archives:listFolders'),
  deleteArchiveFolder: async (folderId) => ipcRenderer.invoke('archives:deleteFolder', folderId),
  renameArchiveFolder: async (folderId, newName) => ipcRenderer.invoke('archives:renameFolder', folderId, newName),
  moveClasseurToArchiveFolder: async (classeurId, folderId = null) => ipcRenderer.invoke('archives:moveClasseur', classeurId, folderId),
  updateArchivedClasseur: async (classeurId, updates) => ipcRenderer.invoke('archives:updateClasseur', classeurId, updates),
  // Corbeille API
  trashList: async () => ipcRenderer.invoke('trash:list'),
  trashMoveClasseur: async (id, context) => ipcRenderer.invoke('trash:moveClasseur', id, context), // context: 'mes' | 'archives'
  trashRestoreClasseur: async (id) => ipcRenderer.invoke('trash:restoreClasseur', id),
  trashDeleteClasseur: async (id) => ipcRenderer.invoke('trash:deleteClasseur', id),
  trashRestoreClasseurFolder: async (id) => ipcRenderer.invoke('trash:restoreClasseurFolder', id),
  trashDeleteClasseurFolder: async (id) => ipcRenderer.invoke('trash:deleteClasseurFolder', id),
  trashClearAll: async () => ipcRenderer.invoke('trash:clearAll'),
  // Utilitaires
  toFileUrl: (absolutePath) => {
    // Convertir le chemin en URL file:// compatible Windows/Linux
    const normalizedPath = absolutePath.replace(/\\/g, '/');
    return 'file://' + (process.platform === 'win32' ? '/' : '') + normalizedPath;
  },
  // Convertir fichier en data URL pour éviter les problèmes CSP
  fileToDataUrl: async (filePath) => {
    return await ipcRenderer.invoke('file:toDataUrl', filePath);
  },
});
