const SHEET_CSV =
  "https://docs.google.com/spreadsheets/d/18J6z5QjrTQHwshNV2jKeJJZHTiRox4O5AsMvMxyfSN4/export?format=csv&gid=0";

// Pega aquí la URL que obtienes al desplegar el Apps Script como Web App
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzgZ1gLlzkTkCzNkJbThNSRL7qlxFGsBMCyQH1TQs7MztksKN3JUE4tSj7SMhxrLbAcAQ/exec";

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
  if (!('IntersectionObserver' in globalThis) || items.length === 0) {
    items.forEach((item) => item.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  items.forEach((item, index) => {
    item.style.transitionDelay = `${index * 70}ms`;
    observer.observe(item);
  });
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
}

// --- Init (top-level await requiere type="module") ---

const yearNode = document.querySelector('#current-year');
if (yearNode) yearNode.textContent = new Date().getFullYear();

attachReveal(document.querySelectorAll('.section.reveal'));

try {
  const res = await fetch(SHEET_CSV);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  renderCards(parseCSV(await res.text()));
} catch {
  const grid = document.getElementById('cards-grid');
  if (grid) {
    grid.innerHTML =
      '<p class="loading-msg error-msg">No se pudo cargar la hoja. Comprueba que el documento es público.</p>';
  }
}
