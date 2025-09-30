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

function setupDocumentationNavigation() {
  const docNavItems = document.querySelectorAll('.doc-nav-item');
  
  docNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.getAttribute('data-section');
      
      // Mettre à jour l'état actif des boutons de navigation
      docNavItems.forEach(navItem => navItem.classList.remove('active'));
      item.classList.add('active');
      
      // Afficher la section correspondante
      const sections = document.querySelectorAll('.doc-section');
      sections.forEach(sec => sec.classList.remove('active'));
      
      const targetSection = document.getElementById(`doc-${section}`);
      if (targetSection) {
        targetSection.classList.add('active');
      }
    });
  });
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
    
    // Initialiser la navigation de la documentation si nécessaire
    if (viewId === 'view-documentation') {
      setupDocumentationNavigation();
    }
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
  initTrashView();
});

function initSettingsView() {
  const input = document.getElementById('input-root-path');
  const browseBtn = document.getElementById('btn-browse-root');
  const saveBtn = document.getElementById('btn-save-settings');
  const dbPathEl = document.getElementById('db-path');
  if (!(input instanceof HTMLInputElement) || !(browseBtn instanceof HTMLElement) || !(saveBtn instanceof HTMLElement)) {
    return;
  }
  // Load current config
  if (window.classiflyer && typeof window.classiflyer.getConfig === 'function') {
    window.classiflyer.getConfig().then((cfg) => {
      if (cfg && cfg.rootPath) {
        input.value = cfg.rootPath;
        if (dbPathEl) dbPathEl.textContent = `${cfg.rootPath}/db.json`;
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
      if (dbPathEl) dbPathEl.textContent = `${newPath}/db.json`;
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
  const btnCreateFolder = document.getElementById('btn-create-classeur-folder');
  const searchInput = document.getElementById('search-classeurs');
  if (!grid || !btnCreate || !btnCreateFolder) return;

  async function refresh() {
    if (!window.classiflyer || typeof window.classiflyer.listClasseurs !== 'function') return;
    const classeurs = await window.classiflyer.listClasseurs();
    const folders = await window.classiflyer.listClasseurFolders();
    const q = (searchInput instanceof HTMLInputElement ? searchInput.value.trim().toLowerCase() : '');
    
    // Filtrer classeurs et dossiers selon la recherche
    const filteredClasseurs = q ? classeurs.filter((c) => (c.name || '').toLowerCase().includes(q)) : classeurs;
    const filteredFolders = q ? folders.filter((f) => (f.name || '').toLowerCase().includes(q)) : folders;
    
    renderClasseursAndFolders(grid, filteredClasseurs, filteredFolders, refresh);
  }

  btnCreate.addEventListener('click', () => {
    openCreateChoiceModal({
      onBlank: () => openCreateModal(refresh),
      onFromFolder: () => openCreateFromFolderModal(refresh)
    });
  });

  btnCreateFolder.addEventListener('click', () => {
    openCreateClasseurFolderModal(refresh);
  });

  if (searchInput instanceof HTMLInputElement) {
    searchInput.addEventListener('input', refresh);
  }

  refresh().then(() => {
    // Initialiser le drag & drop après le rendu initial
    initClasseurFoldersDragDrop();
  });
}

function openCreateChoiceModal({ onBlank, onFromFolder }) {
  const modal = document.createElement('div');
  modal.className = 'modal is-visible';
  modal.style.cssText = 'position:fixed; inset:0; z-index:1000; display:flex; align-items:center; justify-content:center;';
  modal.innerHTML = `
    <div class="modal-backdrop" style="position:absolute; inset:0; background:rgba(0,0,0,0.35); z-index:1;"></div>
    <div class="modal-content" style="position:relative; z-index:2; max-width: 520px; width:90%; background:#fff; border-radius:12px; padding:16px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
      <h3>Créer un classeur</h3>
      <p>Souhaitez-vous créer un classeur vierge ou à partir d'un dossier ?</p>
      <div style="display:flex; gap:12px; margin-top:16px;">
        <button id="btn-create-blank" class="btn primary" style="flex:1">Classeur vierge</button>
        <button id="btn-create-from-folder" class="btn" style="flex:1">Depuis un dossier</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#btn-create-blank')?.addEventListener('click', () => { close(); setTimeout(() => { onBlank && onBlank(); }, 0); }, { once:true });
  modal.querySelector('#btn-create-from-folder')?.addEventListener('click', () => { close(); setTimeout(() => { onFromFolder && onFromFolder(); }, 0); }, { once:true });
  modal.querySelector('.modal-backdrop')?.addEventListener('click', close, { once:true });
}

function openCreateFromFolderModal(onCreated) {
  const modal = document.createElement('div');
  modal.className = 'modal is-visible';
  modal.style.cssText = 'position:fixed; inset:0; z-index:1000; display:flex; align-items:center; justify-content:center;';
  modal.innerHTML = `
    <div class="modal-backdrop" style="position:absolute; inset:0; background:rgba(0,0,0,0.35);"></div>
    <div class="modal-content" style="position:relative; max-width: 760px; width:92%; background:#fff; border-radius:12px; padding:16px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); display:grid; grid-template-columns: 1.2fr 1fr; gap:16px;">
      <div>
        <h3 style="margin-top:0;">Nouveau classeur depuis un dossier</h3>
        <label style="display:block; margin-bottom:10px;">Nom du classeur
          <input id="input-name" type="text" placeholder="Nom" style="width:100%; margin-top:6px;" />
        </label>
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px;">
          <label>Couleur principale <input id="input-primary" type="color" value="#0ea5e9" /></label>
          <label>Secondaire <input id="input-secondary" type="color" value="#38bdf8" /></label>
          <label>Tertiaire <input id="input-tertiary" type="color" value="#0b1220" /></label>
        </div>
        <div style="display:flex; gap:8px; align-items:center; margin-top:12px;">
          <input id="input-folder-path" type="text" placeholder="Aucun dossier sélectionné" readonly style="flex:1;" />
          <button id="btn-choose-folder" class="btn">Choisir un dossier</button>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
          <button id="btn-cancel" class="btn">Annuler</button>
          <button id="btn-create" class="btn primary" disabled>Créer</button>
        </div>
      </div>
      <div>
        <div id="preview-from-folder" class="card" style="position:sticky; top:0; border-right: 8px solid #38bdf8; background:#0ea5e9; color:#0b1220; padding:16px; border-radius:12px;">
          <div class="card-title" style="font-weight:700;">Aperçu</div>
          <div style="opacity:0.8; font-size:12px; margin-top:8px;">Le style du classeur s'appliquera à la création.</div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();

  const nameInput = modal.querySelector('#input-name');
  const primaryInput = modal.querySelector('#input-primary');
  const secondaryInput = modal.querySelector('#input-secondary');
  const tertiaryInput = modal.querySelector('#input-tertiary');
  const folderInput = modal.querySelector('#input-folder-path');
  const chooseBtn = modal.querySelector('#btn-choose-folder');
  const cancelBtn = modal.querySelector('#btn-cancel');
  const createBtn = modal.querySelector('#btn-create');
  const preview = modal.querySelector('#preview-from-folder');

  function updatePreview() {
    const pc = primaryInput instanceof HTMLInputElement ? primaryInput.value : '#0ea5e9';
    const sc = secondaryInput instanceof HTMLInputElement ? secondaryInput.value : '#38bdf8';
    const tc = tertiaryInput instanceof HTMLInputElement ? tertiaryInput.value : '#0b1220';
    if (preview) {
      preview.style.background = pc;
      preview.style.borderRight = `8px solid ${sc}`;
      preview.style.color = tc;
      const t = preview.querySelector('.card-title');
      if (t && nameInput instanceof HTMLInputElement) t.textContent = nameInput.value || 'Aperçu';
    }
  }
  [nameInput, primaryInput, secondaryInput, tertiaryInput].forEach((el) => {
    el && el.addEventListener('input', updatePreview);
    el && el.addEventListener('change', updatePreview);
  });
  updatePreview();

  chooseBtn?.addEventListener('click', async () => {
    const dir = await window.classiflyer.chooseDirectory();
    if (dir) folderInput.value = dir;
    if (createBtn instanceof HTMLButtonElement) createBtn.disabled = !(nameInput?.value?.trim()) || !(folderInput?.value?.trim());
  });

  nameInput?.addEventListener('input', () => {
    if (createBtn instanceof HTMLButtonElement) createBtn.disabled = !(nameInput?.value?.trim()) || !(folderInput?.value?.trim());
  });

  cancelBtn?.addEventListener('click', close, { once:true });
  modal.querySelector('.modal-backdrop')?.addEventListener('click', close, { once:true });

  createBtn?.addEventListener('click', async () => {
    const name = nameInput?.value?.trim();
    const folderPath = folderInput?.value?.trim();
    const primaryColor = primaryInput?.value || '#0ea5e9';
    const secondaryColor = secondaryInput?.value || '#38bdf8';
    const tertiaryColor = tertiaryInput?.value || '#0b1220';
    if (!name || !folderPath) return;
    try {
      await window.classiflyer.createClasseurFromFolder({ name, folderPath, primaryColor, secondaryColor, tertiaryColor });
      close();
      typeof onCreated === 'function' && (await onCreated());
    } catch (e) {
      alert('Erreur: ' + (e?.message || 'Création impossible'));
    }
  }, { once:true });
}
// Nouvelle fonction pour afficher à la fois dossiers et classeurs
function renderClasseursAndFolders(container, classeurs, folders, refreshCallback) {
  container.innerHTML = '';
  
  // D'abord afficher les dossiers
  for (const folder of folders) {
    const folderCard = createFolderCard(folder, classeurs, refreshCallback);
    container.appendChild(folderCard);
  }
  
  // Ensuite afficher les classeurs à la racine (sans classeurFolderId)
  const rootClasseurs = classeurs.filter(c => !c.classeurFolderId);
  for (const item of rootClasseurs) {
    const card = createClasseurCard(item, refreshCallback);
    container.appendChild(card);
  }
}

// Créer une carte de dossier
function createFolderCard(folder, allClasseurs, refreshCallback) {
  const folderCard = document.createElement('div');
  folderCard.className = 'classeur-folder-card';
  folderCard.dataset.folderId = folder.id;
  
  // Compter les classeurs dans ce dossier
  const classeursCount = allClasseurs.filter(c => c.classeurFolderId === folder.id).length;
  
  const icon = document.createElement('div');
  icon.className = 'folder-icon';
  icon.textContent = '📁';
  
  const title = document.createElement('div');
  title.className = 'folder-title';
  title.textContent = folder.name;
  
  const count = document.createElement('div');
  count.className = 'folder-count';
  count.textContent = `${classeursCount} classeur${classeursCount > 1 ? 's' : ''}`;
  
  const menuBtn = document.createElement('button');
  menuBtn.className = 'btn folder-menu-btn';
  menuBtn.textContent = '⋯';
  
  const menu = document.createElement('div');
  menu.className = 'menu';
  
  const renameItem = document.createElement('div');
  renameItem.className = 'menu-item';
  renameItem.textContent = 'Renommer';
  renameItem.addEventListener('click', async (e) => {
    e.stopPropagation();
    openRenameClasseurFolderModal(folder, refreshCallback);
    menu.classList.remove('is-open');
  });
  
  const deleteItem = document.createElement('div');
  deleteItem.className = 'menu-item';
  deleteItem.textContent = 'Supprimer';
  deleteItem.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (await showConfirmModal('Confirmation', `Envoyer ce dossier et ses ${classeursCount} classeur(s) à la corbeille ?`)) {
      try {
        await window.classiflyer.deleteClasseurFolder(folder.id);
        await refreshCallback();
      } catch (err) {
        alert('Erreur: ' + (err?.message || 'Impossible de supprimer le dossier'));
      }
    }
    menu.classList.remove('is-open');
  });
  
  menu.appendChild(renameItem);
  menu.appendChild(deleteItem);
  
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = menu.classList.contains('is-open');
    document.querySelectorAll('.menu.is-open').forEach((el) => el.classList.remove('is-open'));
    if (!isOpen) menu.classList.add('is-open');
  });
  
  document.addEventListener('click', () => menu.classList.remove('is-open'));
  
  folderCard.appendChild(icon);
  folderCard.appendChild(title);
  folderCard.appendChild(count);
  folderCard.appendChild(menuBtn);
  folderCard.appendChild(menu);
  
  // Clic pour ouvrir le dossier
  folderCard.addEventListener('click', (e) => {
    // Ne pas ouvrir si on clique sur le menu
    if (e.target.closest('.folder-menu-btn') || e.target.closest('.menu')) {
      return;
    }
    openFolderView(folder);
  });
  
  return folderCard;
}

