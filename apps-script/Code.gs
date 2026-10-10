/**
 * Panel de Creamdo Art: backend.
 * Vive dentro de una hoja de Google. Guarda la contraseña del panel (como huella con sal)
 * y la clave de Gemini en las propiedades del script. Ninguna de las dos sale de aquí.
 *
 * @OnlyCurrentDoc
 */

var MODELO = 'gemini-nano-banana-2.1';
var TAMANO = '2K';
var LIMITE_DIARIO = 60;            // imágenes por día, para acotar el gasto
var HORAS_SESION = 12;
var FALLOS_MAX = 8;                // intentos de clave antes de bloquear
var MINUTOS_BLOQUEO = 10;
var MAX_IMAGEN_B64 = 7 * 1024 * 1024;
var SHOPIFY_VERSION = '2026-07';
var TIPOS_OBRA = ['Pintura', 'Retablo', 'Escultura', 'Arte sacro', 'Objeto'];
var ESTADOS = ['Borrador', 'Publicada', 'Vendida', 'Oculta'];
var COLUMNAS = ['ID', 'Creada', 'Estado', 'Título', 'Artista', 'Tipo', 'Técnica', 'Ancho cm', 'Alto cm', 'Fondo cm', 'Precio USD', 'Imágenes', 'Actualizada', 'En sala'];

// El texto que recibe Gemini se decide aquí, no en la web: así la clave no sirve
// para pedirle cualquier otra cosa aunque alguien robe una sesión.
var INSTRUCCIONES = {
  pintura: 'This is a photo of a room where a painting has been digitally pasted onto the wall. ' +
    'Make it look like a real photograph of that painting physically hanging there. ' +
    'Only fix the integration: the light and shadow falling on the canvas so they match the wall around it, ' +
    'the soft shadow the canvas casts on the wall, a thin visible canvas edge, and matching grain and sharpness. ' +
    'Strict rules: do NOT move, resize, rotate, crop or reframe the painting; do NOT add a frame; ' +
    'do NOT change anything painted on the canvas; do NOT change the room, furniture, window, plants or camera framing. ' +
    'Output the same image, same aspect ratio and composition, just naturally integrated.',
  // Esculturas y objetos, llamada 1: la silueta. Con ella el panel recorta la pieza real y comprueba la llamada 2.
  mascara: 'Return this exact photo with one change: paint everything that is NOT the main art object in the centre of the photo with flat pure green #00FF00. ' +
    'The object INCLUDES the base, plinth or stand that belongs to it (the block it is mounted on): keep that too. ' +
    'The table, shelf or furniture underneath that base, the walls, windows, plants, other objects and any gap or hole where the background shows through the object must all become green. ' +
    'Do NOT move, resize, rotate, redraw, recolor or relight the object: its pixels must stay exactly where they are. Same framing and aspect ratio.'
};
// Esculturas y objetos, llamada 2: solo cambia el entorno. El mueble sale de esta lista y la altura es un número ya validado.
var MUEBLES = {
  consola: 'a dark tropical-hardwood console table',
  aparador: 'a light natural-wood sideboard',
  pedestal: 'a plain white gallery plinth standing on a polished terracotta tile floor'
};
function instruccionEntorno_(mueble, altoCm) {
  return 'Edit this photo. Keep the main art object in the centre of the photo, together with the base or stand that belongs to it, EXACTLY as it is: ' +
    'same pixels, same position, same size, same angle, same colours and the same light on it. ' +
    'Replace everything else (the furniture it stands on, walls, windows, plants, other objects, and anything seen through gaps or holes in the object) with a new setting: ' +
    'the object now stands on ' + mueble + ' against a plain off-white plaster wall in a bright apartment on the Venezuelan Caribbean coast, soft daylight from the left, calm and uncluttered, ' +
    'nothing else on the furniture, a palm leaf entering at one edge of the frame. ' +
    'Real size matters: the object with its base is ' + altoCm + ' cm tall. Draw the furniture and the room at the true scale for an object of that height ' +
    '(a console or sideboard top is about 80 cm above the floor and 40 cm deep, a gallery plinth is about 100 cm tall), never larger or smaller to flatter it. ' +
    'The new furniture and room must follow the same camera height, angle and perspective as the original photo so the object sits naturally on the surface, with a realistic contact shadow and a soft cast shadow. ' +
    'Do NOT redraw, restyle, simplify, crop, move, resize or relight the object or its base. Same framing and aspect ratio. Photorealistic photograph.';
}

