
// ---------- PRUEBA TEMPORAL (no forma parte del backend publicado) ----------
var PRUEBAS_ESC = {
  mascara: 'Return this exact photo with one change: paint everything that is NOT the two stacked-cube metal sculptures ' +
    '(the red one and the blue one) and their black square bases with flat pure green #00FF00. ' +
    'That includes the wicker wall, the wooden shelf, the frame on the left AND every gap or hole between and inside the cubes where the background shows through. ' +
    'Do NOT move, resize, rotate, redraw, recolor or relight the sculptures or their bases: their pixels must stay exactly where they are. Same framing and aspect ratio.',
  escena: 'Take the two stacked-cube metal sculptures (one red, one blue, each on a black square base) from this photo and show them ' +
    'standing on a dark wood console table against a plain off-white wall in a bright Venezuelan coastal apartment, soft daylight from a window on the left, ' +
    'a hint of tropical plant at the edge of the frame. Photorealistic interior photograph, vertical. ' +
    'Strict rules: the sculptures must be the SAME objects: same number of cubes, same shapes and openings, same colours, same glossy finish, same bases, ' +
    'same viewing angle and same position relative to each other. Do not redesign, simplify, straighten or add anything to them. Only the surroundings change, ' +
    'plus natural contact shadows and reflections on the table.'
};
function pruebaEscultura() {
  var clave = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  var foto = Utilities.base64Encode(UrlFetchApp.fetch('https://raw.githubusercontent.com/Gforero1/creamdo-panel/89a8bf57f885a5dc9ea4fc798aaa357a5c9afc2b/pruebas/muestras/escultura-cubos.jpg').getBlob().getBytes());
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