// Ouvrir la vue d'un dossier
let currentFolderId = null;
async function openFolderView(folder) {
  currentFolderId = folder.id;
  selectView('view-classeur-folder');
  
  const titleEl = document.getElementById('folder-view-title');
  if (titleEl) titleEl.textContent = folder.name;
  
  const backBtn = document.getElementById('btn-back-to-classeurs');
  if (backBtn) {
    backBtn.onclick = () => {
      selectView('view-classeurs');
      currentFolderId = null;
    };
  }
  
  // Charger les classeurs du dossier
  await refreshFolderView(folder.id);
  
  // Recherche dans le dossier
  const searchInput = document.getElementById('search-in-folder');
  if (searchInput instanceof HTMLInputElement) {
    searchInput.value = '';
    searchInput.onkeyup = () => refreshFolderView(folder.id, searchInput.value);
  }
}

async function refreshFolderView(folderId, searchTerm = '') {
  const grid = document.getElementById('folder-classeurs-grid');
  if (!grid) return;
  
  const allClasseurs = await window.classiflyer.listClasseurs();
  const classeursInFolder = allClasseurs.filter(c => c.classeurFolderId === folderId);
  
  const q = searchTerm.trim().toLowerCase();
  const filtered = q ? classeursInFolder.filter((c) => (c.name || '').toLowerCase().includes(q)) : classeursInFolder;
  
  grid.innerHTML = '';
  
  if (filtered.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 40px; color: #64748b; font-size: 16px;';
    emptyMsg.textContent = searchTerm ? 'Aucun classeur trouvé' : 'Ce dossier est vide';
    grid.appendChild(emptyMsg);
  } else {
    for (const classeur of filtered) {
      const card = createClasseurCard(classeur, async () => {
        try {
          await refreshFolderView(folderId, searchTerm);
        } catch (err) {
          console.error('Erreur lors du rafraîchissement de la vue du dossier:', err);
          // Si le dossier n'existe plus ou autre erreur, retourner à Mes Classeurs
          selectView('view-classeurs');
          const grid = document.getElementById('classeurs-grid');
          
          async function refreshMainView() {
            const classeurs = await window.classiflyer.listClasseurs();
            const folders = await window.classiflyer.listClasseurFolders();
            renderClasseursAndFolders(grid, classeurs, folders, refreshMainView);
          }
          
          await refreshMainView();
          setTimeout(() => initClasseurFoldersDragDrop(), 100);
        }
      });
      grid.appendChild(card);
    }
  }
  
  // Activer le drag & drop dans la vue du dossier
  setTimeout(() => initFolderViewDragDrop(), 100);
}

