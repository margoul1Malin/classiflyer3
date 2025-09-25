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
  initArchivesView();
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

    // Compter les fichiers et dossiers
    const fileCount = countClasseurContent(item);
    const counter = document.createElement('div');
    counter.className = 'classeur-counter';
    counter.textContent = `${fileCount.files} fichier${fileCount.files > 1 ? 's' : ''}, ${fileCount.folders} dossier${fileCount.folders > 1 ? 's' : ''}`;
    counter.style.color = item.tertiaryColor || '#0b1220';
    counter.style.fontSize = '12px';
    counter.style.position = 'absolute';
    counter.style.bottom = '8px';
    counter.style.left = '8px';
    counter.style.opacity = '0.8';

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
      menu.classList.remove('is-open');
      await showArchiveDestinationModal(item.id, container);
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
    card.appendChild(counter);
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
      // Désactiver complètement le worker pour éviter les erreurs CSP
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = false;
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

// Fonction pour compter les fichiers et dossiers dans un classeur
function countClasseurContent(classeur) {
  let fileCount = 0;
  let folderCount = 0;
  
  // Compter les fichiers à la racine
  if (Array.isArray(classeur.files)) {
    fileCount += classeur.files.length;
  }
  
  // Compter les dossiers et leurs fichiers
  if (classeur.folders && typeof classeur.folders === 'object') {
    folderCount = Object.keys(classeur.folders).length;
    
    // Compter les fichiers dans chaque dossier (récursif)
    Object.values(classeur.folders).forEach(folder => {
      fileCount += countFolderFiles(folder);
    });
  }
  
  return { files: fileCount, folders: folderCount };
}

// Fonction récursive pour compter les fichiers dans un dossier
function countFolderFiles(folder) {
  let count = 0;
  
  // Compter les fichiers dans ce dossier
  if (folder.files && typeof folder.files === 'object') {
    count += Object.keys(folder.files).length;
  }
  
  // Compter récursivement dans les sous-dossiers
  if (folder.folders && typeof folder.folders === 'object') {
    Object.values(folder.folders).forEach(subFolder => {
      count += countFolderFiles(subFolder);
    });
  }
  
  return count;
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

// ===== ARCHIVES =====

function initArchivesView() {
  const view = document.getElementById('view-archives');
  if (!view) return;

  // Bouton pour créer un dossier d'archive
  const createFolderBtn = document.getElementById('btn-create-archive-folder');
  if (createFolderBtn) {
    createFolderBtn.addEventListener('click', () => createArchiveFolder());
  }

  // Recherche dans les archives
  const searchInput = document.getElementById('search-archives');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => filterArchives(e.target.value));
  }

  // Initialiser le redimensionnement de la sidebar
  initArchiveTreeResize();

  // Observer pour charger les archives quand on arrive sur la vue
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        if (view.classList.contains('is-visible')) {
          loadArchivesView();
        }
      }
    });
  });
  observer.observe(view, { attributes: true });

  // Charger immédiatement si la vue est déjà visible (au rechargement)
  if (view.classList.contains('is-visible')) {
    loadArchivesView();
  }
}

async function loadArchivesView() {
  try {
    // Récupérer l'état sauvegardé
    const selectedFolderId = getArchiveState();
    
    await Promise.all([
      loadArchiveFolders(),
      loadArchivedClasseurs(selectedFolderId) // Charger les classeurs du dossier sauvegardé
    ]);
    
    // Restaurer la sélection dans la sidebar
    setTimeout(() => {
      const treeItems = document.querySelectorAll('#archive-tree-content .tree-item');
      treeItems.forEach(item => {
        item.classList.remove('is-selected');
        if (item.dataset.folderId === selectedFolderId) {
          item.classList.add('is-selected');
          
          // Mettre à jour le titre de la section
          const folderName = item.querySelector('.folder-name')?.textContent || 'Racine des archives';
          const archivesGrid = document.getElementById('archives-grid');
          if (archivesGrid && archivesGrid.previousElementSibling && archivesGrid.previousElementSibling.tagName === 'H3') {
            archivesGrid.previousElementSibling.textContent = `📂 ${folderName}`;
          }
        }
      });
      
      // Initialiser le drag & drop après le chargement
      initArchivesDragDrop();
    }, 100);
  } catch (error) {
    console.error('Erreur lors du chargement des archives:', error);
  }
}

