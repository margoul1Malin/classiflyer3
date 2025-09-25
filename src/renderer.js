/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';

function selectView(viewId) {
  const allViews = document.querySelectorAll('.view');
  for (const view of allViews) {
    if (view.id === viewId) {
      view.classList.add('is-visible');
    } else {
      view.classList.remove('is-visible');
    }
  }
}

function updateActiveNav(targetButton) {
  const buttons = document.querySelectorAll('.nav-item');
  for (const button of buttons) {
    if (button === targetButton) {
      button.classList.add('is-active');
    } else {
      button.classList.remove('is-active');
    }
  }
}

function setupNavigation() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  nav.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains('nav-item')) return;
    const viewId = target.getAttribute('data-view');
    if (!viewId) return;
    selectView(viewId);
    updateActiveNav(target);
    history.replaceState({}, '', `#${viewId}`);
  });
}

function bootFromHash() {
  const hash = window.location.hash.replace('#', '');
  if (!hash) return;
  const button = document.querySelector(`.nav-item[data-view="${hash}"]`);
  if (button instanceof HTMLElement) {
    button.click();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  bootFromHash();
  initSettingsView();
  initClasseursView();
});

function initSettingsView() {
  const input = document.getElementById('input-root-path');
  const browseBtn = document.getElementById('btn-browse-root');
  const saveBtn = document.getElementById('btn-save-settings');
  if (!(input instanceof HTMLInputElement) || !(browseBtn instanceof HTMLElement) || !(saveBtn instanceof HTMLElement)) {
    return;
  }
  // Load current config
  if (window.classiflyer && typeof window.classiflyer.getConfig === 'function') {
    window.classiflyer.getConfig().then((cfg) => {
      if (cfg && cfg.rootPath) {
        input.value = cfg.rootPath;
      }
    }).catch(() => {});
  }

  browseBtn.addEventListener('click', async () => {
    if (!window.classiflyer || typeof window.classiflyer.chooseDirectory !== 'function') return;
    const dir = await window.classiflyer.chooseDirectory();
    if (typeof dir === 'string' && dir.length > 0) {
      input.value = dir;
    }
  });

  saveBtn.addEventListener('click', async () => {
    const newPath = input.value.trim();
    if (!newPath) return;
    if (!window.classiflyer || typeof window.classiflyer.setRootPath !== 'function') return;
    try {
      const res = await window.classiflyer.setRootPath(newPath);
      // Optionally provide lightweight feedback
      saveBtn.textContent = 'Enregistré';
      setTimeout(() => { saveBtn.textContent = 'Enregistrer'; }, 1200);
    } catch (e) {
      saveBtn.textContent = 'Erreur';
      setTimeout(() => { saveBtn.textContent = 'Enregistrer'; }, 1200);
    }
  });
}

// Mes Classeurs
function initClasseursView() {
  const grid = document.getElementById('classeurs-grid');
  const btnCreate = document.getElementById('btn-create-classeur');
  const searchInput = document.getElementById('search-classeurs');
  if (!grid || !btnCreate) return;

  async function refresh() {
    if (!window.classiflyer || typeof window.classiflyer.listClasseurs !== 'function') return;
    const list = await window.classiflyer.listClasseurs();
    const q = (searchInput instanceof HTMLInputElement ? searchInput.value.trim().toLowerCase() : '');
    const filtered = q ? list.filter((c) => (c.name || '').toLowerCase().includes(q)) : list;
    renderClasseurs(grid, filtered);
  }

  btnCreate.addEventListener('click', () => openCreateModal(refresh));

  if (searchInput instanceof HTMLInputElement) {
    searchInput.addEventListener('input', refresh);
  }

  refresh();
}

