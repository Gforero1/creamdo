
// ---------- PRUEBA TEMPORAL (no forma parte del backend publicado) ----------
var COMUN_ESC = 'Photorealistic interior photograph, vertical 3:4 portrait format, shot with a 50mm lens from standing eye level looking very slightly down. ' +
  'A bright apartment on the Venezuelan Caribbean coast: off-white plaster wall, soft natural daylight coming from a window on the left, calm and uncluttered. ' +
  'The surface must be completely EMPTY: no vases, no books, no sculptures, no objects of any kind on it. No art on the wall, no people, no text. ';
var PRUEBAS_ESC = {
  consola: COMUN_ESC + 'Subject: a dark tropical-hardwood console table, 120 cm wide and 80 cm tall, standing against the wall, seen frontally so its front edge is perfectly horizontal. ' +
    'The whole table top is visible and empty and sits in the lower third of the frame, with a lot of plain wall above it. A palm leaf enters the frame slightly at the right edge.',
  pedestal: COMUN_ESC + 'Subject: one white gallery plinth (a plain square pedestal, 35 cm wide and 100 cm tall) standing on a polished terracotta tile floor about 40 cm in front of the wall, centred in the frame. ' +
    'Its empty top surface is slightly visible and sits just below the middle of the frame, with plain wall above it. A rattan armchair is partly visible, out of focus, at the left edge.'
};
function pruebaEscultura() {
  var clave = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  var carpeta = carpetaFotos_(), salida = {};
  Object.keys(PRUEBAS_ESC).forEach(function (k) {
    var resp = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': clave }, muteHttpExceptions: true,
      payload: JSON.stringify({ model: MODELO, input: [{ type: 'text', text: PRUEBAS_ESC[k] }], response_format: { type: 'image', image_size: TAMANO } })
    });
    var img = null; try { img = buscarImagen_(JSON.parse(resp.getContentText())); } catch (e) {}
    if (!img) { salida[k] = 'error ' + resp.getResponseCode() + ' ' + resp.getContentText().slice(0, 200); return; }
    var blob = Utilities.newBlob(Utilities.base64Decode(img.data), img.mime, 'prueba-plantilla-' + k);
    salida[k] = Drive.Files.create({ name: 'prueba-plantilla-' + k, parents: [carpeta] }, blob, { fields: 'id' }).id;
  });
  console.log('RESULTADO_PRUEBA ' + JSON.stringify(salida));
}
