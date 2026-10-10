// Motor de imagen del panel. Todo corre en el navegador de quien lo usa.
// La regla del proyecto: la obra nunca la genera una IA. Aquí solo se recorta,
// se endereza, se coloca a escala y, al final, se vuelve a pegar la foto real
// sobre la escena que integró la IA.
(function () {
  'use strict';

  // ---------- utilidades ----------
  function lienzo(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }
  function ctx2d(c) { return c.getContext('2d', { willReadFrequently: true }); }
  function escalar(origen, w, h) {
    // Reducción por pasos para que no aparezcan dientes de sierra.
    var cw = origen.width, ch = origen.height, actual = origen;
    while (cw / 2 > w) {
      cw = Math.round(cw / 2); ch = Math.round(ch / 2);
      var paso = lienzo(cw, ch), p = ctx2d(paso);
      p.imageSmoothingQuality = 'high'; p.drawImage(actual, 0, 0, cw, ch); actual = paso;
    }
    var fin = lienzo(w, h), f = ctx2d(fin);
    f.imageSmoothingQuality = 'high'; f.drawImage(actual, 0, 0, fin.width, fin.height);
    return fin;
  }
  function gris(c) {
    var d = ctx2d(c).getImageData(0, 0, c.width, c.height).data, n = c.width * c.height;
    var g = new Float32Array(n);
    for (var i = 0, j = 0; i < n; i++, j += 4) g[i] = 0.114 * d[j + 2] + 0.587 * d[j + 1] + 0.299 * d[j];
    return g;
  }
  function desenfocar(a, w, h, r) {
    // Tres pasadas de caja: aproxima un desenfoque gaussiano.
    r = Math.max(1, Math.round(r));
    var b = new Float32Array(a.length), x, y, s, i, k;
    for (var pasada = 0; pasada < 3; pasada++) {
      for (y = 0; y < h; y++) {
        s = 0; var fila = y * w;
        for (k = -r; k <= r; k++) s += a[fila + Math.min(w - 1, Math.max(0, k))];
        for (x = 0; x < w; x++) {
          b[fila + x] = s / (2 * r + 1);
          s += a[fila + Math.min(w - 1, x + r + 1)] - a[fila + Math.max(0, x - r)];
        }
      }
      for (x = 0; x < w; x++) {
        s = 0;
        for (k = -r; k <= r; k++) s += b[Math.min(h - 1, Math.max(0, k)) * w + x];
        for (y = 0; y < h; y++) {
          a[y * w + x] = s / (2 * r + 1);
          s += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
        }
      }
    }
    return a;
  }

  // ---------- homografías ----------
  // Devuelve la matriz 3x3 (9 números) que lleva los cuatro puntos a a los cuatro b.
  function homografia(a, b) {
    var M = [], i, j, k;
    for (i = 0; i < 4; i++) {
      var x = a[i][0], y = a[i][1], u = b[i][0], v = b[i][1];
      M.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
      M.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
    }
    for (i = 0; i < 8; i++) {
      var p = i;
      for (j = i + 1; j < 8; j++) if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j;
      var t = M[i]; M[i] = M[p]; M[p] = t;
      if (Math.abs(M[i][i]) < 1e-12) return null;
      for (j = i + 1; j < 8; j++) {
        var f = M[j][i] / M[i][i];
        for (k = i; k < 9; k++) M[j][k] -= f * M[i][k];
      }
    }
    var hh = new Array(8);
    for (i = 7; i >= 0; i--) {
      var s = M[i][8];
      for (j = i + 1; j < 8; j++) s -= M[i][j] * hh[j];
      hh[i] = s / M[i][i];
    }
    return [hh[0], hh[1], hh[2], hh[3], hh[4], hh[5], hh[6], hh[7], 1];
  }
  function caja(q, w, h) {
    var x0 = Math.max(0, Math.floor(Math.min(q[0][0], q[1][0], q[2][0], q[3][0])) - 1);
    var y0 = Math.max(0, Math.floor(Math.min(q[0][1], q[1][1], q[2][1], q[3][1])) - 1);
    var x1 = Math.min(w - 1, Math.ceil(Math.max(q[0][0], q[1][0], q[2][0], q[3][0])) + 1);
    var y1 = Math.min(h - 1, Math.ceil(Math.max(q[0][1], q[1][1], q[2][1], q[3][1])) + 1);
    return [x0, y0, x1, y1];
  }
  function rectDe(w, h) { return [[0, 0], [w, 0], [w, h], [0, h]]; }

  // Pinta la imagen fuente dentro del cuadrilátero q del destino.
  // Devuelve { rgb: Float32Array(w*h*3), alfa: Float32Array(w*h) } solo con la obra.
  function deformar(fuente, q, w, h) {
    var sw = fuente.width, sh = fuente.height;
    var sd = ctx2d(fuente).getImageData(0, 0, sw, sh).data;
    var H = homografia(q, rectDe(sw, sh));
    var rgb = new Float32Array(w * h * 3), alfa = new Float32Array(w * h);
    if (!H) return { rgb: rgb, alfa: alfa };
    var c = caja(q, w, h);
    for (var y = c[1]; y <= c[3]; y++) {
      for (var x = c[0]; x <= c[2]; x++) {
        var px = x + 0.5, py = y + 0.5;
        var d = H[6] * px + H[7] * py + 1;
        var sx = (H[0] * px + H[1] * py + H[2]) / d, sy = (H[3] * px + H[4] * py + H[5]) / d;
        var borde = Math.min(sx, sw - sx, sy, sh - sy);
        if (borde <= 0) continue;
        var fx = Math.min(sw - 1.001, Math.max(0, sx - 0.5)), fy = Math.min(sh - 1.001, Math.max(0, sy - 0.5));
        var ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy;
        var o = (iy * sw + ix) * 4, o2 = o + sw * 4, i3 = (y * w + x) * 3;
        for (var k = 0; k < 3; k++) {
          rgb[i3 + k] = (sd[o + k] * (1 - ax) + sd[o + 4 + k] * ax) * (1 - ay) +
                        (sd[o2 + k] * (1 - ax) + sd[o2 + 4 + k] * ax) * ay;
        }
        alfa[y * w + x] = Math.min(1, borde);
      }
    }
    return { rgb: rgb, alfa: alfa };
  }

  // ---------- 1. revisar la foto ----------
  // Nitidez: varianza del laplaciano sobre una copia pequeña. Por debajo de ~60 la foto está movida.
  function nitidez(c) {
    var k = 640 / Math.max(c.width, c.height);
    var p = escalar(c, c.width * k, c.height * k), w = p.width, h = p.height, g = gris(p);
    var s = 0, s2 = 0, n = 0;
    for (var y = 1; y < h - 1; y++) for (var x = 1; x < w - 1; x++) {
      var i = y * w + x, l = g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i];
      s += l; s2 += l * l; n++;
    }
    var m = s / n;
    return s2 / n - m * m;
  }
  // Zonas quemadas (reflejo de flash o de una ventana) dentro de la obra ya enderezada.
  function quemado(c) {
    var d = ctx2d(c).getImageData(0, 0, c.width, c.height).data, n = 0, t = c.width * c.height;
    for (var j = 0; j < d.length; j += 4) if (d[j] > 250 && d[j + 1] > 250 && d[j + 2] > 250) n++;
    return n / t;
  }

  // ---------- 2. enderezar ----------
  // esquinas: [[x,y] x4] en orden arriba-izq, arriba-der, abajo-der, abajo-izq, en píxeles de la foto.
  function enderezar(foto, esquinas, anchoCm, altoCm) {
    var W = 1400, Hh = Math.round(W * altoCm / anchoCm);
    if (Hh > 2000) { Hh = 2000; W = Math.round(Hh * anchoCm / altoCm); }
    var sd = ctx2d(foto).getImageData(0, 0, foto.width, foto.height).data, sw = foto.width, sh = foto.height;
    var H = homografia(rectDe(W, Hh), esquinas);
    var sal = lienzo(W, Hh), sx2 = ctx2d(sal), im = sx2.createImageData(W, Hh), od = im.data;
    for (var y = 0; y < Hh; y++) for (var x = 0; x < W; x++) {
      var px = x + 0.5, py = y + 0.5, d = H[6] * px + H[7] * py + 1;
      var fx = (H[0] * px + H[1] * py + H[2]) / d - 0.5, fy = (H[3] * px + H[4] * py + H[5]) / d - 0.5;
      fx = Math.min(sw - 1.001, Math.max(0, fx)); fy = Math.min(sh - 1.001, Math.max(0, fy));
      var ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy, o = (iy * sw + ix) * 4, o2 = o + sw * 4, i = (y * W + x) * 4;
      for (var k = 0; k < 3; k++) {
        od[i + k] = (sd[o + k] * (1 - ax) + sd[o + 4 + k] * ax) * (1 - ay) + (sd[o2 + k] * (1 - ax) + sd[o2 + 4 + k] * ax) * ay;
      }
      od[i + 3] = 255;
    }
    sx2.putImageData(im, 0, 0);
    return sal;
  }
  // ¿Alguna esquina está pegada al borde de la foto? Entonces el cuadro salió cortado.
  function tocaBorde(esquinas, w, h) {
    var m = Math.max(w, h) * 0.006;
    return esquinas.some(function (p) { return p[0] < m || p[1] < m || p[0] > w - m || p[1] > h - m; });
  }

  // ---------- 3. corregir luz y color ----------
  // Usa la pared de alrededor del cuadro como referencia de blanco.
  // Devuelve las ganancias por canal, o null si no hay pared suficiente alrededor.
  function gananciaPared(foto, esquinas) {
    var w = foto.width, h = foto.height, d = ctx2d(foto).getImageData(0, 0, w, h).data;
    var cx = 0, cy = 0; esquinas.forEach(function (p) { cx += p[0] / 4; cy += p[1] / 4; });
    var fuera = esquinas.map(function (p) { return [cx + (p[0] - cx) * 1.14, cy + (p[1] - cy) * 1.14]; });
    var dentro = esquinas.map(function (p) { return [cx + (p[0] - cx) * 1.05, cy + (p[1] - cy) * 1.05]; });
    var Hf = homografia(fuera, rectDe(1, 1)), Hd = homografia(dentro, rectDe(1, 1));
    if (!Hf || !Hd) return null;
    function esta(H, x, y) {
      var dd = H[6] * x + H[7] * y + 1, u = (H[0] * x + H[1] * y + H[2]) / dd, v = (H[3] * x + H[4] * y + H[5]) / dd;
      return u > 0 && u < 1 && v > 0 && v < 1;
    }
    var c = caja(fuera, w, h), r = [], g = [], b = [], paso = Math.max(1, Math.round(Math.max(w, h) / 500));
    for (var y = c[1]; y <= c[3]; y += paso) for (var x = c[0]; x <= c[2]; x += paso) {
      if (esta(Hf, x, y) && !esta(Hd, x, y)) { var o = (y * w + x) * 4; r.push(d[o]); g.push(d[o + 1]); b.push(d[o + 2]); }
    }
    if (r.length < 200) return null;
    function mediana(a) { a.sort(function (p, q) { return p - q; }); return a[a.length >> 1]; }
    var mr = mediana(r), mg = mediana(g), mb = mediana(b);
    var objetivo = 215;
    return [objetivo / Math.max(8, mr), objetivo / Math.max(8, mg), objetivo / Math.max(8, mb)].map(function (v) {
      return Math.min(4.5, Math.max(0.5, v));
    });
  }
  // color: true aplica el balance de la pared; luz: multiplicador de exposición (1 = lo que diga la pared).
  function corregir(obra, ganancia, color, luz) {
    var g = ganancia || [1, 1, 1], medio = (g[0] + g[1] + g[2]) / 3;
    var k = color ? g : [medio, medio, medio];
    if (!ganancia) k = [1, 1, 1];
    var sal = lienzo(obra.width, obra.height), s = ctx2d(sal);
    s.drawImage(obra, 0, 0);
    var im = s.getImageData(0, 0, sal.width, sal.height), d = im.data;
    for (var j = 0; j < d.length; j += 4) { d[j] *= k[0] * luz; d[j + 1] *= k[1] * luz; d[j + 2] *= k[2] * luz; }
    s.putImageData(im, 0, 0);
    return sal;
  }

  // ---------- 4. colocar en la sala a escala ----------
  function lineal(c, x) { return c[0] + c[1] * x; }
  // Devuelve el cuadrilátero donde va la obra en la sala, o { cabe:false } si no entra en la zona.
  function cuadroEnSala(sala, anchoCm, altoCm) {
    var xc = sala.centroX;
    var pxcm = (lineal(sala.suelo, xc) - lineal(sala.techo, xc)) / sala.paredCm;
    var z = sala.zona, anchoPx = anchoCm * pxcm, altoPx = altoCm * pxcm;
    if (anchoPx > (z[2] - z[0]) || altoPx > (z[3] - z[1])) return { cabe: false, pxcm: pxcm };
    xc = Math.min(z[2] - anchoPx / 2, Math.max(z[0] + anchoPx / 2, xc));
    var centroCm = sala.centroCm;
    function lado(x, c) {
      var alto = lineal(sala.suelo, x) - lineal(sala.techo, x), yc = lineal(sala.suelo, x) - c / sala.paredCm * alto, m = altoCm / sala.paredCm * alto / 2;
      return [yc - m, yc + m];
    }
    // Si a la altura normal se sale de la zona, se sube o se baja lo justo.
    for (var i = 0; i < 40; i++) {
      var a = lado(xc - anchoPx / 2, centroCm), b = lado(xc + anchoPx / 2, centroCm);
      var arriba = Math.min(a[0], b[0]), abajo = Math.max(a[1], b[1]);
      if (abajo > z[3]) centroCm += 3; else if (arriba < z[1]) centroCm -= 3; else break;
    }
    var L = lado(xc - anchoPx / 2, centroCm), R = lado(xc + anchoPx / 2, centroCm);
    return { cabe: true, pxcm: pxcm, q: [[xc - anchoPx / 2, L[0]], [xc + anchoPx / 2, R[0]], [xc + anchoPx / 2, R[1]], [xc - anchoPx / 2, L[1]]] };
  }
  function multiplicar(q, k) { return q.map(function (p) { return [p[0] * k, p[1] * k]; }); }

  // Montaje sin IA: obra a escala, con la luz de la pared y una sombra coherente.
  function montar(salaImg, sala, obra, q) {
    var w = salaImg.width, h = salaImg.height;
    var base = lienzo(w, h), b = ctx2d(base); b.drawImage(salaImg, 0, 0, w, h);
    var im = b.getImageData(0, 0, w, h), d = im.data;
    var anchoQ = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]);
    var k = Math.min(1, anchoQ * 1.25 / obra.width);
    var obraP = k < 1 ? escalar(obra, obra.width * k, obra.height * k) : obra;
    var o = deformar(obraP, q, w, h);
    // luz de la pared
    var lum = gris(base); desenfocar(lum, w, h, 5);
    var dentro = [];
    for (var i = 0; i < w * h; i += 7) if (o.alfa[i] > 0.5) dentro.push(lum[i]);
    dentro.sort(function (p, r) { return p - r; });
    var ref = dentro.length ? dentro[Math.floor(dentro.length * 0.35)] : 200;
    // sombra
    var sx = sala.sombra[0], sy = sala.sombra[1], sombra = new Float32Array(w * h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var ox = x - sx, oy = y - sy;
      if (ox >= 0 && oy >= 0 && ox < w && oy < h) sombra[y * w + x] = o.alfa[oy * w + ox];
    }
    desenfocar(sombra, w, h, 9);
    for (var p = 0, j = 0; p < w * h; p++, j += 4) {
      var a = o.alfa[p], s = 1 - 0.36 * sombra[p];
      var il = 1 + (Math.min(1.22, Math.max(0.8, lum[p] / ref)) - 1) * 0.85;
      for (var c = 0; c < 3; c++) d[j + c] = d[j + c] * s * (1 - a) + Math.min(255, o.rgb[p * 3 + c] * il) * a;
    }
    b.putImageData(im, 0, 0);
    return base;
  }

  // ---------- 5. volver a pegar la obra real sobre la escena de la IA ----------
  // Busca dónde quedó la obra en la escena (parte de donde se pidió y afina esquina a esquina)
  // comparando la foto real con lo que devolvió la IA.
  function localizar(escena, obra, qPedido) {
    var k = 440 / escena.width;
    var e = escalar(escena, escena.width * k, escena.height * k), ew = e.width, eh = e.height, eg = gris(e);
    var q0 = multiplicar(qPedido, k);
    var anchoQ = Math.hypot(q0[1][0] - q0[0][0], q0[1][1] - q0[0][1]);
    var ko = Math.min(1, anchoQ * 1.3 / obra.width);
    var op = escalar(obra, obra.width * ko, obra.height * ko), ow = op.width, oh = op.height, og = gris(op);
    function nota(q) {
      var H = homografia(q, rectDe(ow, oh)); if (!H) return -1;
      var c = caja(q, ew, eh), n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
      for (var y = c[1]; y <= c[3]; y++) for (var x = c[0]; x <= c[2]; x++) {
        var px = x + 0.5, py = y + 0.5, d = H[6] * px + H[7] * py + 1;
        var fx = (H[0] * px + H[1] * py + H[2]) / d - 0.5, fy = (H[3] * px + H[4] * py + H[5]) / d - 0.5;
        if (fx < 1 || fy < 1 || fx > ow - 2 || fy > oh - 2) continue;
        var ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy, o = iy * ow + ix;
        var a = (og[o] * (1 - ax) + og[o + 1] * ax) * (1 - ay) + (og[o + ow] * (1 - ax) + og[o + ow + 1] * ax) * ay;
        var b = eg[y * ew + x];
        n++; sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b;
      }
      if (n < 400) return -1;
      var va = saa - sa * sa / n, vb = sbb - sb * sb / n;
      return (va <= 0 || vb <= 0) ? -1 : (sab - sa * sb / n) / Math.sqrt(va * vb);
    }
    var q = q0.map(function (p) { return p.slice(); }), mejor = nota(q);
    var inicial = mejor, pasos, i, dx, dy;
    // 1) desplazamiento de todo el cuadro
    for (dx = -14; dx <= 14; dx += 2) for (dy = -14; dy <= 14; dy += 2) {
      var qt = q0.map(function (p) { return [p[0] + dx, p[1] + dy]; }), nt = nota(qt);
      if (nt > mejor) { mejor = nt; q = qt; }
    }
    // 2) cada esquina por separado, de grueso a fino
    [[8, 2], [3, 1], [1, 0.5]].forEach(function (cfg) {
      for (var vuelta = 0; vuelta < 2; vuelta++) for (i = 0; i < 4; i++) {
        var bx = q[i][0], by = q[i][1], mx = bx, my = by;
        for (dx = -cfg[0]; dx <= cfg[0]; dx += cfg[1]) for (dy = -cfg[0]; dy <= cfg[0]; dy += cfg[1]) {
          q[i][0] = bx + dx; q[i][1] = by + dy;
          var n2 = nota(q);
          if (n2 > mejor) { mejor = n2; mx = bx + dx; my = by + dy; }
        }
        q[i][0] = mx; q[i][1] = my;
      }
    });
    var movido = 0;
    for (i = 0; i < 4; i++) movido = Math.max(movido, Math.hypot(q[i][0] - q0[i][0], q[i][1] - q0[i][1]));
    return { q: multiplicar(q, 1 / k), parecido: mejor, parecidoInicial: inicial, desvio: movido / ew };
  }

  // Pega la foto real en el cuadrilátero q de la escena, conservando el sombreado que puso la IA.
  function repegar(escena, obra, q) {
    var w = escena.width, h = escena.height;
    var sal = lienzo(w, h), s = ctx2d(sal); s.drawImage(escena, 0, 0);
    var im = s.getImageData(0, 0, w, h), d = im.data;
    var anchoQ = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]);
    var ko = Math.min(1, anchoQ * 1.25 / obra.width);
    var op = ko < 1 ? escalar(obra, obra.width * ko, obra.height * ko) : obra;
    var o = deformar(op, q, w, h);
    // el borde de la mezcla se mete 2 px hacia dentro para no pisar el canto que dibujó la IA
    var cx = 0, cy = 0; q.forEach(function (p) { cx += p[0] / 4; cy += p[1] / 4; });
    var qi = q.map(function (p) { var l = Math.hypot(p[0] - cx, p[1] - cy); return [p[0] - (p[0] - cx) / l * 2.5, p[1] - (p[1] - cy) / l * 2.5]; });
    var Hi = homografia(qi, rectDe(1000, 1000));
    // sombreado a baja resolución
    var f = 4, lw = Math.ceil(w / f), lh = Math.ceil(h / f);
    var lg = new Float32Array(lw * lh), lr = new Float32Array(lw * lh), cnt = new Float32Array(lw * lh);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var p = y * w + x, j = p * 4, li = ((y / f) | 0) * lw + ((x / f) | 0);
      var g = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2] + 8;
      var a = o.alfa[p], r = (0.299 * o.rgb[p * 3] + 0.587 * o.rgb[p * 3 + 1] + 0.114 * o.rgb[p * 3 + 2] + 8);
      lg[li] += g; lr[li] += a > 0.5 ? r : g; cnt[li]++;
    }
    for (var i = 0; i < lw * lh; i++) { lg[i] /= cnt[i] || 1; lr[i] /= cnt[i] || 1; }
    var radio = Math.max(2, Math.round(w / 60 / f));
    desenfocar(lg, lw, lh, radio); desenfocar(lr, lw, lh, radio);
    var c = caja(q, w, h);
    for (y = c[1]; y <= c[3]; y++) for (x = c[0]; x <= c[2]; x++) {
      p = y * w + x; if (o.alfa[p] <= 0) continue;
      var px = x + 0.5, py = y + 0.5, dd = Hi[6] * px + Hi[7] * py + 1;
      var u = (Hi[0] * px + Hi[1] * py + Hi[2]) / dd, v = (Hi[3] * px + Hi[4] * py + Hi[5]) / dd;
      var borde = Math.min(u, 1000 - u, v, 1000 - v) * (anchoQ / 1000);
      var al = Math.min(1, Math.max(0, borde / 1.5));
      if (al <= 0) continue;
      li = ((y / f) | 0) * lw + ((x / f) | 0);
      var rat = Math.min(1.35, Math.max(0.7, lg[li] / lr[li]));
      j = p * 4;
      for (var k2 = 0; k2 < 3; k2++) d[j + k2] = d[j + k2] * (1 - al) + Math.min(255, o.rgb[p * 3 + k2] * rat) * al;
    }
    s.putImageData(im, 0, 0);
    return sal;
  }

  window.Imagen = {
    lienzo: lienzo, escalar: escalar, nitidez: nitidez, quemado: quemado, enderezar: enderezar, tocaBorde: tocaBorde,
    gananciaPared: gananciaPared, corregir: corregir, cuadroEnSala: cuadroEnSala, multiplicar: multiplicar,
    montar: montar, localizar: localizar, repegar: repegar
  };
})();