function renderClasseurs(container, classeurs) {
  container.innerHTML = '';
  for (const item of classeurs) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.background = item.primaryColor || '#ffffff';
    card.style.borderRight = `8px solid ${item.secondaryColor || '#000000'}`;

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = item.name;
    // Force text color on title to ensure no CSS override
    title.style.color = item.tertiaryColor || '#0b1220';

    const menuBtn = document.createElement('button');
    menuBtn.className = 'btn card-menu-btn';
    menuBtn.textContent = '⋯';

    const menu = document.createElement('div');
    menu.className = 'menu';

    const editItem = document.createElement('div');
    editItem.className = 'menu-item';
    editItem.textContent = 'Modifier';
    editItem.addEventListener('click', async (e) => {
      e.stopPropagation();
      openEditModal(item, async () => {
        const l = await window.classiflyer.listClasseurs();
        renderClasseurs(container, l);
      });
      menu.classList.remove('is-open');
    });

    const deleteItem = document.createElement('div');
    deleteItem.className = 'menu-item';
    deleteItem.textContent = 'Supprimer';
    deleteItem.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Supprimer ce classeur ?')) {
        await window.classiflyer.deleteClasseur(item.id);
        await window.classiflyer.listClasseurs().then((l) => renderClasseurs(container, l));
      }
      menu.classList.remove('is-open');
    });

    const archiveItem = document.createElement('div');
    archiveItem.className = 'menu-item';
    archiveItem.textContent = 'Archiver';
    archiveItem.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.classiflyer.archiveClasseur(item.id);
      await window.classiflyer.listClasseurs().then((l) => renderClasseurs(container, l));
      menu.classList.remove('is-open');
    });

    menu.appendChild(editItem);
    menu.appendChild(deleteItem);
    menu.appendChild(archiveItem);

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.contains('is-open');
      document.querySelectorAll('.menu.is-open').forEach((el) => el.classList.remove('is-open'));
      if (!isOpen) menu.classList.add('is-open');
    });

    document.addEventListener('click', () => menu.classList.remove('is-open'));

    card.appendChild(title);
    card.appendChild(menuBtn);
    card.appendChild(menu);

    // Click to open classeur page
    card.addEventListener('click', () => openClasseurView(item.id));

    container.appendChild(card);
  }
}

function openCreateModal(onCreated) {
  const modal = document.getElementById('modal-create');
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'false');

  const nameInput = document.getElementById('classeur-name');
  const primaryInput = document.getElementById('classeur-primary');
  const secondaryInput = document.getElementById('classeur-secondary');
  const tertiaryInput = document.getElementById('classeur-tertiary');
  const confirmBtn = document.getElementById('confirm-create-classeur');
  const closeEls = modal.querySelectorAll('[data-modal-close]');

  const close = () => modal.setAttribute('aria-hidden', 'true');
  closeEls.forEach((el) => el.addEventListener('click', close, { once: true }));
  modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); }, { once: true });

  // Live preview
  const preview = document.getElementById('preview-classeur');
  function updatePreview() {
    const title = preview.querySelector('.card-title');
    if (nameInput instanceof HTMLInputElement && title) title.textContent = nameInput.value || 'Aperçu';
    const pc = primaryInput instanceof HTMLInputElement ? primaryInput.value : '#0ea5e9';
    const sc = secondaryInput instanceof HTMLInputElement ? secondaryInput.value : '#38bdf8';
    const tc = tertiaryInput instanceof HTMLInputElement ? tertiaryInput.value : '#0b1220';
    preview.style.background = pc;
    preview.style.borderRight = `8px solid ${sc}`;
    preview.style.color = tc;
  }
  [nameInput, primaryInput, secondaryInput, tertiaryInput].forEach((el) => {
    if (el) el.addEventListener('input', updatePreview);
    if (el) el.addEventListener('change', updatePreview);
  });
  updatePreview();

  confirmBtn.addEventListener('click', async () => {
    const name = (nameInput instanceof HTMLInputElement ? nameInput.value.trim() : '');
    const primaryColor = (primaryInput instanceof HTMLInputElement ? primaryInput.value : '#0ea5e9');
    const secondaryColor = (secondaryInput instanceof HTMLInputElement ? secondaryInput.value : '#38bdf8');
    const tertiaryColor = (tertiaryInput instanceof HTMLInputElement ? tertiaryInput.value : '#0b1220');
    if (!name) return;
    await window.classiflyer.createClasseur({ name, primaryColor, secondaryColor, tertiaryColor });
    close();
    if (typeof onCreated === 'function') await onCreated();
  }, { once: true });
}

