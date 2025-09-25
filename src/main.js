const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const fsp = require('node:fs/promises');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

function getDefaultRootPath() {
  const homeDir = os.homedir();
  if (process.platform === 'win32') {
    return path.join(homeDir, 'AppData', 'Roaming', 'Classiflyer', 'config');
  }
  return path.join(homeDir, '.classiflyer', 'config');
}

function getUserDataConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

async function readAppConfig() {
  const configPath = getUserDataConfigPath();
  try {
    const raw = await fsp.readFile(configPath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

async function writeAppConfig(config) {
  const configPath = getUserDataConfigPath();
  await fsp.mkdir(path.dirname(configPath), { recursive: true });
  await fsp.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

async function ensureRootAndDb(rootPath) {
  // Create root and standard sub-directories
  await fsp.mkdir(rootPath, { recursive: true });
  const subDirs = ['classeurs', 'archives', 'corbeille', 'uploads'];
  await Promise.all(subDirs.map((d) => fsp.mkdir(path.join(rootPath, d), { recursive: true })));

  const dbPath = path.join(rootPath, 'db.json');
  try {
    await fsp.access(dbPath, fs.constants.F_OK);
  } catch (_e) {
    const initialDb = {
      settings: {
        rootPath,
      },
      nextId: {
        classeurs: 1,
        dossiers: 1,
        fichiers: 1,
        archiveFolders: 1,
      },
      mes_classeurs: {},
      archives: {},
      corbeille: {},
    };
    await fsp.writeFile(dbPath, JSON.stringify(initialDb, null, 2), 'utf-8');
  }
  return { rootPath, dbPath };
}

async function bootstrapConfig() {
  const appConfig = await readAppConfig();
  const rootPath = typeof appConfig.rootPath === 'string' && appConfig.rootPath.trim().length > 0
    ? appConfig.rootPath
    : getDefaultRootPath();
  await ensureRootAndDb(rootPath);
  if (appConfig.rootPath !== rootPath) {
    await writeAppConfig({ ...appConfig, rootPath });
  }
  return rootPath;
}

function registerIpcHandlers() {
  ipcMain.handle('config:get', async () => {
    const cfg = await readAppConfig();
    const rootPath = cfg.rootPath || getDefaultRootPath();
    return { rootPath, dbPath: path.join(rootPath, 'db.json') };
  });

  ipcMain.handle('config:setRootPath', async (_event, newRootPath) => {
    if (typeof newRootPath !== 'string' || newRootPath.trim().length === 0) {
      throw new Error('Chemin invalide');
    }
    await ensureRootAndDb(newRootPath);
    const current = await readAppConfig();
    await writeAppConfig({ ...current, rootPath: newRootPath });
    return { rootPath: newRootPath, dbPath: path.join(newRootPath, 'db.json') };
  });

  ipcMain.handle('dialog:chooseDirectory', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle('dialog:chooseFiles', async () => {
    const result = await dialog.showOpenDialog({ 
      properties: ['openFile', 'multiSelections', 'showHiddenFiles'],
      filters: [
        { name: 'Tous les fichiers', extensions: ['*'] },
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg'] },
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'Excel', extensions: ['xlsx', 'xls'] },
        { name: 'Documents', extensions: ['doc', 'docx', 'txt', 'rtf'] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths.map(path => ({ path }));
  });

  // DB helpers
  const getDbPath = async () => {
    const cfg = await readAppConfig();
    const rootPath = cfg.rootPath || getDefaultRootPath();
    return path.join(rootPath, 'db.json');
  };

  async function readDb() {
    const dbPath = await getDbPath();
    const raw = await fsp.readFile(dbPath, 'utf-8');
    return JSON.parse(raw);
  }

  async function writeDb(db) {
    const dbPath = await getDbPath();
    await fsp.writeFile(dbPath, JSON.stringify(db, null, 2), 'utf-8');
    return db;
  }

  function toClasseurKey(id) {
    return `classeur_${id}`;
  }

  // IPC: classeurs CRUD
  ipcMain.handle('classeurs:list', async () => {
    const db = await readDb();
    const entries = Object.entries(db.mes_classeurs || {});
    return entries.map(([key, value]) => ({ id: key, ...value }));
  });

  // Classeur helpers
  ipcMain.handle('classeur:get', async (_e, idKey) => {
    const db = await readDb();
    const item = db.mes_classeurs?.[idKey];
    if (!item) throw new Error('Classeur introuvable');
    return { id: idKey, ...item };
  });

  ipcMain.handle('classeur:createFolder', async (_e, idKey, folderName) => {
    if (!folderName || !idKey) throw new Error('Paramètres manquants');
    const db = await readDb();
    const cls = db.mes_classeurs?.[idKey];
    if (!cls) throw new Error('Classeur introuvable');
    const folderId = `dossier_${(db.nextId.dossiers = (db.nextId.dossiers || 1) + 1)}`;
    const folderPath = path.join(cls.sys_path, folderName);
    await fsp.mkdir(folderPath, { recursive: true });
    cls.folders = cls.folders || {};
    cls.folders[folderId] = { name: folderName, sys_path: folderPath, files: {}, folders: {} };
    cls.updatedAt = Date.now();
    await writeDb(db);
    return { id: folderId, ...cls.folders[folderId] };
  });

  ipcMain.handle('classeur:uploadFiles', async (_e, idKey, targetFolderId, files) => {
    const db = await readDb();
    const cls = db.mes_classeurs?.[idKey];
    if (!cls) throw new Error('Classeur introuvable');
    const targetFolder = targetFolderId ? (cls.folders?.[targetFolderId]) : null;
    const destDir = targetFolder ? targetFolder.sys_path : cls.sys_path;
    await fsp.mkdir(destDir, { recursive: true });
    cls.files = cls.files || [];
    const saved = [];
    for (const f of files || []) {
      const base = path.basename(f.path || f);
      const dest = path.join(destDir, base);
      await fsp.copyFile(f.path || f, dest);
      const fileRec = { name: base, sys_path: dest, mime: f.mime || null, createdAt: Date.now() };
      if (targetFolder) {
        targetFolder.files = targetFolder.files || {};
        const fid = `file_${(db.nextId.fichiers = (db.nextId.fichiers || 1) + 1)}`;
        targetFolder.files[fid] = fileRec;
        saved.push({ id: fid, ...fileRec });
      } else {
        const fid = `file_${(db.nextId.fichiers = (db.nextId.fichiers || 1) + 1)}`;
        cls.files.push({ id: fid, ...fileRec });
        saved.push({ id: fid, ...fileRec });
      }
    }
    cls.updatedAt = Date.now();
    await writeDb(db);
    return saved;
  });

  ipcMain.handle('classeur:updateFolder', async (_e, idKey, folderId, updates) => {
    const db = await readDb();
    const cls = db.mes_classeurs?.[idKey];
    if (!cls) throw new Error('Classeur introuvable');
    const folder = cls.folders?.[folderId];
    if (!folder) throw new Error('Dossier introuvable');
    
    if (updates.name && updates.name !== folder.name) {
      const newPath = path.join(path.dirname(folder.sys_path), updates.name);
      await fsp.rename(folder.sys_path, newPath);
      folder.name = updates.name;
      folder.sys_path = newPath;
    }
    
    cls.updatedAt = Date.now();
    await writeDb(db);
    return { id: folderId, ...folder };
  });

  ipcMain.handle('classeur:deleteFolder', async (_e, idKey, folderId) => {
    const db = await readDb();
    const cls = db.mes_classeurs?.[idKey];
    if (!cls) throw new Error('Classeur introuvable');
    const folder = cls.folders?.[folderId];
    if (!folder) throw new Error('Dossier introuvable');
    
    // Delete folder from filesystem
    await fsp.rm(folder.sys_path, { recursive: true, force: true });
    
    // Remove from DB
    delete cls.folders[folderId];
    cls.updatedAt = Date.now();
    await writeDb(db);
    return true;
  });

  ipcMain.handle('classeurs:create', async (_event, payload) => {
    const { name, primaryColor, secondaryColor, tertiaryColor } = payload || {};
    if (!name || typeof name !== 'string') throw new Error('Nom requis');
    const db = await readDb();
    db.nextId = db.nextId || { classeurs: 1, dossiers: 1, fichiers: 1, archiveFolders: 1 };
    const newId = db.nextId.classeurs++;
    const idKey = toClasseurKey(newId);

    // Create folder on filesystem under rootPath/classeurs/<name>
    const rootPath = db.settings && db.settings.rootPath ? db.settings.rootPath : getDefaultRootPath();
    const classeurDir = path.join(rootPath, 'classeurs', name);
    await fsp.mkdir(classeurDir, { recursive: true });

    const newClasseur = {
      name,
      sys_path: classeurDir,
      app_path: `/mes_classeurs/${name}`,
      primaryColor: primaryColor || '#0ea5e9',
      secondaryColor: secondaryColor || '#38bdf8',
      tertiaryColor: tertiaryColor || '#0b1220',
      folders: {},
      files: [],
      archived: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    db.mes_classeurs = db.mes_classeurs || {};
    db.mes_classeurs[idKey] = newClasseur;
    await writeDb(db);
    return { id: idKey, ...newClasseur };
  });

  ipcMain.handle('classeurs:update', async (_event, idKey, updates) => {
    if (!idKey) throw new Error('Id manquant');
    const db = await readDb();
    const current = db.mes_classeurs?.[idKey];
    if (!current) throw new Error('Classeur introuvable');
    let next = { ...current };

    // Handle rename (filesystem move) if name changed
    if (typeof updates?.name === 'string' && updates.name.trim() && updates.name !== current.name) {
      const rootPath = db.settings && db.settings.rootPath ? db.settings.rootPath : getDefaultRootPath();
      const newDir = path.join(rootPath, 'classeurs', updates.name.trim());
      await fsp.mkdir(path.dirname(newDir), { recursive: true });
      try {
        await fsp.rename(current.sys_path, newDir);
        next.sys_path = newDir;
        next.app_path = `/mes_classeurs/${updates.name.trim()}`;
        next.name = updates.name.trim();
      } catch (e) {
        throw new Error('Échec du renommage du dossier du classeur');
      }
    }

    if (typeof updates?.primaryColor === 'string') next.primaryColor = updates.primaryColor;
    if (typeof updates?.secondaryColor === 'string') next.secondaryColor = updates.secondaryColor;
    if (typeof updates?.tertiaryColor === 'string') next.tertiaryColor = updates.tertiaryColor;

    next.updatedAt = Date.now();
    db.mes_classeurs[idKey] = next;
    await writeDb(db);
    return { id: idKey, ...next };
  });

  ipcMain.handle('classeurs:delete', async (_event, idKey) => {
    if (!idKey) throw new Error('Id manquant');
    const db = await readDb();
    const current = db.mes_classeurs?.[idKey];
    if (!current) return false;

    // Attempt to remove the classeur folder from filesystem
    if (current.sys_path) {
      try {
        await fsp.rm(current.sys_path, { recursive: true, force: true });
      } catch (_e) {
        // ignore filesystem errors but continue DB cleanup
      }
    }

    // Remove from DB entirely (no corbeille)
    delete db.mes_classeurs[idKey];
    await writeDb(db);
    return true;
  });

  ipcMain.handle('classeurs:archive', async (_event, idKey) => {
    if (!idKey) throw new Error('Id manquant');
    const db = await readDb();
    const current = db.mes_classeurs?.[idKey];
    if (!current) throw new Error('Classeur introuvable');
    current.archived = true;
    current.updatedAt = Date.now();
    await writeDb(db);
    return { id: idKey, ...current };
  });
}

const createWindow = async () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      webSecurity: false, // Permet l'accès aux fichiers locaux
      disableWebSecurity: true, // Désactive complètement la sécurité web
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  await bootstrapConfig();
  registerIpcHandlers();
  await createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handler pour convertir les fichiers en data URLs
ipcMain.handle('file:toDataUrl', async (_e, filePath) => {
  try {
    const data = await fsp.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'application/octet-stream';
    
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.svg'].includes(ext)) {
      if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
      else if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.gif') mimeType = 'image/gif';
      else if (ext === '.webp') mimeType = 'image/webp';
      else if (ext === '.avif') mimeType = 'image/avif';
      else if (ext === '.bmp') mimeType = 'image/bmp';
      else if (ext === '.svg') mimeType = 'image/svg+xml';
    }
    
    const base64 = data.toString('base64');
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    throw new Error(`Erreur lors de la lecture du fichier: ${error.message}`);
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
