// ─────────────────────────────────────────────
//  events.js  –  Carga los eventos del Sheet y
//               los renderiza como tarjetas
// ─────────────────────────────────────────────

// ── Carga eventos desde Google Sheets ───────────────────────────
async function loadEvents() {
  const statusEl = document.getElementById('events-status');
  const listEl   = document.getElementById('events-list');

  statusEl.textContent = 'Cargando eventos…';
  statusEl.style.display = 'block';
  listEl.innerHTML = '';

  try {
    // 1. Cargar eventos
    const eventsUrl =
      `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}` +
      `/values/${CONFIG.SHEETS.EVENTS}` +
      `?key=${CONFIG.API_KEY}`;

    const evRes  = await fetch(eventsUrl);
    const evData = await evRes.json();

    if (!evData.values || evData.values.length < 2) {
      statusEl.textContent = 'No hay eventos próximos.';
      return;
    }

    // Cabecera: ID | Tipo | Fecha | Hora | Lugar | Notas
    const events = evData.values.slice(1).map(row => ({
      id:       row[0] || '',
      type:     row[1] || 'Otro',
      date:     row[2] || '',
      time:     row[3] || '',
      location: row[4] || '',
      notes:    row[5] || '',
    })).filter(e => e.id && isFutureOrToday(e.date));

    window._events = events;

    // 2. Cargar asistencias del jugador actual
    const playerName = Session.get().name;
    const attendance = await loadPlayerAttendance(playerName);

    statusEl.style.display = 'none';

    if (events.length === 0) {
      statusEl.textContent = 'No hay eventos próximos.';
      statusEl.style.display = 'block';
      return;
    }

    events.forEach(event => {
      const existing = attendance[event.id] || null;
      listEl.appendChild(renderEventCard(event, existing));
    });

  } catch (err) {
    console.error('Error cargando eventos:', err);
    statusEl.textContent = 'Error al cargar eventos. Revisa la configuración.';
  }
}

// ── Carga las asistencias ya registradas del jugador ─────────────
async function loadPlayerAttendance(playerName) {
  try {
    const url =
      `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}` +
      `/values/${CONFIG.SHEETS.ATTENDANCE}` +
      `?key=${CONFIG.API_KEY}`;

    const res  = await fetch(url);
    const data = await res.json();

    if (!data.values || data.values.length < 2) return {};

    // Cabecera: EventoID | Jugador | Respuesta | Comentario | Timestamp
    const map = {};
    data.values.slice(1).forEach(row => {
      if (row[1] === playerName) {
        map[row[0]] = { response: row[2], comment: row[3] || '' };
      }
    });
    return map;

  } catch {
    return {};
  }
}

// ── Renderiza una tarjeta de evento ─────────────────────────────
function renderEventCard(event, existing) {
  const card = document.createElement('div');
  card.className = 'event-card';
  card.dataset.eventId = event.id;

  const typeClass = event.type.toLowerCase().includes('partido')
    ? 'partido'
    : event.type.toLowerCase().includes('entrena')
    ? 'entrenamiento'
    : 'otro';

  const dateStr = formatDate(event.date);
  const timeStr = event.time ? ` · ${event.time}` : '';

  card.innerHTML = `
    <div class="event-header">
      <span class="event-type-badge ${typeClass}">${event.type}</span>
      <span class="event-datetime">${dateStr}${timeStr}</span>
    </div>
    <div class="event-title-row">
      ${event.location
        ? `<span class="event-location">📍 ${event.location}</span>`
        : ''}
    </div>
    ${event.notes
      ? `<div class="event-notes">📋 ${event.notes}</div>`
      : ''}
    <div class="attendance-row">
      <button class="btn-attend yes ${existing?.response === 'Sí' ? 'active' : ''}"
              data-action="yes" data-event-id="${event.id}" data-event-label="${event.type} – ${dateStr}">
        ✅ Voy
      </button>
      <button class="btn-attend no ${existing?.response === 'No' ? 'active' : ''}"
              data-action="no" data-event-id="${event.id}" data-event-label="${event.type} – ${dateStr}">
        ❌ No puedo
      </button>
    </div>
    ${existing?.comment
      ? `<p class="attendance-comment">💬 "${existing.comment}"</p>`
      : ''}
  `;

  return card;
}

// ── Helpers ──────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '';
  // Acepta DD/MM/YYYY o YYYY-MM-DD
  const parts = dateStr.includes('/')
    ? dateStr.split('/').map(Number)       // [DD, MM, YYYY]
    : dateStr.split('-').map(Number);      // [YYYY, MM, DD]

  const d = dateStr.includes('/')
    ? new Date(parts[2], parts[1] - 1, parts[0])
    : new Date(parts[0], parts[1] - 1, parts[2]);

  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

function isFutureOrToday(dateStr) {
  if (!dateStr) return false;
  const parts = dateStr.includes('/')
    ? dateStr.split('/').map(Number)
    : dateStr.split('-').map(Number);

  const d = dateStr.includes('/')
    ? new Date(parts[2], parts[1] - 1, parts[0])
    : new Date(parts[0], parts[1] - 1, parts[2]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d >= today;
}