async function loadArchiveFolders(preserveExpandedState = false) {
  const treeContent = document.getElementById('archive-tree-content');
  if (!treeContent) return;

  try {
    const archiveFolders = await window.classiflyer.listArchiveFolders();
    
    // Sauvegarder les états d'expansion si demandé
    let expandedFolders = new Set();
    if (preserveExpandedState) {
      const expandedElements = treeContent.querySelectorAll('.tree-children[data-parent]');
      expandedElements.forEach(el => {
        // Vérifier si l'élément est visible (pas display: none)
        const isVisible = el.style.display !== 'none' && 
                         getComputedStyle(el).display !== 'none';
        if (isVisible) {
          expandedFolders.add(el.dataset.parent);
        }
      });
      console.log('Expanded folders saved:', Array.from(expandedFolders));
    }
    
    // Organiser les dossiers par hiérarchie
    const rootFolders = archiveFolders.filter(f => !f.parentId);
    const foldersByParent = {};
    
    archiveFolders.forEach(folder => {
      if (folder.parentId) {
        if (!foldersByParent[folder.parentId]) {
          foldersByParent[folder.parentId] = [];
        }
        foldersByParent[folder.parentId].push(folder);
      }
    });
    
    let html = `
      <div class="tree-item is-selected" data-folder-id="root">
        <span class="expand-arrow">▼</span>
        <span>📁</span>
        <span class="folder-name">Racine des archives</span>
        <div class="folder-actions">
          <button class="btn add-subfolder" title="Nouveau sous-dossier" data-parent-id="root">+</button>
        </div>
      </div>
    `;
    
    // Toujours garder la racine ouverte pour une meilleure UX
    html += `<div class="tree-children" data-parent="root" style="display: block;">`;
    html += await renderFolderTree(rootFolders, foldersByParent, 0, expandedFolders, preserveExpandedState);
    html += '</div>';
    
    treeContent.innerHTML = html;
    
    // Ajouter les événements
    setupArchiveFolderEvents(treeContent);
    
    console.log(`Archive folders loaded: ${archiveFolders.length} dossiers`);
  } catch (error) {
    console.error('Erreur lors du chargement des dossiers d\'archives:', error);
    // Fallback vers le contenu statique
    treeContent.innerHTML = `
      <div class="tree-item is-selected" data-folder-id="root">
        <span>📁</span>
        <span class="folder-name">Racine des archives</span>
      </div>
    `;
  }
}

async function renderFolderTree(folders, foldersByParent, depth, expandedFolders = new Set(), preserveExpandedState = false) {
  let html = '';
  
  // Récupérer la liste des classeurs archivés pour vérifier les contenus
  const allClasseurs = await window.classiflyer.listArchives();
  
  // Ajouter la racine comme drop target si on est au niveau 0
  if (depth === 0) {
    const rootClasseurs = allClasseurs.filter(c => !c.archiveFolderId);
    html += `
      <div class="tree-item" data-folder-id="root" style="margin-bottom: 8px; font-weight: bold;">
        <span>📁</span>
        <span class="folder-name">Racine des archives (${rootClasseurs.length})</span>
      </div>
    `;
  }
  
  for (const folder of folders) {
    const hasSubfolders = foldersByParent[folder.id] && foldersByParent[folder.id].length > 0;
    const hasClasseurs = allClasseurs.filter(c => c.archiveFolderId === folder.id).length > 0;
    const hasChildren = hasSubfolders || hasClasseurs;
    const indent = depth * 20;
    const isExpanded = expandedFolders.has(folder.id);
    const arrowSymbol = hasChildren && isExpanded ? '▼' : '▶';
    
    const folderClasseurs = allClasseurs.filter(c => c.archiveFolderId === folder.id);
    
    // Choisir le bon symbole de flèche selon le type de contenu
    let arrowIcon;
    if (hasSubfolders) {
      arrowIcon = isExpanded ? '▼' : '▶'; // Flèche normale pour sous-dossiers
    } else if (hasClasseurs) {
      arrowIcon = '📁'; // Icône dossier pour dossiers avec classeurs
    } else {
      arrowIcon = '📂'; // Dossier vide
    }
    
    html += `
      <div class="tree-item" data-folder-id="${folder.id}" style="margin-left: ${indent}px;">
        <span class="expand-arrow" style="opacity: ${hasChildren ? '1' : '0.3'}; cursor: ${hasChildren ? 'pointer' : 'default'};">${arrowIcon}</span>
        <span>📂</span>
        <span class="folder-name" title="${folder.name}">${folder.name} (${folderClasseurs.length})</span>
        <div class="folder-actions">
          <button class="btn add-subfolder" title="Nouveau sous-dossier" data-parent-id="${folder.id}" style="background: #22c55e !important; color: white !important; border-radius: 50% !important; width: 22px !important; height: 22px !important; display: flex !important; align-items: center !important; justify-content: center !important; font-size: 16px !important; font-weight: bold !important; border: none !important;">+</button>
          <button class="btn rename-folder" title="Renommer" data-folder-id="${folder.id}">✏️</button>
          <button class="btn delete-folder" title="Supprimer" data-folder-id="${folder.id}">🗑️</button>
        </div>
      </div>
    `;
    
    if (hasSubfolders) {
      const childrenVisible = preserveExpandedState ? isExpanded : false;
      html += `<div class="tree-children" data-parent="${folder.id}" style="display: ${childrenVisible ? 'block' : 'none'};">`;
      html += await renderFolderTree(foldersByParent[folder.id], foldersByParent, depth + 1, expandedFolders, preserveExpandedState);
      html += '</div>';
    }
  }
  
  return html;
}

