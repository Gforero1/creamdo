/**
 * Panel de Creamdo Art: backend.
 * Vive dentro de una hoja de Google. Guarda la contraseña del panel (como huella con sal)
 * y la clave de Gemini en las propiedades del script. Ninguna de las dos sale de aquí.
 *
 * @OnlyCurrentDoc
 */

var MODELO = 'gemini-nano-banana-2.1';
var TAMANO = '2K';
var LIMITE_DIARIO = 40;            // imágenes por día, para acotar el gasto
var HORAS_SESION = 12;
var FALLOS_MAX = 8;                // intentos de clave antes de bloquear
var MINUTOS_BLOQUEO = 10;
var MAX_IMAGEN_B64 = 7 * 1024 * 1024;

// El texto que recibe Gemini se decide aquí, no en la web: así la clave no sirve
// para pedirle cualquier otra cosa aunque alguien robe una sesión.
var INSTRUCCIONES = {
  pintura: 'This is a photo of a room where a painting has been digitally pasted onto the wall. ' +
    'Make it look like a real photograph of that painting physically hanging there. ' +
    'Only fix the integration: the light and shadow falling on the canvas so they match the wall around it, ' +
    'the soft shadow the canvas casts on the wall, a thin visible canvas edge, and matching grain and sharpness. ' +
    'Strict rules: do NOT move, resize, rotate, crop or reframe the painting; do NOT add a frame; ' +
    'do NOT change anything painted on the canvas; do NOT change the room, furniture, window, plants or camera framing. ' +
    'Output the same image, same aspect ratio and composition, just naturally integrated.'
};

// ---------- menú de la hoja ----------
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Creamdo')
    .addItem('1. Preparar la hoja', 'instalar')
    .addItem('2. Guardar la clave de Gemini', 'guardarClaveGemini')
    .addItem('3. Crear o cambiar la contraseña del panel', 'crearContrasena')
    .addSeparator()
    .addItem('Ver estado', 'verEstado')
    .addToUi();
}

function instalar() {
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = libro.getSheetByName('Generaciones') || libro.insertSheet('Generaciones');
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(['Fecha', 'Título', 'Artista', 'Ancho cm', 'Alto cm', 'Sala', 'Resultado']);
    hoja.setFrozenRows(1);
  }
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('SECRETO_SESION')) p.setProperty('SECRETO_SESION', Utilities.getUuid() + Utilities.getUuid());
  SpreadsheetApp.getUi().alert('Hoja lista.');
}

function guardarClaveGemini() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Clave de Gemini', 'Pega aquí la clave de API del proyecto Creamdo.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var clave = r.getResponseText().trim();
  if (clave.length < 20) { ui.alert('Eso no parece una clave. No se guardó nada.'); return; }
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', clave);
  ui.alert('Clave guardada.');
}

function crearContrasena() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Contraseña del panel', 'Mínimo 10 caracteres. Es la que se escribe al entrar al panel.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var clave = r.getResponseText();
  if (clave.length < 10) { ui.alert('Demasiado corta. No se guardó nada.'); return; }
  var p = PropertiesService.getScriptProperties();
  var sal = Utilities.getUuid();
  p.setProperty('PANEL_SAL', sal);
  p.setProperty('PANEL_HUELLA', huella_(sal + clave));
  // cambiar la contraseña cierra todas las sesiones abiertas
  p.setProperty('SECRETO_SESION', Utilities.getUuid() + Utilities.getUuid());
  ui.alert('Contraseña guardada.');
}

function verEstado() {
  var p = PropertiesService.getScriptProperties();
  var hoy = p.getProperty('USO_' + dia_()) || '0';
  SpreadsheetApp.getUi().alert(
    'Clave de Gemini: ' + (p.getProperty('GEMINI_API_KEY') ? 'guardada' : 'FALTA') + '\n' +
    'Contraseña del panel: ' + (p.getProperty('PANEL_HUELLA') ? 'creada' : 'FALTA') + '\n' +
    'Imágenes generadas hoy: ' + hoy + ' de ' + LIMITE_DIARIO);
}

// ---------- web app ----------
function doGet() {
  return json_({ ok: true, servicio: 'creamdo-panel' });
}