// Drag & drop dans la vue d'un dossier (pour sortir des classeurs du dossier)
function initFolderViewDragDrop() {
  const folderGrid = document.getElementById('folder-classeurs-grid');
  if (!folderGrid) return;
  
  folderGrid.addEventListener('mousedown', (e) => {
    if (e.target.closest('.card-menu-btn') || e.target.closest('.menu')) {
      return;
    }

    const card = e.target.closest('.card.drag-ready');
    if (!card) return;

    const classeurId = card.dataset.classeurId;
    if (!classeurId) return;

    e.preventDefault();
    e.stopPropagation();

    let isDragging = false;
    let startX = e.clientX;
    let startY = e.clientY;
    let dragThreshold = 8;

    document.body.style.userSelect = 'none';

    const handleMouseMove = (e) => {
      e.preventDefault();
      const deltaX = Math.abs(e.clientX - startX);
      const deltaY = Math.abs(e.clientY - startY);
      
      if (!isDragging && (deltaX > dragThreshold || deltaY > dragThreshold)) {
        isDragging = true;
        card.classList.add('dragging');
        card.style.position = 'fixed';
        card.style.zIndex = '9999';
        card.style.pointerEvents = 'none';
        document.body.style.cursor = 'grabbing';
      }

      if (isDragging) {
        card.style.left = (e.clientX - 100) + 'px';
        card.style.top = (e.clientY - 150) + 'px';
      }
    };

    const handleMouseUp = async (e) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      if (isDragging) {
        card.classList.remove('dragging');
        card.style.position = '';
        card.style.zIndex = '';
        card.style.left = '';
        card.style.top = '';
        card.style.pointerEvents = '';

        try {
          // Dans la vue d'un dossier, on peut seulement sortir le classeur (le remettre à la racine)
          await window.classiflyer.moveClasseurToFolder(classeurId, null);
          await refreshFolderView(currentFolderId);
        } catch (err) {
          console.error('Erreur de déplacement:', err);
          if (!err.message.includes('ENOENT')) {
            alert('Erreur: ' + (err?.message || 'Impossible de sortir le classeur'));
          }
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  });
}

// Créer une carte de classeur
function createClasseurCard(item, refreshCallback) {
  const card = document.createElement('div');
  card.className = 'card drag-ready';
  card.style.background = item.primaryColor || '#ffffff';
  card.style.borderRight = `8px solid ${item.secondaryColor || '#000000'}`;
  card.dataset.classeurId = item.id;

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = item.name;
  title.style.color = item.tertiaryColor || '#0b1220';

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
    openEditModal(item, refreshCallback);
    menu.classList.remove('is-open');
  });

  const deleteItem = document.createElement('div');
  deleteItem.className = 'menu-item';
  deleteItem.textContent = 'Supprimer';
  deleteItem.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (await showConfirmModal('Confirmation', 'Envoyer ce classeur à la corbeille ?')) {
      try {
        await window.classiflyer.trashMoveClasseur(item.id, 'mes');
        await refreshCallback();
      } catch (err) {
        alert('Erreur: ' + (err?.message || 'Impossible de déplacer vers corbeille'));
      }
    }
    menu.classList.remove('is-open');
  });

  const archiveItem = document.createElement('div');
  archiveItem.className = 'menu-item';
  archiveItem.textContent = 'Archiver';
  archiveItem.addEventListener('click', async (e) => {
    e.stopPropagation();
    menu.classList.remove('is-open');
    await showArchiveDestinationModal(item.id, async () => {
      try {
        await refreshCallback();
      } catch (err) {
        console.error('Erreur lors du rafraîchissement après archivage:', err);
      }
    });
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

  return card;
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
let currentClasseurOrigin = 'mes-classeurs'; // 'mes-classeurs' ou 'archives'

async function openClasseurView(id, origin = 'mes-classeurs') {
  currentClasseurId = id;
  currentClasseurOrigin = origin;
  selectView('view-classeur');
  
  // Mettre à jour le bouton de retour
  updateBackButton();
  
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
  setupSidebarResize();
}

function updateBackButton() {
  const backButton = document.getElementById('btn-back-to-list');
  if (!backButton) return;
  
  if (currentClasseurOrigin === 'archives') {
    backButton.textContent = '← Retour aux Archives';
    backButton.onclick = () => {
      selectView('view-archives');
      updateActiveNav(document.querySelector('[data-view="view-archives"]'));
    };
  } else {
    backButton.textContent = '← Retour aux Mes Classeurs';
    backButton.onclick = () => {
      selectView('view-classeurs');
      updateActiveNav(document.querySelector('[data-view="view-classeurs"]'));
    };
  }
}

function collectAllFiles(classeur) {
  const files = [];
  
  // Fonction récursive pour parcourir tous les dossiers
  function collectFromFolder(folder, depth = 0) {
    // Ajouter les fichiers du dossier actuel
    if (folder.files) {
      for (const [id, f] of Object.entries(folder.files)) {
        files.push({ ...f, id, depth });
      }
    }
    
    // Parcourir récursivement les sous-dossiers
    if (folder.folders) {
      for (const [subFolderId, subFolder] of Object.entries(folder.folders)) {
        collectFromFolder(subFolder, depth + 1);
      }
    }
  }
  
  // root files array (if any)
  if (Array.isArray(classeur.files)) {
    for (const f of classeur.files) {
      files.push({ ...f, depth: 0 });
    }
  }
  
  // Parcourir tous les dossiers récursivement
  if (classeur.folders) {
    for (const [fid, folder] of Object.entries(classeur.folders)) {
      collectFromFolder(folder, 1);
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

  // Fonction récursive pour rendre un dossier et ses sous-dossiers
  function renderFolder(folder, folderId, depth = 1) {
    const folderContainer = document.createElement('div');
    folderContainer.className = 'folder-container';
    
             const folderNode = document.createElement('div');
             folderNode.className = 'node folder-node';
             folderNode.style.paddingLeft = `${20 + (depth * 20)}px`;
             folderNode.innerHTML = `
               <span>📁 ${folder.name}</span>
               <div class="folder-actions">
                 <button class="btn-icon" title="Nouveau sous-dossier" data-action="create-subfolder" data-folder-id="${folderId}">📁+</button>
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

    // Ajouter les fichiers de ce dossier
    if (folder.files) {
      for (const [fileId, f] of Object.entries(folder.files)) {
        const fnode = document.createElement('div');
        fnode.className = 'node';
        fnode.style.paddingLeft = `${20 + ((depth + 1) * 20)}px`;
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

    // Récursivement rendre les sous-dossiers
    if (folder.folders) {
      for (const [subFolderId, subFolder] of Object.entries(folder.folders)) {
        const subFolderContainer = renderFolder(subFolder, subFolderId, depth + 1);
        folderContainer.appendChild(subFolderContainer);
      }
    }

    return folderContainer;
  }

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

  // Rendre tous les dossiers récursivement
  if (classeur.folders) {
    for (const [folderId, folder] of Object.entries(classeur.folders)) {
      const folderContainer = renderFolder(folder, folderId);
      tree.appendChild(folderContainer);
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
    case 'create-subfolder':
      openCreateSubfolderModal(folderId, folder.name);
      break;
    case 'upload':
      await uploadFilesToFolder(folderId);
      break;
    case 'edit':
      openRenameFolderModal(folderId, folder.name);
      break;
    case 'delete':
      if (await showConfirmModal('Confirmation', `Supprimer le dossier "${folder.name}" et tout son contenu ?`)) {
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

function openCreateSubfolderModal(parentFolderId, parentFolderName) {
  const modal = document.getElementById('modal-create-folder');
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'false');

  const nameInput = document.getElementById('folder-name');
  const confirmBtn = document.getElementById('confirm-create-folder');
  const closeEls = modal.querySelectorAll('[data-modal-close]');

  if (nameInput instanceof HTMLInputElement) nameInput.value = '';
  
  // Modifier le titre pour indiquer qu'on crée un sous-dossier
  const modalTitle = modal.querySelector('.modal-header h2');
  if (modalTitle) modalTitle.textContent = `Créer un sous-dossier dans "${parentFolderName}"`;

  const close = () => {
    modal.setAttribute('aria-hidden', 'true');
    // Restaurer le titre original
    if (modalTitle) modalTitle.textContent = 'Créer un dossier';
  };
  closeEls.forEach((el) => el.addEventListener('click', close, { once: true }));
  modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); }, { once: true });

  confirmBtn.addEventListener('click', async () => {
    const folderName = (nameInput instanceof HTMLInputElement ? nameInput.value.trim() : '');
    if (!folderName || !currentClasseurId) return;
    try {
      await window.classiflyer.createFolder(currentClasseurId, folderName, parentFolderId);
      // Refresh the classeur view
      const data = await window.classiflyer.getClasseur(currentClasseurId);
      renderClasseurTree(data);
      const allFiles = collectAllFiles(data);
      currentFileList = allFiles;
      close();
    } catch (e) {
      alert('Erreur lors de la création du sous-dossier: ' + e.message);
    }
  }, { once: true });
}

// PDF viewer state
let pdfDoc = null;
let currentPdfPage = 1;
let totalPdfPages = 1;
let pdfRenderTask = null; // tâche de rendu PDF.js active

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
  const isTxtByExt = /\.txt$/.test(lowerPath);
  const isPpByExt = /\.pp$/.test(lowerPath);
  const isOdtByExt = /\.odt$/.test(lowerPath);
  const isOdsByExt = /\.ods$/.test(lowerPath);
  const isOdpByExt = /\.odp$/.test(lowerPath);
  
  if (mime.startsWith('image/') || isImageByExt) {
    await renderImage(filePath, canvas);
  } else if (mime === 'application/pdf' || isPdfByExt) {
    await renderPDF(filePath, canvas, pdfNav);
  } else if (mime.includes('excel') || isExcelByExt || mime.includes('spreadsheet')) {
    await renderExcel(filePath, canvas);
  } else if (mime === 'text/plain' || isTxtByExt) {
    await renderText(filePath, canvas);
  } else if (mime.includes('powerpoint') || isPpByExt) {
    await renderPowerPoint(filePath, canvas);
  } else if (mime.includes('opendocument.text') || isOdtByExt) {
    await renderOpenDocument(filePath, canvas, 'text');
  } else if (mime.includes('opendocument.spreadsheet') || isOdsByExt) {
    await renderOpenDocument(filePath, canvas, 'spreadsheet');
  } else if (mime.includes('opendocument.presentation') || isOdpByExt) {
    await renderOpenDocument(filePath, canvas, 'presentation');
  } else {
    const hint = document.createElement('div');
    hint.textContent = 'Aperçu non supporté. Télécharger / ouvrir avec application externe.';
    canvas.appendChild(hint);
  }
}

async function renderImage(filePath, canvas) {
  try {
    const lowerPath = filePath.toLowerCase();
    const isSvg = lowerPath.endsWith('.svg');
    
    if (isSvg) {
      // Pour les SVG, charger directement le contenu et l'insérer dans un div
      const dataUrl = await window.classiflyer.fileToDataUrl(filePath);
      const base64Data = dataUrl.split(',')[1];
      const svgContent = atob(base64Data);
      
      const svgContainer = document.createElement('div');
      svgContainer.style.cssText = `
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: auto;
      `;
      svgContainer.innerHTML = svgContent;
      
      // S'assurer que le SVG s'adapte bien
      const svgElement = svgContainer.querySelector('svg');
      if (svgElement) {
        svgElement.style.maxWidth = '100%';
        svgElement.style.maxHeight = '100%';
        svgElement.style.width = 'auto';
        svgElement.style.height = 'auto';
      }
      
      canvas.appendChild(svgContainer);
      highlightCurrentFile(filePath);
      return;
    }
    
    // Pour les autres images, utiliser img normalement
    const dataUrl = await window.classiflyer.fileToDataUrl(filePath);
    const displayElement = document.createElement('img');
    displayElement.src = dataUrl;
    displayElement.style.maxWidth = '100%';
    displayElement.style.maxHeight = '100%';
    displayElement.style.objectFit = 'contain';
    displayElement.style.transition = 'transform 0.2s ease';
    displayElement.style.cursor = 'grab';
    
    let currentZoom = 1;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let startX, startY;
    
    // Fonction pour mettre à jour le zoom et la position
    const updateTransform = () => {
      displayElement.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentZoom})`;
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
    
    // Gestion du drag & drop pour les images normales
    displayElement.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX - translateX;
      startY = e.clientY - translateY;
      displayElement.style.cursor = 'grabbing';
      displayElement.style.transition = 'none'; // Désactiver la transition pendant le drag
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
        displayElement.style.cursor = 'grab';
        displayElement.style.transition = 'transform 0.2s ease'; // Remettre la transition
      }
    });
    
    // Zoom avec la molette
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      updateZoom(Math.min(Math.max(currentZoom * delta, 0.2), 5));
    });
    
    canvas.appendChild(displayElement);
    
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

async function renderText(filePath, canvas) {
  try {
    // Créer un conteneur pour le texte
    const textContainer = document.createElement('div');
    textContainer.style.cssText = `
      width: 100%;
      height: 100%;
      padding: 20px;
      overflow: auto;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.6;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      white-space: pre-wrap;
      word-wrap: break-word;
    `;
    
    // Lire le contenu du fichier
    const dataUrl = await window.classiflyer.fileToDataUrl(filePath);
    
    // Extraire le contenu base64 du data URL
    const base64Data = dataUrl.split(',')[1];
    
    // Décoder le base64 en texte
    const textContent = atob(base64Data);
    
    // Afficher le contenu
    textContainer.textContent = textContent;
    
    canvas.appendChild(textContainer);
    
    // Mettre en surbrillance le fichier actuel dans la sidebar
    highlightCurrentFile(filePath);
    
  } catch (error) {
    console.error('Erreur lors du chargement du fichier texte:', error);
    const hint = document.createElement('div');
    hint.textContent = 'Erreur lors du chargement du fichier texte.';
    canvas.appendChild(hint);
  }
}

async function renderPowerPoint(filePath, canvas) {
  try {
    const fileName = filePath.split(/[\\/]/).pop();
    const isOldFormat = fileName.toLowerCase().endsWith('.pp');
    
    // Créer un conteneur pour la présentation PowerPoint
    const ppContainer = document.createElement('div');
    ppContainer.style.cssText = `
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: white;
      border-radius: 8px;
      overflow: hidden;
    `;
    
    // Header avec contrôles
    const header = document.createElement('div');
    header.style.cssText = `
      background: #d32f2f;
      color: white;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 600;
    `;
    
    const title = document.createElement('div');
    title.textContent = isOldFormat ? '📊 PowerPoint 95/97 (.pp)' : '📊 Présentation PowerPoint';
    
    const controls = document.createElement('div');
    controls.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: center;
    `;
    
    const slideCounter = document.createElement('div');
    slideCounter.id = 'slide-counter';
    slideCounter.style.cssText = `
      background: rgba(255,255,255,0.2);
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 14px;
    `;
    
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Préc.';
    prevBtn.style.cssText = `
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    `;
    
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Suiv. →';
    nextBtn.style.cssText = `
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    `;
    
    controls.appendChild(slideCounter);
    controls.appendChild(prevBtn);
    controls.appendChild(nextBtn);
    header.appendChild(title);
    header.appendChild(controls);
    
    // Zone de contenu des slides
    const slideArea = document.createElement('div');
    slideArea.style.cssText = `
      flex: 1;
      padding: 20px;
      overflow-y: auto;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // Loading
    const loading = document.createElement('div');
    loading.textContent = '⏳ Chargement de la présentation...';
    loading.style.cssText = `
      font-size: 16px;
      color: #666;
    `;
    slideArea.appendChild(loading);
    
    ppContainer.appendChild(header);
    ppContainer.appendChild(slideArea);
    canvas.appendChild(ppContainer);
    
    // Gestion spéciale pour les anciens fichiers .pp
    if (isOldFormat) {
      slideArea.innerHTML = `
        <div style="text-align: center; color: #d32f2f;">
          <div style="font-size: 64px; margin-bottom: 20px;">📊</div>
          <h2 style="color: #d32f2f; margin-bottom: 16px;">PowerPoint 95/97 (.pp)</h2>
          <p style="font-size: 16px; margin-bottom: 24px; max-width: 600px; line-height: 1.6;">
            Ce fichier utilise l'ancien format PowerPoint 95/97 (.pp) qui est un format binaire fermé. 
            Contrairement aux fichiers .pptx modernes, ce format ne peut pas être lu directement par le navigateur.
          </p>
          <div style="
            background: #fff;
            border-radius: 8px;
            padding: 24px;
            margin: 20px 0;
            border-left: 4px solid #d32f2f;
            text-align: left;
            max-width: 500px;
          ">
            <h3 style="margin: 0 0 12px 0; color: #d32f2f;">📄 Informations du fichier :</h3>
            <div style="margin-bottom: 8px;"><strong>Nom :</strong> ${fileName}</div>
            <div style="margin-bottom: 8px;"><strong>Taille :</strong> ${await getFileSize(filePath)}</div>
            <div style="margin-bottom: 8px;"><strong>Format :</strong> PowerPoint 95/97</div>
            <div><strong>Chemin :</strong> <span style="font-family: monospace; background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">${filePath}</span></div>
          </div>
          <div style="
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
            max-width: 600px;
          ">
            <h4 style="margin: 0 0 8px 0; color: #856404;">💡 Solutions recommandées :</h4>
            <ul style="text-align: left; margin: 0; padding-left: 20px; color: #856404;">
              <li>Ouvrir avec Microsoft PowerPoint et sauvegarder au format .pptx moderne</li>
              <li>Utiliser LibreOffice Impress pour convertir le fichier</li>
              <li>Utiliser des outils de conversion en ligne</li>
            </ul>
          </div>
          <button onclick="alert('Fichier ${fileName} - Format PowerPoint 95/97 non supporté pour la visualisation directe')" style="
            background: #d32f2f;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 16px;
            cursor: pointer;
            margin-top: 16px;
          ">
            📁 Ouvrir avec application externe
          </button>
        </div>
      `;
      
      // Mettre en surbrillance le fichier actuel dans la sidebar
      highlightCurrentFile(filePath);
      return;
    }
    
    // Message simple pour PowerPoint - besoin d'app externe
    slideArea.innerHTML = `
      <div style="text-align: center; color: #d32f2f;">
        <div style="font-size: 64px; margin-bottom: 20px;">📊</div>
        <h2 style="color: #d32f2f; margin-bottom: 16px;">Présentation PowerPoint</h2>
        <p style="font-size: 16px; margin-bottom: 24px; max-width: 600px; line-height: 1.6;">
          Ce fichier PowerPoint nécessite une application externe pour être visualisé correctement avec toutes ses fonctionnalités (images, animations, formatage).
        </p>
        <div style="
          background: #fff;
          border-radius: 8px;
          padding: 24px;
          margin: 20px 0;
          border-left: 4px solid #d32f2f;
          text-align: left;
          max-width: 500px;
        ">
          <h3 style="margin: 0 0 12px 0; color: #d32f2f;">📄 Informations du fichier :</h3>
          <div style="margin-bottom: 8px;"><strong>Nom :</strong> ${fileName}</div>
          <div style="margin-bottom: 8px;"><strong>Taille :</strong> ${await getFileSize(filePath)}</div>
          <div style="margin-bottom: 8px;"><strong>Format :</strong> PowerPoint (.pptx)</div>
          <div><strong>Chemin :</strong> <span style="font-family: monospace; background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">${filePath}</span></div>
        </div>
        <div style="
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 16px;
          margin: 20px 0;
          max-width: 600px;
        ">
          <h4 style="margin: 0 0 8px 0; color: #856404;">💡 Solutions recommandées :</h4>
          <ul style="text-align: left; margin: 0; padding-left: 20px; color: #856404;">
            <li>Microsoft PowerPoint (Windows/Mac)</li>
            <li>LibreOffice Impress (gratuit)</li>
            <li>Google Slides (en ligne)</li>
            <li>PowerPoint Online (Microsoft)</li>
          </ul>
        </div>
        <button onclick="alert('Fichier ${fileName} - Utilisez PowerPoint ou une application compatible pour visualiser la présentation')" style="
          background: #d32f2f;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
          margin-top: 16px;
        ">
          📁 Ouvrir avec application externe
        </button>
      </div>
    `;
    
    // Mettre en surbrillance le fichier actuel dans la sidebar
    highlightCurrentFile(filePath);
    
  } catch (error) {
    console.error('Erreur lors du chargement du fichier PowerPoint:', error);
    const hint = document.createElement('div');
    hint.textContent = 'Erreur lors du chargement du fichier PowerPoint.';
    canvas.appendChild(hint);
  }
}

// Fonction pour charger des scripts dynamiquement
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Fonction pour extraire le texte des slides
function extractSlideText(slideXml) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(slideXml, 'text/xml');
    
    // Extraire tous les textes
    const textElements = doc.querySelectorAll('a\\:t, t');
    const texts = Array.from(textElements).map(el => el.textContent).filter(t => t.trim());
    
    // Essayer de déterminer le titre (premier texte généralement)
    const title = texts[0] || 'Slide sans titre';
    const content = texts.slice(1).join('\n') || 'Contenu non disponible';
    
    return { title, content };
  } catch (error) {
    return { 
      title: 'Slide', 
      content: 'Impossible d\'extraire le contenu' 
    };
  }
}

