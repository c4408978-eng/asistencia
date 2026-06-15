// ─────────────────────────────────────────────
//  technician-attendance.js  –  Lista de eventos
//  y modal de ver asistencia para técnicos
// ─────────────────────────────────────────────

// ── Carga y renderiza eventos del técnico ────
async function loadTechnicianEvents() {
  const eventsUrl =
    `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}` +
    `/values/${CONFIG.SHEETS.EVENTS}` +
    `?key=${CONFIG.API_KEY}`;

  TECHNICIAN_EVENT_TYPES.forEach(type => {
    renderTechnicianEventsList(type.key, []);
  });

  try {
    const response = await fetch(eventsUrl, { method: 'GET', redirect: 'follow' });
    const data     = await response.json();

    if (!data.values || data.values.length < 2) return;

    const groupedEvents = { training: [], match: [], friendly: [] };

    data.values.slice(1).forEach(row => {
      const event = {
        id:           row[0] || '',
        type:         row[1] || '',
        date:         row[2] || '',
        time:         row[3] || '',
        location:     row[4] || '',
        convocatoria: row[5] || '',
        notes:        row[6] || '',
      };

      const typeKey = getTechnicianTypeKey(event.type);
      if (!typeKey || !event.id || !isFutureOrToday(event.date)) return;

      groupedEvents[typeKey].push(event);
    });

    TECHNICIAN_EVENT_TYPES.forEach(type => {
      renderTechnicianEventsList(type.key, groupedEvents[type.key] || []);
    });
  } catch (error) {
    console.error('Error cargando eventos del técnico:', error);
  }
}

function getTechnicianTypeKey(typeLabel = '') {
  const normalized = String(typeLabel).trim().toLowerCase();
  if (normalized.includes('entrena')) return 'training';
  if (normalized.includes('partido')) return 'match';
  if (normalized.includes('amistoso')) return 'friendly';
  return null;
}

function renderTechnicianEventsList(typeKey, events) {
  const listEl = document.getElementById(`technician-events-${typeKey}`);
  if (!listEl) return;

  if (!events.length) {
    listEl.innerHTML = '<p class="technician-events-empty">No hay eventos guardados.</p>';
    return;
  }

  listEl.innerHTML = events.map(event => renderTechnicianEventRow(event)).join('');

  listEl.querySelectorAll('.btn-technician-view-attendance').forEach(button => {
    button.addEventListener('click', onTechnicianViewAttendanceClick);
  });
  listEl.querySelectorAll('.btn-technician-edit-event').forEach(button => {
    button.addEventListener('click', () => openEditEventModal(button.dataset));
  });
}

function renderTechnicianEventRow(event) {
  const dateText     = formatTechnicianEventDate(event.date);
  const timeText     = event.time     || '—';
  const locationText = event.location || '—';
  const convocatoriaText = event.convocatoria || '';

  return `
    <div class="technician-event-row">
      <div class="technician-event-meta">
        <span class="technician-event-date">${escapeHtml(dateText)}</span>
        <span class="technician-event-time">${escapeHtml(timeText)}</span>
        <span class="technician-event-location">${escapeHtml(locationText)}</span>
        ${convocatoriaText ? `<span class="technician-event-convocatoria">Conv: ${escapeHtml(convocatoriaText)}</span>` : ''}
      </div>
      <button
        class="btn-technician-view-attendance"
        type="button"
        data-event-id="${escapeHtml(event.id)}"
        data-event-tipo="${escapeHtml(event.type)}"
        data-event-fecha="${escapeHtml(event.date)}"
      >Ver asistencia</button>
      <button
        class="btn-technician-edit-event"
        type="button"
        data-event-id="${escapeHtml(event.id)}"
        data-event-tipo="${escapeHtml(event.type)}"
        data-event-fecha="${escapeHtml(event.date)}"
        data-event-hora="${escapeHtml(event.time || '')}"
        data-event-location="${escapeHtml(event.location || '')}"
        data-event-convocatoria="${escapeHtml(event.convocatoria || '')}"
        data-event-notas="${escapeHtml(event.notes || '')}"
      >Editar</button>
    </div>
  `;
}

