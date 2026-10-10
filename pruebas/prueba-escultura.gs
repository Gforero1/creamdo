
// ---------- PRUEBA TEMPORAL (no forma parte del backend publicado) ----------
var PRUEBAS_ESC = {
  mascara2: { foto: 'https://raw.githubusercontent.com/Gforero1/creamdo-panel/a1da7f062367e8c3bfcfcdbe4338b88dc1f51238/pruebas/muestras/caja-pintada.jpg', texto:
    'Return this exact photo with one change: paint everything that is NOT the main art object in the centre of the photo (including its own base or stand) with flat pure green #00FF00. ' +
    'The furniture it stands on, the walls, windows, plants, other objects and any gap where the background shows through the object must all become green. ' +
    'Do NOT move, resize, rotate, redraw, recolor or relight the object: its pixels must stay exactly where they are. Same framing and aspect ratio.' },
  mesa: { texto: 'Photorealistic interior photograph, vertical 3:4 portrait format, 35mm lens. A bright apartment on the Venezuelan Caribbean coast, soft natural daylight from a window on the left. ' +
    'Subject: a light natural-wood sideboard, 100 cm wide and 45 cm deep, standing against an off-white plaster wall. The camera is at standing height, close, looking DOWN at about 30 degrees, ' +
    'so the whole top surface is clearly visible as a wide trapezoid filling the lower half of the frame, with the front edge horizontal. The wall fills the upper half. ' +
    'The top is completely EMPTY: no vases, no books, no objects of any kind. No art on the wall, no people, no text. A palm leaf enters slightly at the right edge.' }
};
function pruebaEscultura() {
  var clave = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  var carpeta = carpetaFotos_(), salida = {};
  Object.keys(PRUEBAS_ESC).forEach(function (k) {
    var p = PRUEBAS_ESC[k], entrada = [{ type: 'text', text: p.texto }];
    if (p.foto) entrada.push({ type: 'image', mime_type: 'image/jpeg', data: Utilities.base64Encode(UrlFetchApp.fetch(p.foto).getBlob().getBytes()) });
    var resp = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': clave }, muteHttpExceptions: true,
      payload: JSON.stringify({ model: MODELO, input: entrada, response_format: { type: 'image', image_size: TAMANO } })
    });
    var img = null; try { img = buscarImagen_(JSON.parse(resp.getContentText())); } catch (e) {}
    if (!img) { salida[k] = 'error ' + resp.getResponseCode() + ' ' + resp.getContentText().slice(0, 200); return; }
    var blob = Utilities.newBlob(Utilities.base64Decode(img.data), img.mime, 'prueba2-' + k);
    salida[k] = Drive.Files.create({ name: 'prueba2-' + k, parents: [carpeta] }, blob, { fields: 'id' }).id;
  });
  console.log('RESULTADO_PRUEBA ' + JSON.stringify(salida));
}
