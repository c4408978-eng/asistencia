// ─────────────────────────────────────────────
//  technician.js  –  Gestión de creación de
//                    eventos para técnicos
// ─────────────────────────────────────────────

const TECHNICIAN_EVENT_TYPES = [
  { key: 'training', label: 'Entrenamiento' },
  { key: 'match', label: 'Partido' },
  { key: 'friendly', label: 'Amistoso' },
];

const TechnicianState = {
  pendingEvents: [],
  calendars: {},
  selectedDates: {},
  savedEventsByType: {},
  attendanceModalBound: false,
};

function initTechnicianScreen() {
  TECHNICIAN_EVENT_TYPES.forEach(type => {
    if (!TechnicianState.calendars[type.key]) {
      TechnicianState.calendars[type.key] = getMonthStart(new Date());
    }
    renderTechnicianCalendar(type.key);
  });

  document.querySelectorAll('.btn-technician-section-save').forEach(btn => {
    if (!btn.dataset.bound) {
      btn.addEventListener('click', onTechnicianSectionSave);
      btn.dataset.bound = 'true';
    }
  });

  bindTechnicianAttendanceModal();
}

function showTechnicianScreen(name) {
  const header = document.getElementById('header-name-technician');
  if (header) header.textContent = name;

  TechnicianState.pendingEvents = [];
  TechnicianState.selectedDates = {};
  TechnicianState.savedEventsByType = {};
  TECHNICIAN_EVENT_TYPES.forEach(type => {
    TechnicianState.calendars[type.key] = getMonthStart(new Date());
    clearTechnicianForm(type.key);
    hideTechnicianError(type.key);
    renderTechnicianCalendar(type.key);
  });

  loadTechnicianEvents();
}

