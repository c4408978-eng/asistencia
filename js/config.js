// ─────────────────────────────────────────────
//  config.js  –  Ajusta estos valores antes de
//               desplegar la aplicación
// ─────────────────────────────────────────────

const CONFIG = {

  // ID del Google Spreadsheet.
  // Lo encuentras en la URL del Sheet:
  //   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
  SPREADSHEET_ID: '1wlNoXS9MW_MZL8L8-8X5fPWGMZ0oNQMGpTE4UybIkKQ',

  // API Key de Google Cloud Console (solo lectura es suficiente para
  // cargar jugadores y eventos; las escrituras van por Apps Script).
  // Ver README.md para instrucciones de obtención.
  API_KEY: 'AIzaSyBWcOH4qAp0pmjXBhTz2EZPK2Boltm5l3Y',

  // URL del Web App de Google Apps Script que escribe las asistencias.
  // Ver README.md – sección "Apps Script" para instrucciones.
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwfZ9l0kS16BK0_VQeV5eD1w3zzDof-e63f8Cb8nkWomIzs69He14i7E0Vza50L72nH/exec',

  // Nombre de las hojas dentro del Spreadsheet (no cambiar salvo
  // que renombres las hojas en Google Sheets).
  SHEETS: {
    PLAYERS:    'Jugadores',
    COACHES:    'Tecnicos',
    EVENTS:     'Evento',
    ATTENDANCE: 'Asistencia',
  },
};