function openEditModal(classeur, onSaved) {
  const modal = document.getElementById('modal-edit');
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'false');

  const nameInput = document.getElementById('edit-name');
  const primaryInput = document.getElementById('edit-primary');
  const secondaryInput = document.getElementById('edit-secondary');
  const tertiaryInput = document.getElementById('edit-tertiary');
  const confirmBtn = document.getElementById('confirm-edit-classeur');
  const closeEls = modal.querySelectorAll('[data-modal-close]');

  if (nameInput instanceof HTMLInputElement) nameInput.value = classeur.name || '';
  if (primaryInput instanceof HTMLInputElement) primaryInput.value = classeur.primaryColor || '#0ea5e9';
  if (secondaryInput instanceof HTMLInputElement) secondaryInput.value = classeur.secondaryColor || '#38bdf8';
  if (tertiaryInput instanceof HTMLInputElement) tertiaryInput.value = classeur.tertiaryColor || '#0b1220';

  const preview = document.getElementById('preview-edit');
  function updatePreview() {
    const title = preview.querySelector('.card-title');
    if (nameInput instanceof HTMLInputElement && title) title.textContent = nameInput.value || 'Aperçu';
    const pc = primaryInput instanceof HTMLInputElement ? primaryInput.value : '#0ea5e9';
    const sc = secondaryInput instanceof HTMLInputElement ? secondaryInput.value : '#38bdf8';
    const tc = tertiaryInput instanceof HTMLInputElement ? tertiaryInput.value : '#0b1220';
    preview.style.background = pc;
    preview.style.borderRight = `8px solid ${sc}`;
    preview.style.color = tc;
  }
  [nameInput, primaryInput, secondaryInput, tertiaryInput].forEach((el) => {
    if (el) el.addEventListener('input', updatePreview);
    if (el) el.addEventListener('change', updatePreview);
  });
  updatePreview();

  const close = () => modal.setAttribute('aria-hidden', 'true');
  closeEls.forEach((el) => el.addEventListener('click', close, { once: true }));
  modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); }, { once: true });

  confirmBtn.addEventListener('click', async () => {
    const name = (nameInput instanceof HTMLInputElement ? nameInput.value.trim() : '');
    const primaryColor = (primaryInput instanceof HTMLInputElement ? primaryInput.value : '#0ea5e9');
    const secondaryColor = (secondaryInput instanceof HTMLInputElement ? secondaryInput.value : '#38bdf8');
    const tertiaryColor = (tertiaryInput instanceof HTMLInputElement ? tertiaryInput.value : '#0b1220');
    if (!name) return;
    await window.classiflyer.updateClasseur(classeur.id, { name, primaryColor, secondaryColor, tertiaryColor });
    close();
    if (typeof onSaved === 'function') await onSaved();
  }, { once: true });
}

// Classeur view
let currentClasseurId = null;
let currentFileList = [];
let currentFileIndex = -1;

async function openClasseurView(id) {
  currentClasseurId = id;
  selectView('view-classeur');
  const data = await window.classiflyer.getClasseur(id);
  renderClasseurTree(data);
  const allFiles = collectAllFiles(data);
  currentFileList = allFiles;
  if (allFiles.length > 0) {
    currentFileIndex = 0;
    await renderViewer(allFiles[0]);
  } else {
    currentFileIndex = -1;
    await renderViewer(null);
  }
  setupViewerNav();
  setupClasseurActions();
}

function collectAllFiles(classeur) {
  const files = [];
  // root files array (if any)
  if (Array.isArray(classeur.files)) {
    for (const f of classeur.files) files.push(f);
  }
  // folders first-level only for now
  if (classeur.folders) {
    for (const [fid, folder] of Object.entries(classeur.folders)) {
      if (folder.files) {
        for (const [id, f] of Object.entries(folder.files)) {
          files.push({ ...f, id });
        }
      }
    }
  }
  return files;
}