// Fonction pour extraire les slides avec images et formatage (VERSION CORRIGÉE)
async function extractSlideWithImages(slideXml, images) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(slideXml, 'text/xml');
    
    console.log('=== DEBUG SLIDE XML ===');
    console.log('XML reçu:', slideXml.substring(0, 500) + '...');
    
    // Extraire les textes correctement - chercher dans les shapes (a:sp)
    const textElements = [];
    const shapes = doc.querySelectorAll('a\\:sp');
    
    console.log(`Nombre de shapes trouvés: ${shapes.length}`);
    
    shapes.forEach((shape, shapeIndex) => {
      console.log(`Shape ${shapeIndex}:`, shape.outerHTML.substring(0, 200) + '...');
      
      // Chercher les paragraphes dans cette shape
      const paragraphs = shape.querySelectorAll('a\\:p');
      console.log(`  - Paragraphes: ${paragraphs.length}`);
      
      paragraphs.forEach((p, pIndex) => {
        const texts = p.querySelectorAll('a\\:t');
        console.log(`    - Paragraphe ${pIndex}, textes: ${texts.length}`);
        
        const paragraphText = Array.from(texts).map(t => t.textContent).join('');
        if (paragraphText.trim()) {
          console.log(`    - Texte: "${paragraphText}"`);
          textElements.push(paragraphText.trim());
        }
      });
    });
    
    // Extraire les images correctement
    const slideImages = [];
    const imageShapes = doc.querySelectorAll('a\\:pic');
    
    console.log(`Nombre d'images trouvées: ${imageShapes.length}`);
    
    imageShapes.forEach((pic, picIndex) => {
      console.log(`Image ${picIndex}:`, pic.outerHTML.substring(0, 200) + '...');
      
      const blip = pic.querySelector('a\\:blip');
      if (blip) {
        const embed = blip.getAttribute('r\\:embed');
        console.log(`  - Embed ID: ${embed}`);
        
        if (embed) {
          // Chercher l'image correspondante dans les médias
          const imagePath = Object.keys(images).find(path => {
            // L'embed ID correspond souvent au nom de fichier
            const fileName = path.split('/').pop().split('.')[0];
            return embed.includes(fileName) || path.includes(embed);
          });
          
          if (imagePath) {
            console.log(`  - Image trouvée: ${imagePath}`);
            slideImages.push(images[imagePath]);
          } else {
            console.log(`  - Aucune image trouvée pour embed: ${embed}`);
            console.log(`  - Images disponibles:`, Object.keys(images));
          }
        }
      }
    });
    
    console.log('=== RÉSULTAT FINAL ===');
    console.log('Textes extraits:', textElements);
    console.log('Images extraites:', slideImages.length);
    
    const title = textElements[0] || 'Slide sans titre';
    const content = textElements.slice(1);
    
    return {
      title,
      content,
      images: slideImages,
      shapes: []
    };
  } catch (error) {
    console.error('Erreur extraction slide:', error);
    return {
      title: 'Slide',
      content: ['Impossible d\'extraire le contenu'],
      images: [],
      shapes: []
    };
  }
}

// Fonction pour afficher les slides
function displaySlides(slides, container, counter, prevBtn, nextBtn) {
  let currentSlide = 0;
  
  function showSlide(index) {
    const slide = slides[index];
    container.innerHTML = `
      <div style="
        background: white;
        border-radius: 8px;
        padding: 40px;
        max-width: 800px;
        width: 100%;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        text-align: center;
      ">
        <h2 style="
          color: #d32f2f;
          margin: 0 0 24px 0;
          font-size: 28px;
          border-bottom: 2px solid #e0e0e0;
          padding-bottom: 16px;
        ">${slide.title}</h2>
        <div style="
          font-size: 16px;
          line-height: 1.6;
          color: #333;
          white-space: pre-line;
          text-align: left;
        ">${slide.content}</div>
      </div>
    `;
    
    counter.textContent = `${index + 1} / ${slides.length}`;
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === slides.length - 1;
    
    prevBtn.style.opacity = prevBtn.disabled ? '0.5' : '1';
    nextBtn.style.opacity = nextBtn.disabled ? '0.5' : '1';
  }
  
  prevBtn.onclick = () => {
    if (currentSlide > 0) {
      currentSlide--;
      showSlide(currentSlide);
    }
  };
  
  nextBtn.onclick = () => {
    if (currentSlide < slides.length - 1) {
      currentSlide++;
      showSlide(currentSlide);
    }
  };
  
  // Afficher le premier slide
  showSlide(0);
}

// Fonction pour afficher les slides avec images (style Google Slides)
function displaySlidesWithImages(slides, container, counter, prevBtn, nextBtn) {
  let currentSlide = 0;
  
  function showSlide(index) {
    const slide = slides[index];
    
    // Créer le contenu de la slide avec images
    let imagesHtml = '';
    if (slide.images && slide.images.length > 0) {
      imagesHtml = slide.images.map(img => `
        <div style="margin: 16px 0; text-align: center;">
          <img src="${img}" style="
            max-width: 100%;
            max-height: 400px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            object-fit: contain;
          " />
        </div>
      `).join('');
    }
    
    // Créer le contenu texte
    let contentHtml = '';
    if (slide.content && slide.content.length > 0) {
      contentHtml = slide.content.map(text => `
        <div style="
          margin: 12px 0;
          font-size: 16px;
          line-height: 1.6;
          color: #333;
          text-align: left;
        ">${text}</div>
      `).join('');
    }
    
    container.innerHTML = `
      <div style="
        background: white;
        border-radius: 12px;
        padding: 40px;
        max-width: 900px;
        width: 100%;
        max-height: calc(100vh - 200px);
        overflow-y: auto;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        text-align: center;
        position: relative;
      ">
        <div style="
          position: absolute;
          top: 12px;
          right: 12px;
          background: rgba(211, 47, 47, 0.1);
          color: #d32f2f;
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 600;
        ">
          Slide ${index + 1}
        </div>
        
        <h1 style="
          color: #d32f2f;
          margin: 0 0 32px 0;
          font-size: 32px;
          font-weight: bold;
          border-bottom: 3px solid #e0e0e0;
          padding-bottom: 16px;
          text-align: center;
        ">${slide.title}</h1>
        
        ${imagesHtml}
        
        <div style="
          margin-top: 24px;
          text-align: left;
        ">
          ${contentHtml}
        </div>
        
        ${slide.shapes && slide.shapes.length > 0 ? `
          <div style="
            margin-top: 24px;
            padding: 16px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #d32f2f;
          ">
            <div style="color: #666; font-size: 14px;">
              📊 Cette slide contient ${slide.shapes.length} élément(s) graphique(s)
            </div>
          </div>
        ` : ''}
      </div>
    `;
    
    counter.textContent = `${index + 1} / ${slides.length}`;
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === slides.length - 1;
    
    prevBtn.style.opacity = prevBtn.disabled ? '0.5' : '1';
    nextBtn.style.opacity = nextBtn.disabled ? '0.5' : '1';
  }
  
  prevBtn.onclick = () => {
    if (currentSlide > 0) {
      currentSlide--;
      showSlide(currentSlide);
    }
  };
  
  nextBtn.onclick = () => {
    if (currentSlide < slides.length - 1) {
      currentSlide++;
      showSlide(currentSlide);
    }
  };
  
  // Afficher le premier slide
  showSlide(0);
}

// Fonction utilitaire pour obtenir la taille d'un fichier
async function getFileSize(filePath) {
  try {
    const dataUrl = await window.classiflyer.fileToDataUrl(filePath);
    const base64Data = dataUrl.split(',')[1];
    const bytes = atob(base64Data).length;
    
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  } catch (error) {
    return 'Taille inconnue';
  }
}

async function renderOpenDocument(filePath, canvas, docType) {
  try {
    // Créer un conteneur pour le document OpenDocument
    const odContainer = document.createElement('div');
    odContainer.style.cssText = `
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: white;
      border-radius: 8px;
      overflow: hidden;
    `;
    
    // Icons et titres selon le type
    const configs = {
      text: { icon: '📝', title: 'Document OpenOffice Writer', color: '#4caf50' },
      spreadsheet: { icon: '📊', title: 'Tableur OpenOffice Calc', color: '#2196f3' },
      presentation: { icon: '📋', title: 'Présentation OpenOffice Impress', color: '#ff9800' }
    };
    
    const config = configs[docType] || configs.text;
    
    // Header avec contrôles
    const header = document.createElement('div');
    header.style.cssText = `
      background: ${config.color};
      color: white;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 600;
    `;
    
    const title = document.createElement('div');
    title.textContent = `${config.icon} ${config.title}`;
    
    const info = document.createElement('div');
    info.style.cssText = `
      background: rgba(255,255,255,0.2);
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 14px;
    `;
    info.textContent = filePath.split(/[\\/]/).pop();
    
    header.appendChild(title);
    header.appendChild(info);
    
    // Zone de contenu du document
    const docArea = document.createElement('div');
    docArea.style.cssText = `
      flex: 1;
      padding: 20px;
      overflow-y: auto;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // Loading
    const loading = document.createElement('div');
    loading.textContent = '⏳ Chargement du document...';
    loading.style.cssText = `
      font-size: 16px;
      color: #666;
    `;
    docArea.appendChild(loading);
    
    odContainer.appendChild(header);
    odContainer.appendChild(docArea);
    canvas.appendChild(odContainer);
    
    // Charger le fichier ODT avec WebODF
    try {
      const dataUrl = await window.classiflyer.fileToDataUrl(filePath);
      const response = await fetch(dataUrl);
      const arrayBuffer = await response.arrayBuffer();
      
      // Utiliser JSZip pour lire le fichier ODT et extraire les images
      if (!window.JSZip) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
      }
      
      const zip = new JSZip();
      const contents = await zip.loadAsync(arrayBuffer);
      
      // Extraire toutes les images d'abord
      const images = {};
      for (const [filename, file] of Object.entries(contents.files)) {
        if (filename.match(/Pictures\/[^\/]+\.(png|jpg|jpeg|gif|svg|bmp)/)) {
          const imageData = await file.async('base64');
          const ext = filename.split('.').pop().toLowerCase();
          images[filename] = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${imageData}`;
        }
      }
      
      // Lire le contenu principal avec images
      let documentContent = '';
      
      if (docType === 'text') {
        // Pour les documents texte ODT
        if (contents.files['content.xml']) {
          const contentXml = await contents.files['content.xml'].async('text');
          documentContent = await extractODTWithImages(contentXml, images);
        }
      } else if (docType === 'spreadsheet') {
        // Pour les tableurs ODS
        if (contents.files['content.xml']) {
          const contentXml = await contents.files['content.xml'].async('text');
          documentContent = await extractODSWithImages(contentXml, images);
        }
      } else if (docType === 'presentation') {
        // Pour les présentations ODP
        if (contents.files['content.xml']) {
          const contentXml = await contents.files['content.xml'].async('text');
          documentContent = await extractODPWithImages(contentXml, images);
        }
      }
      
      // Si aucun contenu trouvé
      if (!documentContent) {
        documentContent = `
          <div style="text-align: center; color: ${config.color};">
            <div style="font-size: 48px; margin-bottom: 16px;">${config.icon}</div>
            <h3>Document OpenDocument détecté</h3>
            <p>Le fichier est valide mais son contenu n'est pas entièrement analysable.</p>
            <div style="margin-top: 20px; padding: 16px; background: #fff; border-radius: 8px; border-left: 4px solid ${config.color};">
              <strong>Fichier :</strong> ${filePath.split(/[\\/]/).pop()}<br>
              <strong>Taille :</strong> ${await getFileSize(filePath)}<br>
              <strong>Type :</strong> ${config.title}
            </div>
          </div>
        `;
      }
      
      // Afficher le contenu
      docArea.innerHTML = documentContent;
      
    } catch (error) {
      console.error('Erreur lors du parsing OpenDocument:', error);
      docArea.innerHTML = `
        <div style="text-align: center; color: ${config.color};">
          <div style="font-size: 48px; margin-bottom: 16px;">${config.icon}</div>
          <h3>Erreur de lecture</h3>
          <p>Impossible d'analyser le fichier OpenDocument.</p>
          <div style="margin-top: 20px; padding: 16px; background: #fff; border-radius: 8px; border-left: 4px solid #f44336;">
            <strong>Erreur :</strong> ${error.message}
          </div>
        </div>
      `;
    }
    
    // Mettre en surbrillance le fichier actuel dans la sidebar
    highlightCurrentFile(filePath);
    
  } catch (error) {
    console.error('Erreur lors du chargement du fichier OpenDocument:', error);
    const hint = document.createElement('div');
    hint.textContent = 'Erreur lors du chargement du fichier OpenDocument.';
    canvas.appendChild(hint);
  }
}

