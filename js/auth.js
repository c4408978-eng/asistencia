// ─────────────────────────────────────────────
//  auth.js  –  Carga jugadores, valida PIN y
//              gestiona la sesión en memoria
// ─────────────────────────────────────────────

// Estado de sesión (vive solo mientras la pestaña está abierta)
const Session = {
  player: null,   // { name, pin, role }

  set(player) {
    this.player = player;
  },
  clear() {
    this.player = null;
  },
  get() {
    return this.player;
  },
};

// ── Carga la lista de jugadores desde Google Sheets ──────────────
async function loadPlayers() {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}` +
    `/values/${CONFIG.SHEETS.PLAYERS}` +
    `?key=${CONFIG.API_KEY}`;

  const res  = await fetch(url, { redirect: 'follow' });
  const data = await res.json();

  if (!data.values || data.values.length < 2) return [];

  // Fila 0 = cabecera (Nombre | PIN), fila 1+ = datos
  return data.values.slice(1).map(row => ({
    name: row[0] || '',
    pin:  String(row[1] || ''),
    role: 'player',
  })).filter(p => p.name);
}

// ── Carga la lista de técnicos desde Google Sheets ──────────────
async function loadTechnicians() {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}` +
    `/values/${CONFIG.SHEETS.COACHES}` +
    `?key=${CONFIG.API_KEY}`;

  const res  = await fetch(url, { redirect: 'follow' });
  const data = await res.json();

  if (!data.values || data.values.length < 2) return [];

  return data.values.slice(1).map(row => ({
    name: row[0] || '',
    pin:  String(row[1] || ''),
    role: 'technician',
  })).filter(t => t.name);
}

// ── Carga e inicializa los jugadores en memoria ──────────────────
async function initAuth() {
  try {
    const [players, technicians] = await Promise.all([
      loadPlayers(),
      loadTechnicians(),
    ]);
    window._players = players;
    window._technicians = technicians;
  } catch (err) {
    console.error('Error cargando usuarios:', err);
  }
}

// ── Valida PIN ──────────────────────────────────────────────────
function validateLogin(pin) {
  const players = window._players || [];
  const technicians = window._technicians || [];
  return technicians.find(t => String(t.pin).trim() === String(pin).trim())
    || players.find(p => String(p.pin).trim() === String(pin).trim())
    || null;
}

// ── Listeners del formulario de login ────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initAuth();

  const btnLogin   = document.getElementById('btn-login');
  const errorMsg   = document.getElementById('login-error');
  const btnLogout  = document.getElementById('btn-logout');
  const btnLogoutTechnician = document.getElementById('btn-logout-technician');

  const handleLogout = () => {
    Session.clear();
    document.getElementById('input-pin').value = '';
    document.getElementById('screen-dashboard').classList.add('hidden');
    document.getElementById('screen-dashboard').classList.remove('active');
    document.getElementById('screen-technician').classList.add('hidden');
    document.getElementById('screen-technician').classList.remove('active');
    document.getElementById('screen-login').classList.remove('hidden');
    document.getElementById('screen-login').classList.add('active');
  };

  btnLogin.addEventListener('click', () => {
    const pin  = document.getElementById('input-pin').value.trim();

    if (!pin) {
      errorMsg.textContent = 'Introduce tu PIN.';
      errorMsg.classList.remove('hidden');
      return;
    }

    const user = validateLogin(pin);
    if (!user) {
      errorMsg.textContent = 'PIN incorrecto. Inténtalo de nuevo.';
      errorMsg.classList.remove('hidden');
      document.getElementById('input-pin').value = '';
      return;
    }

    // Login correcto
    errorMsg.classList.add('hidden');
    Session.set(user);
    showDashboard(user.name);
  });

  // Permitir Enter en el campo PIN
  document.getElementById('input-pin').addEventListener('keydown', e => {
    if (e.key === 'Enter') btnLogin.click();
  });

  btnLogout.addEventListener('click', handleLogout);
  if (btnLogoutTechnician) btnLogoutTechnician.addEventListener('click', handleLogout);
});

// ── Transición de pantallas ──────────────────────────────────────
function showDashboard(playerName) {
  const technicians = window._technicians || [];
  const isTechnician = technicians.some(t => t.name === playerName);

  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-login').classList.remove('active');

  if (isTechnician) {
    document.getElementById('screen-dashboard').classList.add('hidden');
    document.getElementById('screen-dashboard').classList.remove('active');
    document.getElementById('screen-technician').classList.remove('hidden');
    document.getElementById('screen-technician').classList.add('active');
    initTechnicianScreen();
    showTechnicianScreen(playerName);
    return;
  }

  document.getElementById('screen-technician').classList.add('hidden');
  document.getElementById('screen-technician').classList.remove('active');
  document.getElementById('screen-dashboard').classList.remove('hidden');
  document.getElementById('screen-dashboard').classList.add('active');
  document.getElementById('header-name').textContent = playerName;
  loadEvents(); // definido en events.js
}