function setupArchiveFolderEvents(container) {
  console.log('Setting up archive folder events');
  
  // Supprimer les anciens événements pour éviter les doublons
  const newContainer = container.cloneNode(true);
  container.parentNode.replaceChild(newContainer, container);
  
  // Gestion des clics sur les dossiers pour sélection
  newContainer.addEventListener('click', (e) => {
    // Ignore les clics sur les boutons d'action et les flèches
    if (e.target.classList.contains('add-subfolder') || 
        e.target.classList.contains('rename-folder') ||
        e.target.classList.contains('delete-folder') ||
        e.target.classList.contains('expand-arrow')) {
      return;
    }
    
    const item = e.target.closest('.tree-item');
    if (item) {
      // Retirer la sélection des autres items
      newContainer.querySelectorAll('.tree-item').forEach(i => 
        i.classList.remove('is-selected')
      );
      
      // Sélectionner l'item cliqué
      item.classList.add('is-selected');
      
      // Charger les classeurs de ce dossier
      const folderId = item.dataset.folderId;
      console.log('Dossier sélectionné:', folderId);
      
      // Sauvegarder l'état
      saveArchiveState(folderId);
      
      loadArchivedClasseurs(folderId);
      
      // Mettre à jour le titre de la section (optionnel)
      const folderName = item.querySelector('.folder-name')?.textContent || 'Racine des archives';
      const archivesGrid = document.getElementById('archives-grid');
      if (archivesGrid && archivesGrid.previousElementSibling && archivesGrid.previousElementSibling.tagName === 'H3') {
        archivesGrid.previousElementSibling.textContent = `📂 ${folderName}`;
      }
    }
  });
  
  // Gestion des flèches d'expansion - événement séparé
  newContainer.addEventListener('click', async (e) => {
    if (e.target.classList.contains('expand-arrow')) {
      e.preventDefault();
      e.stopPropagation();
      
      const item = e.target.closest('.tree-item');
      if (!item) return;
      
      const folderId = item.dataset.folderId;
      console.log('Expand arrow clicked for folder:', folderId);
      
      // Chercher les enfants (sous-dossiers)
      const children = item.nextElementSibling?.classList.contains('tree-children') ? 
                      item.nextElementSibling : 
                      newContainer.querySelector(`.tree-children[data-parent="${folderId}"]`);
      
      if (children) {
        // Il y a des sous-dossiers, les dérouler/réduire
        const isExpanded = children.style.display !== 'none';
        children.style.display = isExpanded ? 'none' : 'block';
        e.target.textContent = isExpanded ? '▶' : '▼';
        console.log('Toggled subfolder to:', isExpanded ? 'collapsed' : 'expanded');
      } else {
        // Pas de sous-dossiers, mais peut-être des classeurs → naviguer vers ce dossier
        console.log('No subfolders, loading classeurs for folder:', folderId);
        
        // Sélectionner ce dossier et charger ses classeurs
        newContainer.querySelectorAll('.tree-item').forEach(i => 
          i.classList.remove('is-selected')
        );
        item.classList.add('is-selected');
        
        // Sauvegarder l'état
        saveArchiveState(folderId);
        
        // Charger les classeurs de ce dossier
        await loadArchivedClasseurs(folderId);
        
        // Changer la flèche pour indiquer que c'est "sélectionné"
        e.target.textContent = '📂';
        
        // Mettre à jour le titre de la section
        const folderName = item.querySelector('.folder-name')?.textContent || 'Dossier';
        const archivesGrid = document.getElementById('archives-grid');
        if (archivesGrid && archivesGrid.previousElementSibling && archivesGrid.previousElementSibling.tagName === 'H3') {
          archivesGrid.previousElementSibling.textContent = `📂 ${folderName}`;
        }
      }
    }
  });
  
  // Gestion des boutons d'actions - événement séparé  
  newContainer.addEventListener('click', async (e) => {
    // Vérifier si c'est un bouton d'action
    if (e.target.classList.contains('add-subfolder') || 
        e.target.classList.contains('rename-folder') || 
        e.target.classList.contains('delete-folder')) {
      
      e.preventDefault();
      e.stopPropagation();
      console.log('Action button clicked:', e.target.className);
      
      if (e.target.classList.contains('add-subfolder')) {
        console.log('Add subfolder clicked');
        const parentId = e.target.dataset.parentId === 'root' ? null : e.target.dataset.parentId;
        await createArchiveFolderWithParent(parentId);
      } else if (e.target.classList.contains('rename-folder')) {
        console.log('Rename folder clicked');
        const folderId = e.target.dataset.folderId;
        await renameArchiveFolder(folderId);
      } else if (e.target.classList.contains('delete-folder')) {
        console.log('Delete folder clicked');
        const folderId = e.target.dataset.folderId;
        await deleteArchiveFolder(folderId);
      }
    }
  });
}