// ---------- menú de la hoja ----------
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Creamdo')
    .addItem('1. Preparar la hoja', 'instalar')
    .addItem('2. Guardar la clave de Gemini', 'guardarClaveGemini')
    .addItem('3. Crear o cambiar la contraseña del panel', 'crearContrasena')
    .addItem('4. Conectar con Shopify', 'conectarShopify')
    .addSeparator()
    .addItem('Ver estado', 'verEstado')
    .addItem('Probar la conexión con Shopify', 'probarShopify')
    .addSeparator()
    .addItem('Traer obras de la tienda antigua', 'importarObrasIniciales')
    .addToUi();
}

function instalar() {
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = libro.getSheetByName('Generaciones') || libro.insertSheet('Generaciones');
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(['Fecha', 'Título', 'Artista', 'Ancho cm', 'Alto cm', 'Sala', 'Resultado']);
    hoja.setFrozenRows(1);
  }
  var obras = libro.getSheetByName('Obras') || libro.insertSheet('Obras', 0);
  if (obras.getLastRow() > 0) obras.getRange(1, 1, 1, COLUMNAS.length).setValues([COLUMNAS]).setFontWeight('bold');
  if (obras.getLastRow() === 0) {
    obras.appendRow(COLUMNAS);
    obras.setFrozenRows(1);
    obras.getRange(1, 1, 1, COLUMNAS.length).setFontWeight('bold');
  }
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('SECRETO_SESION')) p.setProperty('SECRETO_SESION', Utilities.getUuid() + Utilities.getUuid());
  carpetaFotos_();
  SpreadsheetApp.getUi().alert('Hoja lista. Las obras se guardan en la pestaña "Obras" y sus fotos en la carpeta de Drive "Creamdo catálogo (fotos públicas)".');
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
    'Shopify: ' + (p.getProperty('SHOPIFY_CLIENT_SECRET') ? 'conectado a ' + p.getProperty('SHOPIFY_TIENDA') : 'sin conectar') + '\n' +
    'Imágenes generadas hoy: ' + hoy + ' de ' + LIMITE_DIARIO);
}

// ---------- catálogo propio ----------
// Carpeta de Drive con las fotos del catálogo. Con el permiso drive.file el script
// solo ve lo que él mismo crea, no el resto del Drive.
function carpetaFotos_() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty('CARPETA_FOTOS');
  if (id) return id;
  var c = Drive.Files.create({ name: 'Creamdo catálogo (fotos públicas)', mimeType: 'application/vnd.google-apps.folder' }, null, { fields: 'id' });
  Drive.Permissions.create({ role: 'reader', type: 'anyone' }, c.id);
  p.setProperty('CARPETA_FOTOS', c.id);
  return c.id;
}

function hojaObras_() {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Obras');
  if (!h) throw new Error('Falta preparar la hoja (menú Creamdo > 1)');
  return h;
}

function filaAObra_(f) {
  return { id: String(f[0]), creada: f[1] instanceof Date ? f[1].toISOString() : String(f[1]), estado: String(f[2]), titulo: String(f[3]), artista: String(f[4]),
    tipo: String(f[5]), tecnica: String(f[6]), anchoCm: Number(f[7]) || 0, altoCm: Number(f[8]) || 0, fondoCm: Number(f[9]) || 0,
    precio: Number(f[10]) || 0, imagenes: String(f[11] || '').split(',').filter(function (x) { return /^[A-Za-z0-9_-]{10,}$/.test(x); }),
    enSala: Math.max(0, Math.min(3, Number(f[13]) || 0)) };
}

