const SHEET_CSV =
  "https://docs.google.com/spreadsheets/d/18J6z5QjrTQHwshNV2jKeJJZHTiRox4O5AsMvMxyfSN4/export?format=csv&gid=0";
const USERS_CSV =
  "https://docs.google.com/spreadsheets/d/18J6z5QjrTQHwshNV2jKeJJZHTiRox4O5AsMvMxyfSN4/gviz/tq?tqx=out:csv&sheet=usuarios";

// Pega aquí la URL que obtienes al desplegar el Apps Script como Web App
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw98xDuDBsoyC6X-eC0ty_VOVIjr1BpFBz2PX_dGDE1yTSwCGHhb-ZFA-V1mzrpLRd72A/exec";

// --- CSV helpers ---

function handleQuotedChar(state, ch, next) {
  if (ch === '"' && next === '"') {
    state.field += '"';
    return 1;
  }
  if (ch === '"') {
    state.inQuotes = false;
    return 0;
  }
  state.field += ch;
  return 0;
}

function flushField(state) {
  state.row.push(state.field);
  state.field = '';
}

function flushRow(state) {
  flushField(state);
  state.rows.push(state.row);
  state.row = [];
}

function handleUnquotedChar(state, ch, next) {
  if (ch === '"') {
    state.inQuotes = true;
    return 0;
  }
  if (ch === ',') {
    flushField(state);
    return 0;
  }
  if (ch === '\r' && next === '\n') {
    flushRow(state);
    return 1;
  }
  if (ch === '\n' || ch === '\r') {
    flushRow(state);
    return 0;
  }
  state.field += ch;
  return 0;
}

function parseCSV(text) {
  const state = { rows: [], row: [], field: '', inQuotes: false };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    const skip = state.inQuotes
      ? handleQuotedChar(state, ch, next)
      : handleUnquotedChar(state, ch, next);
    i += skip;
  }

  if (state.field !== '' || state.row.length > 0) {
    flushRow(state);
  }

  return state.rows;
}

// --- Utilities ---

function safeUrl(raw) {
  const t = (raw ?? '').trim();
  return t.startsWith('https://') || t.startsWith('http://') ? t : '#';
}

function attachReveal(items) {
  items.forEach((item) => item.classList.add('is-visible'));
}

// --- Counter ---

function incrementVeces(sheetRow, countSpan) {
  const next = (Number.parseInt(countSpan.dataset.count ?? '0', 10) || 0) + 1;
  countSpan.dataset.count = String(next);
  countSpan.textContent = String(next);

  const validUrl = APPS_SCRIPT_URL && !APPS_SCRIPT_URL.includes('TU_URL_AQUI');
  if (!validUrl) return;

  // no-cors: el fetch llega al servidor aunque no podamos leer la respuesta
  fetch(`${APPS_SCRIPT_URL}?row=${sheetRow}`, { mode: 'no-cors' });
}

// --- Card builder ---

function buildCard(cols, sheetRow) {
  const numero = (cols[0] ?? '').trim();
  const tag = (cols[1] ?? '').trim();
  const titulo = (cols[2] ?? '').trim();
  const descripcion = (cols[3] ?? '').trim();
  const veces = Number.parseInt((cols[4] ?? '0').trim(), 10) || 0;
  const url = safeUrl(cols[5]);

  const article = document.createElement('article');
  article.className = 'dyn-card reveal';
  article.dataset.dynamicTitle = titulo;

  const top = document.createElement('div');
  top.className = 'dyn-card-top';

  const numSpan = document.createElement('span');
  numSpan.className = 'dyn-number';
  numSpan.textContent = numero;

  const tagSpan = document.createElement('span');
  tagSpan.className = 'dyn-tag';
  tagSpan.textContent = tag;

  top.appendChild(numSpan);
  top.appendChild(tagSpan);

  const h3 = document.createElement('h3');
  h3.textContent = titulo;

  const p = document.createElement('p');
  p.textContent = descripcion;

  const footer = document.createElement('div');
  footer.className = 'dyn-card-footer';

  const realizaciones = document.createElement('div');
  realizaciones.className = 'realizaciones';

  const count = document.createElement('span');
  count.className = 'realizaciones-count';
  count.dataset.count = String(veces);
  count.textContent = String(veces);

  const countLabel = document.createElement('span');
  countLabel.className = 'realizaciones-label';
  countLabel.textContent = 'veces realizada';

  realizaciones.appendChild(count);
  realizaciones.appendChild(countLabel);

  const link = document.createElement('a');
  link.className = 'button button-primary';
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Ir a la dinámica';
  if (url === '#') link.setAttribute('aria-disabled', 'true');

  link.addEventListener('click', (e) => {
    if (url === '#') e.preventDefault();
    incrementVeces(sheetRow, count);
  });

  footer.appendChild(realizaciones);
  footer.appendChild(link);

  article.appendChild(top);
  article.appendChild(h3);
  article.appendChild(p);
  article.appendChild(footer);

  return article;
}

