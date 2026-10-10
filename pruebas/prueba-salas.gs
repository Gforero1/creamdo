
// ---------- PRUEBA TEMPORAL: plantillas para obras pequeñas (no forma parte del backend publicado) ----------
var COMUN_SALA = 'Photorealistic interior photograph, vertical 3:4 portrait format, 50mm lens, camera at 115 cm height, perfectly frontal to the wall so the floor line and the furniture edges are perfectly horizontal. ' +
  'A calm corner of an apartment on the Venezuelan Caribbean coast: smooth off-white plaster wall, soft natural daylight coming from a window on the left (outside the frame), no harsh shadows. ' +
  'The framing is CLOSE. Above the furniture there is a large area of completely EMPTY plain wall: no art, no frames, no shelves, no lamps, no switches, no sockets. No people, no text. ';
var PRUEBAS_SALA = {
  rincon: COMUN_SALA + 'Against the wall, centred horizontally, stands one small solid tropical-wood side table, exactly 60 cm tall and 45 cm wide, with a small unglazed clay vase holding one dry branch on it. ' +
    'The visible wall is only about 130 cm wide. The polished cement floor is visible in the bottom 10 percent of the frame. The table top sits at about two thirds of the frame height, so the empty wall fills the upper half.',
  escritorio: COMUN_SALA + 'Against the wall stands a simple light-wood writing desk, exactly 75 cm tall and 110 cm wide, centred horizontally, with only a closed linen notebook and a small plant in a clay pot at its right end. A rattan chair is pushed in under it, partly visible. ' +
    'The visible wall is about 150 cm wide. The terracotta tile floor is visible in the bottom 10 percent of the frame. The desk top sits at about two thirds of the frame height, so the empty wall fills the upper half.',
  repisa: COMUN_SALA + 'Mounted on the wall, centred, there is one floating natural-wood shelf, exactly 80 cm wide and 4 cm thick, at about 60 percent of the frame height from the top. The shelf is completely EMPTY. ' +
    'The visible wall is about 120 cm wide and nothing else is in the frame except a hint of a palm leaf at the right edge.'
};
function pruebaSalas() {
  var clave = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  var carpeta = carpetaFotos_(), salida = {};
  Object.keys(PRUEBAS_SALA).forEach(function (k) {
    var resp = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': clave }, muteHttpExceptions: true,
      payload: JSON.stringify({ model: MODELO, input: [{ type: 'text', text: PRUEBAS_SALA[k] }], response_format: { type: 'image', image_size: TAMANO } })
    });
    var img = null; try { img = buscarImagen_(JSON.parse(resp.getContentText())); } catch (e) {}
    if (!img) { salida[k] = 'error ' + resp.getResponseCode(); return; }
    salida[k] = Drive.Files.create({ name: 'sala-nueva-' + k, parents: [carpeta] }, Utilities.newBlob(Utilities.base64Decode(img.data), img.mime, 'sala-nueva-' + k), { fields: 'id' }).id;
  });
  console.log('RESULTADO_PRUEBA ' + JSON.stringify(salida));
}
