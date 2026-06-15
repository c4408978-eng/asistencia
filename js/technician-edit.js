// ─────────────────────────────────────────────
//  technician-edit.js  –  Modal de edición
//  de eventos para técnicos
// ─────────────────────────────────────────────

// ── Punto de entrada llamado desde technician-attendance.js ──────
function openEditEventModal(dataset) {
  TechnicianState.currentEditEventId = dataset.eventId || '';

  const titleEl           = document.getElementById('modal-edit-title');
  const fechaInput        = document.getElementById('edit-fecha');
  const horaInput         = document.getElementById('edit-hora');
  const locationSelect    = document.getElementById('edit-location');
  const convocatoriaInput = document.getElementById('edit-convocatoria');
  const notasInput        = document.getElementById('edit-notas');

  if (!fechaInput || !horaInput || !locationSelect || !convocatoriaInput || !notasInput) return;

  if (titleEl) {
    titleEl.textContent = `${dataset.eventTipo || 'Evento'} · ${formatTechnicianEventDate(dataset.eventFecha || '')}`;
  }

  fechaInput.value        = normalizeEventDateForInput(dataset.eventFecha || '');
  horaInput.value         = dataset.eventHora         || '';
  locationSelect.value    = dataset.eventLocation      || 'LOCAL';
  convocatoriaInput.value = dataset.eventConvocatoria  || '';
  notasInput.value        = dataset.eventNotas         || '';

  updateTechnicianEditConvocatoria();
  openTechnicianEditModal();
}

// ── Bind de listeners (se llama desde initTechnicianScreen) ──────
function bindTechnicianEditModal() {
  if (TechnicianState.editModalBound) return;

  const modal          = document.getElementById('modal-edit-event');
  const cancelButton   = document.getElementById('modal-edit-cancel');
  const saveButton     = document.getElementById('modal-edit-save');
  const deleteButton   = document.getElementById('modal-edit-delete');
  const timeInput      = document.getElementById('edit-hora');
  const locationSelect = document.getElementById('edit-location');

  if (!modal || !cancelButton || !saveButton || !deleteButton || !timeInput || !locationSelect) return;

  cancelButton.addEventListener('click', closeTechnicianEditModal);
  saveButton.addEventListener('click', onTechnicianEditSave);
  deleteButton.addEventListener('click', onTechnicianEditDelete);

  modal.addEventListener('click', event => {
    if (event.target === modal) closeTechnicianEditModal();
  });

  timeInput.addEventListener('change', updateTechnicianEditConvocatoria);
  locationSelect.addEventListener('change', updateTechnicianEditConvocatoria);

  TechnicianState.editModalBound = true;
}

// ── Abrir / cerrar modal ─────────────────────
function openTechnicianEditModal() {
  const modal = document.getElementById('modal-edit-event');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}

function closeTechnicianEditModal() {
  const modal = document.getElementById('modal-edit-event');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.style.display = 'none';
}

// ── Calcular hora convocatoria ───────────────
function updateTechnicianEditConvocatoria() {
  const horaInput         = document.getElementById('edit-hora');
  const locationSelect    = document.getElementById('edit-location');
  const convocatoriaInput = document.getElementById('edit-convocatoria');

  if (!horaInput || !locationSelect || !convocatoriaInput) return;

  convocatoriaInput.value = calculateConvocatoriaTime(horaInput.value, locationSelect.value);
}

function calculateConvocatoriaTime(horaStr, location) {
  if (!horaStr) return '';

  const [h, m]    = horaStr.split(':').map(Number);
  const totalMins = h * 60 + m - (location === 'VISITANTE' ? 75 : 60);
  const hh        = Math.floor(((totalMins % 1440) + 1440) % 1440 / 60);
  const mm        = ((totalMins % 60) + 60) % 60;

  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ── Guardar ──────────────────────────────────
async function onTechnicianEditSave() {
  if (!TechnicianState.currentEditEventId) return;

  const saveButton        = document.getElementById('modal-edit-save');
  const fechaInput        = document.getElementById('edit-fecha');
  const horaInput         = document.getElementById('edit-hora');
  const locationSelect    = document.getElementById('edit-location');
  const convocatoriaInput = document.getElementById('edit-convocatoria');
  const notasInput        = document.getElementById('edit-notas');

  if (!saveButton || !fechaInput || !horaInput || !locationSelect || !convocatoriaInput || !notasInput) return;

  const originalText     = saveButton.textContent;
  saveButton.disabled    = true;
  saveButton.textContent = 'Guardando…';

  try {
    const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method:  'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action:           'updateEvent',
        eventId:          TechnicianState.currentEditEventId,
        fecha:            fechaInput.value        || '',
        hora:             horaInput.value         || '',
        localVisitante:   locationSelect.value    || '',
        horaConvocatoria: convocatoriaInput.value || '',
        notas:            notasInput.value.trim() || '',
      }),
    });

    const result = await response.json();
    if (result?.status !== 'ok') throw new Error('Respuesta no válida del servidor');

    closeTechnicianEditModal();
    loadTechnicianEvents();
  } catch (error) {
    console.error('Error actualizando evento:', error);
    alert('Error al guardar. Inténtalo de nuevo.');
  } finally {
    saveButton.disabled    = false;
    saveButton.textContent = originalText;
  }
}

// ── Eliminar ─────────────────────────────────
async function onTechnicianEditDelete() {
  if (!TechnicianState.currentEditEventId) return;
  if (!confirm('¿Seguro que quieres eliminar este evento?')) return;

  const deleteButton = document.getElementById('modal-edit-delete');
  if (!deleteButton) return;

  const originalText       = deleteButton.textContent;
  deleteButton.disabled    = true;
  deleteButton.textContent = 'Eliminando…';

  try {
    const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method:  'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action:  'deleteEvent',
        eventId: TechnicianState.currentEditEventId,
      }),
    });

    const result = await response.json();
    if (result?.status !== 'ok') throw new Error('Respuesta no válida del servidor');

    closeTechnicianEditModal();
    loadTechnicianEvents();
  } catch (error) {
    console.error('Error eliminando evento:', error);
    alert('Error al eliminar. Inténtalo de nuevo.');
  } finally {
    deleteButton.disabled    = false;
    deleteButton.textContent = originalText;
  }
}

// ── Utilidad ─────────────────────────────────
function normalizeEventDateForInput(dateStr) {
  if (!dateStr) return '';
  if (dateStr.includes('-')) return dateStr;

  const [day, month, year] = dateStr.split('/');
  if (!day || !month || !year) return dateStr;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