function renderClasseurTree(classeur) {
  const tree = document.getElementById('classeur-tree');
  if (!tree) return;
  tree.innerHTML = '';

  const rootLabel = document.createElement('div');
  rootLabel.className = 'node is-selected';
  rootLabel.textContent = classeur.name || 'Classeur';
  tree.appendChild(rootLabel);

  // Root files
  if (Array.isArray(classeur.files)) {
    for (const f of classeur.files) {
      const fnode = document.createElement('div');
      fnode.className = 'node';
      fnode.style.paddingLeft = '22px';
      fnode.textContent = `📄 ${f.name}`;
      fnode.addEventListener('click', async () => {
        const idx = currentFileList.findIndex((x) => x.sys_path === f.sys_path);
        if (idx >= 0) {
          currentFileIndex = idx;
          await renderViewer(currentFileList[currentFileIndex]);
          highlightSelected(tree, f.sys_path);
        }
      });
      tree.appendChild(fnode);
    }
  }

  if (classeur.folders) {
    for (const [folderId, folder] of Object.entries(classeur.folders)) {
      const folderContainer = document.createElement('div');
      folderContainer.className = 'folder-container';
      
      const folderNode = document.createElement('div');
      folderNode.className = 'node folder-node';
      folderNode.innerHTML = `
        <span>📁 ${folder.name}</span>
        <div class="folder-actions">
          <button class="btn-icon" title="Uploader fichier" data-action="upload" data-folder-id="${folderId}">+</button>
          <button class="btn-icon" title="Modifier" data-action="edit" data-folder-id="${folderId}">⋯</button>
          <button class="btn-icon" title="Supprimer" data-action="delete" data-folder-id="${folderId}">🗑</button>
        </div>
      `;
      
      // Handle folder actions
      folderNode.addEventListener('click', (e) => {
        if (e.target.matches('[data-action]')) {
          e.stopPropagation();
          const action = e.target.getAttribute('data-action');
          const folderId = e.target.getAttribute('data-folder-id');
          handleFolderAction(action, folderId, folder);
        }
      });
      
      folderContainer.appendChild(folderNode);
      tree.appendChild(folderContainer);

      if (folder.files) {
        for (const [fileId, f] of Object.entries(folder.files)) {
          const fnode = document.createElement('div');
          fnode.className = 'node';
          fnode.style.paddingLeft = '22px';
          fnode.textContent = `📄 ${f.name}`;
          fnode.addEventListener('click', async () => {
            const idx = currentFileList.findIndex((x) => x.sys_path === f.sys_path);
            if (idx >= 0) {
              currentFileIndex = idx;
              await renderViewer(currentFileList[currentFileIndex]);
              highlightSelected(tree, f.sys_path);
            }
          });
          folderContainer.appendChild(fnode);
        }
      }
    }
  }
}

function highlightSelected(tree, sysPath) {
  const nodes = tree.querySelectorAll('.node');
  nodes.forEach((n) => n.classList.remove('is-selected'));
  const match = Array.from(nodes).find((n) => n.textContent && n.textContent.includes(sysPath));
  if (match) match.classList.add('is-selected');
}

function setupViewerNav() {
  const prev = document.getElementById('viewer-prev');
  const next = document.getElementById('viewer-next');
  if (prev) prev.onclick = async () => {
    if (currentFileIndex > 0) {
      currentFileIndex -= 1;
      await renderViewer(currentFileList[currentFileIndex]);
    }
  };
  if (next) next.onclick = async () => {
    if (currentFileIndex < currentFileList.length - 1) {
      currentFileIndex += 1;
      await renderViewer(currentFileList[currentFileIndex]);
    }
  };
}

function setupClasseurActions() {
  const btnCreateFolder = document.getElementById('btn-create-folder');
  const btnUploadRoot = document.getElementById('btn-upload-root');

  if (btnCreateFolder) {
    btnCreateFolder.addEventListener('click', () => openCreateFolderModal());
  }

  if (btnUploadRoot) {
    btnUploadRoot.addEventListener('click', async () => {
      if (!currentClasseurId) return;
      await uploadFilesToFolder(null);
    });
  }
}

function openCreateFolderModal() {
  const modal = document.getElementById('modal-create-folder');
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'false');

  const nameInput = document.getElementById('folder-name');
  const confirmBtn = document.getElementById('confirm-create-folder');
  const closeEls = modal.querySelectorAll('[data-modal-close]');

  const close = () => modal.setAttribute('aria-hidden', 'true');
  closeEls.forEach((el) => el.addEventListener('click', close, { once: true }));
  modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); }, { once: true });

  confirmBtn.addEventListener('click', async () => {
    const folderName = (nameInput instanceof HTMLInputElement ? nameInput.value.trim() : '');
    if (!folderName || !currentClasseurId) return;
    try {
      await window.classiflyer.createFolder(currentClasseurId, folderName);
      // Refresh the classeur view
      const data = await window.classiflyer.getClasseur(currentClasseurId);
      renderClasseurTree(data);
      close();
    } catch (e) {
      alert('Erreur lors de la création du dossier: ' + e.message);
    }
  }, { once: true });
}

async function uploadFilesToFolder(folderId) {
  try {
    const files = await window.classiflyer.chooseFiles();
    if (files && files.length > 0) {
      await window.classiflyer.uploadFiles(currentClasseurId, folderId, files);
      // Refresh the classeur view
      await refreshClasseurView();
    }
  } catch (e) {
    alert('Erreur lors de l\'upload: ' + e.message);
  }
}