// Fonction pour extraire le texte des documents ODT
function extractODTText(contentXml) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(contentXml, 'text/xml');
    
    // Extraire tous les paragraphes et textes
    const textElements = doc.querySelectorAll('text\\:p, p');
    const paragraphs = Array.from(textElements).map(el => {
      const text = el.textContent.trim();
      return text ? `<p style="margin-bottom: 12px; line-height: 1.6;">${text}</p>` : '';
    }).filter(p => p);
    
    if (paragraphs.length === 0) {
      return null;
    }
    
    return `
      <div style="
        background: white;
        border-radius: 8px;
        padding: 40px;
        max-width: 800px;
        width: 100%;
        max-height: calc(100vh - 200px);
        overflow-y: auto;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        text-align: left;
      ">
        <div style="color: #333; font-size: 16px;">
          ${paragraphs.join('')}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Erreur extraction ODT:', error);
    return null;
  }
}

// Fonction pour extraire les documents ODT avec images
async function extractODTWithImages(contentXml, images) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(contentXml, 'text/xml');
    
    // Extraire les paragraphes avec formatage
    const textElements = doc.querySelectorAll('text\\:p, p');
    const paragraphs = [];
    
    textElements.forEach(p => {
      const text = p.textContent.trim();
      if (text) {
        // Vérifier s'il y a du formatage
        const isHeading = p.getAttribute('text\\:style-name')?.includes('Heading') || 
                         p.getAttribute('style-name')?.includes('Heading');
        const isBold = p.querySelector('text\\:span[text\\:style-name*="Bold"], span[style-name*="Bold"]');
        
        let style = "margin-bottom: 12px; line-height: 1.6;";
        let tag = "p";
        
        if (isHeading) {
          style = "margin: 24px 0 16px 0; font-size: 20px; font-weight: bold; color: #4caf50;";
          tag = "h3";
        } else if (isBold) {
          style = "margin-bottom: 12px; line-height: 1.6; font-weight: bold;";
        }
        
        paragraphs.push(`<${tag} style="${style}">${text}</${tag}>`);
      }
    });
    
    // Extraire les images
    const imageElements = doc.querySelectorAll('draw\\:image, image');
    const imageHtml = [];
    
    imageElements.forEach(img => {
      const href = img.getAttribute('xlink\\:href') || img.getAttribute('href');
      if (href) {
        const imagePath = Object.keys(images).find(path => 
          path.includes(href) || href.includes(path.split('/').pop())
        );
        if (imagePath) {
          imageHtml.push(`
            <div style="margin: 20px 0; text-align: center;">
              <img src="${images[imagePath]}" style="
                max-width: 100%;
                max-height: 400px;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                object-fit: contain;
              " />
            </div>
          `);
        }
      }
    });
    
    // Combiner texte et images
    const content = [...paragraphs, ...imageHtml].join('');
    
    if (!content) {
      return null;
    }
    
    return `
      <div style="
        background: white;
        border-radius: 12px;
        padding: 40px;
        max-width: 800px;
        width: 100%;
        max-height: calc(100vh - 200px);
        overflow-y: auto;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        text-align: left;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      ">
        <div style="color: #333; font-size: 16px; line-height: 1.6;">
          ${content}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Erreur extraction ODT avec images:', error);
    return null;
  }
}

// Fonction pour extraire le contenu des tableurs ODS
function extractODSContent(contentXml) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(contentXml, 'text/xml');
    
    // Extraire les cellules du tableur
    const cells = doc.querySelectorAll('table\\:table-cell, table-cell');
    const cellData = Array.from(cells).map(cell => cell.textContent.trim()).filter(text => text);
    
    if (cellData.length === 0) {
      return null;
    }
    
    // Créer un aperçu simple du tableur
    const rows = [];
    for (let i = 0; i < Math.min(cellData.length, 50); i += 5) {
      const row = cellData.slice(i, i + 5);
      if (row.length > 0) {
        rows.push(`<tr>${row.map(cell => `<td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;">${cell}</td>`).join('')}</tr>`);
      }
    }
    
    return `
      <div style="
        background: white;
        border-radius: 8px;
        padding: 20px;
        max-width: 800px;
        width: 100%;
        max-height: calc(100vh - 200px);
        overflow-y: auto;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      ">
        <h3 style="color: #2196f3; margin-bottom: 20px;">Aperçu du tableur</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${rows.join('')}
        </table>
        ${cellData.length > 50 ? '<p style="margin-top: 16px; color: #666; font-style: italic;">... et plus de données</p>' : ''}
      </div>
    `;
  } catch (error) {
    console.error('Erreur extraction ODS:', error);
    return null;
  }
}

// Fonction pour extraire le contenu des présentations ODP
function extractODPContent(contentXml) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(contentXml, 'text/xml');
    
    // Extraire les slides/pages
    const pages = doc.querySelectorAll('draw\\:page, page');
    const slides = Array.from(pages).map((page, index) => {
      const textElements = page.querySelectorAll('text\\:p, p');
      const texts = Array.from(textElements).map(el => el.textContent.trim()).filter(t => t);
      
      return {
        number: index + 1,
        title: texts[0] || `Slide ${index + 1}`,
        content: texts.slice(1).join('\n') || 'Contenu non disponible'
      };
    });
    
    if (slides.length === 0) {
      return null;
    }
    
    const slideList = slides.map(slide => `
      <div style="
        background: #f5f5f5;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 16px;
        border-left: 4px solid #ff9800;
      ">
        <h4 style="color: #ff9800; margin: 0 0 12px 0;">Slide ${slide.number}: ${slide.title}</h4>
        <div style="color: #333; white-space: pre-line;">${slide.content}</div>
      </div>
    `).join('');
    
    return `
      <div style="
        background: white;
        border-radius: 8px;
        padding: 20px;
        max-width: 800px;
        width: 100%;
        max-height: calc(100vh - 200px);
        overflow-y: auto;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      ">
        <h3 style="color: #ff9800; margin-bottom: 20px;">Contenu de la présentation (${slides.length} slides)</h3>
        ${slideList}
      </div>
    `;
  } catch (error) {
    console.error('Erreur extraction ODP:', error);
    return null;
  }
}

// Fonction pour extraire les tableurs ODS avec images
async function extractODSWithImages(contentXml, images) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(contentXml, 'text/xml');
    
    // Extraire les cellules avec formatage
    const tables = doc.querySelectorAll('table\\:table, table');
    const tablesHtml = [];
    
    tables.forEach((table, tableIndex) => {
      const rows = table.querySelectorAll('table\\:table-row, tr');
      const tableRows = [];
      
      rows.forEach(row => {
        const cells = row.querySelectorAll('table\\:table-cell, td');
        const cellData = Array.from(cells).map(cell => {
          const text = cell.textContent.trim();
          const isHeader = cell.getAttribute('table\\:style-name')?.includes('Header') ||
                          cell.getAttribute('style-name')?.includes('Header');
          
          const style = isHeader ? 
            "padding: 12px; border: 1px solid #ddd; background: #2196f3; color: white; font-weight: bold;" :
            "padding: 8px; border: 1px solid #ddd; background: #f9f9f9;";
          
          return `<td style="${style}">${text}</td>`;
        });
        
        if (cellData.length > 0) {
          tableRows.push(`<tr>${cellData.join('')}</tr>`);
        }
      });
      
      if (tableRows.length > 0) {
        tablesHtml.push(`
          <div style="margin: 20px 0;">
            <h4 style="color: #2196f3; margin-bottom: 12px;">Tableau ${tableIndex + 1}</h4>
            <table style="width: 100%; border-collapse: collapse; border: 2px solid #2196f3;">
              ${tableRows.join('')}
            </table>
          </div>
        `);
      }
    });
    
    // Extraire les images
    const imageElements = doc.querySelectorAll('draw\\:image, image');
    const imageHtml = [];
    
    imageElements.forEach(img => {
      const href = img.getAttribute('xlink\\:href') || img.getAttribute('href');
      if (href) {
        const imagePath = Object.keys(images).find(path => 
          path.includes(href) || href.includes(path.split('/').pop())
        );
        if (imagePath) {
          imageHtml.push(`
            <div style="margin: 20px 0; text-align: center;">
              <img src="${images[imagePath]}" style="
                max-width: 100%;
                max-height: 300px;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                object-fit: contain;
              " />
            </div>
          `);
        }
      }
    });
    
    const content = [...tablesHtml, ...imageHtml].join('');
    
    if (!content) {
      return null;
    }
    
    return `
      <div style="
        background: white;
        border-radius: 12px;
        padding: 30px;
        max-width: 900px;
        width: 100%;
        max-height: calc(100vh - 200px);
        overflow-y: auto;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      ">
        <h3 style="color: #2196f3; margin-bottom: 24px; text-align: center;">📊 Tableur OpenOffice Calc</h3>
        ${content}
      </div>
    `;
  } catch (error) {
    console.error('Erreur extraction ODS avec images:', error);
    return null;
  }
}

