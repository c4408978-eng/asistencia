// ─────────────────────────────────────────────
//  attendance.js  –  Gestiona la confirmación
//  de asistencia (Sí / No + comentario)
// ─────────────────────────────────────────────

// Estado temporal del modal
let _pendingAction = null; // { eventId, eventLabel, response }

// ── Delegación de clicks en las tarjetas ────────────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn-attend');
  if (!btn) return;

  const action     = btn.dataset.action;       // 'yes' | 'no'
  const eventId    = btn.dataset.eventId;
  const eventLabel = btn.dataset.eventLabel;
  const response   = action === 'yes' ? 'Sí' : 'No';

  openModal(eventId, eventLabel, response);
});

// ── Modal ────────────────────────────────────────────────────────
function openModal(eventId, eventLabel, response) {
  _pendingAction = { eventId, eventLabel, response };

  const verb = response === 'Sí' ? '✅ Confirmar asistencia' : '❌ No puedo asistir';
  document.getElementById('modal-title').textContent = `${verb}`;
  document.getElementById('modal-comment').value     = '';

  // Mostrar nombre del evento en el subtítulo
  const sub = document.querySelector('.modal-sub');
  sub.textContent = `${eventLabel} — añade un comentario (opcional)`;

  document.getElementById('modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('modal-comment').focus(), 50);
}

function closeModal() {
  _pendingAction = null;
  document.getElementById('modal-overlay').classList.add('hidden');
}

document.getElementById('modal-cancel').addEventListener('click', closeModal);

document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

document.getElementById('modal-confirm').addEventListener('click', async () => {
  if (!_pendingAction) return;

  const { eventId, response } = _pendingAction;
  const comment = document.getElementById('modal-comment').value.trim();

  const btn = document.getElementById('modal-confirm');
  btn.disabled    = true;
  btn.textContent = 'Guardando…';

  try {
    await saveAttendance(eventId, response, comment);
    closeModal();
    updateCardUI(eventId, response, comment);
  } catch (err) {
    console.error('Error guardando asistencia:', err);
    alert('No se pudo guardar. Inténtalo de nuevo.');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Confirmar';
  }
});

// ── Envío a Apps Script ──────────────────────────────────────────
async function saveAttendance(eventId, response, comment) {
  const player    = Session.get();
  const timestamp = new Date().toISOString();
  const event = (window._events || []).find(e => e.id === eventId) || {};

  const payload = {
    action:    'upsertAttendance',
    eventId,
    tipo:      event.type,
    jugador:   player.name,
    fecha:     event.date,
    response,
    comment,
    timestamp,
  };

  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    redirect: 'follow',
    // Apps Script Web App requiere text/plain para evitar preflight CORS
    headers: { 'Content-Type': 'text/plain' },
    body:    JSON.stringify(payload),
  });

  const data = await res.json();
  if (data.status !== 'ok') throw new Error(data.message || 'Error desconocido');
}

// ── Actualiza la tarjeta visualmente sin recargar ────────────────
function updateCardUI(eventId, response, comment) {
  const card = document.querySelector(`.event-card[data-event-id="${eventId}"]`);
  if (!card) return;

  // Actualizar clases active de los botones
  card.querySelectorAll('.btn-attend').forEach(b => {
    const isActive =
      (b.dataset.action === 'yes' && response === 'Sí') ||
      (b.dataset.action === 'no'  && response === 'No');
    b.classList.toggle('active', isActive);
  });

  // Actualizar o crear el comentario
  let commentEl = card.querySelector('.attendance-comment');
  if (comment) {
    if (!commentEl) {
      commentEl = document.createElement('p');
      commentEl.className = 'attendance-comment';
      card.appendChild(commentEl);
    }
    commentEl.textContent = `💬 "${comment}"`;
  } else if (commentEl) {
    commentEl.remove();
  }
}
