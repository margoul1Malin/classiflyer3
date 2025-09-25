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

    // Click to open classeur page (placeholder)
    card.addEventListener('click', () => {
      history.replaceState({}, '', `#view-classeur-${item.id}`);
      alert('Vue classeur à implémenter');
    });

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