// Fonction pour extraire les présentations ODP avec images
async function extractODPWithImages(contentXml, images) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(contentXml, 'text/xml');
    
    // Extraire les slides/pages avec images
    const pages = doc.querySelectorAll('draw\\:page, page');
    const slides = [];
    
    pages.forEach((page, index) => {
      const textElements = page.querySelectorAll('text\\:p, p');
      const texts = Array.from(textElements).map(el => el.textContent.trim()).filter(t => t);
      
      // Extraire les images de cette slide
      const slideImages = [];
      const imageElements = page.querySelectorAll('draw\\:image, image');
      
      imageElements.forEach(img => {
        const href = img.getAttribute('xlink\\:href') || img.getAttribute('href');
        if (href) {
          const imagePath = Object.keys(images).find(path => 
            path.includes(href) || href.includes(path.split('/').pop())
          );
          if (imagePath) {
            slideImages.push(images[imagePath]);
          }
        }
      });
      
      slides.push({
        number: index + 1,
        title: texts[0] || `Slide ${index + 1}`,
        content: texts.slice(1),
        images: slideImages
      });
    });
    
    if (slides.length === 0) {
      return null;
    }
    
    const slideList = slides.map(slide => {
      const imagesHtml = slide.images.map(img => `
        <div style="margin: 16px 0; text-align: center;">
          <img src="${img}" style="
            max-width: 100%;
            max-height: 300px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            object-fit: contain;
          " />
        </div>
      `).join('');
      
      const contentHtml = slide.content.map(text => `
        <div style="margin: 8px 0; color: #333;">${text}</div>
      `).join('');
      
      return `
        <div style="
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 20px;
          border-left: 6px solid #ff9800;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        ">
          <h4 style="color: #ff9800; margin: 0 0 16px 0; font-size: 20px;">
            📋 Slide ${slide.number}: ${slide.title}
          </h4>
          ${imagesHtml}
          <div style="margin-top: 16px;">
            ${contentHtml}
          </div>
        </div>
      `;
    }).join('');
    
    return `
      <div style="
        background: white;
        border-radius: 12px;
        padding: 30px;
        max-width: 900px;
        width: 100%;
        max-height: calc(100vh - 200px);
        overflow-y: auto;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      ">
        <h3 style="color: #ff9800; margin-bottom: 24px; text-align: center;">
          📋 Présentation OpenOffice Impress (${slides.length} slides)
        </h3>
        ${slideList}
      </div>
    `;
  } catch (error) {
    console.error('Erreur extraction ODP avec images:', error);
    return null;
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
    pdfCanvas.style.display = 'block';
    pdfCanvas.style.margin = '0 auto';
    pdfCanvas.style.border = '1px solid #ddd';
    pdfCanvas.style.cursor = 'grab';
    canvas.appendChild(pdfCanvas);

    // Charger le document avec PDF.js
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
    pdfDoc = await loadingTask.promise;
    totalPdfPages = pdfDoc.numPages;
    currentPdfPage = 1;

    // Mettre à jour l'info de page
    updatePdfPageInfo();
    
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
    
    // Initialiser l'affichage du zoom PDF (et rendre la première page)
    await updatePdfZoom(currentZoom);

    // Zoom à la molette sur le PDF (throttle)
    let wheelThrottle = null;
    canvas.addEventListener('wheel', async (e) => {
      e.preventDefault();
      if (wheelThrottle) return;
      wheelThrottle = setTimeout(() => { wheelThrottle = null; }, 100);
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const nextZoom = Math.min(Math.max(currentZoom * delta, 0.5), 7.5);
      await updatePdfZoom(nextZoom);
    }, { passive: false });
    
    // Mettre en surbrillance le fichier actuel dans la sidebar
    highlightCurrentFile(filePath);

    // Configuration des boutons de navigation
    const prevBtn = document.getElementById('pdf-prev');
    const nextBtn = document.getElementById('pdf-next');
    
    if (prevBtn) {
      prevBtn.onclick = async () => {
        if (currentPdfPage > 1) {
          currentPdfPage--;
          await renderCurrentPdfPage(pdfCanvas, currentZoom);
          updatePdfPageInfo();
        }
      };
    }
    
    if (nextBtn) {
      nextBtn.onclick = async () => {
        if (currentPdfPage < totalPdfPages) {
          currentPdfPage++;
          await renderCurrentPdfPage(pdfCanvas, currentZoom);
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

  // Définir la taille du canvas selon le viewport
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');
  const renderContext = {
    canvasContext: context,
    viewport: viewport
  };

  // Annuler un rendu en cours si présent avant d'en lancer un nouveau
  if (pdfRenderTask && typeof pdfRenderTask.cancel === 'function') {
    try { pdfRenderTask.cancel(); } catch (_) { /* ignore */ }
  }
  pdfRenderTask = page.render(renderContext);
  try {
    await pdfRenderTask.promise;
  } catch (_) {
    // Ignorer les erreurs dues aux annulations
  } finally {
    pdfRenderTask = null;
  }
  
  // Mettre à jour le style du canvas pour le scroll
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
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
    const sheetNames = workbook.SheetNames;
    
    // Créer le conteneur avec onglets
    const excelContainer = document.createElement('div');
    excelContainer.className = 'excel-container';
    excelContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      overflow: hidden;
    `;
    
    // Créer les onglets si plusieurs feuilles
    let tabsContainer = null;
    if (sheetNames.length > 1) {
      tabsContainer = document.createElement('div');
      tabsContainer.className = 'excel-tabs';
      tabsContainer.style.cssText = `
        display: flex;
        background: #f8f9fa;
        border-bottom: 2px solid #e9ecef;
        overflow-x: auto;
        flex-shrink: 0;
        padding: 0 8px;
      `;
      
      sheetNames.forEach((sheetName, index) => {
        const tab = document.createElement('button');
        tab.className = `excel-tab ${index === 0 ? 'active' : ''}`;
        tab.textContent = sheetName;
        tab.style.cssText = `
          padding: 12px 20px;
          margin: 4px 2px 0;
          border: none;
          background: ${index === 0 ? '#ffffff' : '#e9ecef'};
          color: ${index === 0 ? '#2563eb' : '#6b7280'};
          border-radius: 8px 8px 0 0;
          cursor: pointer;
          font-weight: ${index === 0 ? '600' : '400'};
          font-size: 14px;
          border-bottom: ${index === 0 ? '2px solid #2563eb' : '2px solid transparent'};
          transition: all 0.2s ease;
          white-space: nowrap;
        `;
        
        tab.addEventListener('click', () => {
          // Désactiver tous les onglets
          tabsContainer.querySelectorAll('.excel-tab').forEach(t => {
            t.style.background = '#e9ecef';
            t.style.color = '#6b7280';
            t.style.fontWeight = '400';
            t.style.borderBottom = '2px solid transparent';
            t.classList.remove('active');
          });
          
          // Activer l'onglet cliqué
          tab.style.background = '#ffffff';
          tab.style.color = '#2563eb';
          tab.style.fontWeight = '600';
          tab.style.borderBottom = '2px solid #2563eb';
          tab.classList.add('active');
          
          // Afficher la feuille correspondante
          renderSheet(sheetName, contentContainer, XLSX, workbook);
        });
        
        tabsContainer.appendChild(tab);
      });
      
      excelContainer.appendChild(tabsContainer);
    }
    
    // Créer le conteneur pour le contenu de la feuille (responsive)
    const contentContainer = document.createElement('div');
    contentContainer.className = 'excel-content';
    contentContainer.style.cssText = `
      padding: 8px 0 0 0;
      background: white;
      flex: 1;
      min-height: 0;
      display: flex;
    `;
    
    excelContainer.appendChild(contentContainer);
    
    // Fonction pour afficher une feuille
    function renderSheet(sheetName, container, XLSX, workbook) {
      const worksheet = workbook.Sheets[sheetName];
      
      // Mettre à jour le titre avec le nom de l'onglet
      const titleElement = document.getElementById('viewer-title');
      if (titleElement) {
        const fileName = filePath.split(/[/\\]/).pop() || 'Fichier Excel';
        titleElement.textContent = `${fileName} - ${sheetName}`;
      }
      
      // Obtenir les données de la feuille
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
      
      // Fonction pour convertir un numéro de colonne en lettre (0->A, 1->B, etc.)
      function numberToColumnLetter(num) {
        let result = '';
        while (num >= 0) {
          result = String.fromCharCode(65 + (num % 26)) + result;
          num = Math.floor(num / 26) - 1;
        }
        return result;
      }
      
      // Créer le tableau avec en-têtes
      const table = document.createElement('table');
      table.style.cssText = `
        border-collapse: collapse;
        font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: 13px;
        background: white;
        min-width: fit-content;
        width: auto;
      `;
      
      // Calculer le nombre de colonnes nécessaires
      const maxCols = Math.max(range.e.c + 1, sheetData.reduce((max, row) => Math.max(max, row.length), 0));
      const maxRows = Math.max(range.e.r + 1, sheetData.length);
      
      // Créer la ligne d'en-têtes de colonnes (A, B, C, ...)
      const headerRow = document.createElement('tr');
      
      // Cellule vide en haut à gauche
      const cornerCell = document.createElement('th');
      cornerCell.style.cssText = `
        background: #e5e7eb;
        border: 1px solid #d1d5db;
        padding: 6px 8px;
        text-align: center;
        font-weight: 600;
        color: #6b7280;
        min-width: 40px;
        width: 40px;
        position: sticky;
        left: 0;
        z-index: 3;
      `;
      headerRow.appendChild(cornerCell);
      
      // En-têtes de colonnes (A, B, C, ...)
      for (let col = 0; col < maxCols; col++) {
        const colHeader = document.createElement('th');
        colHeader.textContent = numberToColumnLetter(col);
        colHeader.style.cssText = `
          background: #e5e7eb;
          border: 1px solid #d1d5db;
          padding: 6px 8px;
          text-align: center;
          font-weight: 600;
          color: #6b7280;
          min-width: 100px;
          width: 120px;
          position: sticky;
          top: 0;
          z-index: 2;
        `;
        headerRow.appendChild(colHeader);
      }
      table.appendChild(headerRow);
      
      // Créer les lignes de données
      for (let row = 0; row < maxRows; row++) {
        const tr = document.createElement('tr');
        
        // Numéro de ligne (1, 2, 3, ...)
        const rowHeader = document.createElement('th');
        rowHeader.textContent = row + 1;
        rowHeader.style.cssText = `
          background: #e5e7eb;
          border: 1px solid #d1d5db;
          padding: 6px 8px;
          text-align: center;
          font-weight: 600;
          color: #6b7280;
          min-width: 40px;
          width: 40px;
          position: sticky;
          left: 0;
          z-index: 1;
        `;
        tr.appendChild(rowHeader);
        
        // Cellules de données
        for (let col = 0; col < maxCols; col++) {
          const td = document.createElement('td');
          const cellValue = sheetData[row] && sheetData[row][col] !== undefined ? sheetData[row][col] : '';
          td.textContent = cellValue;
          td.style.cssText = `
            border: 1px solid #d1d5db;
            padding: 6px 12px;
            text-align: left;
            vertical-align: top;
            background: white;
            min-width: 100px;
            width: 120px;
            max-width: 300px;
            word-wrap: break-word;
            overflow-wrap: break-word;
            white-space: pre-wrap;
          `;
          tr.appendChild(td);
        }
        
        // Effet hover sur les lignes
        tr.addEventListener('mouseenter', () => {
          tr.style.backgroundColor = '#f3f4f6';
        });
        tr.addEventListener('mouseleave', () => {
          tr.style.backgroundColor = '';
        });
        
        table.appendChild(tr);
      }
      
      // Wrapper avec défilement optimisé
      const tableWrapper = document.createElement('div');
      
      tableWrapper.style.cssText = `
        overflow: auto;
        height: 100%;
        width: 100%;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        min-height: 0;
      `;
      
      // Améliorer le style des scrollbars sur Webkit
      tableWrapper.style.cssText += `
        -webkit-overflow-scrolling: touch;
      `;
      
      // Ajouter les styles de scrollbar personnalisés via une balise style
      if (!document.getElementById('excel-scrollbar-styles')) {
        const scrollbarStyles = document.createElement('style');
        scrollbarStyles.id = 'excel-scrollbar-styles';
        scrollbarStyles.textContent = `
          .excel-content > div::-webkit-scrollbar {
            width: 12px;
            height: 12px;
          }
          .excel-content > div::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 6px;
          }
          .excel-content > div::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 6px;
            border: 2px solid #f1f5f9;
          }
          .excel-content > div::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
          .excel-content > div::-webkit-scrollbar-corner {
            background: #f1f5f9;
          }
        `;
        document.head.appendChild(scrollbarStyles);
      }
      
      tableWrapper.appendChild(table);
      
      // Fonction pour fixer une hauteur PIXEL pour activer overflow
      const updateWrapperHeight = () => {
        try {
          const canvasRect = canvas.getBoundingClientRect();
          const tabsH = tabsContainer ? tabsContainer.offsetHeight : 0;
          // marge interne + nav + petite marge
          const paddingReserve = 16;
          const maxH = Math.max(180, Math.floor(canvasRect.height - tabsH - paddingReserve));
          tableWrapper.style.maxHeight = `${maxH}px`;
        } catch (_) {}
      };

      // Initialisation et écoute du resize
      updateWrapperHeight();
      let excelResizeHandler = null;
      excelResizeHandler = () => updateWrapperHeight();
      window.addEventListener('resize', excelResizeHandler);

      // Nettoyer les listeners quand on change de fichier/feuille
      // (on attache un attribut pour retrouver/retirer si nécessaire)
      tableWrapper.dataset.excelResizeBound = '1';

      container.innerHTML = '';
      container.appendChild(tableWrapper);
    }
    
    // Afficher la première feuille par défaut
    renderSheet(sheetNames[0], contentContainer, XLSX, workbook);
    
    // Remplacer le contenu du canvas
    canvas.innerHTML = '';
    canvas.appendChild(excelContainer);
    
    // Afficher les contrôles de zoom pour Excel
    const zoomControls = document.getElementById('zoom-controls');
    if (zoomControls) {
    zoomControls.style.display = 'flex';
    
    let currentZoom = 1;
    
    // Fonction pour mettre à jour le zoom Excel
    const updateExcelZoom = (zoom) => {
      currentZoom = zoom;
        const table = contentContainer.querySelector('table');
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
    }
    
    // Mettre en surbrillance le fichier actuel dans la sidebar
    highlightCurrentFile(filePath);
    
  } catch (error) {
    console.error('Excel rendering error:', error);
    const hint = document.createElement('div');
    hint.style.cssText = `
      padding: 40px;
      text-align: center;
      color: #ef4444;
      font-size: 16px;
      background: #fef2f2;
      border: 2px dashed #fca5a5;
      border-radius: 8px;
      margin: 20px;
    `;
    hint.textContent = '❌ Erreur lors du chargement du fichier Excel.';
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

// ===== MODAL DE CONFIRMATION =====
function showConfirmModal(title, message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-confirm');
    const titleEl = document.getElementById('confirm-title');
    const messageEl = document.getElementById('confirm-message');
    const cancelBtn = document.getElementById('confirm-cancel');
    const okBtn = document.getElementById('confirm-ok');

    if (!modal || !titleEl || !messageEl || !cancelBtn || !okBtn) {
      resolve(false);
      return;
    }

    titleEl.textContent = title;
    messageEl.textContent = message;
    modal.setAttribute('aria-hidden', 'false');

    const cleanup = () => {
      modal.setAttribute('aria-hidden', 'true');
      cancelBtn.removeEventListener('click', handleCancel);
      okBtn.removeEventListener('click', handleOk);
      modal.removeEventListener('keydown', handleKeydown);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    const handleOk = () => {
      cleanup();
      resolve(true);
    };

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };

    cancelBtn.addEventListener('click', handleCancel);
    okBtn.addEventListener('click', handleOk);
    modal.addEventListener('keydown', handleKeydown);
  });
}

// ===== CORBEILLE =====
function initTrashView() {
  const view = document.getElementById('view-corbeille');
  if (!view) return;

  const listEl = document.getElementById('trash-list');
  const searchInput = document.getElementById('search-trash');
  const clearBtn = document.getElementById('btn-clear-trash');

  async function refresh() {
    try {
      const items = await window.classiflyer.trashList();
      const q = (searchInput instanceof HTMLInputElement ? searchInput.value.trim().toLowerCase() : '');
      const filtered = q ? items.filter((x) => (x.name || '').toLowerCase().includes(q)) : items;
      renderTrash(listEl, filtered);
    } catch (e) {
      if (listEl) listEl.innerHTML = '<div class="muted">Erreur de chargement de la corbeille</div>';
    }
  }

  if (searchInput instanceof HTMLInputElement) {
    searchInput.addEventListener('input', refresh);
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (await showConfirmModal('Vider la corbeille', 'Êtes-vous sûr de vouloir vider complètement la corbeille ? Cette action est irréversible et supprimera définitivement tous les classeurs et leur contenu.')) {
        try {
          await window.classiflyer.trashClearAll();
          await refresh();
        } catch (error) {
          alert('Erreur lors de la suppression: ' + (error?.message || 'Suppression impossible'));
        }
      }
    });
  }

  // Charger quand on arrive sur l’onglet
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      if (m.type === 'attributes' && m.attributeName === 'class') {
        if (view.classList.contains('is-visible')) refresh();
      }
    });
  });
  observer.observe(view, { attributes: true });

  // Chargement initial si déjà visible
  if (view.classList.contains('is-visible')) refresh();
}

// Créer une carte de dossier dans la corbeille
function createTrashFolderCard(folder, container) {
  const card = document.createElement('div');
  card.className = 'trash-folder-card';
  
  const icon = document.createElement('div');
  icon.className = 'folder-icon';
  icon.textContent = '🗑️📁';
  
  const title = document.createElement('div');
  title.className = 'folder-title';
  title.textContent = folder.name || '(Sans nom)';
  
  const count = document.createElement('div');
  count.className = 'folder-count';
  const nbClasseurs = folder.classeurs ? folder.classeurs.length : 0;
  count.textContent = `${nbClasseurs} classeur${nbClasseurs > 1 ? 's' : ''}`;
  
  // Informations de suppression
  const metaInfo = document.createElement('div');
  metaInfo.style.fontSize = '11px';
  metaInfo.style.color = '#dc2626';
  metaInfo.style.opacity = '0.8';
  metaInfo.style.textAlign = 'center';
  const from = folder.deletedFrom === 'archives' ? 'Archives' : 'Mes Classeurs';
  const when = folder.deletedAt ? new Date(folder.deletedAt).toLocaleString('fr-FR', { 
    dateStyle: 'short', 
    timeStyle: 'short' 
  }) : '';
  metaInfo.innerHTML = `<div>Supprimé le ${when}</div>`;
  
  const actions = document.createElement('div');
  actions.className = 'trash-actions';
  
  const restoreBtn = document.createElement('button');
  restoreBtn.className = 'btn';
  restoreBtn.textContent = '♻️ Restaurer';
  restoreBtn.style.background = '#22c55e';
  restoreBtn.style.color = 'white';
  restoreBtn.style.border = 'none';
  restoreBtn.style.fontSize = '12px';
  restoreBtn.style.padding = '6px 12px';
  restoreBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (await showConfirmModal('Confirmation', `Restaurer ce dossier et ses ${nbClasseurs} classeur(s) ?`)) {
      try {
        await window.classiflyer.trashRestoreClasseurFolder(folder.id);
        // Rafraîchir la corbeille
        const items = await window.classiflyer.trashList();
        renderTrash(container, items);
      } catch (err) {
        alert('Erreur: ' + (err?.message || 'Impossible de restaurer le dossier'));
      }
    }
  });
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn';
  deleteBtn.textContent = '🗑️ Supprimer';
  deleteBtn.style.background = '#dc2626';
  deleteBtn.style.color = 'white';
  deleteBtn.style.border = 'none';
  deleteBtn.style.fontSize = '12px';
  deleteBtn.style.padding = '6px 12px';
  deleteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (await showConfirmModal('Confirmation', `Supprimer DÉFINITIVEMENT ce dossier et ses ${nbClasseurs} classeur(s) ? Cette action est irréversible.`)) {
      try {
        await window.classiflyer.trashDeleteClasseurFolder(folder.id);
        // Rafraîchir la corbeille
        const items = await window.classiflyer.trashList();
        renderTrash(container, items);
      } catch (err) {
        alert('Erreur: ' + (err?.message || 'Impossible de supprimer le dossier'));
      }
    }
  });
  
  actions.appendChild(restoreBtn);
  actions.appendChild(deleteBtn);
  
  card.appendChild(icon);
  card.appendChild(title);
  card.appendChild(count);
  card.appendChild(metaInfo);
  card.appendChild(actions);
  
  return card;
}

function renderTrash(container, items) {
  if (!container) return;
  container.innerHTML = '';
  for (const it of items) {
    // Vérifier si c'est un dossier ou un classeur
    if (it.type === 'classeur_folder') {
      // Créer une carte de dossier dans la corbeille
      const card = createTrashFolderCard(it, container);
      container.appendChild(card);
      continue;
    }
    
    // Sinon, c'est un classeur normal
    const card = document.createElement('div');
    card.className = 'card';
    card.style.background = it.primaryColor || '#ffffff';
    card.style.borderRight = `8px solid ${it.secondaryColor || '#000000'}`;

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = it.name || '(Sans nom)';
    // Force text color on title to ensure no CSS override
    title.style.color = it.tertiaryColor || '#0b1220';

    // Compter les fichiers et dossiers
    const fileCount = countClasseurContent(it);
    const counter = document.createElement('div');
    counter.className = 'classeur-counter';
    counter.textContent = `${fileCount.files} fichier${fileCount.files > 1 ? 's' : ''}, ${fileCount.folders} dossier${fileCount.folders > 1 ? 's' : ''}`;
    counter.style.color = it.tertiaryColor || '#0b1220';
    counter.style.fontSize = '12px';
    counter.style.position = 'absolute';
    counter.style.bottom = '8px';
    counter.style.left = '8px';
    counter.style.opacity = '0.8';

    // Informations de suppression
    const metaInfo = document.createElement('div');
    metaInfo.className = 'trash-meta';
    metaInfo.style.position = 'absolute';
    metaInfo.style.bottom = '32px';
    metaInfo.style.left = '8px';
    metaInfo.style.right = '40px';
    metaInfo.style.fontSize = '10px';
    metaInfo.style.color = it.tertiaryColor || '#0b1220';
    metaInfo.style.opacity = '0.7';
    
    const from = it.deletedFrom === 'archives' ? 'Archives' : 'Mes Classeurs';
    const when = it.deletedAt ? new Date(it.deletedAt).toLocaleString() : '';
    metaInfo.innerHTML = `<div>Supprimé de: ${from}</div><div>Le: ${when}</div>`;

    const menuBtn = document.createElement('button');
    menuBtn.className = 'btn card-menu-btn';
    menuBtn.textContent = '⋯';

    const menu = document.createElement('div');
    menu.className = 'menu';

    const restoreItem = document.createElement('div');
    restoreItem.className = 'menu-item';
    restoreItem.textContent = '🛠️ Restaurer';
    restoreItem.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await window.classiflyer.trashRestoreClasseur(it.id);
        // Refresh
        const list = await window.classiflyer.trashList();
        renderTrash(container, list);
      } catch (err) {
        alert('Erreur: ' + (err?.message || 'Restauration impossible'));
      }
      menu.classList.remove('is-open');
    });

    const deleteItem = document.createElement('div');
    deleteItem.className = 'menu-item';
    deleteItem.textContent = '🗑️ Supprimer définitivement';
    deleteItem.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!(await showConfirmModal('Suppression définitive', 'Supprimer définitivement ? Cette action est irréversible.'))) return;
      try {
        await window.classiflyer.trashDeleteClasseur(it.id);
        const list = await window.classiflyer.trashList();
        renderTrash(container, list);
      } catch (err) {
        alert('Erreur: ' + (err?.message || 'Suppression impossible'));
      }
      menu.classList.remove('is-open');
    });

    menu.appendChild(restoreItem);
    menu.appendChild(deleteItem);

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.contains('is-open');
      document.querySelectorAll('.menu.is-open').forEach((el) => el.classList.remove('is-open'));
      if (!isOpen) menu.classList.add('is-open');
    });

    document.addEventListener('click', () => menu.classList.remove('is-open'));

    card.appendChild(title);
    card.appendChild(counter);
    card.appendChild(metaInfo);
    card.appendChild(menuBtn);
    card.appendChild(menu);

    container.appendChild(card);
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
      if (await showConfirmModal('Confirmation', 'Envoyer ce classeur à la corbeille ?')) {
        try {
          await window.classiflyer.trashMoveClasseur(item.id, 'archives');
          // Recharger en préservant l'état du dossier sélectionné
          const currentFolderId = getArchiveState();
          await loadArchivedClasseurs(currentFolderId);
        } catch (err) {
          alert('Erreur: ' + (err?.message || 'Impossible de déplacer vers corbeille'));
        }
      }
      menu.classList.remove('is-open');
    });

    const unarchiveItem = document.createElement('div');
    unarchiveItem.className = 'menu-item';
    unarchiveItem.textContent = 'Désarchiver';
    unarchiveItem.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.classiflyer.unarchiveClasseur(item.id);
      // Recharger en préservant l'état du dossier sélectionné
      const currentFolderId = getArchiveState();
      await loadArchivedClasseurs(currentFolderId);
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
    card.addEventListener('click', () => openClasseurView(item.id, 'archives'));
    container.appendChild(card);
  }
}

async function filterArchives(searchTerm) {
  const container = document.getElementById('archives-grid');
  if (!container) return;

  const term = searchTerm.toLowerCase().trim();
  
  if (term === '') {
    // Si pas de terme de recherche, revenir à l'affichage normal du dossier courant
    const currentFolderId = getArchiveState();
    await loadArchivedClasseurs(currentFolderId);
    return;
  }

  try {
    // Charger TOUS les classeurs archivés pour la recherche globale
    const allArchives = await window.classiflyer.listArchives();
    
    // Filtrer pour s'assurer qu'on n'a que des classeurs, pas des dossiers
    const onlyClasseurs = allArchives.filter(item => {
      const isClasseur = item.hasOwnProperty('primaryColor') || item.hasOwnProperty('files') || item.hasOwnProperty('folders');
      const isRootPath = item.sys_path && item.sys_path.match(/\/archives\/[^\/]+$/);
      const hasSameName = item.name && (item.name === 'Projets 2K25 RELEASED' || item.name === 'a');
      const isDuplicateFolder = isRootPath && hasSameName && !item.archiveFolderId;
      
      return isClasseur && !isDuplicateFolder;
    });

    // Filtrer par terme de recherche
    const filteredResults = onlyClasseurs.filter(classeur => {
      const title = (classeur.name || '').toLowerCase();
      return title.includes(term);
    });

    // Afficher les résultats de recherche
    renderArchivedClasseurs(container, filteredResults);
  } catch (error) {
    console.error('Erreur lors de la recherche dans les archives:', error);
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
  if (!(await showConfirmModal('Confirmation', 'Envoyer ce dossier et tous ses classeurs à la corbeille ?'))) {
    return;
  }

  try {
    // Récupérer tous les classeurs du dossier
    const allArchives = await window.classiflyer.listArchives();
    const classeursInFolder = allArchives.filter(item => {
      const isClasseur = item.hasOwnProperty('primaryColor') || item.hasOwnProperty('files') || item.hasOwnProperty('folders');
      return isClasseur && item.archiveFolderId === folderId;
    });

    // Envoyer tous les classeurs du dossier à la corbeille
    for (const classeur of classeursInFolder) {
      try {
        await window.classiflyer.trashMoveClasseur(classeur.id, 'archives');
      } catch (err) {
        console.error(`Erreur lors de l'envoi du classeur ${classeur.name} à la corbeille:`, err);
      }
    }

    // Maintenant supprimer le dossier vide
    await window.classiflyer.deleteArchiveFolder(folderId);
    
    await loadArchiveFolders(true); // Préserver les états d'expansion
    // Recharger aussi les classeurs car ils peuvent avoir été affectés
    const currentFolderId = getArchiveState();
    await loadArchivedClasseurs(currentFolderId);
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