function leerObras_() {
  var v = hojaObras_().getDataRange().getValues();
  return v.slice(1).filter(function (f) { return f[0]; }).map(filaAObra_);
}

// Lo que ve la web pública: solo obras publicadas o vendidas, sin datos internos.
function catalogoPublico_() {
  var cache = CacheService.getScriptCache(), g = cache.get('catalogo');
  if (g) return JSON.parse(g);
  var obras = leerObras_().filter(function (o) { return o.estado === 'Publicada' || o.estado === 'Vendida'; }).reverse();
  var r = { ok: true, obras: obras };
  var t = JSON.stringify(r);
  if (t.length < 95000) cache.put('catalogo', t, 120);
  return r;
}

function guardarObra_(d) {
  if (!sesionValida_(d.token)) return { ok: false, error: 'sesion' };
  var titulo = limpioTexto_(d.titulo, 80), artista = limpioTexto_(d.artista, 80), tecnica = limpioTexto_(d.tecnica, 80);
  var tipo = TIPOS_OBRA.indexOf(d.tipoObra) >= 0 ? d.tipoObra : TIPOS_OBRA[0];
  var estado = d.estado === 'Publicada' ? 'Publicada' : 'Borrador';
  var ancho = medida_(d.anchoCm), alto = medida_(d.altoCm), fondo = medida_(d.fondoCm), precio = Math.max(0, Number(d.precio) || 0);
  if (!titulo || !artista) return { ok: false, error: 'Faltan el título y el artista' };
  if (!alto) return { ok: false, error: 'Falta al menos el alto de la obra' };
  var imgs = Array.isArray(d.imagenes) ? d.imagenes.slice(0, 5) : [];
  if (!imgs.length) return { ok: false, error: 'No hay imágenes que guardar' };
  for (var i = 0; i < imgs.length; i++) {
    var dato = String(imgs[i].datos || '');
    if (!/^[A-Za-z0-9+/=]+$/.test(dato) || dato.length < 1000 || dato.length > MAX_IMAGEN_B64) return { ok: false, error: 'Imagen no válida' };
  }
  var id = 'o' + Date.now().toString(36);
  var base = (titulo + '-' + artista).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'obra';
  var carpeta = carpetaFotos_();
  var ids = imgs.map(function (im, n) {
    var blob = Utilities.newBlob(Utilities.base64Decode(im.datos), 'image/jpeg', base + '-' + (n + 1) + '.jpg');
    return Drive.Files.create({ name: base + '-' + (n + 1) + '.jpg', parents: [carpeta] }, blob, { fields: 'id' }).id;
  });
  var cerrojo = LockService.getScriptLock(); cerrojo.waitLock(15000);
  hojaObras_().appendRow([id, new Date(), estado, hoja_(titulo), hoja_(artista), tipo, hoja_(tecnica), ancho || '', alto, fondo || '', precio || '', ids.join(','), new Date(), Math.max(0, Math.min(3, Number(d.enSala) || 0))]);
  cerrojo.releaseLock();
  CacheService.getScriptCache().remove('catalogo');
  return { ok: true, id: id, estado: estado, titulo: titulo };
}

function listarObras_(d) {
  if (!sesionValida_(d.token)) return { ok: false, error: 'sesion' };
  return { ok: true, obras: leerObras_().reverse() };
}

function cambiarObra_(d) {
  if (!sesionValida_(d.token)) return { ok: false, error: 'sesion' };
  var h = hojaObras_(), v = h.getDataRange().getValues(), fila = -1;
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === String(d.id)) { fila = i + 1; break; }
  if (fila < 0) return { ok: false, error: 'No se encontró la obra' };
  if (d.estado !== undefined) {
    if (ESTADOS.indexOf(d.estado) < 0) return { ok: false, error: 'Estado no válido' };
    h.getRange(fila, 3).setValue(d.estado);
  }
  if (d.precio !== undefined) h.getRange(fila, 11).setValue(Math.max(0, Number(d.precio) || 0) || '');
  if (d.titulo !== undefined && limpioTexto_(d.titulo, 80)) h.getRange(fila, 4).setValue(hoja_(limpioTexto_(d.titulo, 80)));
  if (d.artista !== undefined && limpioTexto_(d.artista, 80)) h.getRange(fila, 5).setValue(hoja_(limpioTexto_(d.artista, 80)));
  h.getRange(fila, 13).setValue(new Date());
  CacheService.getScriptCache().remove('catalogo');
  return { ok: true };
}