function highlightSelectedDynamic(dynamicName) {
  const cards = document.querySelectorAll('.dyn-card');

  cards.forEach((card) => {
    card.classList.toggle('dyn-card-selected', card.dataset.dynamicTitle === dynamicName);
  });
}

function renderCards(rows) {
  const grid = document.getElementById('cards-grid');
  if (!grid) return;

  // Rastreamos el número de fila real en la hoja (cabecera = fila 1, datos desde fila 2)
  const dataRows = [];
  rows.slice(1).forEach((r, i) => {
    if (r.length >= 3 && (r[2] ?? '').trim() !== '') {
      dataRows.push({ cols: r, sheetRow: i + 2 });
    }
  });

  if (dataRows.length === 0) {
    grid.innerHTML = '<p class="loading-msg error-msg">No se encontraron dinámicas en la hoja.</p>';
    return;
  }

  grid.innerHTML = '';
  dataRows.forEach(({ cols, sheetRow }) => grid.appendChild(buildCard(cols, sheetRow)));
  attachReveal(grid.querySelectorAll('.dyn-card.reveal'));

  const lastDynamic = getLastDynamicFromStorage();
  if (lastDynamic) {
    highlightSelectedDynamic(lastDynamic);
  }
}

function getDynamicNames(rows) {
  return rows
    .slice(1)
    .filter((r) => r.length >= 3 && (r[2] ?? '').trim() !== '')
    .map((r) => (r[2] ?? '').trim());
}

function getUserNames(rows) {
  return rows
    .slice(1)
    .filter((r) => r.length >= 1)
    .map((r) => {
      const name = (r[0] ?? '').trim();
      const selected = Number.parseInt((r[1] ?? '0').trim(), 10) || 0;
      return { name, selected };
    })
    .filter(({ name }) => name.length > 0);
}

// --- localStorage para usuarios seleccionados ---
const LS_SELECTED_USERS = 'lab-selected-users';
const LS_ALL_USERS = 'lab-all-users';
const LS_LAST_DYNAMIC = 'lab-last-dynamic';

function saveLastDynamicToStorage(dynamicName) {
  localStorage.setItem(LS_LAST_DYNAMIC, dynamicName);
}

function getLastDynamicFromStorage() {
  return localStorage.getItem(LS_LAST_DYNAMIC) || '';
}

function saveAllUsersToStorage(userNames) {
  localStorage.setItem(LS_ALL_USERS, JSON.stringify(userNames));
}

function getSelectedUsersFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(LS_SELECTED_USERS) || '[]');
  } catch {
    return [];
  }
}

function getAvailableUsersFromStorage() {
  const allUsers = JSON.parse(localStorage.getItem(LS_ALL_USERS) || '[]');
  const selectedUsers = getSelectedUsersFromStorage();
  return allUsers.filter(name => !selectedUsers.includes(name));
}

function markUserInStorage(userName) {
  const selected = getSelectedUsersFromStorage();
  if (!selected.includes(userName)) {
    selected.push(userName);
    localStorage.setItem(LS_SELECTED_USERS, JSON.stringify(selected));
  }
}

function clearSelectedUsersFromStorage() {
  localStorage.setItem(LS_SELECTED_USERS, JSON.stringify([]));
}

function getAvailableUsers(userObjects) {
  return userObjects
    .filter(({ selected }) => selected !== 1)
    .map(({ name }) => name);
}

function spinRoulette(values, outputNode, buttonNode, onEnd) {
  if (values.length === 0 || !outputNode || !buttonNode) return;

  buttonNode.disabled = true;
  const durationMs = 2200;
  const tickMs = 90;
  const totalTicks = Math.floor(durationMs / tickMs);

  let tick = 0;
  const timer = setInterval(() => {
    const randomIndex = Math.floor(Math.random() * values.length);
    const final = values[randomIndex];
    outputNode.textContent = typeof final === 'string' ? final : final.name;
    tick += 1;

    if (tick >= totalTicks) {
      clearInterval(timer);
      const finalIndex = Math.floor(Math.random() * values.length);
      const finalVal = values[finalIndex];
      const finalName = typeof finalVal === 'string' ? finalVal : finalVal.name;
      outputNode.textContent = finalName;
      buttonNode.disabled = false;
      if (onEnd) onEnd(finalName);
    }
  }, tickMs);
}

function refreshUserUI(preserveSelectedName = true) {
  const userValue = document.getElementById('user-value');
  const spinUsers = document.getElementById('spin-users');
  const availableCount = document.getElementById('available-count');
  const availableUsers = getAvailableUsersFromStorage();

  if (availableCount) {
    availableCount.textContent =
      availableUsers.length === 0 ? '(todos seleccionados)' : `(${availableUsers.length} disponibles)`;
  }

  if (spinUsers) {
    spinUsers.disabled = availableUsers.length === 0;
  }

  if (userValue && !preserveSelectedName) {
    userValue.textContent = availableUsers.length > 0 ? 'Pulsa para girar' : 'Todos seleccionados';
  }
}