async function loadArchivedClasseurs(selectedFolderId = null) {
  try {
    const archives = await window.classiflyer.listArchives();
    console.log('Tous les archives récupérés:', archives);
    
    const container = document.getElementById('archives-grid');
    if (!container) return;

    // Filtrer pour s'assurer qu'on n'a que des classeurs, pas des dossiers
    const onlyClasseurs = archives.filter(item => {
      // Un classeur doit avoir des propriétés spécifiques (au moins une)
      const isClasseur = item.hasOwnProperty('primaryColor') || item.hasOwnProperty('files') || item.hasOwnProperty('folders');
      
      // Exclure seulement les classeurs suspects (même nom et chemin root que dossier)
      const isRootPath = item.sys_path && item.sys_path.match(/\/archives\/[^\/]+$/);
      const hasSameName = item.name && (item.name === 'Projets 2K25 RELEASED' || item.name === 'a');
      const isDuplicateFolder = isRootPath && hasSameName && !item.archiveFolderId;
      
      return isClasseur && !isDuplicateFolder;
    });

    // Filtrer les classeurs selon le dossier sélectionné
    const filteredArchives = onlyClasseurs.filter(classeur => {
      if (selectedFolderId === null || selectedFolderId === 'root') {
        // Afficher seulement les classeurs à la racine (sans archiveFolderId ou archiveFolderId = null)
        return !classeur.archiveFolderId;
      } else {
        // Afficher les classeurs du dossier sélectionné
        return classeur.archiveFolderId === selectedFolderId;
      }
    });

    console.log('Classeurs filtrés pour le dossier', selectedFolderId, ':', filteredArchives.length, 'classeurs');
    renderArchivedClasseurs(container, filteredArchives);
  } catch (error) {
    console.error('Erreur lors du chargement des classeurs archivés:', error);
  }
}

function renderArchivedClasseurs(container, archives) {
  container.innerHTML = '';
  
  for (const item of archives) {
    const card = document.createElement('div');
    card.className = 'card drag-ready';
    card.dataset.classeurId = item.id; // Ajouter l'ID pour le drag & drop
    card.style.background = item.primaryColor || '#ffffff';
    card.style.borderRight = `8px solid ${item.secondaryColor || '#000000'}`;

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = item.name;
    title.style.color = item.tertiaryColor || '#0b1220';

    // Compter les fichiers et dossiers
    const fileCount = countClasseurContent(item);
    const counter = document.createElement('div');
    counter.className = 'classeur-counter';
    counter.textContent = `${fileCount.files} fichier${fileCount.files > 1 ? 's' : ''}, ${fileCount.folders} dossier${fileCount.folders > 1 ? 's' : ''}`;
    counter.style.color = item.tertiaryColor || '#0b1220';
    counter.style.fontSize = '12px';
    counter.style.position = 'absolute';
    counter.style.bottom = '8px';
    counter.style.left = '8px';
    counter.style.opacity = '0.8';

    const menuBtn = document.createElement('button');
    menuBtn.className = 'btn card-menu-btn';
    menuBtn.textContent = '⋯';

    const menu = document.createElement('div');
    menu.className = 'menu';

    const modifyItem = document.createElement('div');
    modifyItem.className = 'menu-item';
    modifyItem.textContent = 'Modifier';
    modifyItem.addEventListener('click', async (e) => {
      e.stopPropagation();
      showEditClasseurModal(item);
      menu.classList.remove('is-open');
    });

    const deleteItem = document.createElement('div');
    deleteItem.className = 'menu-item';
    deleteItem.textContent = 'Supprimer';
    deleteItem.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.classiflyer.deleteArchivedClasseur(item.id);
      await loadArchivedClasseurs();
      menu.classList.remove('is-open');
    });

    const unarchiveItem = document.createElement('div');
    unarchiveItem.className = 'menu-item';
    unarchiveItem.textContent = 'Désarchiver';
    unarchiveItem.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.classiflyer.unarchiveClasseur(item.id);
      await loadArchivedClasseurs();
      menu.classList.remove('is-open');
    });

    menu.appendChild(modifyItem);
    menu.appendChild(deleteItem);
    menu.appendChild(unarchiveItem);

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const allMenus = document.querySelectorAll('.menu');
      allMenus.forEach(m => m.classList.remove('is-open'));
      menu.classList.add('is-open');
    });

    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
        menu.classList.remove('is-open');
      }
    });

    card.appendChild(title);
    card.appendChild(counter);
    card.appendChild(menuBtn);
    card.appendChild(menu);

    // Clic sur le classeur pour l'ouvrir
    card.addEventListener('click', () => openClasseurView(item.id));
    container.appendChild(card);
  }
}

function filterArchives(searchTerm) {
  const cards = document.querySelectorAll('#archives-grid .card');
  const term = searchTerm.toLowerCase();

  for (const card of cards) {
    const title = card.querySelector('.card-title')?.textContent?.toLowerCase() || '';
    if (title.includes(term)) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  }
}