function medida_(v) { var n = Number(v); return (n >= 1 && n <= 600) ? Math.round(n * 10) / 10 : 0; }
function hoja_(s) { return /^[=+\-@]/.test(s) ? "'" + s : s; }

// ---------- obras de arranque ----------
// Copia al catálogo una selección de obras de la tienda antigua de Shopify, con sus fotos.
// Los datos vienen de fichas de 2025: hay que revisar en el panel cuáles siguen disponibles.
var CDN_ANTIGUA = 'https://cdn.shopify.com/s/files/1/0688/0008/6038/files/';
var OBRAS_INICIALES = [
  ['Amanecer Tricolor', 'Justo Osuna', 'Pintura', 'Acrílico sobre lienzo', 140, 80, 2200, ['IMG_8453.jpg', 'IMG_8488.jpg', 'IMG_8489.jpg']],
  ['Lunas en el Tepuy', 'Justo Osuna', 'Pintura', 'Díptico, acrílico sobre lienzo', 180, 150, 4500, ['D680C053-970D-41AF-8A16-B4EA9A4194C0.jpg', 'DA8E52AE-8886-4EA0-BDB4-56947244B010.jpg', '0A5C3815-0795-43FD-B927-27E86B0E5029.jpg']],
  ['Atardecer en Lechería', 'Pedro Báez', 'Pintura', 'Acrílico', 140, 90, 3800, ['039C8461-B731-4B82-BA5C-136D830EF698.jpg', '8D356F76-57EE-4C02-931F-ACF36282187E.jpg', '6D1C9195-97B3-408C-AB5F-F4F5FBB56125.jpg']],
  ['El Paraíso Donde Habita mi María José', 'Néstor Carrera', 'Pintura', '', 155, 60, 1200, ['IMG_8444.jpg', 'IMG_8482.jpg', 'IMG_8483.jpg']],
  ['Entorno a la Ciudad 1', 'Gregorio Torres', 'Pintura', '', 100, 100, 1000, ['IMG_8433.jpg', 'IMG_8499.jpg', 'IMG_8500.jpg']],
  ['Simplicity', 'Sabrina Sagnotti de Graci', 'Pintura', '', 100, 40, 900, ['IMG_8448.jpg', 'IMG_8491.jpg', 'IMG_8490.jpg']],
  ['Turco', 'Bernardo Nieves', 'Pintura', 'Técnica mixta sobre lienzo', 90, 120, 890, ['FullSizeRender.jpg', 'IMG-8308.jpg']],
  ['Palomina', 'Enrique Lobo', 'Pintura', '', 150, 60, 1000, ['IMG-8562.jpg', 'IMG-8563.jpg', 'IMG-8564.jpg']],
  ['Marina', 'Enrique Lobo', 'Pintura', 'Acrílico', 150, 60, 1000, ['11AC2167-F020-4CDF-86F6-8AA0C5D19714.jpg', 'C5311E3A-5ED5-4CDC-A25A-2EB8E946E964.jpg', 'F2C1287A-0E0D-45C5-A359-177E5BE87794.jpg']],
  ['Sin título', 'Hugo Newton', 'Pintura', '', 75, 95, 1200, ['6BE105A4-DF92-400F-B5F1-E00B63D630D6.jpg', 'CA4ED3C0-FED5-4EDD-981F-3B1C93FE5158.jpg', 'BA19B1C1-84F4-4429-8AF6-916C9FFA64FE.jpg']],
  ['Virgen de Coromoto', 'María Lea Cerdá', 'Arte sacro', 'Escultura', 12, 20, 115, ['IMG-9638.jpg']],
  ['Virgen de Rosario de Chiquinquirá', 'María Lea Cerdá', 'Arte sacro', 'Escultura', 12, 30, 115, ['IMG-9642.jpg']]
];