// ===== Fonctions pour les dossiers de classeurs =====

function openCreateClasseurFolderModal(refreshCallback) {
  const modal = document.getElementById('modal-create-classeur-folder');
  const input = document.getElementById('classeur-folder-name');
  const createBtn = document.getElementById('create-classeur-folder');
  const cancelBtn = document.getElementById('cancel-classeur-folder');
  const closeBtn = document.getElementById('close-classeur-folder-modal');
  
  if (!modal || !input) return;
  
  modal.setAttribute('aria-hidden', 'false');
  input.value = '';
  input.focus();
  
  const close = () => modal.setAttribute('aria-hidden', 'true');
  
  const handleCreate = async () => {
    const name = input.value.trim();
    if (!name) return;
    try {
      await window.classiflyer.createClasseurFolder(name);
      close();
      await refreshCallback();
    } catch (err) {
      alert('Erreur: ' + (err?.message || 'Impossible de créer le dossier'));
    }
  };
  
  createBtn.addEventListener('click', handleCreate, { once: true });
  cancelBtn.addEventListener('click', close, { once: true });
  closeBtn.addEventListener('click', close, { once: true });
  modal.querySelector('.modal-backdrop')?.addEventListener('click', close, { once: true });
}

function openRenameClasseurFolderModal(folder, refreshCallback) {
  const modal = document.getElementById('modal-rename-classeur-folder');
  const input = document.getElementById('rename-classeur-folder-name');
  const confirmBtn = document.getElementById('confirm-rename-classeur-folder');
  const cancelBtn = document.getElementById('cancel-rename-classeur-folder');
  const closeBtn = document.getElementById('close-rename-classeur-folder-modal');
  
  if (!modal || !input) return;
  
  modal.setAttribute('aria-hidden', 'false');
  input.value = folder.name;
  input.select();
  input.focus();
  
  const close = () => modal.setAttribute('aria-hidden', 'true');
  
  const handleRename = async () => {
    const newName = input.value.trim();
    if (!newName || newName === folder.name) {
      close();
      return;
    }
    try {
      await window.classiflyer.renameClasseurFolder(folder.id, newName);
      close();
      await refreshCallback();
    } catch (err) {
      alert('Erreur: ' + (err?.message || 'Impossible de renommer le dossier'));
    }
  };
  
  confirmBtn.addEventListener('click', handleRename, { once: true });
  cancelBtn.addEventListener('click', close, { once: true });
  closeBtn.addEventListener('click', close, { once: true });
  modal.querySelector('.modal-backdrop')?.addEventListener('click', close, { once: true });
}

