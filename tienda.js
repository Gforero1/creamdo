// Web pública de Creamdo Art. Lee el catálogo del backend y lo pinta.
// No hay carrito ni pago: cada obra lleva a WhatsApp con su nombre ya escrito.
(function () {
  'use strict';
  var C = window.CREAMDO || {}, vista = document.getElementById('vista'), obras = [], cargado = false;

  // ---------- utilidades ----------
  function el(tipo, attrs, hijos) {
    var e = document.createElement(tipo);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'texto') e.textContent = attrs[k]; else if (k === 'clase') e.className = attrs[k]; else e.setAttribute(k, attrs[k]);
    });
    (hijos || []).forEach(function (h) { if (h) e.appendChild(typeof h === 'string' ? document.createTextNode(h) : h); });
    return e;
  }
  function slug(t) { return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function foto(id, ancho) { return (C.FOTO || 'https://drive.google.com/thumbnail?id={id}&sz=w{w}').replace('{id}', encodeURIComponent(id)).replace('{w}', ancho); }
  function num(n) { return String(Math.round(n * 10) / 10).replace('.', ','); }
  function medidas(o) {
    if (!o.altoCm) return '';
    var p = [num(o.altoCm) + ' cm de alto'];
    if (o.anchoCm) p.push(num(o.anchoCm) + ' de ancho');
    if (o.fondoCm) p.push(num(o.fondoCm) + ' de fondo');
    return p.join(' × ');
  }
  function medidasCortas(o) { return o.altoCm ? [o.altoCm, o.anchoCm, o.fondoCm].filter(Boolean).map(num).join(' × ') + ' cm' : ''; }
  function precio(o) { return o.precio > 0 ? '$' + Math.round(o.precio).toLocaleString('es-VE') : 'Precio a consultar'; }
  function whatsapp(texto) { return 'https://wa.me/' + (C.WHATSAPP || '') + '?text=' + encodeURIComponent(texto); }
  function titulo(t) { document.title = t ? t + ' · Creamdo Art' : 'Creamdo Art · Galería en Lechería, Venezuela'; }

  // ---------- datos ----------
  function cargar() {
    try { var g = JSON.parse(localStorage.getItem('creamdo-catalogo') || 'null'); if (g && Array.isArray(g.obras)) { obras = g.obras; cargado = true; } } catch (e) {}
    if (!C.API) { cargado = true; return Promise.resolve(); }
    return fetch(C.API + '?catalogo=1').then(function (r) { return r.json(); }).then(function (r) {
      if (r && Array.isArray(r.obras)) {
        obras = r.obras; cargado = true;
        try { localStorage.setItem('creamdo-catalogo', JSON.stringify({ obras: obras })); } catch (e) {}
      }
    }).catch(function () { cargado = true; });
  }

  // ---------- vistas ----------
  function tarjeta(o) {
    return el('a', { clase: 'pieza', href: '#/obra/' + o.id }, [
      o.imagenes[0] ? el('img', { src: foto(o.imagenes[0], 800), alt: o.titulo + ', de ' + o.artista, loading: 'lazy' }) : null,
      el('h2', { texto: o.titulo }),
      el('p', { texto: o.artista }),
      el('p', { texto: [o.tecnica, medidasCortas(o)].filter(Boolean).join(' · ') }),
      o.estado === 'Vendida' ? el('p', { clase: 'vendida', texto: 'Vendida' }) : el('p', { clase: 'precio', texto: precio(o) })
    ]);
  }
  function muro(lista) {
    if (!lista.length) return el('div', { clase: 'vacio' }, [
      el('h2', { texto: cargado ? 'Estamos colgando las obras' : 'Abriendo la galería…' }),
      cargado ? el('p', {}, ['El catálogo se está montando. Mientras tanto, escríbenos y te contamos qué hay disponible: ',
        el('a', { href: whatsapp('Hola, quiero saber qué obras tienen disponibles.'), target: '_blank', rel: 'noopener', texto: 'WhatsApp' }), '.']) : null
    ]);
    return el('div', { clase: 'muro' }, lista.map(tarjeta));
  }
  function vistaObras(tipo) {
    titulo('');
    var tipos = []; obras.forEach(function (o) { if (tipos.indexOf(o.tipo) < 0) tipos.push(o.tipo); });
    var lista = tipo ? obras.filter(function (o) { return slug(o.tipo) === tipo; }) : obras;
    var filtros = tipos.length > 1 ? el('div', { clase: 'filtros' }, [el('a', { href: '#/', 'aria-current': String(!tipo), texto: 'Todo' })].concat(tipos.map(function (t) {
      return el('a', { href: '#/tipo/' + slug(t), 'aria-current': String(slug(t) === tipo), texto: t });
    }))) : null;
    var h = el('h1', {}, ['Arte que ', el('em', { texto: 'habita contigo' })]);
    return [el('section', { clase: 'entrada' }, [h, el('p', { texto: 'Galería y representación de artistas en Lechería. Cada obra con sus medidas y su precio; para verla o reservarla, nos escribes.' })]), filtros, muro(lista)];
  }
  function vistaArtistas() {
    titulo('Artistas');
    var mapa = {}; obras.forEach(function (o) { (mapa[o.artista] = mapa[o.artista] || []).push(o); });
    var nombres = Object.keys(mapa).sort(function (a, b) { return a.localeCompare(b, 'es'); });
    return [el('section', { clase: 'entrada' }, [el('h1', {}, ['Los ', el('em', { texto: 'artistas' })])]),
      nombres.length ? el('ul', { clase: 'lista-artistas' }, nombres.map(function (n) {
        return el('li', {}, [el('a', { href: '#/artista/' + slug(n) }, [el('b', { texto: n }), el('span', { texto: mapa[n].length + (mapa[n].length === 1 ? ' obra' : ' obras') })])]);
      })) : muro([])];
  }
  function vistaArtista(s) {
    var lista = obras.filter(function (o) { return slug(o.artista) === s; });
    if (!lista.length) return vistaObras();
    titulo(lista[0].artista);
    return [el('a', { clase: 'volver', href: '#/artistas', texto: '← Artistas' }),
      el('section', { clase: 'entrada', style: 'padding-top:6px' }, [el('h1', { texto: lista[0].artista })]), muro(lista)];
  }
  function vistaObra(id) {
    var o = obras.filter(function (x) { return x.id === id; })[0];
    if (!o) return vistaObras();
    titulo(o.titulo + ', de ' + o.artista);
    var vendida = o.estado === 'Vendida', reales = o.imagenes.length - (o.enSala || 0);
    var figuras = o.imagenes.map(function (im, i) {
      var enSala = i >= reales;
      return el('figure', {}, [el('img', { src: foto(im, 1600), alt: o.titulo + ', de ' + o.artista + (enSala ? ', en una sala' : ''), loading: i ? 'lazy' : 'eager' }),
        enSala ? el('figcaption', { texto: 'Imagen referencial: la obra a escala en una sala decorada.' }) : null]);
    });
    function dato(k, v) { return v ? el('div', {}, [el('dt', { texto: k }), el('dd', { texto: v })]) : null; }
    var msg = vendida ? 'Hola, vi que «' + o.titulo + '» de ' + o.artista + ' ya se vendió. ¿Tienen algo parecido?'
                      : 'Hola, me interesa «' + o.titulo + '» de ' + o.artista + ' (ref. ' + o.id + ').';
    return [el('a', { clase: 'volver', href: '#/', texto: '← Todas las obras' }),
      el('article', { clase: 'ficha' }, [
        el('div', { clase: 'primera' }, figuras.slice(0, 1)),
        el('aside', {}, [
          el('h1', { texto: o.titulo }),
          el('a', { clase: 'artista', href: '#/artista/' + slug(o.artista), texto: o.artista }),
          el('dl', {}, [dato('Tipo', o.tipo), dato('Técnica', o.tecnica), dato('Medidas', medidas(o)), dato('Referencia', o.id)]),
          vendida ? el('p', { clase: 'vendida', style: 'margin:0 0 18px', texto: 'Vendida' }) : el('p', { clase: 'precio-grande', texto: precio(o) }),
          el('a', { clase: 'boton', href: whatsapp(msg), target: '_blank', rel: 'noopener', texto: vendida ? 'Buscar algo parecido' : 'Me interesa esta obra' }),
          el('p', { clase: 'nota', texto: vendida ? 'Te respondemos por WhatsApp con lo que haya disponible de este artista.' : 'Se abre WhatsApp con el nombre de la obra ya escrito. Coordinamos pago y entrega por ahí.' })
        ]),
        figuras.length > 1 ? el('div', { clase: 'resto' }, figuras.slice(1)) : null
      ])];
  }

  // ---------- ruta ----------
  function pintar() {
    var r = location.hash.replace(/^#\/?/, '').split('/'), nodos;
    if (r[0] === 'obra' && r[1]) nodos = vistaObra(r[1]);
    else if (r[0] === 'artistas') nodos = vistaArtistas();
    else if (r[0] === 'artista' && r[1]) nodos = vistaArtista(r[1]);
    else if (r[0] === 'tipo' && r[1]) nodos = vistaObras(r[1]);
    else nodos = vistaObras();
    vista.textContent = '';
    nodos.forEach(function (n) { if (n) vista.appendChild(n); });
    document.getElementById('n-obras').toggleAttribute('aria-current', r[0] !== 'artistas' && r[0] !== 'artista');
    document.getElementById('n-artistas').toggleAttribute('aria-current', r[0] === 'artistas' || r[0] === 'artista');
    if (document.getElementById('n-obras').hasAttribute('aria-current')) document.getElementById('n-obras').setAttribute('aria-current', 'page');
    if (document.getElementById('n-artistas').hasAttribute('aria-current')) document.getElementById('n-artistas').setAttribute('aria-current', 'page');
  }
  var contacto = whatsapp('Hola, vengo de la web de Creamdo Art.');
  document.getElementById('n-contacto').href = contacto;
  document.getElementById('f-whatsapp').href = contacto;
  document.getElementById('f-instagram').href = 'https://www.instagram.com/' + (C.INSTAGRAM || '') + '/';
  window.addEventListener('hashchange', function () { pintar(); window.scrollTo(0, 0); });
  var espera = cargar(); pintar(); espera.then(pintar);
})();
