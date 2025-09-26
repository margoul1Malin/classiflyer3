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
      archives: {
        folders: {},
        classeurs: {}
      },
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

  // Créer un classeur à partir d'un dossier existant
  ipcMain.handle('classeurs:createFromFolder', async (_event, payload) => {
    // payload: { name, primaryColor, secondaryColor, tertiaryColor, folderPath }
    if (!payload || !payload.folderPath || !payload.name) {
      throw new Error('Données manquantes: name et folderPath requis');
    }
    const db = await readDb();
    const rootPath = db.settings && db.settings.rootPath ? db.settings.rootPath : getDefaultRootPath();
    const classeursPath = path.join(rootPath, 'classeurs');
    await fsp.mkdir(classeursPath, { recursive: true });

    const targetPath = path.join(classeursPath, payload.name);
    // Copie récursive du dossier source dans le répertoire des classeurs
    await fsp.cp(payload.folderPath, targetPath, { recursive: true });

    // Construire la structure de dossiers/fichiers imbriqués
    async function scanFolder(absPath) {
      const entries = await fsp.readdir(absPath, { withFileTypes: true });
      const folders = {};
      const files = {};
      for (const entry of entries) {
        const entryPath = path.join(absPath, entry.name);
        if (entry.isDirectory()) {
          const { folders: subFolders, files: subFiles } = await scanFolder(entryPath);
          const folderId = `dossier_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
          folders[folderId] = {
            name: entry.name,
            sys_path: entryPath,
            folders: subFolders,
            files: subFiles
          };
        } else {
          const fileId = `file_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
          files[fileId] = {
            name: entry.name,
            sys_path: entryPath,
            mime: null,
            createdAt: Date.now()
          };
        }
      }
      return { folders, files };
    }

    const scanned = await scanFolder(targetPath);

    // Créer l'objet classeur
    const classeurId = `classeur_${db.nextId?.classeurs || 1}`;
    db.nextId = db.nextId || {}; db.nextId.classeurs = (db.nextId.classeurs || 1) + 1;
    const newClasseur = {
      name: payload.name,
      sys_path: targetPath,
      app_path: `/mes_classeurs/${payload.name}`,
      primaryColor: payload.primaryColor || '#0ea5e9',
      secondaryColor: payload.secondaryColor || '#38bdf8',
      tertiaryColor: payload.tertiaryColor || '#0b1220',
      folders: scanned.folders,
      files: Object.values(scanned.files),
      archived: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    db.mes_classeurs = db.mes_classeurs || {};
    db.mes_classeurs[classeurId] = newClasseur;
    await writeDb(db);
    return { id: classeurId, ...newClasseur };
  });

  // DB helpers
  const getDbPath = async () => {
    const cfg = await readAppConfig();
    const rootPath = cfg.rootPath || getDefaultRootPath();
    return path.join(rootPath, 'db.json');
  };

  function migrateDbStructure(db) {
    // Migration : Convertir archives de [] vers { folders: {}, classeurs: {} }
    if (Array.isArray(db.archives)) {
      db.archives = {
        folders: {},
        classeurs: {}
      };
    }
    
    // S'assurer que la structure archives existe
    if (!db.archives || typeof db.archives !== 'object') {
      db.archives = { folders: {}, classeurs: {} };
    }
    
    // S'assurer que folders et classeurs existent
    if (!db.archives.folders) db.archives.folders = {};
    if (!db.archives.classeurs) db.archives.classeurs = {};
    
    // Migration : S'assurer que corbeille existe
    if (!db.corbeille) {
      db.corbeille = Array.isArray(db.corbeille) ? [] : {};
    }
    
    return db;
  }

  async function detectOrphanedArchives(db, rootPath) {
    try {
      const archivesDir = path.join(rootPath, 'archives');
      const archiveFolders = await fsp.readdir(archivesDir, { withFileTypes: true });
      
      for (const dirent of archiveFolders) {
        if (dirent.isDirectory()) {
          const classeurName = dirent.name;
          const classeurPath = path.join(archivesDir, classeurName);
          
          // Vérifier si ce classeur existe déjà dans les archives
          const existsInDb = Object.values(db.archives.classeurs || {}).some(
            c => c.name === classeurName || c.sys_path === classeurPath
          );
          
          if (!existsInDb) {
            // Chercher si ce classeur a des données existantes dans mes_classeurs (pour récupérer les couleurs)
            let existingClasseur = null;
            for (const [key, classeur] of Object.entries(db.mes_classeurs || {})) {
              if (classeur.name === classeurName) {
                existingClasseur = { ...classeur };
                // Supprimer de mes_classeurs car il est en fait archivé
                delete db.mes_classeurs[key];
                break;
              }
            }
            
            const classeurId = existingClasseur ? 
              Object.keys(db.mes_classeurs || {}).find(k => db.mes_classeurs[k].name === classeurName) || `classeur_${db.nextId?.classeurs || 1}` :
              `classeur_${db.nextId?.classeurs || 1}`;
            
            if (!existingClasseur && db.nextId) {
              db.nextId.classeurs = (db.nextId.classeurs || 1) + 1;
            }
            
            console.log(`Réintégration du classeur orphelin: ${classeurName}`);
            
            const orphanedClasseur = existingClasseur ? {
              ...existingClasseur,
              sys_path: classeurPath,
              app_path: `/archives/${classeurName}`,
              archived: true,
              archivedAt: Date.now(),
              updatedAt: Date.now(),
              archiveFolderId: null
            } : {
              name: classeurName,
              sys_path: classeurPath,
              app_path: `/archives/${classeurName}`,
              primaryColor: '#ffffff',
              secondaryColor: '#3b82f6',
              tertiaryColor: '#0b1220',
              folders: {},
              files: [],
              archived: true,
              archivedAt: Date.now(),
              createdAt: Date.now(),
              updatedAt: Date.now(),
              archiveFolderId: null
            };
            
            db.archives.classeurs[classeurId] = orphanedClasseur;
          }
        }
      }
    } catch (error) {
      console.log('Pas de dossier archives ou erreur lors de la détection:', error.message);
    }
    
    return db;
  }

  async function readDb() {
    const dbPath = await getDbPath();
    const raw = await fsp.readFile(dbPath, 'utf-8');
    let db = JSON.parse(raw);
    
    // Appliquer les migrations et sauvegarder automatiquement
    const originalDb = JSON.stringify(db);
    db = migrateDbStructure(db);
    
    // Détecter et réintégrer les classeurs orphelins dans les archives
    const config = await readAppConfig();
    const rootPath = config.rootPath || getDefaultRootPath();
    db = await detectOrphanedArchives(db, rootPath);
    
    // Si la structure a changé, sauvegarder automatiquement
    if (JSON.stringify(db) !== originalDb) {
      await fsp.writeFile(dbPath, JSON.stringify(db, null, 2), 'utf-8');
    }
    
    return db;
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
    
    // Chercher d'abord dans mes_classeurs
    let item = db.mes_classeurs?.[idKey];
    
    // Si pas trouvé, chercher dans les archives
    if (!item) {
      item = db.archives?.classeurs?.[idKey];
    }
    
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

  ipcMain.handle('classeurs:archive', async (_event, idKey, archiveFolderId = null) => {
    if (!idKey) throw new Error('Id manquant');
    const db = await readDb();
    const current = db.mes_classeurs?.[idKey];
    if (!current) throw new Error('Classeur introuvable');
    
    // Déplacer le dossier physique vers les archives
    const rootPath = db.settings && db.settings.rootPath ? db.settings.rootPath : getDefaultRootPath();
    const archivesPath = path.join(rootPath, 'archives');
    
    let targetPath;
    if (archiveFolderId && db.archives.folders && db.archives.folders[archiveFolderId]) {
      // Déplacer dans un dossier d'archive spécifique
      targetPath = path.join(db.archives.folders[archiveFolderId].sys_path, current.name);
    } else {
      // Déplacer à la racine des archives
      targetPath = path.join(archivesPath, current.name);
    }
    
    // Sauvegarder l'ancien chemin pour mise à jour des références
    const oldPath = current.sys_path;
    
    // Déplacer le dossier physique
    await fsp.mkdir(path.dirname(targetPath), { recursive: true });
    await fsp.rename(current.sys_path, targetPath);
    
    // Mettre à jour les chemins du classeur
    current.sys_path = targetPath;
    current.app_path = archiveFolderId 
      ? `/archives/${db.archives.folders[archiveFolderId].name}/${current.name}`
      : `/archives/${current.name}`;
    current.archived = true;
    current.archivedAt = Date.now();
    current.updatedAt = Date.now();
    current.archiveFolderId = archiveFolderId || null;
    
    // Fonction récursive pour mettre à jour les chemins des dossiers et fichiers imbriqués
    function updateNestedPaths(folders, files, oldBasePath, newBasePath) {
      // Mettre à jour les dossiers
      if (folders) {
        for (const [folderId, folder] of Object.entries(folders)) {
          if (folder.sys_path && folder.sys_path.startsWith(oldBasePath)) {
            folder.sys_path = folder.sys_path.replace(oldBasePath, newBasePath);
            
            // Récursivement mettre à jour les sous-dossiers et fichiers
            updateNestedPaths(folder.folders, folder.files, oldBasePath, newBasePath);
          }
        }
      }
      
      // Mettre à jour les fichiers
      if (files) {
        if (Array.isArray(files)) {
          // Format tableau
          for (const file of files) {
            if (file.sys_path && file.sys_path.startsWith(oldBasePath)) {
              file.sys_path = file.sys_path.replace(oldBasePath, newBasePath);
            }
          }
        } else {
          // Format objet
          for (const [fileId, file] of Object.entries(files)) {
            if (file.sys_path && file.sys_path.startsWith(oldBasePath)) {
              file.sys_path = file.sys_path.replace(oldBasePath, newBasePath);
            }
          }
        }
      }
    }
    
    // Mettre à jour tous les chemins imbriqués dans ce classeur
    updateNestedPaths(current.folders, current.files, oldPath, targetPath);
    
    // Déplacer dans la DB : de mes_classeurs vers archives
    db.archives = db.archives || { folders: {}, classeurs: {} };
    db.archives.classeurs = db.archives.classeurs || {};
    db.archives.classeurs[idKey] = current;
    delete db.mes_classeurs[idKey];
    
    await writeDb(db);
    return { id: idKey, ...current };
  });

  // IPC: archives
  ipcMain.handle('archives:list', async () => {
    const db = await readDb();
    const classeurs = Object.entries(db.archives?.classeurs || {});
    return classeurs.map(([key, value]) => ({ id: key, ...value }));
  });

  ipcMain.handle('archives:unarchive', async (_event, idKey) => {
    if (!idKey) throw new Error('Id manquant');
    const db = await readDb();
    const current = db.archives?.classeurs?.[idKey];
    if (!current) throw new Error('Classeur archivé introuvable');
    
    // Déplacer le dossier physique vers mes_classeurs
    const rootPath = db.settings && db.settings.rootPath ? db.settings.rootPath : getDefaultRootPath();
    const classeursPath = path.join(rootPath, 'classeurs');
    const targetPath = path.join(classeursPath, current.name);
    
    // Sauvegarder l'ancien chemin pour mise à jour des références
    const oldPath = current.sys_path;
    
    // Déplacer le dossier physique
    await fsp.mkdir(classeursPath, { recursive: true });
    await fsp.rename(current.sys_path, targetPath);
    
    // Mettre à jour les chemins du classeur
    current.sys_path = targetPath;
    current.app_path = `/mes_classeurs/${current.name}`;
    current.archived = false;
    current.archivedAt = null;
    current.archiveFolderId = null;
    current.updatedAt = Date.now();
    
    // Fonction récursive pour mettre à jour les chemins des dossiers et fichiers imbriqués
    function updateNestedPaths(folders, files, oldBasePath, newBasePath) {
      // Mettre à jour les dossiers
      if (folders) {
        for (const [folderId, folder] of Object.entries(folders)) {
          if (folder.sys_path && folder.sys_path.startsWith(oldBasePath)) {
            folder.sys_path = folder.sys_path.replace(oldBasePath, newBasePath);
            
            // Récursivement mettre à jour les sous-dossiers et fichiers
            updateNestedPaths(folder.folders, folder.files, oldBasePath, newBasePath);
          }
        }
      }
      
      // Mettre à jour les fichiers
      if (files) {
        if (Array.isArray(files)) {
          // Format tableau
          for (const file of files) {
            if (file.sys_path && file.sys_path.startsWith(oldBasePath)) {
              file.sys_path = file.sys_path.replace(oldBasePath, newBasePath);
            }
          }
        } else {
          // Format objet
          for (const [fileId, file] of Object.entries(files)) {
            if (file.sys_path && file.sys_path.startsWith(oldBasePath)) {
              file.sys_path = file.sys_path.replace(oldBasePath, newBasePath);
            }
          }
        }
      }
    }
    
    // Mettre à jour tous les chemins imbriqués dans ce classeur
    updateNestedPaths(current.folders, current.files, oldPath, targetPath);
    
    // Déplacer dans la DB : de archives vers mes_classeurs
    db.mes_classeurs = db.mes_classeurs || {};
    db.mes_classeurs[idKey] = current;
    delete db.archives.classeurs[idKey];
    
    await writeDb(db);
    return { id: idKey, ...current };
  });

  ipcMain.handle('archives:createFolder', async (_event, folderName, parentFolderId = null) => {
    if (!folderName) throw new Error('Nom de dossier manquant');
    const db = await readDb();
    const rootPath = db.settings && db.settings.rootPath ? db.settings.rootPath : getDefaultRootPath();
    
    db.archives = db.archives || { folders: {}, classeurs: {} };
    db.nextId = db.nextId || { classeurs: 1, dossiers: 1, fichiers: 1, archiveFolders: 1 };
    
    const folderId = `archive_folder_${db.nextId.archiveFolders++}`;
    
    let folderPath;
    let parentPath = '';
    if (parentFolderId && db.archives.folders[parentFolderId]) {
      folderPath = path.join(db.archives.folders[parentFolderId].sys_path, folderName);
      parentPath = db.archives.folders[parentFolderId].app_path;
    } else {
      folderPath = path.join(rootPath, 'archives', folderName);
    }
    
    // Créer le dossier physique
    await fsp.mkdir(folderPath, { recursive: true });
    
    const newFolder = {
      id: folderId,
      name: folderName,
      sys_path: folderPath,
      app_path: parentPath ? `${parentPath}/${folderName}` : `/archives/${folderName}`,
      parentId: parentFolderId || null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    db.archives.folders[folderId] = newFolder;
    await writeDb(db);
    return newFolder;
  });

  ipcMain.handle('archives:delete', async (_event, idKey) => {
    if (!idKey) throw new Error('Id manquant');
    const db = await readDb();
    const current = db.archives?.classeurs?.[idKey];
    if (!current) throw new Error('Classeur archivé introuvable');

    // Supprimer le dossier physique
    await fsp.rmdir(current.sys_path, { recursive: true });

    // Supprimer de la DB
    delete db.archives.classeurs[idKey];
    await writeDb(db);
    return true;
  });

  ipcMain.handle('archives:listFolders', async () => {
    const db = await readDb();
    const folders = Object.entries(db.archives?.folders || {});
    return folders.map(([key, value]) => ({ id: key, ...value }));
  });

  ipcMain.handle('archives:deleteFolder', async (_event, folderId) => {
    if (!folderId) throw new Error('Id du dossier manquant');
    const db = await readDb();
    const folder = db.archives?.folders?.[folderId];
    if (!folder) throw new Error('Dossier d\'archive introuvable');

    // Supprimer le dossier physique (récursivement)
    await fsp.rmdir(folder.sys_path, { recursive: true });

    // Supprimer de la DB (et tous les sous-dossiers)
    delete db.archives.folders[folderId];
    
    // Supprimer aussi tous les sous-dossiers qui ont ce dossier comme parent
    for (const [key, subFolder] of Object.entries(db.archives.folders || {})) {
      if (subFolder.parentId === folderId) {
        delete db.archives.folders[key];
      }
    }

    await writeDb(db);
    return true;
  });

  ipcMain.handle('archives:renameFolder', async (_event, folderId, newName) => {
    if (!folderId || !newName) throw new Error('Paramètres manquants');
    const db = await readDb();
    const folder = db.archives?.folders?.[folderId];
    if (!folder) throw new Error('Dossier d\'archive introuvable');

    const oldPath = folder.sys_path;
    const newPath = path.join(path.dirname(oldPath), newName);

    // Renommer le dossier physique
    await fsp.rename(oldPath, newPath);

    // Mettre à jour la DB
    folder.name = newName;
    folder.sys_path = newPath;
    folder.app_path = folder.parentId 
      ? `${db.archives.folders[folder.parentId].app_path}/${newName}`
      : `/archives/${newName}`;
    folder.updatedAt = Date.now();

    await writeDb(db);
    return folder;
  });

  ipcMain.handle('archives:updateClasseur', async (_event, classeurId, updates) => {
    if (!classeurId) throw new Error('Id du classeur manquant');
    const db = await readDb();
    const classeur = db.archives?.classeurs?.[classeurId];
    if (!classeur) throw new Error('Classeur archivé introuvable');

    // Mettre à jour les propriétés
    Object.assign(classeur, updates);
    classeur.updatedAt = Date.now();

    await writeDb(db);
    return classeur;
  });

  ipcMain.handle('archives:moveClasseur', async (_event, classeurId, targetFolderId = null) => {
    if (!classeurId) throw new Error('Id du classeur manquant');
    const db = await readDb();
    const classeur = db.archives?.classeurs?.[classeurId];
    if (!classeur) throw new Error('Classeur archivé introuvable');
    const rootPath = db.settings && db.settings.rootPath ? db.settings.rootPath : getDefaultRootPath();
    
    let newPath;
    let newAppPath;
    
    if (targetFolderId && targetFolderId !== 'root' && db.archives.folders[targetFolderId]) {
      // Déplacer dans un dossier spécifique
      const targetFolder = db.archives.folders[targetFolderId];
      newPath = path.join(targetFolder.sys_path, classeur.name);
      newAppPath = `${targetFolder.app_path}/${classeur.name}`;
    } else {
      // Déplacer à la racine des archives
      newPath = path.join(rootPath, 'archives', classeur.name);
      newAppPath = `/archives/${classeur.name}`;
      targetFolderId = null; // Assurer que c'est null pour la racine
    }

    // Sauvegarder l'ancien chemin pour mise à jour des références
    const oldPath = classeur.sys_path;

    // Déplacer le dossier physique
    await fsp.rename(classeur.sys_path, newPath);

    // Mettre à jour les chemins du classeur
    classeur.sys_path = newPath;
    classeur.app_path = newAppPath;
    classeur.archiveFolderId = targetFolderId;
    classeur.updatedAt = Date.now();

    // Fonction récursive pour mettre à jour les chemins des dossiers et fichiers imbriqués
    function updateNestedPaths(folders, files, oldBasePath, newBasePath) {
      // Mettre à jour les dossiers
      if (folders) {
        for (const [folderId, folder] of Object.entries(folders)) {
          if (folder.sys_path && folder.sys_path.startsWith(oldBasePath)) {
            folder.sys_path = folder.sys_path.replace(oldBasePath, newBasePath);
            
            // Récursivement mettre à jour les sous-dossiers et fichiers
            updateNestedPaths(folder.folders, folder.files, oldBasePath, newBasePath);
          }
        }
      }
      
      // Mettre à jour les fichiers
      if (files) {
        if (Array.isArray(files)) {
          // Format tableau
          for (const file of files) {
            if (file.sys_path && file.sys_path.startsWith(oldBasePath)) {
              file.sys_path = file.sys_path.replace(oldBasePath, newBasePath);
            }
          }
        } else {
          // Format objet
          for (const [fileId, file] of Object.entries(files)) {
            if (file.sys_path && file.sys_path.startsWith(oldBasePath)) {
              file.sys_path = file.sys_path.replace(oldBasePath, newBasePath);
            }
          }
        }
      }
    }
    
    // Mettre à jour tous les chemins imbriqués dans ce classeur
    updateNestedPaths(classeur.folders, classeur.files, oldPath, newPath);

    await writeDb(db);
    return classeur;
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

  // Désactiver complètement la CSP pour permettre les CDN externes
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    // Supprimer complètement tous les headers CSP
    const responseHeaders = { ...details.responseHeaders };
    delete responseHeaders['content-security-policy'];
    delete responseHeaders['Content-Security-Policy'];
    delete responseHeaders['content-security-policy-report-only'];
    delete responseHeaders['Content-Security-Policy-Report-Only'];
    
    callback({ responseHeaders });
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
