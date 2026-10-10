
// ---------- PRUEBA TEMPORAL (no forma parte del backend publicado) ----------
var PRUEBAS_ESC = {
  integrada: { foto: 'https://raw.githubusercontent.com/Gforero1/creamdo-panel/8a9388ec3d9f1430137d15741e2a01fcbc28eff5/pruebas/muestras/caja-compuesta.jpg', texto:
    'This is a photo of a room where an art object has been digitally pasted onto a piece of furniture. ' +
    'Make it look like a real photograph of that object physically standing there. ' +
    'Only fix the integration: the contact shadow under it, the soft shadow it casts on the furniture and on the wall according to the light in the room, ' +
    'a faint reflection if the surface is polished, and matching grain, sharpness and white balance. ' +
    'Strict rules: do NOT move, resize, rotate, redraw, simplify or recolor the object; do NOT add or remove any part of it, and do NOT add a base or stand; ' +
    'do NOT change the room, the furniture, the wall, the plant or the camera framing. Output the same image, same aspect ratio and composition, just naturally integrated.' }
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