function importarObrasIniciales() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.alert('Traer obras de la tienda antigua', 'Se copiarán ' + OBRAS_INICIALES.length + ' obras con sus fotos y quedarán publicadas en la web. Las que ya estén en la hoja se saltan. ¿Seguir?', ui.ButtonSet.OK_CANCEL);
  if (r !== ui.Button.OK) return;
  var hoja = hojaObras_(), carpeta = carpetaFotos_(), ya = {}, hechas = 0, fallos = [];
  leerObras_().forEach(function (o) { ya[o.titulo + '|' + o.artista] = true; });
  OBRAS_INICIALES.forEach(function (o, n) {
    if (ya[o[0] + '|' + o[1]]) return;
    try {
      var base = (o[0] + '-' + o[1]).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
      var ids = o[7].map(function (archivo, i) {
        var resp = UrlFetchApp.fetch(CDN_ANTIGUA + archivo + '?width=1600&format=jpg', { muteHttpExceptions: true });
        if (resp.getResponseCode() !== 200) throw new Error('foto ' + archivo + ' código ' + resp.getResponseCode());
        var blob = resp.getBlob().setName(base + '-' + (i + 1) + '.jpg');
        return Drive.Files.create({ name: base + '-' + (i + 1) + '.jpg', parents: [carpeta] }, blob, { fields: 'id' }).id;
      });
      hoja.appendRow(['o' + (Date.now() + n).toString(36), new Date(), 'Publicada', o[0], o[1], o[2], o[3], o[4], o[5], '', o[6], ids.join(','), new Date(), 0]);
      hechas++;
    } catch (err) { fallos.push(o[0] + ': ' + err.message); }
  });
  CacheService.getScriptCache().remove('catalogo');
  ui.alert('Obras copiadas: ' + hechas + '.' + (fallos.length ? '\n\nNo se pudieron copiar:\n' + fallos.join('\n') : ''));
}

// ---------- Shopify: conexión ----------
function conectarShopify() {
  var ui = SpreadsheetApp.getUi(), p = PropertiesService.getScriptProperties();
  var t = ui.prompt('Shopify 1 de 3', 'Dominio de la tienda, por ejemplo creamdo.myshopify.com', ui.ButtonSet.OK_CANCEL);
  if (t.getSelectedButton() !== ui.Button.OK) return;
  var tienda = t.getResponseText().trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(tienda)) { ui.alert('Tiene que ser un dominio .myshopify.com. No se guardó nada.'); return; }
  var a = ui.prompt('Shopify 2 de 3', 'Client ID de la app (Dev Dashboard > la app > Settings).', ui.ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui.Button.OK) return;
  var b = ui.prompt('Shopify 3 de 3', 'Client secret de la app.', ui.ButtonSet.OK_CANCEL);
  if (b.getSelectedButton() !== ui.Button.OK) return;
  var id = a.getResponseText().trim(), secreto = b.getResponseText().trim();
  if (id.length < 16 || secreto.length < 16) { ui.alert('Eso no parecen las credenciales. No se guardó nada.'); return; }
  p.setProperty('SHOPIFY_TIENDA', tienda); p.setProperty('SHOPIFY_CLIENT_ID', id); p.setProperty('SHOPIFY_CLIENT_SECRET', secreto);
  CacheService.getScriptCache().remove('shopify_token');
  probarShopify();
}

function probarShopify() {
  var ui = SpreadsheetApp.getUi();
  try {
    var r = shopify_('query { shop { name myshopifyDomain } }', {});
    ui.alert('Conexión correcta con la tienda "' + r.shop.name + '".');
  } catch (err) {
    ui.alert('No se pudo conectar con Shopify.\n\n' + err.message);
  }
}