async function createArchiveFolder(parentId = null) {
  const modal = document.getElementById('modal-create-archive-folder');
  const input = document.getElementById('archive-folder-name');
  const createBtn = document.getElementById('create-archive-folder');
  const cancelBtn = document.getElementById('cancel-archive-folder');
  const closeBtn = document.getElementById('close-archive-folder-modal');
  
  if (!modal || !input || !createBtn) return;

  // Réinitialiser et afficher la modale
  input.value = '';
  modal.setAttribute('aria-hidden', 'false');
  input.focus();

  const handleCreate = async () => {
    const folderName = input.value.trim();
    if (!folderName) return;

    try {
      await window.classiflyer.createArchiveFolder(folderName, parentId);
      await loadArchiveFolders(true); // Préserver les états d'expansion
      modal.setAttribute('aria-hidden', 'true');
    } catch (error) {
      console.error('Erreur lors de la création du dossier d\'archive:', error);
      alert('Erreur lors de la création du dossier');
    }
  };

  const handleClose = () => {
    // Enlever le focus avant de fermer la modale
    if (document.activeElement && modal.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    modal.setAttribute('aria-hidden', 'true');
  };

  // Événements temporaires pour cette modale
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleCreate();
    } else if (e.key === 'Escape') {
      handleClose();
    }
  };

  // Ajouter les événements
  createBtn.addEventListener('click', handleCreate, { once: true });
  cancelBtn.addEventListener('click', handleClose, { once: true });
  closeBtn.addEventListener('click', handleClose, { once: true });
  input.addEventListener('keypress', handleKeyPress, { once: true });

  // Fermer si clic sur backdrop
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('modal-backdrop')) {
      handleClose();
    }
  }, { once: true });
}

async function createArchiveFolderWithParent(parentId) {
  await createArchiveFolder(parentId);
}

async function renameArchiveFolder(folderId) {
  const modal = document.getElementById('modal-rename-archive-folder');
  const input = document.getElementById('rename-archive-folder-name');
  const confirmBtn = document.getElementById('confirm-rename-archive-folder');
  const cancelBtn = document.getElementById('cancel-rename-archive-folder');
  const closeBtn = document.getElementById('close-rename-archive-folder-modal');
  
  if (!modal || !input || !confirmBtn) return;

  // Réinitialiser et afficher la modale
  input.value = '';
  input.disabled = false; // S'assurer que l'input n'est pas désactivé
  modal.setAttribute('aria-hidden', 'false');
  
  // Forcer le focus avec un délai pour que la modale soit bien affichée
  setTimeout(() => {
    input.focus();
    input.select();
    console.log('Input focused for rename');
  }, 150);

  const handleRename = async () => {
    const folderName = input.value.trim();
    if (!folderName) return;

    try {
      await window.classiflyer.renameArchiveFolder(folderId, folderName);
      await loadArchiveFolders(true); // Préserver les états d'expansion
      modal.setAttribute('aria-hidden', 'true');
    } catch (error) {
      console.error('Erreur lors du renommage du dossier:', error);
      alert('Erreur lors du renommage du dossier');
    }
  };

  const handleClose = () => {
    // Enlever le focus avant de fermer la modale
    if (document.activeElement && modal.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    modal.setAttribute('aria-hidden', 'true');
  };

  // Événements temporaires pour cette modale
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  };

  // Nettoyer les anciens événements d'abord
  confirmBtn.replaceWith(confirmBtn.cloneNode(true));
  cancelBtn.replaceWith(cancelBtn.cloneNode(true));
  closeBtn.replaceWith(closeBtn.cloneNode(true));
  
  // Récupérer les nouveaux éléments
  const newConfirmBtn = document.getElementById('confirm-rename-archive-folder');
  const newCancelBtn = document.getElementById('cancel-rename-archive-folder');
  const newCloseBtn = document.getElementById('close-rename-archive-folder-modal');

  // Ajouter les événements sur les nouveaux éléments
  newConfirmBtn.addEventListener('click', handleRename, { once: true });
  newCancelBtn.addEventListener('click', handleClose, { once: true });
  newCloseBtn.addEventListener('click', handleClose, { once: true });
  input.addEventListener('keydown', handleKeyPress, { once: true });

  // Fermer si clic sur backdrop
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('modal-backdrop')) {
      handleClose();
    }
  }, { once: true });
}

async function deleteArchiveFolder(folderId) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce dossier et tout son contenu ?')) {
    return;
  }

  try {
    await window.classiflyer.deleteArchiveFolder(folderId);
    await loadArchiveFolders(true); // Préserver les états d'expansion
    // Recharger aussi les classeurs car ils peuvent avoir été affectés
    await loadArchivedClasseurs();
  } catch (error) {
    console.error('Erreur lors de la suppression du dossier:', error);
    alert('Erreur lors de la suppression du dossier');
  }
}

// ===== REDIMENSIONNEMENT SIDEBAR =====

