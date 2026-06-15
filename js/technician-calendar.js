// ─────────────────────────────────────────────
//  technician-calendar.js  –  Calendarios y
//  creación de eventos para técnicos
// ─────────────────────────────────────────────

const TECHNICIAN_EVENT_TYPES = [
  { key: 'training', label: 'Entrenamiento' },
  { key: 'match',    label: 'Partido' },
  { key: 'friendly', label: 'Amistoso' },
];

const TECHNICIAN_FORM_FIELD_IDS = {
  training: { time: 'time-entrenamiento' },
  match:    { time: 'time-partido' },
  friendly: { time: 'time-amistoso' },
};

const TECHNICIAN_CONVOCATION_FIELD_IDS = {
  training: {
    time:         'time-entrenamiento',
    location:     'location-training',
    convocatoria: 'convocatoria-training',
  },
  match: {
    time:         'time-partido',
    location:     'location-match',
    convocatoria: 'convocatoria-match',
  },
  friendly: {
    time:         'time-amistoso',
    location:     'location-friendly',
    convocatoria: 'convocatoria-friendly',
  },
};

const TechnicianState = {
  pendingEvents:        [],
  calendars:            {},
  selectedDates:        {},
  savedEventsByType:    {},
  attendanceModalBound: false,
};

// ── Inicialización ───────────────────────────
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
  bindTechnicianEditModal();
}

function showTechnicianScreen(name) {
  const header = document.getElementById('header-name-technician');
  if (header) header.textContent = name;

  TechnicianState.pendingEvents      = [];
  TechnicianState.selectedDates      = {};
  TechnicianState.savedEventsByType  = {};

  TECHNICIAN_EVENT_TYPES.forEach(type => {
    TechnicianState.calendars[type.key] = getMonthStart(new Date());
    clearTechnicianForm(type.key);
    hideTechnicianError(type.key);
    renderTechnicianCalendar(type.key);
  });

  loadTechnicianEvents();
}

