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
  function rayas() { return el('span', { clase: 'rayas', 'aria-hidden': 'true' }, [el('i'), el('i'), el('i')]); }
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

  // ---------- piezas comunes ----------
  function tarjeta(o) {
    return el('a', { clase: 'pieza', href: '#/obra/' + o.id }, [
      o.imagenes[0] ? el('img', { src: foto(o.imagenes[0], 1000), alt: o.titulo + ', de ' + o.artista, loading: 'lazy' }) : null,
      el('h3', { texto: o.titulo }),
      el('p', { clase: 'artista', texto: o.artista }),
      el('p', { texto: [o.tecnica, medidasCortas(o)].filter(Boolean).join(' · ') }),
      o.estado === 'Vendida' ? el('p', { clase: 'vendida', texto: 'Vendida' }) : el('p', { clase: 'precio', texto: precio(o) })
    ]);
  }
  // Dos columnas desfasadas: las obras se reparten alternando, como en una pared.
  function muro(lista) {
    if (!lista.length) return el('div', { clase: 'vacio' }, [
      el('h3', { texto: cargado ? 'Estamos colgando las obras' : 'Abriendo la galería' }),
      cargado ? el('p', {}, ['El catálogo se está montando. Mientras tanto, escríbenos y te contamos qué hay disponible: ',
        el('a', { href: whatsapp('Hola, quiero saber qué obras tienen disponibles.'), target: '_blank', rel: 'noopener', texto: 'WhatsApp' }), '.']) : null
    ]);
    var a = el('div', { clase: 'col' }), b = el('div', { clase: 'col' });
    lista.forEach(function (o, i) { (i % 2 ? b : a).appendChild(tarjeta(o)); });
    return el('div', { clase: 'muro' }, [a, b]);
  }
  function banda() {
    function item(color, nombre, texto) {
      return el('li', {}, [el('i', { style: 'background:' + color }), el('div', {}, [el('b', { texto: nombre }), el('span', { texto: texto })])]);
    }
    return el('section', { clase: 'banda' }, [
      el('p', { clase: 'etiqueta', texto: 'Qué hacemos' }),
      el('p', { clase: 'frase', texto: 'Asesoramos eventos, representamos artistas plásticos y comercializamos obras de arte.' }),
      el('ul', {}, [
        item('var(--cian)', 'Galería', 'Pintura, escultura y arte sacro de artistas venezolanos.'),
        item('var(--naranja)', 'Representación', 'Llevamos la obra de nuestros artistas a quien la busca.'),
        item('var(--magenta)', 'Asesoría', 'Te ayudamos a elegir la pieza para tu casa, tu oficina o tu evento.'),
        item('#FFFFFF', 'Bromelias', 'Arte vivo para acompañar los espacios.')
      ]),
      el('a', { clase: 'artistas-cta', href: whatsapp('Hola, soy artista y me gustaría comercializar mi obra con Creamdo Art.'), target: '_blank', rel: 'noopener', texto: '¿Eres artista? Comercializa tu arte con nosotros' })
    ]);
  }

  // ---------- vistas ----------
  function vistaObras(tipo) {
    titulo('');
    var tipos = []; obras.forEach(function (o) { if (tipos.indexOf(o.tipo) < 0) tipos.push(o.tipo); });
    var lista = tipo ? obras.filter(function (o) { return slug(o.tipo) === tipo; }) : obras;
    var disponible = obras.filter(function (o) { return o.estado !== 'Vendida' && o.imagenes.length; })[0];
    var portada = tipo ? null : el('section', { clase: 'portada' }, [
      el('div', {}, [
        el('h1', {}, [el('b', { texto: 'Arte que' }), el('b', { texto: 'habita' }), el('span', { texto: 'contigo' })]),
        el('p', { clase: 'texto', texto: 'Galería de Adriana Moncayo en Lechería. Cada obra está aquí con sus medidas y su precio; para verla o reservarla, nos escribes por WhatsApp.' }),
        rayas()
      ]),
      disponible ? el('a', { clase: 'destacada', href: '#/obra/' + disponible.id }, [
        el('img', { src: foto(disponible.imagenes[0], 1200), alt: disponible.titulo + ', de ' + disponible.artista }),
        el('p', {}, [el('b', { texto: disponible.titulo }), ' · ' + disponible.artista])
      ]) : null
    ]);
    var filtros = tipos.length > 1 ? el('div', { clase: 'filtros' }, [el('a', { href: '#/', 'aria-current': String(!tipo), texto: 'Todo' })].concat(tipos.map(function (t) {
      return el('a', { href: '#/tipo/' + slug(t), 'aria-current': String(slug(t) === tipo), texto: t });
    }))) : null;
    return [portada, el('div', { clase: 'cabecera-seccion', id: 'obras' }, [el('h2', { texto: 'Obras' }), filtros]), muro(lista), tipo ? null : banda()];
  }
  function vistaArtistas() {
    titulo('Artistas');
    var mapa = {}; obras.forEach(function (o) { (mapa[o.artista] = mapa[o.artista] || []).push(o); });
    var nombres = Object.keys(mapa).sort(function (a, b) { return a.localeCompare(b, 'es'); });
    return [el('h1', { clase: 'titulo-pagina', texto: 'Artistas' }),
      nombres.length ? el('ul', { clase: 'lista-artistas' }, nombres.map(function (n) {
        return el('li', {}, [el('a', { href: '#/artista/' + slug(n) }, [el('b', { texto: n }), el('span', { texto: mapa[n].length + (mapa[n].length === 1 ? ' obra' : ' obras') })])]);
      })) : muro([])];
  }
  function vistaArtista(s) {
    var lista = obras.filter(function (o) { return slug(o.artista) === s; });
    if (!lista.length) return vistaObras();
    titulo(lista[0].artista);
    return [el('a', { clase: 'volver', href: '#/artistas', texto: '← Artistas' }), el('h1', { clase: 'titulo-pagina', texto: lista[0].artista }), muro(lista)];
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
          vendida ? el('p', { clase: 'vendida', style: 'margin:0 0 20px', texto: 'Vendida' }) : el('p', { clase: 'precio-grande', texto: precio(o) }),
          el('a', { clase: 'boton', href: whatsapp(msg), target: '_blank', rel: 'noopener' }, [vendida ? 'Buscar algo parecido' : 'Me interesa esta obra', rayas()]),
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
    var enArtistas = r[0] === 'artistas' || r[0] === 'artista';
    [['n-obras', !enArtistas], ['n-artistas', enArtistas]].forEach(function (x) {
      var a = document.getElementById(x[0]); if (x[1]) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  var contacto = whatsapp('Hola, vengo de la web de Creamdo Art.');
  document.getElementById('n-contacto').href = contacto;
  document.getElementById('f-whatsapp').href = contacto;
  document.getElementById('f-instagram').href = 'https://www.instagram.com/' + (C.INSTAGRAM || '') + '/';
  window.addEventListener('hashchange', function () { pintar(); window.scrollTo(0, 0); });
  var espera = cargar(); pintar(); espera.then(pintar);
})();