// Pide a Shopify un token de 24 horas con las credenciales de la app y lo guarda unas horas.
function tokenShopify_() {
  var cache = CacheService.getScriptCache(), guardado = cache.get('shopify_token');
  if (guardado) return guardado;
  var p = PropertiesService.getScriptProperties();
  var tienda = p.getProperty('SHOPIFY_TIENDA'), id = p.getProperty('SHOPIFY_CLIENT_ID'), secreto = p.getProperty('SHOPIFY_CLIENT_SECRET');
  if (!tienda || !id || !secreto) throw new Error('Shopify aún no está conectado');
  var r = UrlFetchApp.fetch('https://' + tienda + '/admin/oauth/access_token', {
    method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'client_credentials', client_id: id, client_secret: secreto }
  });
  var j; try { j = JSON.parse(r.getContentText()); } catch (err) { j = {}; }
  if (r.getResponseCode() !== 200 || !j.access_token) {
    throw new Error('Shopify rechazó las credenciales (código ' + r.getResponseCode() + (j.error ? ', ' + j.error : '') + ')');
  }
  cache.put('shopify_token', j.access_token, 5 * 3600);
  return j.access_token;
}

function shopify_(consulta, variables) {
  var tienda = PropertiesService.getScriptProperties().getProperty('SHOPIFY_TIENDA');
  var r = UrlFetchApp.fetch('https://' + tienda + '/admin/api/' + SHOPIFY_VERSION + '/graphql.json', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'X-Shopify-Access-Token': tokenShopify_() },
    payload: JSON.stringify({ query: consulta, variables: variables })
  });
  var j; try { j = JSON.parse(r.getContentText()); } catch (err) { j = null; }
  if (r.getResponseCode() === 401) CacheService.getScriptCache().remove('shopify_token');
  if (r.getResponseCode() !== 200 || !j || j.errors) {
    console.error('Shopify ' + r.getResponseCode() + ' ' + String(r.getContentText()).slice(0, 500));
    throw new Error('Shopify respondió con un error (código ' + r.getResponseCode() + ')');
  }
  return j.data;
}

