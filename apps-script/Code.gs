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
var SHOPIFY_VERSION = '2026-07';
var TIPOS_OBRA = ['Pintura', 'Retablo'];

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
    .addItem('4. Conectar con Shopify', 'conectarShopify')
    .addSeparator()
    .addItem('Ver estado', 'verEstado')
    .addItem('Probar la conexión con Shopify', 'probarShopify')
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
    'Shopify: ' + (p.getProperty('SHOPIFY_CLIENT_SECRET') ? 'conectado a ' + p.getProperty('SHOPIFY_TIENDA') : 'sin conectar') + '\n' +
    'Imágenes generadas hoy: ' + hoy + ' de ' + LIMITE_DIARIO);
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
function doGet() {
  return json_({ ok: true, servicio: 'creamdo-panel' });
}

function doPost(e) {
  var d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Petición no válida' }); }
  try {
    if (d.accion === 'entrar') return json_(entrar_(d));
    if (d.accion === 'integrar') return json_(integrar_(d));
    if (d.accion === 'publicar') return json_(publicar_(d));
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