// ── Calendario ───────────────────────────────
function renderTechnicianCalendar(typeKey) {
  const container = document.getElementById(`calendar-${typeKey}`);
  if (!container) return;

  const monthDate    = TechnicianState.calendars[typeKey] || getMonthStart(new Date());
  const selectedDate = TechnicianState.selectedDates[typeKey];
  const today        = startOfDay(new Date());
  const firstDay     = getMonthStart(monthDate);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth  = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();

  const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const cells    = [];

  for (let i = 0; i < startWeekday; i++) {
    cells.push('<button class="calendar-day is-empty" type="button" disabled></button>');
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date       = new Date(firstDay.getFullYear(), firstDay.getMonth(), day);
    const iso        = toISODate(date);
    const isPast     = startOfDay(date) < today;
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
      ${weekdays.map(d => `<div class="calendar-weekday">${d}</div>`).join('')}
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
  TechnicianState.calendars[type] = new Date(
    current.getFullYear(),
    current.getMonth() + (nav === 'next' ? 1 : -1),
    1
  );
  renderTechnicianCalendar(type);
}

function onTechnicianDateSelect(event) {
  const { type, date } = event.currentTarget.dataset;
  TechnicianState.selectedDates[type] = date;
  hideTechnicianError(type);
  showTechnicianForm(type);
  renderTechnicianCalendar(type);
}

// ── Formulario ───────────────────────────────
function showTechnicianForm(typeKey) {
  const form = document.getElementById(`form-${typeKey}`);
  if (form) form.classList.remove('hidden');

  const fieldIds = TECHNICIAN_CONVOCATION_FIELD_IDS[typeKey];
  if (!fieldIds) return;

  const timeInput         = document.getElementById(fieldIds.time);
  const locationSelect    = document.getElementById(fieldIds.location);
  const convocatoriaInput = document.getElementById(fieldIds.convocatoria);

  if (!timeInput || !locationSelect || !convocatoriaInput) return;

  const updateConvocatoria = () => {
    convocatoriaInput.value = calculateConvocatoriaTime(timeInput.value, locationSelect.value);
  };

  if (!timeInput.dataset.convocatoriaBound) {
    timeInput.addEventListener('change', updateConvocatoria);
    timeInput.dataset.convocatoriaBound = 'true';
  }

  if (!locationSelect.dataset.convocatoriaBound) {
    locationSelect.addEventListener('change', updateConvocatoria);
    locationSelect.dataset.convocatoriaBound = 'true';
  }

  updateConvocatoria();
}

function clearTechnicianForm(typeKey) {
  const form = document.getElementById(`form-${typeKey}`);
  if (form) form.classList.add('hidden');

  const fieldIds = TECHNICIAN_FORM_FIELD_IDS[typeKey] || {};
  const time     = document.getElementById(fieldIds.time);
  const location = document.getElementById(`location-${typeKey}`);
  const notes    = document.getElementById(`notes-${typeKey}`);

  if (time)     time.value     = '';
  if (location) location.value = '';
  if (notes)    notes.value    = '';
}

// ── Guardar evento ───────────────────────────
async function onTechnicianSectionSave(event) {
  const button       = event.currentTarget;
  const typeKey      = button.dataset.saveType;
  const selectedDate = TechnicianState.selectedDates[typeKey];
  const fieldIds     = TECHNICIAN_FORM_FIELD_IDS[typeKey] || {};

  if (!selectedDate) {
    showTechnicianMessage(typeKey, 'Selecciona una fecha primero', 'error');
    return;
  }

  const originalLabel   = button.textContent;
  button.disabled       = true;
  button.textContent    = 'Guardando…';
  hideTechnicianMessage(typeKey);

  const typeConfig  = TECHNICIAN_EVENT_TYPES.find(t => t.key === typeKey);
  const savedEvent  = {
    type:     typeConfig?.label || typeKey,
    date:     selectedDate,
    time:     document.getElementById(fieldIds.time)?.value || '',
    notes:    document.getElementById(`notes-${typeKey}`)?.value.trim() || '',
  };

  TechnicianState.savedEventsByType[typeKey] = savedEvent;
  TechnicianState.pendingEvents = Object.values(TechnicianState.savedEventsByType);
  window.pendingEvents = TechnicianState.pendingEvents;

  console.log('Evento guardado:', savedEvent);

  try {
    const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method:   'POST',
      redirect: 'follow',
      headers:  { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action:           'createEvent',
        tipo:             savedEvent.type,
        fecha:            savedEvent.date,
        hora:             savedEvent.time,
        localVisitante:   document.getElementById(`location-${typeKey}`)?.value || '',
        horaConvocatoria: document.getElementById(`convocatoria-${typeKey}`)?.value || '',
        notas:            savedEvent.notes,
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
    button.disabled    = false;
    button.textContent = originalLabel;
  }
}

// ── Mensajes ─────────────────────────────────
function showTechnicianMessage(typeKey, message, kind = 'error') {
  const errorEl = document.getElementById(`error-${typeKey}`);
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.remove('hidden', 'is-success');
  if (kind === 'success') errorEl.classList.add('is-success');
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

// ── Utilidades de fecha ───────────────────────
function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function toISODate(date) {
  const year  = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day   = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateConvocatoriaTime(timeValue, locationValue) {
  if (!timeValue) return '';

  const [hours, minutes] = timeValue.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return '';

  const totalMinutes = (hours * 60) + minutes;
  const offset = locationValue === 'VISITANTE' ? 75 : 60;
  const convocatoriaMinutes = totalMinutes - offset;
  const normalizedMinutes = ((convocatoriaMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const convocatoriaHours = Math.floor(normalizedMinutes / 60);
  const remainingMinutes = normalizedMinutes % 60;

  return `${String(convocatoriaHours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}`;
}

window.initTechnicianScreen  = initTechnicianScreen;
window.showTechnicianScreen  = showTechnicianScreen;
