// Panel de Creamdo: flujo de pantallas. El trabajo de imagen está en imagen.js.
(function () {
  'use strict';
  var I = window.Imagen, API = (window.CREAMDO && window.CREAMDO.API) || '';
  var $ = function (id) { return document.getElementById(id); };
  var E = { token: null, foto: null, esquinas: null, recortada: false, obraRecta: null, ganancia: null, obra: null,
            sala: null, q: null, montaje: null, final: null, conIA: false, salaImgs: {}, escenas: [], enviada: false };
  var NITIDEZ_MINIMA = 90;

  // ---------- navegación ----------
  function ir(paso) {
    ['entrar', 'foto', 'esquinas', 'medidas', 'sala', 'resultado'].forEach(function (p) {
      $('p-' + p).classList.toggle('visible', p === paso);
    });
    window.scrollTo(0, 0);
    if (paso === 'esquinas') requestAnimationFrame(pintarEsquinas);
  }
  function aviso(donde, texto, clase) {
    var d = document.createElement('div'); d.className = 'aviso ' + (clase || ''); d.textContent = texto; $(donde).appendChild(d);
  }
  function limpiar(donde) { $(donde).textContent = ''; }
  function guardarToken(t) { E.token = t; try { t ? sessionStorage.setItem('creamdo', t) : sessionStorage.removeItem('creamdo'); } catch (e) {} }
  function tokenVigente(t) { return !!t && Number(String(t).split('.')[0]) > Date.now() + 60000; }

  function llamar(datos) {
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(datos) })
      .then(function (r) { return r.json(); });
  }

  // ---------- entrar ----------
  $('f-entrar').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var b = $('b-entrar'), err = $('entrar-error');
    b.disabled = true; b.textContent = 'Comprobando…'; err.classList.add('oculto');
    llamar({ accion: 'entrar', clave: $('clave').value }).then(function (r) {
      if (!r.ok) throw new Error(r.error || 'No se pudo entrar');
      guardarToken(r.token); $('clave').value = ''; $('b-salir').classList.remove('oculto');
      ir(E.obra ? 'sala' : 'foto');
    }).catch(function (e) {
      err.textContent = e.message === 'Failed to fetch' ? 'No hay conexión con el servidor. Inténtalo de nuevo.' : e.message;
      err.classList.remove('oculto');
    }).then(function () { b.disabled = false; b.textContent = 'Entrar'; });
  });
  $('b-salir').addEventListener('click', function () { guardarToken(null); location.reload(); });

  // ---------- 1. foto ----------
  function cargarImagen(origen) {
    return new Promise(function (ok, no) {
      var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { no(new Error('imagen')); };
      i.src = origen;
    });
  }
  $('archivo').addEventListener('change', function () {
    var f = this.files && this.files[0]; this.value = '';
    if (!f) return;
    var err = $('foto-error'); err.classList.add('oculto');
    var url = URL.createObjectURL(f);
    cargarImagen(url).then(function (img) {
      var k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
      var c = I.lienzo(img.naturalWidth * k, img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      if (Math.min(c.width, c.height) < 500) throw new Error('pequena');
      E.foto = c; E.recortada = false; E.nitidez = I.nitidez(c);
      var w = c.width, h = c.height, m = 0.14;
      E.esquinas = [[w * m, h * m], [w * (1 - m), h * m], [w * (1 - m), h * (1 - m)], [w * m, h * (1 - m)]];
      limpiar('esq-avisos');
      if (E.nitidez < NITIDEZ_MINIMA) aviso('esq-avisos', 'La foto parece movida o desenfocada. Si puedes, repítela apoyando el teléfono.');
      ir('esquinas');
    }).catch(function (e) {
      err.textContent = e.message === 'pequena' ? 'La foto es demasiado pequeña. Usa la original, no una captura.' : 'No se pudo abrir esa foto. Prueba con otra.';
      err.classList.remove('oculto');
    });
  });

  // ---------- 2. esquinas ----------
  var lz = $('c-esquinas'), arrastre = -1;
  function escalaLienzo() { return lz.width / E.foto.width; }
  function pintarEsquinas() {
    if (!E.foto) return;
    var ancho = lz.parentNode.clientWidth || 360, dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.round(ancho * dpr), h = Math.round(w * E.foto.height / E.foto.width);
    if (lz.width !== w || lz.height !== h) { lz.width = w; lz.height = h; }
    var c = lz.getContext('2d'), s = escalaLienzo(), q = E.esquinas;
    c.drawImage(E.foto, 0, 0, w, h);
    c.save(); c.fillStyle = 'rgba(20,16,12,.55)'; c.beginPath(); c.rect(0, 0, w, h);
    c.moveTo(q[0][0] * s, q[0][1] * s); for (var i = 3; i >= 0; i--) c.lineTo(q[i][0] * s, q[i][1] * s);
    c.closePath(); c.fill('evenodd'); c.restore();
    c.strokeStyle = '#F3EEE4'; c.lineWidth = 1.5 * dpr; c.beginPath();
    c.moveTo(q[0][0] * s, q[0][1] * s); for (i = 1; i < 4; i++) c.lineTo(q[i][0] * s, q[i][1] * s); c.closePath(); c.stroke();
    for (i = 0; i < 4; i++) {
      c.beginPath(); c.arc(q[i][0] * s, q[i][1] * s, 13 * dpr, 0, 6.3); c.fillStyle = i === arrastre ? '#A9472B' : 'rgba(169,71,43,.85)'; c.fill();
      c.lineWidth = 2 * dpr; c.strokeStyle = '#F3EEE4'; c.stroke();
    }
    if (arrastre >= 0) lupa(c, q[arrastre], s, w, dpr);
  }
  // Lupa: muestra ampliado lo que queda debajo del dedo, en la esquina contraria del lienzo.
  function lupa(c, p, s, w, dpr) {
    var r = 58 * dpr, cx = (p[0] * s < w / 2) ? w - r - 10 * dpr : r + 10 * dpr, cy = r + 10 * dpr, zona = 46 / s * dpr;
    c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 6.3); c.clip();
    c.drawImage(E.foto, p[0] - zona / 2, p[1] - zona / 2, zona, zona, cx - r, cy - r, 2 * r, 2 * r);
    c.restore();
    c.strokeStyle = '#F3EEE4'; c.lineWidth = 2 * dpr; c.beginPath(); c.arc(cx, cy, r, 0, 6.3); c.stroke();
    c.strokeStyle = '#A9472B'; c.lineWidth = 1 * dpr; c.beginPath(); c.moveTo(cx - r, cy); c.lineTo(cx + r, cy); c.moveTo(cx, cy - r); c.lineTo(cx, cy + r); c.stroke();
  }
  function puntoDe(ev) {
    var b = lz.getBoundingClientRect(), k = E.foto.width / b.width;
    return [(ev.clientX - b.left) * k, (ev.clientY - b.top) * k];
  }
  lz.addEventListener('pointerdown', function (ev) {
    var p = puntoDe(ev), mejor = -1, dist = E.foto.width * 0.12;
    E.esquinas.forEach(function (q, i) { var d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < dist) { dist = d; mejor = i; } });
    if (mejor < 0) return;
    arrastre = mejor; lz.setPointerCapture(ev.pointerId); ev.preventDefault(); pintarEsquinas();
  });
  lz.addEventListener('pointermove', function (ev) {
    if (arrastre < 0) return;
    var p = puntoDe(ev);
    E.esquinas[arrastre] = [Math.min(E.foto.width, Math.max(0, p[0])), Math.min(E.foto.height, Math.max(0, p[1]))];
    E.recortada = false; pintarEsquinas();
  });
  function soltar() { if (arrastre >= 0) { arrastre = -1; pintarEsquinas(); } }
  lz.addEventListener('pointerup', soltar); lz.addEventListener('pointercancel', soltar);
  window.addEventListener('resize', function () { if ($('p-esquinas').classList.contains('visible')) pintarEsquinas(); });

  function ordenar(q) {
    var porSuma = q.slice().sort(function (a, b) { return (a[0] + a[1]) - (b[0] + b[1]); });
    var porResta = q.slice().sort(function (a, b) { return (a[0] - a[1]) - (b[0] - b[1]); });
    return [porSuma[0], porResta[3], porSuma[3], porResta[0]];
  }
  function areaDe(q) {
    var a = 0; for (var i = 0; i < 4; i++) { var j = (i + 1) % 4; a += q[i][0] * q[j][1] - q[j][0] * q[i][1]; } return Math.abs(a) / 2;
  }
  $('b-recortada').addEventListener('click', function () {
    var w = E.foto.width, h = E.foto.height;
    E.esquinas = [[0, 0], [w, 0], [w, h], [0, h]]; E.recortada = true; pintarEsquinas(); pasarAMedidas();
  });
  $('b-esq-sig').addEventListener('click', pasarAMedidas);
  $('b-otra-foto').addEventListener('click', function () { ir('foto'); });
  function pasarAMedidas() {
    var q = ordenar(E.esquinas); limpiar('esq-avisos');
    if (new Set(q).size < 4 || areaDe(q) < E.foto.width * E.foto.height * 0.04) {
      aviso('esq-avisos', 'Los cuatro puntos tienen que rodear la obra. Colócalos uno en cada esquina.', 'grave'); return;
    }
    if (!E.recortada && I.tocaBorde(q, E.foto.width, E.foto.height)) {
      aviso('esq-avisos', 'Un punto está en el borde de la foto: parece que la obra salió cortada. Repite la foto con la obra entera, o usa "La foto ya es solo la obra".', 'grave'); return;
    }
    E.esquinas = q;
    E.ganancia = E.recortada ? null : I.gananciaPared(E.foto, q);
    $('l-color').classList.toggle('oculto', !E.ganancia);
    $('color').checked = !!E.ganancia; $('luz').value = 1;
    E.obraRecta = null; limpiar('med-avisos');
    ir('medidas'); refrescarObra();
  }

  // ---------- 3. medidas y luz ----------
  function medidas() {
    var a = parseFloat($('ancho').value), b = parseFloat($('alto').value);
    return (a >= 5 && a <= 400 && b >= 5 && b <= 400) ? [a, b] : null;
  }
  function formaFoto() {
    var q = E.esquinas, d = function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); };
    return (d(q[0], q[1]) + d(q[3], q[2])) / (d(q[0], q[3]) + d(q[1], q[2]));
  }
  var pendiente = 0;
  function refrescarObra() {
    clearTimeout(pendiente);
    pendiente = setTimeout(function () {
      var m = medidas(), c = $('c-obra'); limpiar('med-avisos');
      if (!m) { c.width = 600; c.height = 60; return; }
      var forma = formaFoto(), pedida = m[0] / m[1];
      if (Math.abs(Math.log(forma / pedida)) > 0.16) {
        aviso('med-avisos', 'Las medidas no coinciden con la forma de la obra en la foto. Revisa que ancho y alto no estén cambiados.');
      }
      E.obraRecta = I.enderezar(E.foto, E.esquinas, m[0], m[1]); E.medidas = m;
      if (I.quemado(E.obraRecta) > 0.02) aviso('med-avisos', 'Hay un reflejo fuerte sobre la obra. Sin flash y con la luz de lado saldrá mejor.');
      pintarObra();
    }, 180);
  }
  function obraCorregida() { return I.corregir(E.obraRecta, E.ganancia, $('color').checked, parseFloat($('luz').value)); }
  function pintarObra() {
    if (!E.obraRecta) return;
    var o = obraCorregida(), c = $('c-obra'); c.width = o.width; c.height = o.height; c.getContext('2d').drawImage(o, 0, 0);
  }
  ['ancho', 'alto'].forEach(function (id) { $(id).addEventListener('input', refrescarObra); });
  $('color').addEventListener('change', pintarObra); $('luz').addEventListener('input', pintarObra);
  $('b-med-atras').addEventListener('click', function () { ir('esquinas'); });
  $('b-med-sig').addEventListener('click', function () {
    if (!medidas() || !E.obraRecta) { limpiar('med-avisos'); aviso('med-avisos', 'Escribe el ancho y el alto de la obra en centímetros.', 'grave'); return; }
    E.obra = obraCorregida(); E.sala = null; E.escenas = []; E.enviada = false; prepararSalas(); ir('sala');
  });

  // ---------- 4. sala ----------
  function prepararSalas() {
    var cont = $('salas'); cont.textContent = ''; limpiar('sala-avisos');
    $('m-montaje').classList.add('oculto'); $('sala-acciones').classList.add('oculto');
    window.SALAS.forEach(function (s) {
      var r = I.cuadroEnSala(s, E.medidas[0], E.medidas[1]);
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-pressed', 'false'); b.dataset.sala = s.id;
      var im = document.createElement('img'); im.src = 'salas/' + s.id + '-mini.jpg'; im.alt = ''; im.loading = 'lazy';
      var t = document.createElement('span'); t.textContent = s.nombre;
      var n = document.createElement('small'); n.textContent = r.cabe ? s.nota : 'La obra es demasiado grande para esta pared';
      b.appendChild(im); b.appendChild(t); b.appendChild(n); b.disabled = !r.cabe;
      b.addEventListener('click', function () { elegirSala(s, r.q, b); });
      cont.appendChild(b);
    });
    if (!cont.querySelector('button:not(:disabled)')) aviso('sala-avisos', 'Esta obra no cabe en ninguna de las salas. Revisa las medidas.', 'grave');
  }
  function elegirSala(s, q, boton) {
    Array.prototype.forEach.call($('salas').children, function (b) { b.setAttribute('aria-pressed', b === boton ? 'true' : 'false'); });
    limpiar('sala-avisos');
    var listo = E.salaImgs[s.id] ? Promise.resolve(E.salaImgs[s.id]) : cargarImagen('salas/' + s.id + '.jpg').then(function (i) { E.salaImgs[s.id] = i; return i; });
    listo.then(function (img) {
      E.sala = s; E.q = q; E.montaje = I.montar(img, s, E.obra, q);
      var c = $('c-montaje'); c.width = E.montaje.width; c.height = E.montaje.height; c.getContext('2d').drawImage(E.montaje, 0, 0);
      $('m-montaje').classList.remove('oculto'); $('sala-acciones').classList.remove('oculto');
      $('m-montaje').scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (Math.abs(q[1][0] - q[0][0]) < 110) aviso('sala-avisos', 'Es una obra pequeña y en esta sala se verá de lejos.');
      $('b-integrar').disabled = !API;
      if (!API) aviso('sala-avisos', 'La integración con IA aún no está conectada. Puedes usar el montaje sin IA.');
    }).catch(function () { aviso('sala-avisos', 'No se pudo cargar la sala. Comprueba la conexión.', 'grave'); });
  }
  $('b-sala-atras').addEventListener('click', function () { ir('medidas'); });
  $('b-sin-ia').addEventListener('click', function () { E.final = E.montaje; E.conIA = false; mostrarResultado(); });
  $('b-integrar').addEventListener('click', integrar);

  function integrar() {
    if (!tokenVigente(E.token)) { guardarToken(null); ir('entrar'); return; }
    limpiar('sala-avisos');
    $('sala-acciones').classList.add('oculto'); $('espera').classList.remove('oculto');
    var b64 = E.montaje.toDataURL('image/jpeg', 0.92).split(',')[1];
    llamar({ accion: 'integrar', token: E.token, tipo: 'pintura', imagen: b64, sala: E.sala.id,
             titulo: $('titulo').value, artista: $('artista').value, anchoCm: E.medidas[0], altoCm: E.medidas[1] })
      .then(function (r) {
        if (!r.ok) { var e = new Error(r.error || 'error'); e.sesion = r.error === 'sesion'; throw e; }
        return cargarImagen('data:' + (r.mime || 'image/png') + ';base64,' + r.imagen);
      })
      .then(function (img) {
        var escena = I.lienzo(img.naturalWidth, img.naturalHeight); escena.getContext('2d').drawImage(img, 0, 0);
        // la escena debe conservar la proporción de la sala; si no, la IA cambió el encuadre
        var mismaForma = Math.abs(escena.width / escena.height - E.montaje.width / E.montaje.height) < 0.03;
        var loc = mismaForma ? I.localizar(escena, E.obra, I.multiplicar(E.q, escena.width / E.montaje.width)) : null;
        E.verificacion = loc ? { parecido: loc.parecido, desvio: loc.desvio } : { parecido: 0, desvio: 1 };
        if (loc && loc.parecido >= 0.5 && loc.desvio <= 0.035) {
          E.final = I.repegar(escena, E.obra, loc.q); E.conIA = true; E.fallida = false;
        } else {
          E.final = E.montaje; E.conIA = false; E.fallida = true;
        }
        mostrarResultado();
      })
      .catch(function (e) {
        if (e.sesion) { guardarToken(null); ir('entrar'); return; }
        aviso('sala-avisos', (e.message === 'Failed to fetch' ? 'No hay conexión con el servidor.' : e.message) + ' Puedes intentarlo otra vez o usar el montaje sin IA.', 'grave');
      })
      .then(function () { $('espera').classList.add('oculto'); $('sala-acciones').classList.remove('oculto'); });
  }

  // ---------- 5. resultado ----------
  function mostrarResultado() {
    var c = $('c-final'); c.width = E.final.width; c.height = E.final.height; c.getContext('2d').drawImage(E.final, 0, 0);
    limpiar('res-avisos');
    if (E.conIA) aviso('res-avisos', 'Integrada con IA. La obra que se ve es tu foto, colocada de nuevo encima.', 'bien');
    else if (E.fallida) aviso('res-avisos', 'La IA movió o cambió la obra, así que se descartó su versión. Esta es la versión sin IA. Puedes volver y repetir.');
    $('b-compartir').classList.toggle('oculto', !(navigator.canShare && window.File));
    E.fallida = false;
    // cada sala generada para esta obra se guarda para enviarla a la tienda
    E.escenas = E.escenas.filter(function (x) { return x.sala !== E.sala.id; });
    E.escenas.push({ sala: E.sala.id, nombre: E.sala.nombre, lienzo: E.final });
    if (E.escenas.length > 3) E.escenas.shift();
    prepararShopify();
    ir('resultado');
  }
  function nombreArchivo() {
    var t = ($('titulo').value || 'obra').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'obra';
    return 'creamdo-' + t + '-' + E.sala.id + '.jpg';
  }
  function comoBlob() { return new Promise(function (ok) { E.final.toBlob(ok, 'image/jpeg', 0.92); }); }
  $('b-descargar').addEventListener('click', function () {
    comoBlob().then(function (b) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nombreArchivo();
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    });
  });
  $('b-compartir').addEventListener('click', function () {
    comoBlob().then(function (b) {
      var f = new File([b], nombreArchivo(), { type: 'image/jpeg' });
      if (navigator.canShare({ files: [f] })) return navigator.share({ files: [f] });
    }).catch(function () {});
  });
  $('b-otra-sala').addEventListener('click', function () { ir('sala'); });
  $('b-nueva').addEventListener('click', function () {
    E.foto = E.obra = E.obraRecta = E.montaje = E.final = null;
    ['ancho', 'alto', 'titulo', 'artista', 'sh-titulo', 'sh-artista', 'sh-precio', 'sh-tecnica'].forEach(function (id) { $(id).value = ''; });
    E.escenas = []; E.enviada = false;
    ir('foto');
  });

  // ---------- enviar a Shopify ----------
  function prepararShopify() {
    $('shopify').classList.toggle('oculto', !API);
    if (!$('sh-titulo').value) $('sh-titulo').value = $('titulo').value;
    if (!$('sh-artista').value) $('sh-artista').value = $('artista').value;
    var n = E.escenas.length;
    $('sh-cuenta').textContent = 'Se enviarán la foto de la obra y ' + (n === 1 ? 'esta imagen en sala.' : 'las ' + n + ' imágenes en sala que has generado.');
    limpiar('sh-avisos');
    $('b-shopify').disabled = E.enviada; $('b-shopify').textContent = E.enviada ? 'Ya está en Shopify' : 'Enviar a Shopify como borrador';
  }
  function jpeg(lienzo, maximo) {
    var k = Math.min(1, maximo / Math.max(lienzo.width, lienzo.height));
    var c = k < 1 ? I.escalar(lienzo, lienzo.width * k, lienzo.height * k) : lienzo;
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  }
  $('b-shopify').addEventListener('click', function () {
    var titulo = $('sh-titulo').value.trim(), artista = $('sh-artista').value.trim(), b = $('b-shopify');
    limpiar('sh-avisos');
    if (!titulo || !artista) { aviso('sh-avisos', 'Escribe el título y el artista.', 'grave'); return; }
    if (!tokenVigente(E.token)) { guardarToken(null); ir('entrar'); return; }
    b.disabled = true; b.textContent = 'Enviando…';
    var imagenes = [{ datos: jpeg(E.obra, 2000), alt: titulo + ', de ' + artista }];
    E.escenas.forEach(function (x) { imagenes.push({ datos: jpeg(x.lienzo, 2600), alt: titulo + ' en ' + x.nombre.toLowerCase() + ' (imagen referencial)' }); });
    llamar({ accion: 'publicar', token: E.token, titulo: titulo, artista: artista, tipoObra: $('sh-tipo').value, tecnica: $('sh-tecnica').value,
             precio: parseFloat($('sh-precio').value) || 0, anchoCm: E.medidas[0], altoCm: E.medidas[1], sala: E.sala.id, imagenes: imagenes })
      .then(function (r) {
        if (!r.ok) { var e = new Error(r.error || 'error'); e.sesion = r.error === 'sesion'; throw e; }
        E.enviada = true;
        var d = document.createElement('div'); d.className = 'aviso bien';
        d.appendChild(document.createTextNode('"' + r.titulo + '" ya está en Shopify como borrador. '));
        if (/^https:\/\/admin\.shopify\.com\//.test(r.enlace || '')) {
          var a = document.createElement('a'); a.href = r.enlace; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Abrir en Shopify'; d.appendChild(a);
        }
        $('sh-avisos').appendChild(d);
        if (r.aviso) aviso('sh-avisos', r.aviso);
      })
      .catch(function (e) {
        if (e.sesion) { guardarToken(null); ir('entrar'); return; }
        aviso('sh-avisos', e.message === 'Failed to fetch' ? 'No hay conexión con el servidor. Inténtalo de nuevo.' : e.message, 'grave');
      })
      .then(function () { b.disabled = E.enviada; b.textContent = E.enviada ? 'Ya está en Shopify' : 'Enviar a Shopify como borrador'; });
  });

  // ---------- arranque ----------
  var guardado = null; try { guardado = sessionStorage.getItem('creamdo'); } catch (e) {}
  if (!API) {
    $('cabecera').textContent = 'Obra en sala · sin IA'; ir('foto');
  } else if (tokenVigente(guardado)) {
    E.token = guardado; $('b-salir').classList.remove('oculto'); ir('foto');
  } else {
    ir('entrar');
  }
  // Acceso para las pruebas automáticas.
  window.__panel = { E: E, ponerEsquinas: function (q) { E.esquinas = q; E.recortada = false; pintarEsquinas(); } };
})();