async function loadTechnicianEvents() {
  const eventsUrl =
    `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}` +
    `/values/${CONFIG.SHEETS.EVENTS}` +
    `?key=${CONFIG.API_KEY}`;

  TECHNICIAN_EVENT_TYPES.forEach(type => {
    renderTechnicianEventsList(type.key, []);
  });

  try {
    const response = await fetch(eventsUrl, {
      method: 'GET',
      redirect: 'follow',
    });
    const data = await response.json();

    if (!data.values || data.values.length < 2) {
      return;
    }

    const groupedEvents = {
      training: [],
      match: [],
      friendly: [],
    };

    data.values.slice(1).forEach(row => {
      const event = {
        id: row[0] || '',
        type: row[1] || '',
        date: row[2] || '',
        time: row[3] || '',
        location: row[4] || '',
        notes: row[5] || '',
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
}

async function onTechnicianViewAttendanceClick(event) {
  const button = event.currentTarget;
  const eventId = button.dataset.eventId;
  console.log('click ver asistencia', eventId);
  const eventType = button.dataset.eventTipo || '';
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

function renderTechnicianEventRow(event) {
  const dateText = formatTechnicianEventDate(event.date);
  const timeText = event.time || '—';
  const locationText = event.location || '—';

  return `
    <div class="technician-event-row">
      <div class="technician-event-meta">
        <span class="technician-event-date">${escapeHtml(dateText)}</span>
        <span class="technician-event-time">${escapeHtml(timeText)}</span>
        <span class="technician-event-location">${escapeHtml(locationText)}</span>
      </div>
      <button
        class="btn-technician-view-attendance"
        type="button"
        data-event-id="${escapeHtml(event.id)}"
        data-event-tipo="${escapeHtml(event.type)}"
        data-event-fecha="${escapeHtml(event.date)}"
      >Ver asistencia</button>
    </div>
  `;
}

async function loadAttendancePlayers() {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}` +
    `/values/${CONFIG.SHEETS.PLAYERS}` +
    `?key=${CONFIG.API_KEY}`;

  const response = await fetch(url, { redirect: 'follow' });
  const data = await response.json();

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
  const data = await response.json();
  console.log('asistencias cargadas:', data);

  if (!data.values || data.values.length < 2) return {};

  const attendanceMap = {};

  data.values
    .slice(1)
    .filter(row => row[0] === eventId)
    .forEach(row => {
      const playerName = row[2] || '';

      if (!playerName) return;

      attendanceMap[playerName] = {
        response: row[4] || '⏳ Pendiente',
        comment: row[5] || '',
      };
    });

  return attendanceMap;
}

function bindTechnicianAttendanceModal() {
  if (TechnicianState.attendanceModalBound) return;

  const modal = document.getElementById('modal-attendance');
  const closeButton = document.getElementById('modal-attendance-close');

  if (!modal || !closeButton) return;

  closeButton.addEventListener('click', () => {
    document.getElementById('modal-attendance').classList.add('hidden');
  });
  modal.addEventListener('click', event => {
    if (event.target === modal) {
      closeTechnicianAttendanceModal();
    }
  });

  TechnicianState.attendanceModalBound = true;
}

function openTechnicianAttendanceModal(title) {
  const modal = document.getElementById('modal-attendance');
  console.log('modal encontrado:', modal);
  const titleEl = document.getElementById('modal-attendance-title');
  const bodyEl = document.getElementById('modal-attendance-body');

  if (!modal) {
    console.log('modal NO existe en el HTML');
    return;
  }

  if (!titleEl || !bodyEl) return;

  titleEl.textContent = title;
  bodyEl.innerHTML = 'Cargando...';
  modal.classList.remove('hidden');
  console.log('modal abierto');
}

function closeTechnicianAttendanceModal() {
  const modal = document.getElementById('modal-attendance');
  if (!modal) return;

  modal.classList.add('hidden');
}

function renderAttendanceDetailRows(players, attendanceMap) {
  const bodyEl = document.getElementById('modal-attendance-body');
  if (!bodyEl) return;

  if (!players.length) {
    bodyEl.innerHTML = '<p>No hay jugadores disponibles.</p>';
    return;
  }

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
    const response = attendance?.response || '⏳ Pendiente';
    const comment = attendance?.comment || '';

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

function renderTechnicianCalendar(typeKey) {
  const container = document.getElementById(`calendar-${typeKey}`);
  if (!container) return;

  const monthDate = TechnicianState.calendars[typeKey] || getMonthStart(new Date());
  const selectedDate = TechnicianState.selectedDates[typeKey];
  const today = startOfDay(new Date());
  const firstDay = getMonthStart(monthDate);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();

  const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const cells = [];

  for (let i = 0; i < startWeekday; i += 1) {
    cells.push('<button class="calendar-day is-empty" type="button" disabled></button>');
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(firstDay.getFullYear(), firstDay.getMonth(), day);
    const iso = toISODate(date);
    const isPast = startOfDay(date) < today;
    const isSelected = selectedDate === iso;

    cells.push(`
      <button
        class="calendar-day${isSelected ? ' selected' : ''}"
        type="button"
        data-type="${typeKey}"
        data-date="${iso}"
        ${isPast ? 'disabled' : ''}
      >${day}</button>
    `);
  }

  container.innerHTML = `
    <div class="calendar-header">
      <button class="calendar-nav" type="button" data-nav="prev" data-type="${typeKey}" aria-label="Mes anterior">‹</button>
      <div class="calendar-month">${monthDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</div>
      <button class="calendar-nav" type="button" data-nav="next" data-type="${typeKey}" aria-label="Mes siguiente">›</button>
    </div>
    <div class="calendar-weekdays">
      ${weekdays.map(day => `<div class="calendar-weekday">${day}</div>`).join('')}
    </div>
    <div class="calendar-grid">
      ${cells.join('')}
    </div>
  `;

  container.querySelectorAll('.calendar-nav').forEach(btn => {
    btn.addEventListener('click', onTechnicianCalendarNav);
  });

  container.querySelectorAll('.calendar-day:not(:disabled)').forEach(btn => {
    btn.addEventListener('click', onTechnicianDateSelect);
  });
}

function onTechnicianCalendarNav(event) {
  const { nav, type } = event.currentTarget.dataset;
  const current = TechnicianState.calendars[type] || getMonthStart(new Date());
  TechnicianState.calendars[type] = new Date(current.getFullYear(), current.getMonth() + (nav === 'next' ? 1 : -1), 1);
  renderTechnicianCalendar(type);
}

function onTechnicianDateSelect(event) {
  const { type, date } = event.currentTarget.dataset;
  TechnicianState.selectedDates[type] = date;
  hideTechnicianError(type);
  showTechnicianForm(type);
  renderTechnicianCalendar(type);
}

function showTechnicianForm(typeKey) {
  const form = document.getElementById(`form-${typeKey}`);
  if (form) form.classList.remove('hidden');
}

function clearTechnicianForm(typeKey) {
  const form = document.getElementById(`form-${typeKey}`);
  if (form) form.classList.add('hidden');

  const time = document.getElementById(`time-${typeKey}`);
  const location = document.getElementById(`location-${typeKey}`);
  const notes = document.getElementById(`notes-${typeKey}`);

  if (time) time.value = '';
  if (location) location.value = '';
  if (notes) notes.value = '';
}

async function onTechnicianSectionSave(event) {
  const button = event.currentTarget;
  const typeKey = button.dataset.saveType;
  const selectedDate = TechnicianState.selectedDates[typeKey];

  if (!selectedDate) {
    showTechnicianMessage(typeKey, 'Selecciona una fecha primero', 'error');
    return;
  }

  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = 'Guardando…';

  hideTechnicianMessage(typeKey);

  const typeConfig = TECHNICIAN_EVENT_TYPES.find(type => type.key === typeKey);
  const savedEvent = {
    type: typeConfig?.label || typeKey,
    date: selectedDate,
    time: document.getElementById(`time-${typeKey}`)?.value || '',
    location: document.getElementById(`location-${typeKey}`)?.value.trim() || '',
    notes: document.getElementById(`notes-${typeKey}`)?.value.trim() || '',
  };

  TechnicianState.savedEventsByType[typeKey] = savedEvent;
  TechnicianState.pendingEvents = Object.values(TechnicianState.savedEventsByType);
  window.pendingEvents = TechnicianState.pendingEvents;

  console.log('Evento guardado:', savedEvent);

  try {
    const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'createEvent',
        tipo: savedEvent.type,
        fecha: savedEvent.date,
        hora: savedEvent.time,
        lugar: savedEvent.location,
        notas: savedEvent.notes,
      }),
    });

    const result = await response.json();

    if (result?.status === 'ok') {
      showTechnicianMessage(typeKey, 'Evento guardado correctamente', 'success');
      loadTechnicianEvents();
    } else {
      throw new Error('Respuesta no válida del servidor');
    }
  } catch (error) {
    console.error('Error guardando evento:', error);
    showTechnicianMessage(typeKey, 'Error al guardar, inténtalo de nuevo', 'error');
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function showTechnicianMessage(typeKey, message, kind = 'error') {
  const errorEl = document.getElementById(`error-${typeKey}`);
  if (!errorEl) return;

  errorEl.textContent = message;
  errorEl.classList.remove('hidden', 'is-success');

  if (kind === 'success') {
    errorEl.classList.add('is-success');
  }
}

function hideTechnicianMessage(typeKey) {
  const errorEl = document.getElementById(`error-${typeKey}`);
  if (!errorEl) return;

  errorEl.classList.add('hidden');
  errorEl.classList.remove('is-success');
}

function hideTechnicianError(typeKey) {
  hideTechnicianMessage(typeKey);
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

window.initTechnicianScreen = initTechnicianScreen;
window.showTechnicianScreen = showTechnicianScreen;
