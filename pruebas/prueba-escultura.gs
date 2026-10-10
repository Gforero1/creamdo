
// ---------- PRUEBA TEMPORAL (no forma parte del backend publicado) ----------
var PRUEBAS_ESC = {
  integrada: 'This is a photo of a room where a small sculpture has been digitally pasted onto a console table. ' +
    'Make it look like a real photograph of that sculpture physically standing on the table. ' +
    'Only fix the integration: the contact shadow under its base, the soft shadow it casts on the table top and on the wall according to the window light coming from the left, ' +
    'a faint reflection of the base on the polished wood, and matching grain, sharpness and white balance. ' +
    'Strict rules: do NOT move, resize, rotate, redraw, simplify or recolor the sculpture or its base; do NOT add or remove any part of it; ' +
    'do NOT change the room, the table, the wall, the plant or the camera framing. Output the same image, same aspect ratio and composition, just naturally integrated.'
};
function pruebaEscultura() {
  var clave = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  var foto = Utilities.base64Encode(UrlFetchApp.fetch('https://raw.githubusercontent.com/Gforero1/creamdo-panel/795f0f1f5423f70720a7f1c9894f70877c29815e/pruebas/muestras/escultura-compuesta.jpg').getBlob().getBytes());
  var carpeta = carpetaFotos_(), salida = {};
  Object.keys(PRUEBAS_ESC).forEach(function (k) {
    var resp = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': clave }, muteHttpExceptions: true,
      payload: JSON.stringify({ model: MODELO, input: [{ type: 'text', text: PRUEBAS_ESC[k] }, { type: 'image', mime_type: 'image/jpeg', data: foto }], response_format: { type: 'image', image_size: TAMANO } })
    });
    var img = null; try { img = buscarImagen_(JSON.parse(resp.getContentText())); } catch (e) {}
    if (!img) { salida[k] = 'error ' + resp.getResponseCode() + ' ' + resp.getContentText().slice(0, 200); return; }
    var blob = Utilities.newBlob(Utilities.base64Decode(img.data), img.mime, 'prueba-escultura-' + k);
    salida[k] = Drive.Files.create({ name: 'prueba-escultura-' + k, parents: [carpeta] }, blob, { fields: 'id' }).id;
  });
  console.log('RESULTADO_PRUEBA ' + JSON.stringify(salida));
}