function initArchiveTreeResize() {
  const archiveTree = document.getElementById('archive-tree');
  const resizeHandle = archiveTree?.querySelector('.resize-handle');
  
  if (!archiveTree || !resizeHandle) return;

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  // Charger la largeur sauvegardée
  const savedWidth = localStorage.getItem('archive-tree-width');
  if (savedWidth) {
    archiveTree.style.width = savedWidth + 'px';
  }

  const startResize = (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = parseInt(getComputedStyle(archiveTree).width, 10);
    
    // Ajouter les classes de redimensionnement
    archiveTree.classList.add('resizing');
    resizeHandle.classList.add('resizing');
    
    // Prévenir la sélection de texte
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    
    // Ajouter les événements globaux
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
    
    e.preventDefault();
  };

  const doResize = (e) => {
    if (!isResizing) return;
    
    const deltaX = e.clientX - startX;
    let newWidth = startWidth + deltaX;
    
    // Respecter les limites min/max
    const minWidth = 280;
    const maxWidth = 600;
    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    
    archiveTree.style.width = newWidth + 'px';
    
    e.preventDefault();
  };

  const stopResize = () => {
    if (!isResizing) return;
    
    isResizing = false;
    
    // Retirer les classes de redimensionnement
    archiveTree.classList.remove('resizing');
    resizeHandle.classList.remove('resizing');
    
    // Restaurer le curseur et la sélection
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    
    // Sauvegarder la nouvelle largeur
    const currentWidth = parseInt(archiveTree.style.width, 10);
    localStorage.setItem('archive-tree-width', currentWidth);
    
    // Supprimer les événements globaux
    document.removeEventListener('mousemove', doResize);
    document.removeEventListener('mouseup', stopResize);
    
    console.log('Archive tree resized to:', currentWidth + 'px');
  };

  // Ajouter l'événement de début de redimensionnement
  resizeHandle.addEventListener('mousedown', startResize);
}

// ===== MODALE DE DESTINATION D'ARCHIVAGE =====

async function showArchiveDestinationModal(classeurId, container) {
  const modal = document.getElementById('modal-archive-destination');
  const tree = document.getElementById('archive-destination-tree');
  const confirmBtn = document.getElementById('confirm-archive-destination');
  const cancelBtn = document.getElementById('cancel-archive-destination');
  const closeBtn = document.getElementById('close-archive-destination-modal');
  
  if (!modal || !tree || !confirmBtn) return;

  let selectedFolderId = null;

  // Charger l'arborescence des dossiers d'archives
  try {
    const archiveFolders = await window.classiflyer.listArchiveFolders();
    renderDestinationTree(tree, archiveFolders);
  } catch (error) {
    console.error('Erreur lors du chargement des dossiers d\'archives:', error);
    tree.innerHTML = '<div class="tree-item selected" data-folder-id="root"><span>📁</span><span>Racine des archives</span></div>';
  }

  // Sélectionner la racine par défaut
  selectedFolderId = 'root';
  
  // Afficher la modale
  modal.setAttribute('aria-hidden', 'false');

  const handleDestinationSelect = (e) => {
    // Retirer la sélection précédente
    tree.querySelectorAll('.tree-item').forEach(item => item.classList.remove('selected'));
    
    // Ajouter la sélection au nouvel élément
    const treeItem = e.target.closest('.tree-item');
    if (treeItem) {
      treeItem.classList.add('selected');
      selectedFolderId = treeItem.dataset.folderId;
    }
  };

  const handleConfirm = async () => {
    try {
      const targetFolderId = selectedFolderId === 'root' ? null : selectedFolderId;
      await window.classiflyer.archiveClasseur(classeurId, targetFolderId);
      await window.classiflyer.listClasseurs().then((l) => renderClasseurs(container, l));
      modal.setAttribute('aria-hidden', 'true');
    } catch (error) {
      console.error('Erreur lors de l\'archivage:', error);
      alert('Erreur lors de l\'archivage du classeur');
    }
  };

  const handleClose = () => {
    modal.setAttribute('aria-hidden', 'true');
  };

  // Ajouter les événements
  tree.addEventListener('click', handleDestinationSelect);
  confirmBtn.addEventListener('click', handleConfirm, { once: true });
  cancelBtn.addEventListener('click', handleClose, { once: true });
  closeBtn.addEventListener('click', handleClose, { once: true });

  // Fermer si clic sur backdrop
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('modal-backdrop')) {
      handleClose();
    }
  }, { once: true });
}

function renderDestinationTree(container, folders) {
  // Organiser les dossiers par hiérarchie
  const rootFolders = folders.filter(f => !f.parentId);
  const foldersByParent = {};
  
  folders.forEach(folder => {
    if (folder.parentId) {
      if (!foldersByParent[folder.parentId]) {
        foldersByParent[folder.parentId] = [];
      }
      foldersByParent[folder.parentId].push(folder);
    }
  });

  let html = `
    <div class="tree-item selected" data-folder-id="root">
      <span>📁</span>
      <span>Racine des archives</span>
    </div>
  `;

  html += renderDestinationFolderTree(rootFolders, foldersByParent, 0);
  container.innerHTML = html;
}