function resetUserRouletteUI() {
  const userValue = document.getElementById('user-value');
  const spinUsers = document.getElementById('spin-users');
  const allUsers = JSON.parse(localStorage.getItem(LS_ALL_USERS) || '[]');
  const availableCount = document.getElementById('available-count');

  if (userValue) {
    userValue.textContent = 'Pulsa para girar';
  }

  if (availableCount) {
    availableCount.textContent = `(${allUsers.length} disponibles)`;
  }

  if (spinUsers) {
    spinUsers.disabled = allUsers.length === 0;
  }
}

function handleSpinUsersClick() {
  const userValue = document.getElementById('user-value');
  const spinUsers = document.getElementById('spin-users');
  const currentAvailable = getAvailableUsersFromStorage();

  if (!userValue || !spinUsers || currentAvailable.length === 0) return;

  spinRoulette(currentAvailable, userValue, spinUsers, (selectedName) => {
    markUserInStorage(selectedName);
    syncUserToSheet(selectedName);
    refreshUserUI(true);
  });
}

function initRoulettes(dynamicNames, userObjects) {
  const dynamicValue = document.getElementById('dynamic-value');
  const userValue = document.getElementById('user-value');
  const spinDynamics = document.getElementById('spin-dynamics');
  const spinUsers = document.getElementById('spin-users');
  const resetUsers = document.getElementById('reset-users');

  // Guardar todos los usuarios en localStorage
  const allUserNames = userObjects.map(u => u.name);
  saveAllUsersToStorage(allUserNames);

  // Obtener disponibles del localStorage
  const availableUsers = getAvailableUsersFromStorage();
  const lastDynamic = getLastDynamicFromStorage();

  if (dynamicValue) {
    dynamicValue.textContent =
      dynamicNames.length === 0 ? 'Sin dinámicas' : lastDynamic || 'Pulsa para girar';
  }
  if (userValue) {
    userValue.textContent = availableUsers.length > 0 ? 'Pulsa para girar' : 'Sin usuarios';
  }
  refreshUserUI(false);

  if (spinDynamics) {
    spinDynamics.disabled = dynamicNames.length === 0;
    spinDynamics.addEventListener('click', () => {
      spinRoulette(dynamicNames, dynamicValue, spinDynamics, (selectedName) => {
        saveLastDynamicToStorage(selectedName);
        highlightSelectedDynamic(selectedName);
      });
    });
  }

  if (spinUsers) {
    spinUsers.disabled = availableUsers.length === 0;
    spinUsers.onclick = handleSpinUsersClick;
  }

  if (resetUsers) {
    resetUsers.addEventListener('click', () => {
      if (confirm('¿Resetear todas las selecciones de usuarios?')) {
        handleResetUsersClick();
      }
    });
  }
}

function syncUserToSheet(userName) {
  const validUrl = APPS_SCRIPT_URL && !APPS_SCRIPT_URL.includes('TU_URL_AQUI');
  if (!validUrl) return;

  // Sincroniza en background, sin esperar respuesta
  fetch(`${APPS_SCRIPT_URL}?action=markUser&name=${encodeURIComponent(userName)}`, { mode: 'no-cors' });
}

function resetAllUsersInSheet() {
  const validUrl = APPS_SCRIPT_URL && !APPS_SCRIPT_URL.includes('TU_URL_AQUI');
  if (!validUrl) return Promise.resolve();

  return fetch(`${APPS_SCRIPT_URL}?action=resetUsers`, { mode: 'no-cors' }).catch(() => {});
}

function handleResetUsersClick() {
  clearSelectedUsersFromStorage();
  resetUserRouletteUI();
  resetAllUsersInSheet();

  setTimeout(() => {
    location.reload();
  }, 150);
}



// --- Init (top-level await requiere type="module") ---

const yearNode = document.querySelector('#current-year');
if (yearNode) yearNode.textContent = new Date().getFullYear();

attachReveal(document.querySelectorAll('.section.reveal'));

try {
  const [dynamicsResult, usersResult] = await Promise.allSettled([fetch(SHEET_CSV), fetch(USERS_CSV)]);

  if (dynamicsResult.status !== 'fulfilled' || !dynamicsResult.value.ok) {
    throw new Error('No se pudieron cargar las dinamicas');
  }

  const dynamicRows = parseCSV(await dynamicsResult.value.text());
  renderCards(dynamicRows);

  let userRows = [];
  if (usersResult.status === 'fulfilled' && usersResult.value.ok) {
    userRows = parseCSV(await usersResult.value.text());
  }

  const userObjects = userRows.length > 0 ? getUserNames(userRows) : [];
  initRoulettes(getDynamicNames(dynamicRows), userObjects);
} catch {
  const grid = document.getElementById('cards-grid');
  if (grid) {
    grid.innerHTML =
      '<p class="loading-msg error-msg">No se pudo cargar la hoja. Comprueba que el documento es público.</p>';
  }

  initRoulettes([], []);
}