async function refreshClasseurView() {
  const data = await window.classiflyer.getClasseur(currentClasseurId);
  renderClasseurTree(data);
  const allFiles = collectAllFiles(data);
  currentFileList = allFiles;
  if (allFiles.length > 0) {
    currentFileIndex = 0;
    await renderViewer(allFiles[0]);
  }
}

async function handleFolderAction(action, folderId, folder) {
  switch (action) {
    case 'upload':
      await uploadFilesToFolder(folderId);
      break;
    case 'edit':
      openRenameFolderModal(folderId, folder.name);
      break;
    case 'delete':
      if (confirm(`Supprimer le dossier "${folder.name}" et tout son contenu ?`)) {
        try {
          await window.classiflyer.deleteFolder(currentClasseurId, folderId);
          await refreshClasseurView();
        } catch (e) {
          alert('Erreur lors de la suppression: ' + e.message);
        }
      }
      break;
  }
}

function openRenameFolderModal(folderId, currentName) {
  const modal = document.getElementById('modal-rename-folder');
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'false');

  const nameInput = document.getElementById('rename-folder-name');
  const confirmBtn = document.getElementById('confirm-rename-folder');
  const closeEls = modal.querySelectorAll('[data-modal-close]');

  if (nameInput instanceof HTMLInputElement) nameInput.value = currentName;

  const close = () => modal.setAttribute('aria-hidden', 'true');
  closeEls.forEach((el) => el.addEventListener('click', close, { once: true }));
  modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); }, { once: true });

  confirmBtn.addEventListener('click', async () => {
    const newName = (nameInput instanceof HTMLInputElement ? nameInput.value.trim() : '');
    if (!newName || newName === currentName) return;
    try {
      await window.classiflyer.updateFolder(currentClasseurId, folderId, { name: newName });
      await refreshClasseurView();
      close();
    } catch (e) {
      alert('Erreur lors de la modification: ' + e.message);
    }
  }, { once: true });
}

// PDF viewer state
let pdfDoc = null;
let currentPdfPage = 1;
let totalPdfPages = 1;

async function renderViewer(file) {
  const canvas = document.getElementById('viewer-canvas');
  const title = document.getElementById('viewer-title');
  const pdfNav = document.getElementById('viewer-pdf-nav');
  if (!canvas || !title) return;
  
  canvas.innerHTML = '';
  pdfNav.style.display = 'none';
  
  // Masquer les contrôles de zoom par défaut
  const zoomControls = document.getElementById('zoom-controls');
  if (zoomControls) zoomControls.style.display = 'none';
  
  if (!file) {
    title.textContent = 'Aucun fichier';
    return;
  }
  
  title.textContent = file.name || 'Fichier';
  const mime = (file.mime || '').toLowerCase();
  const filePath = file.sys_path;
  
  const lowerPath = (filePath || '').toLowerCase();
  const isImageByExt = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/.test(lowerPath);
  const isPdfByExt = /\.pdf$/.test(lowerPath);
  const isExcelByExt = /\.(xlsx?|xls)$/.test(lowerPath);
  
  if (mime.startsWith('image/') || isImageByExt) {
    await renderImage(filePath, canvas);
  } else if (mime === 'application/pdf' || isPdfByExt) {
    await renderPDF(filePath, canvas, pdfNav);
  } else if (mime.includes('excel') || isExcelByExt || mime.includes('spreadsheet')) {
    await renderExcel(filePath, canvas);
  } else {
    const hint = document.createElement('div');
    hint.textContent = 'Aperçu non supporté. Télécharger / ouvrir avec application externe.';
    canvas.appendChild(hint);
  }
}