function doPost(e) {
  var d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Petición no válida' }); }
  try {
    if (d.accion === 'entrar') return json_(entrar_(d));
    if (d.accion === 'integrar') return json_(integrar_(d));
    return json_({ ok: false, error: 'Acción desconocida' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Error interno' });
  }
}

function entrar_(d) {
  var p = PropertiesService.getScriptProperties(), cache = CacheService.getScriptCache();
  var huella = p.getProperty('PANEL_HUELLA'), sal = p.getProperty('PANEL_SAL');
  if (!huella || !sal) return { ok: false, error: 'El panel aún no tiene contraseña' };
  var fallos = Number(cache.get('fallos') || 0);
  if (fallos >= FALLOS_MAX) return { ok: false, error: 'Demasiados intentos. Espera ' + MINUTOS_BLOQUEO + ' minutos.' };
  var clave = String(d.clave || '').slice(0, 200);
  if (!iguales_(huella_(sal + clave), huella)) {
    cache.put('fallos', String(fallos + 1), MINUTOS_BLOQUEO * 60);
    Utilities.sleep(600);
    return { ok: false, error: 'Contraseña incorrecta' };
  }
  cache.remove('fallos');
  return { ok: true, token: firmar_(Date.now() + HORAS_SESION * 3600 * 1000) };
}

function integrar_(d) {
  if (!sesionValida_(d.token)) return { ok: false, error: 'sesion' };
  var p = PropertiesService.getScriptProperties();
  var claveGemini = p.getProperty('GEMINI_API_KEY');
  if (!claveGemini) return { ok: false, error: 'Falta la clave de Gemini en la hoja' };

  var instruccion = INSTRUCCIONES[d.tipo];
  if (!instruccion) return { ok: false, error: 'Tipo de obra no admitido' };
  var imagen = String(d.imagen || '');
  if (!/^[A-Za-z0-9+/=]+$/.test(imagen) || imagen.length < 1000 || imagen.length > MAX_IMAGEN_B64) {
    return { ok: false, error: 'Imagen no válida' };
  }

  // tope diario, con cerrojo para que dos peticiones a la vez no se lo salten
  var cerrojo = LockService.getScriptLock();
  cerrojo.waitLock(15000);
  var llave = 'USO_' + dia_(), uso = Number(p.getProperty(llave) || 0);
  if (uso >= LIMITE_DIARIO) { cerrojo.releaseLock(); return { ok: false, error: 'Se alcanzó el tope de ' + LIMITE_DIARIO + ' imágenes por hoy' }; }
  p.setProperty(llave, String(uso + 1));
  cerrojo.releaseLock();

  var resp = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': claveGemini },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      model: MODELO,
      input: [
        { type: 'text', text: instruccion },
        { type: 'image', mime_type: 'image/jpeg', data: imagen }
      ],
      response_format: { type: 'image', image_size: TAMANO }
    })
  });
  var codigo = resp.getResponseCode(), cuerpo;
  try { cuerpo = JSON.parse(resp.getContentText()); } catch (err) { cuerpo = null; }
  var img = cuerpo ? buscarImagen_(cuerpo) : null;
  var ok = codigo === 200 && !!img;
  registrar_(d, ok ? 'ok' : 'error ' + codigo);
  if (!ok) {
    // no se devuelve el detalle de Google a la web; queda en el registro de ejecuciones
    console.error('Gemini ' + codigo + ' ' + String(resp.getContentText()).slice(0, 500));
    return { ok: false, error: 'La IA no devolvió una imagen (código ' + codigo + ')' };
  }
  return { ok: true, mime: img.mime, imagen: img.data, quedan: LIMITE_DIARIO - uso - 1 };
}

// Recorre la respuesta y se queda con el último bloque de imagen que encuentre.
function buscarImagen_(o) {
  var hallada = null;
  (function ver(x) {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) { x.forEach(ver); return; }
    if (x.type === 'image' && typeof x.data === 'string' && x.data.length > 1000) {
      hallada = { data: x.data, mime: x.mime_type || 'image/png' };
    }
    Object.keys(x).forEach(function (k) { ver(x[k]); });
  })(o);
  return hallada;
}

// ---------- auxiliares ----------
function registrar_(d, resultado) {
  try {
    var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Generaciones');
    if (!hoja) return;
    hoja.appendRow([new Date(), limpio_(d.titulo), limpio_(d.artista), Number(d.anchoCm) || '', Number(d.altoCm) || '', limpio_(d.sala), resultado]);
  } catch (err) { console.error(err); }
}
function limpio_(v) {
  var s = String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').slice(0, 120);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
function huella_(texto) {
  return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8));
}
function firmar_(caduca) {
  var secreto = PropertiesService.getScriptProperties().getProperty('SECRETO_SESION');
  return caduca + '.' + hex_(Utilities.computeHmacSha256Signature(String(caduca), secreto));
}
function sesionValida_(token) {
  var partes = String(token || '').split('.');
  if (partes.length !== 2 || !/^\d+$/.test(partes[0])) return false;
  if (Number(partes[0]) < Date.now()) return false;
  if (!PropertiesService.getScriptProperties().getProperty('SECRETO_SESION')) return false;
  return iguales_(firmar_(partes[0]), token);
}
function iguales_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var dif = 0;
  for (var i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}
function hex_(bytes) {
  return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function dia_() {
  return Utilities.formatDate(new Date(), 'America/Caracas', 'yyyy-MM-dd');
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