function renderDestinationFolderTree(folders, foldersByParent, depth) {
  let html = '';
  
  for (const folder of folders) {
    const hasChildren = foldersByParent[folder.id] && foldersByParent[folder.id].length > 0;
    const indent = depth * 20;
    
    html += `
      <div class="tree-item" data-folder-id="${folder.id}" style="margin-left: ${indent}px;">
        <span>📂</span>
        <span>${folder.name}</span>
      </div>
    `;
    
    if (hasChildren) {
      html += renderDestinationFolderTree(foldersByParent[folder.id], foldersByParent, depth + 1);
    }
  }
  
  return html;
}

// ===== DRAG & DROP DANS LES ARCHIVES =====

function initArchivesDragDrop() {
  const archivesGrid = document.getElementById('archives-grid');
  const archiveTree = document.getElementById('archive-tree-content');
  
  console.log('Initialisation drag & drop:', { archivesGrid: !!archivesGrid, archiveTree: !!archiveTree });
  
  if (!archivesGrid || !archiveTree) {
    console.error('Éléments manquants pour le drag & drop');
    return;
  }

  // Rendre les classeurs archivés draggables
  makeClasseursDraggable(archivesGrid);
  
  // Rendre les dossiers d'archives drop targets
  makeArchiveFoldersDropTargets(archiveTree);
  
  console.log('Drag & drop initialisé avec succès');
}