async function renderImage(filePath, canvas) {
  try {
    const img = document.createElement('img');
    const dataUrl = await window.classiflyer.fileToDataUrl(filePath);
    img.src = dataUrl;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';
    img.style.transition = 'transform 0.2s ease';
    img.style.cursor = 'grab';
    
    let currentZoom = 1;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let startX, startY;
    
    // Fonction pour mettre à jour le zoom et la position
    const updateTransform = () => {
      img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentZoom})`;
      document.getElementById('zoom-level').textContent = `${Math.round(currentZoom * 100)}%`;
    };
    
    // Fonction pour mettre à jour le zoom
    const updateZoom = (zoom) => {
      currentZoom = zoom;
      updateTransform();
    };
    
    // Afficher les contrôles de zoom
    const zoomControls = document.getElementById('zoom-controls');
    zoomControls.style.display = 'flex';
    
    // Bouton zoom +
    document.getElementById('zoom-in').onclick = () => {
      updateZoom(Math.min(currentZoom * 1.2, 5));
    };
    
    // Bouton zoom -
    document.getElementById('zoom-out').onclick = () => {
      updateZoom(Math.max(currentZoom / 1.2, 0.2));
    };
    
    // Bouton reset
    document.getElementById('zoom-reset').onclick = () => {
      currentZoom = 1;
      translateX = 0;
      translateY = 0;
      updateTransform();
    };
    
    // Gestion du drag & drop
    img.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX - translateX;
      startY = e.clientY - translateY;
      img.style.cursor = 'grabbing';
      img.style.transition = 'none'; // Désactiver la transition pendant le drag
    });
    
    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        updateTransform();
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        img.style.cursor = 'grab';
        img.style.transition = 'transform 0.2s ease'; // Remettre la transition
      }
    });
    
    // Zoom avec la molette (optionnel)
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      updateZoom(Math.min(Math.max(currentZoom * delta, 0.2), 5));
    });
    
    canvas.appendChild(img);
    
    // Initialiser l'affichage du zoom
    updateZoom(1);
    
    // Mettre en surbrillance le fichier actuel dans la sidebar
    highlightCurrentFile(filePath);
    
  } catch (error) {
    console.error('Erreur lors du chargement de l\'image:', error);
    const hint = document.createElement('div');
    hint.textContent = 'Erreur lors du chargement de l\'image.';
    canvas.appendChild(hint);
  }
}

async function renderPDF(filePath, canvas, pdfNav) {
  try {
    // Charger PDF.js via CDN pour éviter les problèmes Webpack
    if (!window.pdfjsLib) {
      await loadPdfJs();
    }

    // Charger le PDF en mémoire
    const dataUrl = await window.classiflyer.fileToDataUrl(filePath);
    const response = await fetch(dataUrl);
    const arrayBuffer = await response.arrayBuffer();

    // Préparer l'affichage
    canvas.innerHTML = '';
    pdfNav.style.display = 'flex';

    // Créer un canvas pour le rendu
    const pdfCanvas = document.createElement('canvas');
    pdfCanvas.style.maxWidth = '100%';
    pdfCanvas.style.maxHeight = '100%';
    pdfCanvas.style.display = 'block';
    pdfCanvas.style.margin = '0 auto';
    pdfCanvas.style.border = '1px solid #ddd';
    canvas.appendChild(pdfCanvas);

    // Charger le document avec PDF.js
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
    pdfDoc = await loadingTask.promise;
    totalPdfPages = pdfDoc.numPages;
    currentPdfPage = 1;

    // Mettre à jour l'info de page et afficher la première page
    updatePdfPageInfo();
    await renderCurrentPdfPage(pdfCanvas);
    
    // Afficher les contrôles de zoom pour PDF
    const zoomControls = document.getElementById('zoom-controls');
    zoomControls.style.display = 'flex';
    
    let currentZoom = 1.5; // Zoom initial du PDF
    
    // Fonction pour mettre à jour le zoom PDF
    const updatePdfZoom = async (zoom) => {
      currentZoom = zoom;
      document.getElementById('zoom-level').textContent = `${Math.round((zoom / 1.5) * 100)}%`;
      await renderCurrentPdfPage(pdfCanvas, zoom);
    };
    
    // Boutons de zoom PDF
    document.getElementById('zoom-in').onclick = async () => {
      await updatePdfZoom(Math.min(currentZoom * 1.2, 7.5));
    };
    
    document.getElementById('zoom-out').onclick = async () => {
      await updatePdfZoom(Math.max(currentZoom / 1.2, 0.5));
    };
    
    document.getElementById('zoom-reset').onclick = async () => {
      await updatePdfZoom(1.5);
    };
    
    // Initialiser l'affichage du zoom PDF
    updatePdfZoom(1.5);
    
    // Mettre en surbrillance le fichier actuel dans la sidebar
    highlightCurrentFile(filePath);

    // Configuration des boutons de navigation
    const prevBtn = document.getElementById('pdf-prev');
    const nextBtn = document.getElementById('pdf-next');
    
    if (prevBtn) {
      prevBtn.onclick = async () => {
        if (currentPdfPage > 1) {
          currentPdfPage--;
          await renderCurrentPdfPage(pdfCanvas);
          updatePdfPageInfo();
        }
      };
    }
    
    if (nextBtn) {
      nextBtn.onclick = async () => {
        if (currentPdfPage < totalPdfPages) {
          currentPdfPage++;
          await renderCurrentPdfPage(pdfCanvas);
          updatePdfPageInfo();
        }
      };
    }

  } catch (error) {
    console.error('PDF rendering error:', error);
    canvas.innerHTML = '';
    const hint = document.createElement('div');
    hint.style.textAlign = 'center';
    hint.style.padding = '20px';
    hint.textContent = 'Erreur lors du chargement du PDF.';
    canvas.appendChild(hint);
  }
}

// Charger PDF.js depuis CDN
async function loadPdfJs() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      // Configuration du worker
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Rendu de la page PDF actuelle
async function renderCurrentPdfPage(canvas, scale = 1.5) {
  if (!pdfDoc || !canvas) return;

  const page = await pdfDoc.getPage(currentPdfPage);
  const viewport = page.getViewport({ scale: scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');
  const renderContext = {
    canvasContext: context,
    viewport: viewport
  };

  await page.render(renderContext).promise;
}

function updatePdfPageInfo() {
  const pageInfo = document.getElementById('pdf-page-info');
  if (pageInfo) {
    pageInfo.textContent = `${currentPdfPage}/${totalPdfPages}`;
  }
}

// Fonction pour mettre en surbrillance le fichier actuel dans la sidebar
function highlightCurrentFile(filePath) {
  // Supprimer toutes les surbrillances existantes
  const allNodes = document.querySelectorAll('.tree .node');
  allNodes.forEach(node => node.classList.remove('is-selected'));
  
  // Extraire le nom du fichier du chemin complet
  const fileName = filePath.split(/[/\\]/).pop();
  
  // Trouver et surbriller le fichier actuel
  allNodes.forEach(node => {
    const text = node.textContent;
    // Vérifier si le nom du fichier est dans le texte du nœud
    if (text.includes(fileName) && text.includes('📄')) {
      node.classList.add('is-selected');
      // Faire défiler pour voir l'élément sélectionné
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}


async function renderExcel(filePath, canvas) {
  try {
    // Import dynamique de xlsx
    const XLSX = await import('xlsx');
    
    // Lire le fichier via le processus principal
    const dataUrl = await window.classiflyer.fileToDataUrl(filePath);
    const response = await fetch(dataUrl);
    const arrayBuffer = await response.arrayBuffer();
    
    // Parser le fichier Excel
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convertir en HTML
    const html = XLSX.utils.sheet_to_html(worksheet);
    
    // Afficher le tableau
    canvas.innerHTML = html;
    
    // Afficher les contrôles de zoom pour Excel
    const zoomControls = document.getElementById('zoom-controls');
    zoomControls.style.display = 'flex';
    
    let currentZoom = 1;
    
    // Fonction pour mettre à jour le zoom Excel
    const updateExcelZoom = (zoom) => {
      currentZoom = zoom;
      const table = canvas.querySelector('table');
      if (table) {
        table.style.transform = `scale(${zoom})`;
        table.style.transformOrigin = 'top left';
      }
      document.getElementById('zoom-level').textContent = `${Math.round(zoom * 100)}%`;
    };
    
    // Boutons de zoom Excel
    document.getElementById('zoom-in').onclick = () => {
      updateExcelZoom(Math.min(currentZoom * 1.2, 3));
    };
    
    document.getElementById('zoom-out').onclick = () => {
      updateExcelZoom(Math.max(currentZoom / 1.2, 0.3));
    };
    
    document.getElementById('zoom-reset').onclick = () => {
      updateExcelZoom(1);
    };
    
    // Initialiser l'affichage du zoom Excel
    updateExcelZoom(1);
    
    // Mettre en surbrillance le fichier actuel dans la sidebar
    highlightCurrentFile(filePath);
    
  } catch (error) {
    console.error('Excel rendering error:', error);
    const hint = document.createElement('div');
    hint.textContent = 'Erreur lors du chargement du fichier Excel.';
    canvas.appendChild(hint);
  }
}