// ── Modal ver asistencia ─────────────────────
async function onTechnicianViewAttendanceClick(event) {
  const button    = event.currentTarget;
  const eventId   = button.dataset.eventId;
  const eventType = button.dataset.eventTipo  || '';
  const eventDate = button.dataset.eventFecha || '';

  if (!eventId) return;

  openTechnicianAttendanceModal(`${eventType} · ${formatTechnicianEventDate(eventDate)}`);

  try {
    const [players, attendanceMap] = await Promise.all([
      loadAttendancePlayers(),
      loadAttendanceByEventId(eventId),
    ]);
    console.log('jugadores cargados:', players);
    renderAttendanceDetailRows(players, attendanceMap);
  } catch (error) {
    console.error('Error cargando detalle de asistencia:', error);
    renderAttendanceDetailError();
  }
}

function bindTechnicianAttendanceModal() {
  if (TechnicianState.attendanceModalBound) return;

  const modal       = document.getElementById('modal-attendance');
  const closeButton = document.getElementById('modal-attendance-close');

  if (!modal || !closeButton) return;

  closeButton.addEventListener('click', closeTechnicianAttendanceModal);
  modal.addEventListener('click', event => {
    if (event.target === modal) closeTechnicianAttendanceModal();
  });

  TechnicianState.attendanceModalBound = true;
}

function openTechnicianAttendanceModal(title) {
  const modal   = document.getElementById('modal-attendance');
  const titleEl = document.getElementById('modal-attendance-title');
  const bodyEl  = document.getElementById('modal-attendance-body');

  if (!modal) return;

  if (titleEl) titleEl.textContent = title;
  if (bodyEl)  bodyEl.innerHTML    = '<p>Cargando...</p>';

  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}

function closeTechnicianAttendanceModal() {
  const modal = document.getElementById('modal-attendance');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.style.display = 'none';
}

// ── Carga de datos ───────────────────────────
async function loadAttendancePlayers() {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}` +
    `/values/${CONFIG.SHEETS.PLAYERS}` +
    `?key=${CONFIG.API_KEY}`;

  const response = await fetch(url, { redirect: 'follow' });
  const data     = await response.json();

  if (!data.values || data.values.length < 2) return [];

  return data.values.slice(1)
    .map(row => ({ name: row[0] || '' }))
    .filter(player => player.name);
}

async function loadAttendanceByEventId(eventId) {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}` +
    `/values/${CONFIG.SHEETS.ATTENDANCE}` +
    `?key=${CONFIG.API_KEY}`;

  const response = await fetch(url, { redirect: 'follow' });
  const data     = await response.json();
  console.log('asistencias cargadas:', data);

  if (!data.values || data.values.length < 2) return {};

  const attendanceMap = {};

  data.values.slice(1)
    .filter(row => row[0] === eventId)
    .forEach(row => {
      const playerName = row[2] || '';
      if (!playerName) return;
      attendanceMap[playerName] = {
        response: row[4] || '⏳ Pendiente',
        comment:  row[5] || '',
      };
    });

  return attendanceMap;
}

// ── Renderizado tabla asistencia ─────────────
function renderAttendanceDetailRows(players, attendanceMap) {
  const bodyEl = document.getElementById('modal-attendance-body');
  if (!bodyEl) return;

  bodyEl.innerHTML = `
    <div class="attendance-detail-table-wrap">
      <table class="attendance-detail-table">
        <thead>
          <tr>
            <th>Jugador</th>
            <th class="attendance-col-response">Respuesta</th>
            <th>Comentario</th>
          </tr>
        </thead>
        <tbody>
          ${players.map(player => {
            const attendance = attendanceMap[player.name];
            const response   = attendance?.response || '⏳ Pendiente';
            const comment    = attendance?.comment   || '';
            return `
              <tr>
                <td>${escapeHtml(player.name)}</td>
                <td>${escapeHtml(response)}</td>
                <td>${comment ? escapeHtml(comment) : '—'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderAttendanceDetailError() {
  const bodyEl = document.getElementById('modal-attendance-body');
  if (!bodyEl) return;
  bodyEl.innerHTML = '<p>Error al cargar la asistencia.</p>';
}

// ── Utilidades ───────────────────────────────
function formatTechnicianEventDate(dateStr) {
  if (!dateStr) return '—';

  const parts = dateStr.includes('/')
    ? dateStr.split('/').map(Number)
    : dateStr.split('-').map(Number);

  const date = dateStr.includes('/')
    ? new Date(parts[2], parts[1] - 1, parts[0])
    : new Date(parts[0], parts[1] - 1, parts[2]);

  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('es-ES');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