function makeClasseursDraggable(container) {
  container.addEventListener('mousedown', (e) => {
    // Ignorer si c'est un clic sur le menu "..."
    if (e.target.closest('.menu-trigger') || e.target.closest('.menu')) {
      return;
    }

    const card = e.target.closest('.card');
    if (!card) return;

    const classeurId = card.dataset.classeurId || getClasseurIdFromCard(card);
    if (!classeurId) return;

    // Prévenir la sélection de texte immédiatement
    e.preventDefault();
    e.stopPropagation();

    let isDragging = false;
    let startX = e.clientX;
    let startY = e.clientY;
    let dragThreshold = 8; // Augmenter le seuil

    // Désactiver la sélection de texte sur tout le document
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    const handleMouseMove = (e) => {
      e.preventDefault();
      const deltaX = Math.abs(e.clientX - startX);
      const deltaY = Math.abs(e.clientY - startY);
      
      if (!isDragging && (deltaX > dragThreshold || deltaY > dragThreshold)) {
        isDragging = true;
        console.log('Début du drag pour classeur:', classeurId);
        
        // Styles de drag
        card.classList.add('dragging');
        card.style.position = 'fixed';
        card.style.zIndex = '9999';
        card.style.pointerEvents = 'none';
        document.body.style.cursor = 'grabbing';
        
        // Activer les drop targets
        const dropTargets = document.querySelectorAll('.archive-tree .tree-item');
        dropTargets.forEach(target => {
          target.classList.add('drop-target');
          target.style.pointerEvents = 'auto';
        });
      }

      if (isDragging) {
        // Déplacer le classeur avec la souris
        card.style.left = (e.clientX - 75) + 'px'; // 75px = moitié de la largeur estimée
        card.style.top = (e.clientY - 125) + 'px'; // 125px = moitié de la hauteur estimée
      }
    };

    const handleMouseUp = async (e) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // Restaurer la sélection de texte
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      document.body.style.cursor = '';

      if (isDragging) {
        console.log('Fin du drag');
        
        // Restaurer le classeur
        card.classList.remove('dragging');
        card.style.position = '';
        card.style.zIndex = '';
        card.style.left = '';
        card.style.top = '';
        card.style.pointerEvents = '';
        
        // Désactiver les drop targets
        const dropTargets = document.querySelectorAll('.drop-target');
        dropTargets.forEach(target => {
          target.classList.remove('drop-target', 'drag-over');
          target.style.pointerEvents = '';
        });

        // Vérifier si on a droppé sur un dossier
        const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
        console.log('Élément sous la souris:', elementUnderMouse);
        
        const targetFolder = elementUnderMouse?.closest('.tree-item[data-folder-id]');
        console.log('Dossier cible trouvé:', targetFolder);
        
        if (targetFolder && targetFolder.dataset.folderId) {
          const targetFolderId = targetFolder.dataset.folderId;
          const actualTargetId = targetFolderId === 'root' ? null : targetFolderId;
          
          console.log('Drop détecté sur:', targetFolderId, 'Actual ID:', actualTargetId);
          console.log('Classeur ID:', classeurId);
          
          try {
            console.log('Appel moveClasseurToArchiveFolder...');
            const result = await window.classiflyer.moveClasseurToArchiveFolder(classeurId, actualTargetId);
            console.log('Résultat du déplacement:', result);
            
            console.log('Rechargement des classeurs archivés...');
            await loadArchivedClasseurs();
            console.log(`✅ Classeur ${classeurId} déplacé vers ${targetFolderId}`);
            
            // Feedback visuel
            if (targetFolder) {
              targetFolder.style.background = '#22c55e';
              setTimeout(() => {
                targetFolder.style.background = '';
              }, 500);
            }
          } catch (error) {
            console.error('❌ Erreur lors du déplacement:', error);
            console.error('Stack trace:', error.stack);
            alert('Erreur lors du déplacement du classeur: ' + error.message);
          }
        } else {
          console.log('❌ Aucun dossier cible détecté');
          console.log('ElementUnderMouse:', elementUnderMouse);
          console.log('TargetFolder:', targetFolder);
          console.log('Toutes les tree-items:', document.querySelectorAll('.tree-item[data-folder-id]'));
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  });
}

function handleMouseUp(e) {
  console.log('Mouse up, isDragging:', isDragging);
  
  if (!isDragging || !draggedCard) {
    return;
  }
  
  // Trouver la cible de drop
  const dropTarget = e.target.closest('.tree-item');
  console.log('Drop target:', dropTarget);
  
  if (dropTarget) {
    const folderId = dropTarget.dataset.folderId;
    const classeurId = originalCard.dataset.classeurId;
    
    console.log('Tentative de drop:', { classeurId, folderId });
    
    if (classeurId) {
      // Effectuer le déplacement
      window.electronAPI.moveClasseurToArchiveFolder(classeurId, folderId || null)
        .then(async () => {
          console.log('✅ Classeur déplacé avec succès');
          
          // Feedback visuel immédiat
          dropTarget.style.backgroundColor = '#22c55e';
          setTimeout(() => {
            dropTarget.style.backgroundColor = '';
          }, 1000);
          
          try {
            // Rafraîchir l'affichage complet des archives
            await loadArchivesView();
            console.log('✅ Interface mise à jour');
          } catch (refreshError) {
            console.error('⚠️ Erreur lors du refresh (mais déplacement réussi):', refreshError);
            // Ne pas afficher d'alert car le déplacement a fonctionné
          }
        })
        .catch(error => {
          console.error('❌ Erreur lors du déplacement:', error);
          alert('Erreur lors du déplacement du classeur: ' + error.message);
        });
    }
  }
  
  // Nettoyer
  if (draggedCard) {
    draggedCard.remove();
    originalCard.classList.remove('dragging');
    originalCard.style.display = '';
  }
  
  // Retirer user-select: none du body
  document.body.style.userSelect = '';
  
  // Nettoyer les classes drag-over
  document.querySelectorAll('.drag-over').forEach(item => 
    item.classList.remove('drag-over')
  );
  
  isDragging = false;
  draggedCard = null;
  originalCard = null;
  
  // Retirer les event listeners
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
}

function makeArchiveFoldersDropTargets(container) {
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  container.addEventListener('mouseover', (e) => {
    if (document.querySelector('.card.dragging')) {
      const treeItem = e.target.closest('.tree-item');
      if (treeItem) {
        // Retirer la classe drag-over des autres
        container.querySelectorAll('.drag-over').forEach(item => 
          item.classList.remove('drag-over')
        );
        // Ajouter à l'item courant
        treeItem.classList.add('drag-over');
      }
    }
  });

  container.addEventListener('mouseleave', () => {
    container.querySelectorAll('.drag-over').forEach(item => 
      item.classList.remove('drag-over')
    );
  });
}

function getClasseurIdFromCard(card) {
  // Essayer de récupérer l'ID depuis un data attribute ou depuis l'ordre dans la grille
  const cards = Array.from(card.parentElement.children);
  const index = cards.indexOf(card);
  
  // Cette fonction devra être adaptée selon la structure de tes cartes
  // Pour l'instant, on va ajouter l'ID aux cartes lors du rendu
  return card.dataset.classeurId;
}

// Gestion de l'état des archives
function saveArchiveState(selectedFolderId) {
  localStorage.setItem('classiflyer_selectedArchiveFolder', selectedFolderId || 'root');
}

function getArchiveState() {
  return localStorage.getItem('classiflyer_selectedArchiveFolder') || 'root';
}

function clearArchiveState() {
  localStorage.removeItem('classiflyer_selectedArchiveFolder');
}

function showEditClasseurModal(classeur) {
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
    
    try {
      // Utiliser l'API spécifique aux archives
      await window.classiflyer.updateArchivedClasseur(classeur.id, { 
        name, 
        primaryColor, 
        secondaryColor, 
        tertiaryColor 
      });
      close();
      
      // Rafraîchir seulement les classeurs du dossier actuel (pas toute la vue)
      const currentFolderId = getArchiveState();
      await loadArchivedClasseurs(currentFolderId);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du classeur archivé:', error);
      alert('Erreur lors de la modification: ' + error.message);
    }
  }, { once: true });
}