// Crea la obra en Shopify como BORRADOR, con la foto real primero y las imágenes en sala después.
function publicar_(d) {
  if (!sesionValida_(d.token)) return { ok: false, error: 'sesion' };
  var titulo = limpioTexto_(d.titulo, 80), artista = limpioTexto_(d.artista, 80), tecnica = limpioTexto_(d.tecnica, 80);
  var ancho = Number(d.anchoCm), alto = Number(d.altoCm), precio = Number(d.precio);
  var tipo = TIPOS_OBRA.indexOf(d.tipoObra) >= 0 ? d.tipoObra : TIPOS_OBRA[0];
  if (!titulo || !artista) return { ok: false, error: 'Faltan el título y el artista' };
  if (!(ancho >= 5 && ancho <= 400 && alto >= 5 && alto <= 400)) return { ok: false, error: 'Medidas no válidas' };
  var imgs = Array.isArray(d.imagenes) ? d.imagenes.slice(0, 4) : [];
  if (!imgs.length) return { ok: false, error: 'No hay imágenes que enviar' };
  for (var i = 0; i < imgs.length; i++) {
    var dato = String(imgs[i].datos || '');
    if (!/^[A-Za-z0-9+/=]+$/.test(dato) || dato.length < 1000 || dato.length > MAX_IMAGEN_B64) return { ok: false, error: 'Imagen no válida' };
  }
  try {
    var base = (titulo + '-' + artista).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'obra';
    var entradas = imgs.map(function (im, n) {
      return { resource: 'IMAGE', httpMethod: 'POST', mimeType: 'image/jpeg', filename: base + '-' + (n + 1) + '.jpg' };
    });
    var st = shopify_('mutation subir($input: [StagedUploadInput!]!) { stagedUploadsCreate(input: $input) { stagedTargets { url resourceUrl parameters { name value } } userErrors { field message } } }', { input: entradas }).stagedUploadsCreate;
    if (st.userErrors.length) throw new Error(st.userErrors[0].message);
    var medios = st.stagedTargets.map(function (t, n) {
      var carga = {};
      t.parameters.forEach(function (q) { carga[q.name] = q.value; });
      carga.file = Utilities.newBlob(Utilities.base64Decode(imgs[n].datos), 'image/jpeg', entradas[n].filename);
      var r = UrlFetchApp.fetch(t.url, { method: 'post', payload: carga, muteHttpExceptions: true });
      if (r.getResponseCode() >= 300) throw new Error('No se pudo subir la imagen ' + (n + 1) + ' (código ' + r.getResponseCode() + ')');
      return { originalSource: t.resourceUrl, mediaContentType: 'IMAGE', alt: limpioTexto_(imgs[n].alt, 120) || titulo + ', de ' + artista };
    });
    var descripcion = '<p><strong>' + html_(titulo) + '</strong>, de ' + html_(artista) + '.</p>' +
      '<p>' + (tecnica ? html_(tecnica) + '. ' : '') + 'Medidas: ' + numero_(alto) + ' cm de alto por ' + numero_(ancho) + ' cm de ancho.</p>' +
      (medios.length > 1 ? '<p>Las imágenes en sala son referenciales: muestran la obra a escala en un espacio decorado.</p>' : '');
    var pc = shopify_('mutation crear($product: ProductCreateInput!, $media: [CreateMediaInput!]) { productCreate(product: $product, media: $media) { product { id handle title status variants(first: 1) { nodes { id } } } userErrors { field message } } }', {
      product: { title: titulo + ' - ' + artista, descriptionHtml: descripcion, vendor: 'creamdo', productType: tipo, tags: [artista, tipo], status: 'DRAFT' },
      media: medios
    }).productCreate;
    if (pc.userErrors.length) throw new Error(pc.userErrors[0].message);
    var prod = pc.product, aviso = '';
    if (precio > 0 && prod.variants.nodes.length) {
      var pv = shopify_('mutation precio($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $productId, variants: $variants) { productVariants { id price } userErrors { field message } } }', {
        productId: prod.id, variants: [{ id: prod.variants.nodes[0].id, price: precio.toFixed(2) }]
      }).productVariantsBulkUpdate;
      if (pv.userErrors.length) aviso = 'La obra se creó, pero no se pudo poner el precio.';
    }
    var tienda = PropertiesService.getScriptProperties().getProperty('SHOPIFY_TIENDA').replace('.myshopify.com', '');
    registrar_(d, 'shopify ok');
    return { ok: true, titulo: prod.title, aviso: aviso, enlace: 'https://admin.shopify.com/store/' + tienda + '/products/' + prod.id.split('/').pop() };
  } catch (err) {
    registrar_(d, 'shopify error');
    console.error(err);
    return { ok: false, error: err.message };
  }
}

// ---------- web app ----------
function doGet(e) {
  if (e && e.parameter && e.parameter.catalogo) {
    try { return json_(catalogoPublico_()); } catch (err) { console.error(err); return json_({ ok: false, obras: [] }); }
  }
  return json_({ ok: true, servicio: 'creamdo-admin' });
}

function doPost(e) {
  var d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Petición no válida' }); }
  try {
    if (d.accion === 'entrar') return json_(entrar_(d));
    if (d.accion === 'integrar') return json_(integrar_(d));
    if (d.accion === 'publicar') return json_(publicar_(d));
    if (d.accion === 'guardarObra') return json_(guardarObra_(d));
    if (d.accion === 'listarObras') return json_(listarObras_(d));
    if (d.accion === 'cambiarObra') return json_(cambiarObra_(d));
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

  var instruccion = null;
  if (d.tipo === 'entorno') {
    var alto = medida_(d.altoCm);
    if (!alto || !Object.prototype.hasOwnProperty.call(MUEBLES, d.mueble)) return { ok: false, error: 'Faltan el alto de la pieza o el mueble' };
    instruccion = instruccionEntorno_(MUEBLES[d.mueble], alto);
  } else if (Object.prototype.hasOwnProperty.call(INSTRUCCIONES, d.tipo)) {
    instruccion = INSTRUCCIONES[d.tipo];
  }
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
function limpioTexto_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function html_(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function numero_(n) {
  return String(Math.round(n * 10) / 10).replace('.', ',');
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