// ===== DRAG & DROP DANS MES CLASSEURS =====

function initClasseurFoldersDragDrop() {
  const classeursGrid = document.getElementById('classeurs-grid');
  
  if (!classeursGrid) {
    console.error('Grid des classeurs introuvable pour le drag & drop');
    return;
  }

  // Rendre les classeurs draggables
  classeursGrid.addEventListener('mousedown', (e) => {
    // Ignorer si c'est un clic sur le menu ou un dossier
    if (e.target.closest('.card-menu-btn') || 
        e.target.closest('.menu') || 
        e.target.closest('.folder-menu-btn') ||
        e.target.closest('.classeur-folder-card')) {
      return;
    }

    const card = e.target.closest('.card.drag-ready');
    if (!card) return;

    const classeurId = card.dataset.classeurId;
    if (!classeurId) return;

    e.preventDefault();
    e.stopPropagation();

    let isDragging = false;
    let startX = e.clientX;
    let startY = e.clientY;
    let dragThreshold = 8;

    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    const handleMouseMove = (e) => {
      e.preventDefault();
      const deltaX = Math.abs(e.clientX - startX);
      const deltaY = Math.abs(e.clientY - startY);
      
      if (!isDragging && (deltaX > dragThreshold || deltaY > dragThreshold)) {
        isDragging = true;
        console.log('Début du drag pour classeur:', classeurId);
        
        card.classList.add('dragging');
        card.style.position = 'fixed';
        card.style.zIndex = '9999';
        card.style.pointerEvents = 'none';
        document.body.style.cursor = 'grabbing';
        
        // Activer les drop targets
        const folders = document.querySelectorAll('.classeur-folder-card');
        folders.forEach(folder => {
          folder.classList.add('drop-target');
          folder.style.pointerEvents = 'auto';
        });
      }

      if (isDragging) {
        card.style.left = (e.clientX - 100) + 'px';
        card.style.top = (e.clientY - 150) + 'px';
      }
    };

    const handleMouseUp = async (e) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      document.body.style.cursor = '';

      if (isDragging) {
        console.log('Fin du drag');
        
        card.classList.remove('dragging');
        card.style.position = '';
        card.style.zIndex = '';
        card.style.left = '';
        card.style.top = '';
        card.style.pointerEvents = '';

        // Retirer les indicateurs de drop
        const folders = document.querySelectorAll('.classeur-folder-card');
        folders.forEach(folder => {
          folder.classList.remove('drop-target');
          folder.classList.remove('drag-over');
          folder.style.pointerEvents = '';
        });

        // Trouver le folder sous la souris
        const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
        const targetFolder = elementUnderMouse?.closest('.classeur-folder-card');
        
        // Vérifier quelle vue est active
        const isInFolderView = document.getElementById('view-classeur-folder')?.classList.contains('is-visible');
        const isInMainView = document.getElementById('view-classeurs')?.classList.contains('is-visible');
        
        let needsMove = false;
        let targetFolderId = null;
        
        if (targetFolder) {
          // Déplacer vers un dossier
          targetFolderId = targetFolder.dataset.folderId;
          needsMove = true;
          console.log('Déplacement du classeur', classeurId, 'vers le dossier', targetFolderId);
        } else if (isInMainView && !targetFolder) {
          // Si dans la vue principale et drop sur zone vide -> déplacer à la racine
          targetFolderId = null;
          needsMove = true;
          console.log('Déplacement du classeur', classeurId, 'vers la racine');
        }
        
        if (needsMove) {
          try {
            await window.classiflyer.moveClasseurToFolder(classeurId, targetFolderId);
            
            // Rafraîchir selon la vue active
            if (isInFolderView && currentFolderId) {
              await refreshFolderView(currentFolderId);
            } else {
              const grid = document.getElementById('classeurs-grid');
              const searchInput = document.getElementById('search-classeurs');
              
              async function refreshView() {
                const classeurs = await window.classiflyer.listClasseurs();
                const folders = await window.classiflyer.listClasseurFolders();
                const q = (searchInput instanceof HTMLInputElement ? searchInput.value.trim().toLowerCase() : '');
                const filteredClasseurs = q ? classeurs.filter((c) => (c.name || '').toLowerCase().includes(q)) : classeurs;
                const filteredFolders = q ? folders.filter((f) => (f.name || '').toLowerCase().includes(q)) : folders;
                renderClasseursAndFolders(grid, filteredClasseurs, filteredFolders, refreshView);
              }
              
              await refreshView();
              // Réinitialiser le drag & drop après le rafraîchissement
              setTimeout(() => initClasseurFoldersDragDrop(), 100);
            }
          } catch (err) {
            console.error('Erreur de déplacement:', err);
            // Ne pas afficher d'alerte si le déplacement a réussi malgré l'erreur
            if (!err.message.includes('ENOENT')) {
              alert('Erreur: ' + (err?.message || 'Impossible de déplacer le classeur'));
            }
          }
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  });

  // Gérer le survol des dossiers pendant le drag
  classeursGrid.addEventListener('mouseover', (e) => {
    if (document.querySelector('.card.dragging')) {
      const folderCard = e.target.closest('.classeur-folder-card');
      if (folderCard) {
        document.querySelectorAll('.drag-over').forEach(item => 
          item.classList.remove('drag-over')
        );
        folderCard.classList.add('drag-over');
      }
    }
  });

  classeursGrid.addEventListener('mouseout', (e) => {
    if (document.querySelector('.card.dragging')) {
      const folderCard = e.target.closest('.classeur-folder-card');
      if (folderCard && !folderCard.contains(e.relatedTarget)) {
        folderCard.classList.remove('drag-over');
      }
    }
  });

  console.log('Drag & drop des classeurs folders initialisé');
}

async function showArchiveDestinationModal(classeurId, refreshCallback) {
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
      modal.setAttribute('aria-hidden', 'true');
      
      // Appeler le callback de rafraîchissement si fourni
      if (typeof refreshCallback === 'function') {
        try {
          await refreshCallback();
        } catch (err) {
          console.error('Erreur lors du rafraîchissement:', err);
          // Ignorer l'erreur de rafraîchissement, le classeur est archivé
        }
      }
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

// Fonction pour gérer le redimensionnement de la sidebar du classeur
function setupSidebarResize() {
  const sidebar = document.querySelector('.classeur-sidebar');
  const resizeHandle = document.querySelector('.classeur-sidebar .resize-handle');
  
  if (!sidebar || !resizeHandle) return;
  
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;
  
  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = parseInt(window.getComputedStyle(sidebar).width, 10);
    
    // Ajouter une classe pour indiquer qu'on est en train de redimensionner
    document.body.classList.add('resizing');
    
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const deltaX = startX - e.clientX; // Inversé car on redimensionne vers la gauche
    const newWidth = startWidth + deltaX;
    
    // Limiter la largeur entre min-width et max-width
    const minWidth = 200;
    const maxWidth = 600;
    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    
    sidebar.style.width = `${clampedWidth}px`;
    
    // Mettre à jour la grille CSS pour que le viewer s'adapte
    const layout = document.querySelector('.classeur-layout');
    if (layout) {
      layout.style.gridTemplateColumns = `1fr ${clampedWidth}px`;
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.classList.remove('resizing');
    }
  });
  
  // Empêcher la sélection de texte pendant le redimensionnement
  resizeHandle.addEventListener('selectstart', (e) => {
    e.preventDefault();
  });
}