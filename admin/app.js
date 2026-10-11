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
    ['entrar', 'inicio', 'pieza', 'foto', 'esquinas', 'medidas', 'sala', 'resultado', 'objeto', 'obras', 'editar'].forEach(function (p) {
      $('p-' + p).classList.toggle('visible', p === paso);
    });
    // la barra dice siempre dónde está: en Inicio (todo lo de añadir) o en Mis obras
    var enObras = paso === 'obras' || paso === 'editar';
    $('b-inicio')[enObras ? 'removeAttribute' : 'setAttribute']('aria-current', 'page');
    $('b-ver-obras')[enObras ? 'setAttribute' : 'removeAttribute']('aria-current', 'page');
    window.scrollTo(0, 0);
    if (paso === 'esquinas') requestAnimationFrame(pintarEsquinas);
  }
  function aviso(donde, texto, clase) {
    var d = document.createElement('div'); d.className = 'aviso ' + (clase || ''); d.textContent = texto; $(donde).appendChild(d);
  }
  function limpiar(donde) { $(donde).textContent = ''; }
  function guardarToken(t) { E.token = t; try { t ? sessionStorage.setItem('creamdo', t) : sessionStorage.removeItem('creamdo'); } catch (e) {} }
  function tokenVigente(t) { return !!t && Number(String(t).split('.')[0]) > Date.now() + 60000; }

  // Google a veces ejecuta la petición pero no entrega la respuesta (llega la portada del servicio o una página).
  // Entonces se repite la misma petición con el mismo "pid": el backend devuelve lo que ya hizo, sin repetirlo.
  var alRepetir = null;
  function pidNuevo() {
    var a = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }
  function unIntento(datos) {
    var corte = new AbortController(), reloj = setTimeout(function () { corte.abort(); }, datos.accion === 'integrar' ? 150000 : 60000);
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(datos), signal: corte.signal })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var j = null; try { j = JSON.parse(t); } catch (e) {}
        if (!j || typeof j !== 'object' || j.servicio) { var e = new Error('El servidor no contestó bien. Espera un minuto y vuelve a intentarlo.'); e.perdida = true; throw e; }
        return j;
      }, function (e) { throw new Error(e && e.name === 'AbortError' ? 'El servidor tardó demasiado. Espera un minuto y vuelve a intentarlo.' : 'Failed to fetch'); })
      .then(function (j) { clearTimeout(reloj); return j; }, function (e) { clearTimeout(reloj); throw e; });
  }
  function llamar(datos) {
    if (datos.accion !== 'entrar') datos.pid = pidNuevo();
    var quedan = 2, intento = 1;
    function probar() {
      return unIntento(datos).catch(function (e) { if (e.perdida && quedan-- > 0) { intento++; if (alRepetir) alRepetir(intento); return probar(); } throw e; });
    }
    return probar();
  }

  $('f-entrar').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var b = $('b-entrar'), err = $('entrar-error');
    b.disabled = true; b.textContent = 'Comprobando…'; err.classList.add('oculto');
    llamar({ accion: 'entrar', clave: $('clave').value }).then(function (r) {
      if (!r.ok || !r.token) throw new Error(r.error || 'No se pudo entrar');
      guardarToken(r.token); $('clave').value = ''; $('b-salir').classList.remove('oculto'); $('barra').classList.remove('oculto');
      ir(E.obra ? 'sala' : 'inicio');
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
  $('b-girar').addEventListener('click', function () {
    E.foto = I.girar(E.foto); E.recortada = false;
    var w = E.foto.width, h = E.foto.height, m = 0.14;
    E.esquinas = [[w * m, h * m], [w * (1 - m), h * m], [w * (1 - m), h * (1 - m)], [w * m, h * (1 - m)]];
    pintarEsquinas();
  });
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
    $('m-montaje').classList.add('oculto'); $('sala-acciones').classList.add('oculto'); $('b-cerca').classList.add('oculto'); $('cerca-nota').classList.add('oculto');
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
  // Una obra pequeña en una sala entera se ve como un sello. Para esas hay una vista de cerca:
  // se recorta la sala alrededor de la obra (que sigue a su tamaño real respecto al mueble) y se amplía.
  var PEQUENA = 230;   // ancho en píxeles de la plantilla por debajo del cual se ofrece la vista de cerca
  function vistaDeCerca(img, s, q) {
    var xs = q.map(function (p) { return p[0]; }), ys = q.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    // El recorte es vertical (4:5). Tiene que caber la obra con aire y asomar el mueble de debajo,
    // que empieza donde acaba la zona libre de la pared (s.zona[3]).
    var mueble = s.zona ? s.zona[3] : y1;
    var ch = Math.max(375, (x1 - x0) / 0.42 * 1.25, (y1 - y0) / 0.5, (mueble - y0) / 0.72);
    ch = Math.min(ch, img.height, img.width * 1.25); var cw = ch / 1.25;
    var cx = Math.max(0, Math.min(img.width - cw, (x0 + x1) / 2 - cw / 2));
    var cy = Math.min(mueble + ch * 0.2 - ch, y0 - ch * 0.07);
    cy = Math.max(0, Math.min(img.height - ch, cy));
    var k = Math.min(3, 1280 / cw), zona = I.lienzo(cw * k, ch * k), z = zona.getContext('2d');
    z.imageSmoothingQuality = 'high'; z.drawImage(img, cx, cy, cw, ch, 0, 0, zona.width, zona.height);
    return { img: zona, q: q.map(function (p) { return [(p[0] - cx) * k, (p[1] - cy) * k]; }),
             sala: { id: s.id, sombra: [Math.round(s.sombra[0] * k), Math.round(s.sombra[1] * k)] } };
  }
  function pintarMontaje() {
    var s = E.salaBase, q = E.qBase, img = E.salaImgs[s.id], pequena = Math.abs(q[1][0] - q[0][0]) < PEQUENA;
    if (pequena && E.cerca) { var v = vistaDeCerca(img, s, q); E.q = v.q; E.montaje = I.montar(v.img, v.sala, E.obra, v.q); }
    else { E.q = q; E.montaje = I.montar(img, s, E.obra, q); }
    var c = $('c-montaje'); c.width = E.montaje.width; c.height = E.montaje.height; c.getContext('2d').drawImage(E.montaje, 0, 0);
    $('b-cerca').classList.toggle('oculto', !pequena);
    $('b-cerca').textContent = E.cerca ? 'Ver la sala completa' : 'Ver la obra de cerca';
    $('cerca-nota').classList.toggle('oculto', !pequena);
    $('cerca-nota').textContent = E.cerca ? 'Es una obra pequeña: se muestra de cerca para que se aprecie. Sigue a su tamaño real respecto al mueble.' : 'Sala completa. La obra es pequeña y se ve de lejos.';
  }
  function elegirSala(s, q, boton) {
    Array.prototype.forEach.call($('salas').children, function (b) { b.setAttribute('aria-pressed', b === boton ? 'true' : 'false'); });
    limpiar('sala-avisos');
    var listo = E.salaImgs[s.id] ? Promise.resolve(E.salaImgs[s.id]) : cargarImagen('salas/' + s.id + '.jpg').then(function (i) { E.salaImgs[s.id] = i; return i; });
    listo.then(function () {
      E.sala = s; E.salaBase = s; E.qBase = q; E.cerca = true;
      pintarMontaje();
      $('m-montaje').classList.remove('oculto'); $('sala-acciones').classList.remove('oculto');
      $('m-montaje').scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('b-integrar').disabled = !API;
      if (!API) aviso('sala-avisos', 'La integración con IA aún no está conectada. Puedes usar el montaje sin IA.');
    }).catch(function () { aviso('sala-avisos', 'No se pudo cargar la sala. Comprueba la conexión.', 'grave'); });
  }
  $('b-cerca').addEventListener('click', function () { E.cerca = !E.cerca; pintarMontaje(); });
  $('b-sala-atras').addEventListener('click', function () { ir('medidas'); });
  $('b-sin-ia').addEventListener('click', function () { E.final = E.montaje; E.conIA = false; mostrarResultado(); });
  $('b-integrar').addEventListener('click', integrar);

  function integrar() {
    if (!tokenVigente(E.token)) { guardarToken(null); ir('entrar'); return; }
    limpiar('sala-avisos');
    $('sala-acciones').classList.add('oculto'); progreso(1, 'Suele tardar menos de un minuto. No cierres ni cambies de página.', 'esp');
    var b64 = E.montaje.toDataURL('image/jpeg', 0.92).split(',')[1];
    llamar({ accion: 'integrar', token: E.token, tipo: 'pintura', imagen: b64, sala: E.sala.id,
             titulo: $('titulo').value, artista: $('artista').value, anchoCm: E.medidas[0], altoCm: E.medidas[1] })
      .then(function (r) {
        if (!r.ok) { var e = new Error(r.error || 'error'); e.sesion = r.error === 'sesion'; throw e; }
        return recogerImagen(r);
      })
      .then(function (img) {
        progreso(2, '', 'esp');
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
      .then(function () { progreso(-1, '', 'esp'); $('sala-acciones').classList.remove('oculto'); });
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
    prepararCatalogo();
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
    ['ancho', 'alto', 'titulo', 'artista', 'cat-titulo', 'cat-artista', 'cat-precio', 'cat-tecnica'].forEach(function (id) { $(id).value = ''; });
    E.escenas = []; E.enviada = false;
    ir('inicio');
  });

  // ---------- guardar en el catálogo ----------
  function jpeg(lienzo, maximo) {
    var k = Math.min(1, maximo / Math.max(lienzo.width, lienzo.height));
    var c = k < 1 ? I.escalar(lienzo, lienzo.width * k, lienzo.height * k) : lienzo;
    return c.toDataURL('image/jpeg', 0.88).split(',')[1];
  }
  function prepararCatalogo() {
    $('catalogo').classList.toggle('oculto', !API);
    if (!$('cat-titulo').value) $('cat-titulo').value = $('titulo').value;
    if (!$('cat-artista').value) $('cat-artista').value = $('artista').value;
    var n = E.escenas.length;
    $('cat-cuenta').textContent = 'Se guardarán la foto de la obra y ' + (n === 1 ? 'esta imagen en sala.' : 'las ' + n + ' imágenes en sala que has generado.');
    limpiar('cat-avisos'); botonGuardar($('b-catalogo'), E.enviada);
  }
  // Dos botones por pantalla: publicar ya o dejar en borrador. Al guardar, los dos quedan apagados.
  var PAREJAS = { 'b-catalogo': 'b-cat-publicar', 'b-cat-publicar': 'b-catalogo', 'b-obj-guardar': 'b-obj-publicar', 'b-obj-publicar': 'b-obj-guardar' };
  function textoBoton(b) { return /publicar$/.test(b.id) ? 'Guardar y publicar en la web' : 'Guardar sin publicar'; }
  function botonGuardar(b, hecho) {
    [b, $(PAREJAS[b.id])].forEach(function (x) { if (!x) return; x.disabled = hecho; x.textContent = hecho ? 'Ya está guardada' : textoBoton(x); });
  }
  function enviarObra(datos, avisos, boton, alTerminar) {
    limpiar(avisos);
    if (!datos.titulo || !datos.artista) { aviso(avisos, 'Escribe el título y el artista.', 'grave'); return; }
    if (!datos.altoCm) { aviso(avisos, 'Escribe al menos el alto en centímetros.', 'grave'); return; }
    if (!tokenVigente(E.token)) { guardarToken(null); ir('entrar'); return; }
    boton.disabled = true; boton.textContent = 'Guardando…'; if ($(PAREJAS[boton.id])) $(PAREJAS[boton.id]).disabled = true;
    datos.accion = 'guardarObra'; datos.token = E.token;
    var hecho = false;
    llamar(datos).then(function (r) {
      if (!r.ok) { var e = new Error(r.error || 'error'); e.sesion = r.error === 'sesion'; throw e; }
      hecho = true;
      aviso(avisos, '"' + r.titulo + '" quedó guardada ' + (r.estado === 'Publicada' ? 'y publicada. En un par de minutos se ve en la web.' : 'como borrador: todavía no se ve en la web. Para publicarla, entra en "Mis obras" y cambia su estado a Publicada.'), 'bien');
      var caja = $(avisos).lastChild, salto = document.createElement('br'), enlace = document.createElement('a');
      if (r.estado === 'Publicada') { enlace.href = '../'; enlace.target = '_blank'; enlace.rel = 'noopener'; enlace.textContent = 'Ver la web'; }
      else { enlace.href = '#'; enlace.textContent = 'Ir a Mis obras'; enlace.addEventListener('click', function (ev) { ev.preventDefault(); cargarObras(); }); }
      caja.appendChild(salto); caja.appendChild(enlace);
      if (alTerminar) alTerminar();
    }).catch(function (e) {
      if (e.sesion) { guardarToken(null); ir('entrar'); return; }
      aviso(avisos, e.message === 'Failed to fetch' ? 'No hay conexión con el servidor. Inténtalo de nuevo.' : e.message, 'grave');
    }).then(function () { botonGuardar(boton, hecho); });
  }
  function guardarCuadro(boton, estado) {
    var titulo = $('cat-titulo').value.trim(), artista = $('cat-artista').value.trim();
    var imagenes = [{ datos: jpeg(E.obra, 1800) }];
    E.escenas.forEach(function (x) { imagenes.push({ datos: jpeg(x.lienzo, 2200) }); });
    enviarObra({ titulo: titulo, artista: artista, tipoObra: $('cat-tipo').value, tecnica: $('cat-tecnica').value, precio: parseFloat($('cat-precio').value) || 0,
                 anchoCm: E.medidas[0], altoCm: E.medidas[1], estado: estado, imagenes: imagenes, enSala: E.escenas.length },
               'cat-avisos', boton, function () { E.enviada = true; });
  }
  $('b-catalogo').addEventListener('click', function () { guardarCuadro(this, 'Borrador'); });
  $('b-cat-publicar').addEventListener('click', function () { guardarCuadro(this, 'Publicada'); });

  // ---------- esculturas y objetos ----------
  var objFotos = [], amb = null;   // amb: { lienzo, enSala } la imagen ambientada o de estudio
  function quitarAmbiente() {
    amb = null; ['amb-marco', 'amb-nota', 'b-amb-quitar'].forEach(function (id) { $(id).classList.add('oculto'); }); limpiar('amb-avisos');
    $('b-ambientar').textContent = 'Crear la imagen en sala';
  }
  $('archivos-obj').addEventListener('change', function () {
    var fs = Array.prototype.slice.call(this.files || [], 0, 4); this.value = '';
    if (!fs.length) return;
    var err = $('pieza-error'); err.classList.add('oculto');
    Promise.all(fs.map(function (f) {
      var url = URL.createObjectURL(f);
      return cargarImagen(url).then(function (img) {
        var k = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
        var c = I.lienzo(img.naturalWidth * k, img.naturalHeight * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); return c;
      });
    })).then(function (ls) {
      objFotos = ls; pintarFotosObjeto();
      limpiar('obj-avisos'); botonGuardar($('b-obj-guardar'), false); quitarAmbiente();
      if (ls.some(function (c) { return I.nitidez(c) < NITIDEZ_MINIMA; })) aviso('obj-avisos', 'Alguna foto parece movida o desenfocada.');
      ir('objeto');
    }).catch(function () { err.textContent = 'No se pudo abrir alguna de las fotos.'; err.classList.remove('oculto'); });
  });
  $('b-obj-atras').addEventListener('click', function () { ir('pieza'); });
  function pintarFotosObjeto() {
    var cont = $('obj-fotos'); cont.textContent = '';
    objFotos.forEach(function (c, i) {
      var fig = document.createElement('figure'), im = document.createElement('img'), g = document.createElement('button');
      im.src = c.toDataURL('image/jpeg', 0.6); im.alt = '';
      g.type = 'button'; g.className = 'gira'; g.textContent = 'Girar'; g.setAttribute('aria-label', 'Girar la foto ' + (i + 1));
      g.addEventListener('click', function () {
        objFotos[i] = I.girar(objFotos[i]);
        if (i === 0) quitarAmbiente();   // la imagen en sala se hizo con la foto sin girar
        botonGuardar($('b-obj-guardar'), false); pintarFotosObjeto();
      });
      fig.appendChild(im); fig.appendChild(g); cont.appendChild(fig);
    });
  }
  function guardarObjeto(boton, estado) {
    enviarObra({ titulo: $('obj-titulo').value.trim(), artista: $('obj-artista').value.trim(), tipoObra: $('obj-tipo').value, tecnica: $('obj-tecnica').value,
                 precio: parseFloat($('obj-precio').value) || 0, altoCm: parseFloat($('obj-alto').value) || 0, anchoCm: parseFloat($('obj-ancho').value) || 0,
                 fondoCm: parseFloat($('obj-fondo').value) || 0, estado: estado,
                 imagenes: imagenesObjeto(), enSala: amb && amb.enSala ? 1 : 0 },
               'obj-avisos', boton, function () {
                 ['obj-titulo', 'obj-precio', 'obj-tecnica', 'obj-alto', 'obj-ancho', 'obj-fondo'].forEach(function (id) { $(id).value = ''; });
               });
  }
  $('b-obj-guardar').addEventListener('click', function () { guardarObjeto(this, 'Borrador'); });
  $('b-obj-publicar').addEventListener('click', function () { guardarObjeto(this, 'Publicada'); });
  // Orden en la web: si hay sala, fotos reales primero y la sala al final (lleva el rótulo de imagen referencial).
  // Si solo se pudo limpiar el fondo, esa va primero: es la pieza real y hace mejor portada.
  function imagenesObjeto() {
    var reales = objFotos.map(function (c) { return { datos: jpeg(c, 1800) }; });
    if (!amb) return reales;
    var extra = { datos: jpeg(amb.lienzo, 2200) };
    return amb.enSala ? reales.concat([extra]) : [extra].concat(reales);
  }
  // La imagen hecha por la IA llega como un archivo de Drive (r.archivo) y se baja aparte, con permiso para leer sus píxeles.
  // Recién subida puede tardar unos segundos en estar disponible: se reintenta.
  function recogerImagen(r) {
    if (!r.archivo) return cargarImagen('data:' + (r.mime || 'image/png') + ';base64,' + r.imagen);
    var base = (window.CREAMDO && window.CREAMDO.IMAGEN) || 'https://lh3.googleusercontent.com/d/{id}=w2400', intentos = 0;
    function una() {
      return new Promise(function (ok, mal) {
        var im = new Image(); im.crossOrigin = 'anonymous';
        im.onload = function () { ok(im); }; im.onerror = function () { mal(new Error('La imagen se hizo pero no se pudo descargar. Inténtalo otra vez.')); };
        im.src = base.replace('{id}', encodeURIComponent(r.archivo)) + (intentos ? '?r=' + intentos : '');
      }).catch(function (e) {
        if (++intentos >= 8) throw e;
        return new Promise(function (ok) { setTimeout(ok, 2500); }).then(una);
      });
    }
    return una();
  }
  function pedirImagen(datos) {
    datos.accion = 'integrar'; datos.token = E.token; datos.titulo = $('obj-titulo').value; datos.artista = $('obj-artista').value;
    return llamar(datos).then(function (r) {
      if (!r.ok) { var e = new Error(r.error || 'error'); e.sesion = r.error === 'sesion'; throw e; }
      return recogerImagen(r);
    }).then(function (img) { var c = I.lienzo(img.naturalWidth, img.naturalHeight); c.getContext('2d').drawImage(img, 0, 0); return c; });
  }
  function mostrarAmbiente(lienzo, enSala, nota) {
    amb = { lienzo: lienzo, enSala: enSala };
    var c = $('c-amb'); c.width = lienzo.width; c.height = lienzo.height; c.getContext('2d').drawImage(lienzo, 0, 0);
    $('amb-nota').textContent = nota;
    ['amb-marco', 'amb-nota', 'b-amb-quitar'].forEach(function (id) { $(id).classList.remove('oculto'); });
    $('b-ambientar').textContent = 'Probar otra vez';
    botonGuardar($('b-obj-guardar'), false);
  }
  // Progreso de verdad: qué paso va, cuánto lleva y si hubo que repetir una petición.
  var PASOS = { amb: ['Enviar la foto', 'Separar la pieza del fondo', 'Crear la sala alrededor', 'Comprobar que la pieza no cambió'],
                esp: ['Enviar el montaje', 'Integrar la obra en la sala', 'Comprobar que la obra no cambió'] }, relojes = {}, zonaActiva = 'amb';
  function progreso(n, nota, zona) {
    zona = zona || 'amb'; zonaActiva = zona;
    var caja = $(zona + '-espera'), lista = $(zona + '-pasos');
    if (n < 0) { clearInterval(relojes[zona]); relojes[zona] = null; caja.classList.add('oculto'); return; }
    caja.classList.remove('oculto'); lista.textContent = '';
    PASOS[zona].forEach(function (t, i) {
      var li = document.createElement('li'); li.className = i < n ? 'hecho' : (i === n ? 'ahora' : '');
      li.textContent = t; if (i === n) { var s = document.createElement('span'); s.id = zona + '-tiempo'; li.appendChild(s); }
      lista.appendChild(li);
    });
    $(zona + '-nota-paso').textContent = nota || '';
    var inicio = Date.now(); clearInterval(relojes[zona]);
    function tic() { var s = Math.floor((Date.now() - inicio) / 1000), e = $(zona + '-tiempo'); if (e) e.textContent = ' · ' + Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
    tic(); relojes[zona] = setInterval(tic, 1000);
  }
  alRepetir = function (intento) { $(zonaActiva + '-nota-paso').textContent = 'La respuesta no llegó. Se vuelve a pedir, sin repetir el trabajo (intento ' + intento + ' de 3).'; };
  $('b-amb-quitar').addEventListener('click', quitarAmbiente);
  [].forEach.call(document.querySelectorAll('#obj-muebles button'), function (b) {
    b.addEventListener('click', function () {
      $('obj-mueble').value = b.getAttribute('data-mueble');
      [].forEach.call(document.querySelectorAll('#obj-muebles button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    });
  });
  $('b-ambientar').addEventListener('click', function () {
    limpiar('amb-avisos');
    var alto = parseFloat($('obj-alto').value) || 0;
    if (!objFotos.length) return;
    if (!(alto >= 1 && alto <= 600)) { aviso('amb-avisos', 'Escribe primero el alto de la pieza en centímetros, con la base incluida.', 'grave'); $('obj-alto').focus(); return; }
    if (!tokenVigente(E.token)) { guardarToken(null); ir('entrar'); return; }
    var original = objFotos[0], b64 = jpeg(original, 1800), boton = $('b-ambientar');
    boton.disabled = true; progreso(1, 'Suele tardar entre uno y dos minutos en total. No cierres ni cambies de página.');
    // Una petición detrás de otra: primero la silueta; si la sala falla después, la silueta sirve igual.
    pedirImagen({ tipo: 'mascara', imagen: b64 }).then(function (mascara) {
      progreso(2, 'La pieza ya está separada. Ahora se dibuja el mueble y la pared.');
      return pedirImagen({ tipo: 'entorno', imagen: b64, mueble: $('obj-mueble').value, altoCm: alto })
        .catch(function (e) { if (e.sesion) throw e; return null; })
        .then(function (sala) { return [mascara, sala]; });
    }).then(function (r) {
      progreso(3, '');
      var sil = I.silueta(original, r[0]);
      E.verificacionObjeto = { silueta: sil.parecido || 0, area: sil.area || 0 };
      if (!sil.ok) {
        quitarAmbiente();
        aviso('amb-avisos', 'No se pudo separar la pieza del fondo en esta foto. Prueba con una foto de la pieza sola, delante de una pared lisa. Mientras tanto se guarda con las fotos tal cual.', 'grave');
        return;
      }
      var v = r[1] ? I.verificarEntorno(original, r[1], sil) : { ok: false, parecido: 0, trozosMalos: 1 };
      E.verificacionObjeto.escena = v.parecido; E.verificacionObjeto.trozosMalos = v.trozosMalos;
      if (v.ok) {
        mostrarAmbiente(I.pegarPieza(r[1], original, sil), true, 'Imagen referencial. La pieza es la de tu foto, sin cambios; la sala es una recreación.');
      } else {
        mostrarAmbiente(I.estudio(original, sil), false, 'La sala cambiaba la pieza, así que no se usa. Queda la pieza real sobre un fondo limpio. Puedes probar otra vez o con otro mueble.');
      }
    }).catch(function (e) {
      if (e.sesion) { guardarToken(null); ir('entrar'); return; }
      aviso('amb-avisos', (e.message === 'Failed to fetch' ? 'No hay conexión con el servidor.' : e.message) + ' Puedes intentarlo otra vez o guardar la pieza con las fotos tal cual.', 'grave');
    }).then(function () { boton.disabled = false; progreso(-1); });
  });

  // ---------- lista de obras ----------
  function foto(id, ancho) { return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w' + ancho; }
  function cargarObras() {
    if (!tokenVigente(E.token)) { guardarToken(null); ir('entrar'); return; }
    ir('obras'); limpiar('obras-avisos'); $('obras-lista').textContent = 'Cargando…';
    llamar({ accion: 'listarObras', token: E.token }).then(function (r) {
      if (!r.ok) throw new Error(r.error || 'error');
      var cont = $('obras-lista'); cont.textContent = '';
      if (!r.obras.length) { cont.textContent = 'Todavía no hay obras guardadas.'; return; }
      r.obras.forEach(function (o) {
        var d = document.createElement('div'); d.className = 'obra';
        var im = document.createElement('img'); im.alt = ''; im.loading = 'lazy'; if (o.imagenes[0]) im.src = foto(o.imagenes[0], 200);
        var t = document.createElement('div'), b = document.createElement('b'), s = document.createElement('small');
        b.textContent = o.titulo; s.textContent = o.artista + ' · ' + o.tipo + (o.altoCm ? ' · ' + o.altoCm + (o.anchoCm ? ' x ' + o.anchoCm : '') + ' cm' : '');
        var fila = document.createElement('div'); fila.className = 'dos';
        var est = document.createElement('select'); ['Borrador', 'Publicada', 'Vendida', 'Oculta'].forEach(function (e) { var op = document.createElement('option'); op.textContent = e; est.appendChild(op); });
        est.value = o.estado; est.setAttribute('aria-label', 'Estado de ' + o.titulo);
        var pr = document.createElement('input'); pr.type = 'number'; pr.min = 0; pr.step = 1; pr.inputMode = 'decimal'; pr.placeholder = 'Precio $'; pr.value = o.precio || ''; pr.setAttribute('aria-label', 'Precio de ' + o.titulo);
        function cambiar(campo, valor) {
          var datos = { accion: 'cambiarObra', token: E.token, id: o.id }; datos[campo] = valor;
          limpiar('obras-avisos');
          llamar(datos).then(function (x) { if (!x.ok) throw new Error(x.error); aviso('obras-avisos', 'Guardado: ' + o.titulo, 'bien'); })
            .catch(function (e) { aviso('obras-avisos', 'No se pudo guardar el cambio. ' + (e.message || ''), 'grave'); });
        }
        est.addEventListener('change', function () { cambiar('estado', est.value); });
        pr.addEventListener('change', function () { cambiar('precio', parseFloat(pr.value) || 0); });
        var ed = document.createElement('button'); ed.className = 'editar'; ed.textContent = 'Editar fotos y datos'; ed.setAttribute('aria-label', 'Editar ' + o.titulo);
        ed.addEventListener('click', function () { abrirEdicion(o); });
        var sellos = document.createElement('div'), se = document.createElement('span'); se.className = 'sello ' + o.estado; se.textContent = o.estado; sellos.appendChild(se);
        if (o.destacada) { var sp = document.createElement('span'); sp.className = 'sello portada'; sp.textContent = 'En la portada de la web'; sellos.appendChild(sp); }
        t.appendChild(sellos);
        est.addEventListener('change', function () { se.className = 'sello ' + est.value; se.textContent = est.value; });
        var c1 = document.createElement('label'), c2 = document.createElement('label'), e1 = document.createElement('span'), e2 = document.createElement('span');
        e1.className = e2.className = 'campo'; e1.textContent = 'Estado'; e2.textContent = 'Precio en $';
        c1.appendChild(e1); c1.appendChild(est); c2.appendChild(e2); c2.appendChild(pr); pr.placeholder = 'A solicitud';
        fila.appendChild(c1); fila.appendChild(c2); t.insertBefore(s, t.firstChild); t.insertBefore(b, t.firstChild); t.appendChild(fila); t.appendChild(ed); d.appendChild(im); d.appendChild(t); cont.appendChild(d);
      });
    }).catch(function (e) {
      if (e.message === 'sesion') { guardarToken(null); ir('entrar'); return; }
      $('obras-lista').textContent = ''; aviso('obras-avisos', 'No se pudieron cargar las obras.', 'grave');
    });
  }
  // ---------- editar una obra guardada ----------
  // Cada foto es una que ya estaba ({id}) o una nueva ({lienzo}). Las de sala se quedan siempre al final.
  var ed = null;
  function abrirEdicion(o) {
    var reales = o.imagenes.length - (o.enSala || 0);
    ed = { id: o.id, fotos: o.imagenes.map(function (id, i) { return { id: id, sala: i >= reales }; }) };
    $('ed-titulo').value = o.titulo; $('ed-artista').value = o.artista; $('ed-tipo').value = o.tipo; $('ed-estado').value = o.estado;
    $('ed-tecnica').value = o.tecnica || ''; $('ed-alto').value = o.altoCm || ''; $('ed-ancho').value = o.anchoCm || ''; $('ed-fondo').value = o.fondoCm || '';
    $('ed-precio').value = o.precio || ''; $('ed-destacada').checked = !!o.destacada;
    limpiar('ed-avisos'); $('b-ed-guardar').disabled = false; $('b-ed-guardar').textContent = 'Guardar cambios';
    pintarFotosEdicion(); ir('editar');
  }
  function ordenFotos() { return ed.fotos.filter(function (f) { return !f.sala; }).concat(ed.fotos.filter(function (f) { return f.sala; })); }
  function pintarFotosEdicion() {
    var cont = $('ed-fotos'); cont.textContent = ''; ed.fotos = ordenFotos();
    ed.fotos.forEach(function (f, i) {
      var fig = document.createElement('figure'), im = document.createElement('img'), cap = document.createElement('figcaption'), acc = document.createElement('div');
      im.alt = ''; im.src = f.id ? foto(f.id, 300) : f.lienzo.toDataURL('image/jpeg', 0.6);
      cap.textContent = f.sala ? 'En sala' : (i === 0 ? 'Portada' : (f.id ? '' : 'Nueva o girada'));
      acc.className = 'acc';
      var sube = document.createElement('button'); sube.type = 'button'; sube.textContent = 'Portada'; sube.disabled = i === 0 || f.sala; sube.setAttribute('aria-label', 'Poner como portada la foto ' + (i + 1));
      sube.addEventListener('click', function () { ed.fotos.splice(i, 1); ed.fotos.unshift(f); pintarFotosEdicion(); });
      var quita = document.createElement('button'); quita.type = 'button'; quita.textContent = 'Quitar'; quita.disabled = ed.fotos.length === 1; quita.setAttribute('aria-label', 'Quitar la foto ' + (i + 1));
      quita.addEventListener('click', function () { ed.fotos.splice(i, 1); pintarFotosEdicion(); });
      var gira = document.createElement('button'); gira.type = 'button'; gira.className = 'gira'; gira.textContent = 'Girar'; gira.setAttribute('aria-label', 'Girar la foto ' + (i + 1));
      gira.addEventListener('click', function () {
        limpiar('ed-avisos'); gira.disabled = true; gira.textContent = 'Girando…';
        var listo = f.lienzo ? Promise.resolve(f.lienzo) : recogerImagen({ archivo: f.id }).then(function (img) {
          var k = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
          var c = I.lienzo(img.naturalWidth * k, img.naturalHeight * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c;
        });
        listo.then(function (c) { ed.fotos[i] = { lienzo: I.girar(c), sala: f.sala }; pintarFotosEdicion(); })
          .catch(function () { gira.disabled = false; gira.textContent = 'Girar'; aviso('ed-avisos', 'No se pudo girar esa foto. Comprueba la conexión e inténtalo otra vez.', 'grave'); });
      });
      acc.appendChild(sube); acc.appendChild(gira); acc.appendChild(quita); fig.appendChild(im); fig.appendChild(cap); fig.appendChild(acc); cont.appendChild(fig);
    });
  }
  $('ed-archivos').addEventListener('change', function () {
    var fs = Array.prototype.slice.call(this.files || [], 0, Math.max(0, 6 - ed.fotos.length)); this.value = '';
    limpiar('ed-avisos');
    if (!fs.length) { if (ed.fotos.length >= 6) aviso('ed-avisos', 'Una obra puede tener como mucho 6 fotos. Quita alguna antes de añadir otra.'); return; }
    Promise.all(fs.map(function (f) {
      var url = URL.createObjectURL(f);
      return cargarImagen(url).then(function (img) {
        var k = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
        var c = I.lienzo(img.naturalWidth * k, img.naturalHeight * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); return { lienzo: c, sala: false };
      });
    })).then(function (ls) { ed.fotos = ed.fotos.concat(ls); pintarFotosEdicion(); })
      .catch(function () { aviso('ed-avisos', 'No se pudo abrir alguna de las fotos.', 'grave'); });
  });
  $('b-ed-atras').addEventListener('click', cargarObras);
  $('b-ed-guardar').addEventListener('click', function () {
    limpiar('ed-avisos');
    var titulo = $('ed-titulo').value.trim(), artista = $('ed-artista').value.trim(), alto = parseFloat($('ed-alto').value) || 0;
    if (!titulo || !artista) { aviso('ed-avisos', 'Escribe el título y el artista.', 'grave'); return; }
    if (!alto) { aviso('ed-avisos', 'Escribe al menos el alto en centímetros.', 'grave'); return; }
    if (!tokenVigente(E.token)) { guardarToken(null); ir('entrar'); return; }
    var fotos = ordenFotos(), boton = $('b-ed-guardar');
    boton.disabled = true; boton.textContent = 'Guardando…';
    llamar({ accion: 'cambiarObra', token: E.token, id: ed.id, titulo: titulo, artista: artista, tipoObra: $('ed-tipo').value, estado: $('ed-estado').value,
             tecnica: $('ed-tecnica').value, altoCm: alto, anchoCm: parseFloat($('ed-ancho').value) || 0, fondoCm: parseFloat($('ed-fondo').value) || 0,
             precio: parseFloat($('ed-precio').value) || 0, destacada: $('ed-destacada').checked,
             imagenes: fotos.map(function (f) { return f.id ? { id: f.id } : { datos: jpeg(f.lienzo, 1800) }; }),
             enSala: fotos.filter(function (f) { return f.sala; }).length })
      .then(function (r) {
        if (!r.ok) { var e = new Error(r.error || 'error'); e.sesion = r.error === 'sesion'; throw e; }
        cargarObras(); aviso('obras-avisos', 'Guardado: ' + titulo + '. En la web se ve en un par de minutos.', 'bien');
      })
      .catch(function (e) {
        if (e.sesion) { guardarToken(null); ir('entrar'); return; }
        boton.disabled = false; boton.textContent = 'Guardar cambios';
        aviso('ed-avisos', e.message === 'Failed to fetch' ? 'No hay conexión con el servidor. Inténtalo de nuevo.' : e.message, 'grave');
      });
  });

  $('b-ver-obras').addEventListener('click', cargarObras);
  $('b-obras-nueva').addEventListener('click', function () { ir('inicio'); });
  $('b-inicio').addEventListener('click', function () { ir('inicio'); });
  $('b-ini-cuadro').addEventListener('click', function () { ir('foto'); });
  $('b-ini-pieza').addEventListener('click', function () { $('pieza-error').classList.add('oculto'); ir('pieza'); });
  $('b-ini-obras').addEventListener('click', cargarObras);
  $('b-foto-atras').addEventListener('click', function () { ir('inicio'); });
  $('b-pieza-atras').addEventListener('click', function () { ir('inicio'); });

  // ---------- arranque ----------
  var guardado = null; try { guardado = sessionStorage.getItem('creamdo'); } catch (e) {}
  if (!API) {
    $('b-foto-atras').classList.add('oculto'); ir('foto');
  } else if (tokenVigente(guardado)) {
    E.token = guardado; $('b-salir').classList.remove('oculto'); $('barra').classList.remove('oculto'); ir('inicio');
  } else {
    ir('entrar');
  }
  // Acceso para las pruebas automáticas.
  window.__panel = { E: E, ponerEsquinas: function (q) { E.esquinas = q; E.recortada = false; pintarEsquinas(); } };
})();
