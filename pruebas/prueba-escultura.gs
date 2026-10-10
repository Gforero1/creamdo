
// ---------- PRUEBA TEMPORAL (no forma parte del backend publicado) ----------
var UNA_SOLA = 'Edit this photo. Keep the main art object (or objects) in the centre of the photo, together with the base or stand directly under it, EXACTLY as it is: ' +
  'same pixels, same position, same size, same angle, same colours and the same light on it. ' +
  'Replace everything else (the furniture it stands on, walls, windows, plants, other objects, and anything seen through gaps or holes in the object) with a new setting: ' +
  'the object now stands on SUPERFICIE against a plain off-white plaster wall in a bright apartment on the Venezuelan Caribbean coast, soft daylight from the left, calm and uncluttered, ' +
  'nothing else on the furniture, a palm leaf entering at one edge of the frame. ' +
  'The new furniture and room must follow the same camera height, angle and perspective as the original photo so the object sits naturally on the surface, with a realistic contact shadow and a soft cast shadow. ' +
  'Do NOT redraw, restyle, simplify, crop, move or relight the object or its base. Same framing and aspect ratio. Photorealistic photograph.';
var PRUEBAS_ESC = {
  caja: { foto: 'https://raw.githubusercontent.com/Gforero1/creamdo-panel/988e30d9650aded87607a57a9be215ef48d86719/pruebas/muestras/caja-pintada.jpg', texto: UNA_SOLA.replace('SUPERFICIE', 'a light natural-wood sideboard') },
  cubos: { foto: 'https://raw.githubusercontent.com/Gforero1/creamdo-panel/988e30d9650aded87607a57a9be215ef48d86719/pruebas/muestras/escultura-cubos.jpg', texto: UNA_SOLA.replace('SUPERFICIE', 'a dark tropical-hardwood console table') }
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
    var blob = Utilities.newBlob(Utilities.base64Decode(img.data), img.mime, 'prueba3-' + k);
    salida[k] = Drive.Files.create({ name: 'prueba3-' + k, parents: [carpeta] }, blob, { fields: 'id' }).id;
  });
  console.log('RESULTADO_PRUEBA ' + JSON.stringify(salida));
}
