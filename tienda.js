// Web pública de Creamdo Art. Lee el catálogo del backend y lo pinta.
// No hay carrito ni pago: cada obra lleva a WhatsApp con su nombre ya escrito.
(function () {
  'use strict';
  var C = window.CREAMDO || {}, vista = document.getElementById('vista'), obras = [], cargado = false;

  // ---------- idioma ----------
  // Español o inglés. Manda lo que la persona eligió; si no ha elegido, el idioma de su dispositivo.
  var TEXTOS = {
    es: {
      'nav.obras': 'Obras', 'nav.artistas': 'Artistas', 'pie.firma': 'Creamdo Art, por Adriana Moncayo.', 'marca.inicio': 'Creamdo Art, inicio',
      'titulo.sitio': 'Creamdo Art · Galería en Lechería, Venezuela',
      'inicio.h1': 'Galería de Adriana Moncayo en Lechería, Venezuela.',
      'inicio.texto': 'Pintura, escultura y arte sacro de artistas venezolanos. Cada obra se presenta con sus medidas y su precio, y la galería atiende personalmente cada consulta.',
      'portada.destacada': 'Obra destacada', 'portada.ahora': 'En la galería ahora',
      'obras': 'Obras', 'todo': 'Todo', 'vendida': 'Vendida', 'precio.consultar': 'Precio a solicitud',
      'vacio.h': 'Estamos colgando las obras', 'vacio.cargando': 'Abriendo la galería',
      'vacio.p': 'El catálogo está en preparación. Mientras tanto, la galería le informa de las obras disponibles por ',
      'banda.etiqueta': 'Qué hacemos', 'banda.frase': 'Asesoramos eventos, representamos artistas plásticos y comercializamos obras de arte.',
      'banda.1': 'Galería', 'banda.1t': 'Pintura, escultura y arte sacro de artistas venezolanos.',
      'banda.2': 'Representación', 'banda.2t': 'Llevamos la obra de nuestros artistas a quien la busca.',
      'banda.3': 'Asesoría', 'banda.3t': 'Le acompañamos a elegir la pieza para su casa, su oficina o su evento.',
      'banda.cta': '¿Es artista? Presente su obra con nosotros',
      'artistas': 'Artistas', 'obra1': ' obra', 'obraN': ' obras', 'volver.obras': '← Todas las obras', 'volver.artistas': '← Artistas',
      'dato.tipo': 'Tipo', 'dato.tecnica': 'Técnica', 'dato.medidas': 'Medidas', 'dato.ref': 'Referencia',
      'alto': ' cm de alto', 'ancho': ' de ancho', 'fondo': ' de fondo', 'de': ', de ', 'en.sala': ', en un ambiente',
      'boton': 'Consultar esta obra', 'boton.vendida': 'Consultar obras similares',
      'nota': 'Atención personal de la galería por WhatsApp. Coordinamos con usted la visita, la forma de pago y la entrega.',
      'nota.vendida': 'Esta obra ya forma parte de una colección. La galería puede proponerle otras piezas del artista.',
      'sala': 'Imagen referencial: la obra a escala en un ambiente recreado.',
      'wa.obra': 'Buen día. Me interesa la obra «{t}» de {a} (ref. {r}).', 'wa.vendida': 'Buen día. Vi que «{t}» de {a} ya se vendió. ¿Tienen otras obras del artista?',
      'wa.general': 'Buen día. Les escribo desde la web de Creamdo Art.', 'wa.catalogo': 'Buen día. Quisiera saber qué obras tienen disponibles.',
      'wa.artista': 'Buen día. Soy artista y me gustaría presentar mi obra con Creamdo Art.',
      'tipo.Pintura': 'Pintura', 'tipo.Retablo': 'Retablo', 'tipo.Escultura': 'Escultura', 'tipo.Arte sacro': 'Arte sacro', 'tipo.Objeto': 'Objeto'
    },
    en: {
      'nav.obras': 'Works', 'nav.artistas': 'Artists', 'pie.firma': 'Creamdo Art, by Adriana Moncayo.', 'marca.inicio': 'Creamdo Art, home',
      'titulo.sitio': 'Creamdo Art · Gallery in Lechería, Venezuela',
      'inicio.h1': 'Adriana Moncayo’s gallery in Lechería, Venezuela.',
      'inicio.texto': 'Painting, sculpture and sacred art by Venezuelan artists. Each work is presented with its dimensions and price, and the gallery answers every enquiry personally.',
      'portada.destacada': 'Featured work', 'portada.ahora': 'In the gallery now',
      'obras': 'Works', 'todo': 'All', 'vendida': 'Sold', 'precio.consultar': 'Price on request',
      'vacio.h': 'The works are being hung', 'vacio.cargando': 'Opening the gallery',
      'vacio.p': 'The catalogue is in preparation. In the meantime, the gallery will tell you which works are available on ',
      'banda.etiqueta': 'What we do', 'banda.frase': 'We advise on events, represent visual artists and place works of art.',
      'banda.1': 'Gallery', 'banda.1t': 'Painting, sculpture and sacred art by Venezuelan artists.',
      'banda.2': 'Representation', 'banda.2t': 'We bring our artists’ work to those who seek it.',
      'banda.3': 'Advisory', 'banda.3t': 'We help you choose the right piece for your home, your office or your event.',
      'banda.cta': 'Are you an artist? Present your work with us',
      'artistas': 'Artists', 'obra1': ' work', 'obraN': ' works', 'volver.obras': '← All works', 'volver.artistas': '← Artists',
      'dato.tipo': 'Type', 'dato.tecnica': 'Medium', 'dato.medidas': 'Dimensions', 'dato.ref': 'Reference',
      'alto': ' cm high', 'ancho': ' wide', 'fondo': ' deep', 'de': ', by ', 'en.sala': ', in a setting',
      'boton': 'Enquire about this work', 'boton.vendida': 'Ask about similar works',
      'nota': 'Personal attention from the gallery on WhatsApp. We arrange the viewing, payment and delivery with you.',
      'nota.vendida': 'This work now belongs to a collection. The gallery can suggest other pieces by the artist.',
      'sala': 'For reference: the work shown to scale in a recreated setting.',
      'wa.obra': 'Good day. I am interested in “{t}” by {a} (ref. {r}).', 'wa.vendida': 'Good day. I saw that “{t}” by {a} has been sold. Do you have other works by the artist?',
      'wa.general': 'Good day. I am writing from the Creamdo Art website.', 'wa.catalogo': 'Good day. I would like to know which works are available.',
      'wa.artista': 'Good day. I am an artist and would like to present my work with Creamdo Art.',
      'tipo.Pintura': 'Painting', 'tipo.Retablo': 'Altarpiece', 'tipo.Escultura': 'Sculpture', 'tipo.Arte sacro': 'Sacred art', 'tipo.Objeto': 'Object'
    }
  };
  var idioma = (function () {
    var g = null; try { g = localStorage.getItem('creamdo-idioma'); } catch (e) {}
    if (g === 'es' || g === 'en') return g;
    var d = (navigator.languages && navigator.languages[0]) || navigator.language || 'es';
    return /^es/i.test(d) ? 'es' : 'en';
  })();
  function t(k, v) {
    var x = TEXTOS[idioma][k]; if (x === undefined) x = TEXTOS.es[k]; if (x === undefined) x = k;
    if (v) Object.keys(v).forEach(function (n) { x = x.replace('{' + n + '}', v[n]); });
    return x;
  }
  function tipoDe(o) { var x = TEXTOS[idioma]['tipo.' + o.tipo]; return x || o.tipo; }
  // La técnica es texto libre: el backend la manda ya traducida (tecnicaEn). El título y el artista no se traducen.
  function tecnicaDe(o) { return idioma === 'en' ? (o.tecnicaEn || o.tecnica) : o.tecnica; }

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
  function num(n) { var x = String(Math.round(n * 10) / 10); return idioma === 'es' ? x.replace('.', ',') : x; }
  function medidas(o) {
    if (!o.altoCm) return '';
    var p = [num(o.altoCm) + t('alto')];
    if (o.anchoCm) p.push(num(o.anchoCm) + t('ancho'));
    if (o.fondoCm) p.push(num(o.fondoCm) + t('fondo'));
    return p.join(' × ');
  }
  function medidasCortas(o) { return o.altoCm ? [o.altoCm, o.anchoCm, o.fondoCm].filter(Boolean).map(num).join(' × ') + ' cm' : ''; }
  function precio(o) { return o.precio > 0 ? '$' + Math.round(o.precio).toLocaleString(idioma === 'es' ? 'es-VE' : 'en-US') : t('precio.consultar'); }
  function whatsapp(texto) { return 'https://wa.me/' + (C.WHATSAPP || '') + '?text=' + encodeURIComponent(texto); }
  function titulo(x) { document.title = x ? x + ' · Creamdo Art' : t('titulo.sitio'); }

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
    return el('a', { clase: 'pieza', href: '#/obra/' + o.id, 'data-obra': o.id }, [
      o.imagenes[0] ? el('span', { clase: 'marco' }, [el('img', { src: foto(o.imagenes[0], 1000), alt: o.titulo + t('de') + o.artista, loading: 'lazy' })]) : null,
      el('h3', { texto: o.titulo }),
      el('p', { clase: 'artista', texto: o.artista }),
      el('p', { texto: [tecnicaDe(o), medidasCortas(o)].filter(Boolean).join(' · ') }),
      o.estado === 'Vendida' ? el('p', { clase: 'vendida', texto: t('vendida') }) : el('p', { clase: 'precio', texto: precio(o) })
    ]);
  }
  // Dos columnas desfasadas: las obras se reparten alternando, como en una pared.
  function muro(lista) {
    if (!lista.length) return el('div', { clase: 'vacio' }, [
      el('h3', { texto: cargado ? t('vacio.h') : t('vacio.cargando') }),
      cargado ? el('p', {}, [t('vacio.p'),
        el('a', { href: whatsapp(t('wa.catalogo')), target: '_blank', rel: 'noopener', texto: 'WhatsApp' }), '.']) : null
    ]);
    var cols = [], n = Math.min(columnas(), lista.length);
    for (var k = 0; k < n; k++) cols.push(el('div', { clase: 'col' }));
    lista.forEach(function (o, i) { cols[i % n].appendChild(tarjeta(o)); });
    return el('div', { clase: 'muro' }, cols);
  }
  // La obra de la portada: la que la galería marcó como destacada en el admin. Si no hay ninguna,
  // una disponible distinta en cada visita (se mantiene mientras dure la visita).
  var azar = null;
  function destacada() {
    var libres = obras.filter(function (o) { return o.estado !== 'Vendida' && o.imagenes.length; });
    var marcada = libres.filter(function (o) { return o.destacada; })[0];
    if (marcada || !libres.length) return marcada || null;
    if (azar === null) {
      try { azar = sessionStorage.getItem('creamdo-portada'); } catch (e) {}
      if (!azar || !libres.some(function (o) { return o.id === azar; })) {
        azar = libres[Math.floor(Math.random() * libres.length)].id;
        try { sessionStorage.setItem('creamdo-portada', azar); } catch (e) {}
      }
    }
    return libres.filter(function (o) { return o.id === azar; })[0] || libres[0];
  }
  function columnas() { return window.innerWidth >= 1000 ? 3 : window.innerWidth >= 620 ? 2 : 1; }
  function banda() {
    function item(color, nombre, texto) {
      return el('li', {}, [el('b', {}, [el('i', { style: 'background:' + color }), nombre]), el('span', { texto: texto })]);
    }
    return el('section', { clase: 'banda' }, [
      el('p', { clase: 'etiqueta', texto: t('banda.etiqueta') }),
      el('p', { clase: 'frase', texto: t('banda.frase') }),
      el('ul', {}, [
        item('var(--cian)', t('banda.1'), t('banda.1t')),
        item('var(--naranja)', t('banda.2'), t('banda.2t')),
        item('var(--magenta)', t('banda.3'), t('banda.3t'))
      ]),
      el('a', { clase: 'artistas-cta', href: whatsapp(t('wa.artista')), target: '_blank', rel: 'noopener', texto: t('banda.cta') })
    ]);
  }

  // ---------- vistas ----------
  function vistaObras(tipo) {
    titulo('');
    var tipos = []; obras.forEach(function (o) { if (tipos.indexOf(o.tipo) < 0) tipos.push(o.tipo); });
    var lista = tipo ? obras.filter(function (o) { return slug(o.tipo) === tipo; }) : obras;
    var disponible = destacada();
    var portada = tipo ? null : el('section', { clase: 'portada' }, [
      el('div', {}, [
        el('h1', { texto: t('inicio.h1') }),
        el('p', { clase: 'texto', texto: t('inicio.texto') }),
        rayas()
      ]),
      disponible ? el('a', { clase: 'destacada', href: '#/obra/' + disponible.id, 'data-obra': disponible.id }, [
        el('span', { clase: 'marco' }, [el('img', { src: foto(disponible.imagenes[0], 1000), alt: disponible.titulo + t('de') + disponible.artista })]),
        el('p', {}, [el('span', { clase: 'etiqueta', texto: disponible.destacada ? t('portada.destacada') : t('portada.ahora') }), el('b', { texto: disponible.titulo }), ' · ' + disponible.artista])
      ]) : null
    ]);
    var filtros = tipos.length > 1 ? el('div', { clase: 'filtros' }, [el('a', { href: '#/', 'aria-current': String(!tipo), texto: t('todo') })].concat(tipos.map(function (x) {
      return el('a', { href: '#/tipo/' + slug(x), 'aria-current': String(slug(x) === tipo), texto: TEXTOS[idioma]['tipo.' + x] || x });
    }))) : null;
    return [portada, el('div', { clase: 'cabecera-seccion', id: 'obras' }, [el('h2', { texto: t('obras') }), filtros]), muro(lista), tipo ? null : banda()];
  }
  function vistaArtistas() {
    titulo(t('artistas'));
    var mapa = {}; obras.forEach(function (o) { (mapa[o.artista] = mapa[o.artista] || []).push(o); });
    var nombres = Object.keys(mapa).sort(function (a, b) { return a.localeCompare(b, 'es'); });
    return [el('h1', { clase: 'titulo-pagina', texto: t('artistas') }),
      nombres.length ? el('ul', { clase: 'lista-artistas' }, nombres.map(function (n) {
        return el('li', {}, [el('a', { href: '#/artista/' + slug(n) }, [el('b', { texto: n }), el('span', { texto: mapa[n].length + (mapa[n].length === 1 ? t('obra1') : t('obraN')) })])]);
      })) : muro([])];
  }
  function vistaArtista(s) {
    var lista = obras.filter(function (o) { return slug(o.artista) === s; });
    if (!lista.length) return vistaObras();
    titulo(lista[0].artista);
    return [el('a', { clase: 'volver', href: '#/artistas', texto: t('volver.artistas') }), el('h1', { clase: 'titulo-pagina', texto: lista[0].artista }), muro(lista)];
  }
  function vistaObra(id) {
    var o = obras.filter(function (x) { return x.id === id; })[0];
    if (!o) return vistaObras();
    titulo(o.titulo + t('de') + o.artista);
    var vendida = o.estado === 'Vendida', reales = o.imagenes.length - (o.enSala || 0);
    var figuras = o.imagenes.map(function (im, i) {
      var enSala = i >= reales;
      return el('figure', {}, [el('img', { src: foto(im, 1600), style: i ? '' : 'view-transition-name:obra;background-image:url("' + foto(im, 1000) + '")', alt: o.titulo + t('de') + o.artista + (enSala ? t('en.sala') : ''), loading: i ? 'lazy' : 'eager' }),
        enSala ? el('figcaption', { texto: t('sala') }) : null]);
    });
    function dato(k, v) { return v ? el('div', {}, [el('dt', { texto: k }), el('dd', { texto: v })]) : null; }
    var msg = t(vendida ? 'wa.vendida' : 'wa.obra', { t: o.titulo, a: o.artista, r: o.id });
    return [el('a', { clase: 'volver', href: '#/', texto: t('volver.obras') }),
      el('article', { clase: 'ficha' }, [
        el('div', { clase: 'primera' }, figuras.slice(0, 1)),
        el('aside', {}, [
          el('h1', { texto: o.titulo }),
          el('a', { clase: 'artista', href: '#/artista/' + slug(o.artista), texto: o.artista }),
          el('dl', {}, [dato(t('dato.tipo'), tipoDe(o)), dato(t('dato.tecnica'), tecnicaDe(o)), dato(t('dato.medidas'), medidas(o)), dato(t('dato.ref'), o.id)]),
          vendida ? el('p', { clase: 'vendida', style: 'margin:0 0 20px', texto: t('vendida') }) : el('p', { clase: 'precio-grande', texto: precio(o) }),
          el('a', { clase: 'boton', href: whatsapp(msg), target: '_blank', rel: 'noopener' }, [vendida ? t('boton.vendida') : t('boton'), rayas()]),
          el('p', { clase: 'nota', texto: vendida ? t('nota.vendida') : t('nota') })
        ]),
        figuras.length > 1 ? el('div', { clase: 'resto' }, figuras.slice(1)) : null
      ])];
  }

  // ---------- ruta ----------
  var rutaObra = null, alturas = {}, hashActual = location.hash, colsActuales = columnas();
  function pintar() {
    var r = location.hash.replace(/^#\/?/, '').split('/'), nodos, vengoDe = rutaObra;
    rutaObra = r[0] === 'obra' && r[1] ? r[1] : null;
    if (rutaObra) nodos = vistaObra(r[1]);
    else if (r[0] === 'artistas') nodos = vistaArtistas();
    else if (r[0] === 'artista' && r[1]) nodos = vistaArtista(r[1]);
    else if (r[0] === 'tipo' && r[1]) nodos = vistaObras(r[1]);
    else nodos = vistaObras();
    vista.textContent = '';
    nodos.forEach(function (n) { if (n) vista.appendChild(n); });
    // Al volver de una ficha, la foto regresa a su sitio en la pared.
    if (vengoDe && !rutaObra) { var t = vista.querySelector('.pieza[data-obra="' + vengoDe + '"] img'); if (t) marcar(t); }
    descubrir();
    var enArtistas = r[0] === 'artistas' || r[0] === 'artista';
    [['n-obras', !enArtistas], ['n-artistas', enArtistas]].forEach(function (x) {
      var a = document.getElementById(x[0]); if (x[1]) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  // ---------- movimiento ----------
  var quieto = !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ojo = !quieto && 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('a-la-vista'); ojo.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) : null;
  if (ojo) document.documentElement.classList.add('mov');
  function descubrir() {
    if (!ojo) return;
    [].forEach.call(vista.querySelectorAll('.pieza, .destacada'), function (p) { ojo.observe(p); });
  }
  function marcar(img) {
    [].forEach.call(document.querySelectorAll('[data-viaja]'), function (x) { x.style.viewTransitionName = ''; x.removeAttribute('data-viaja'); });
    img.style.viewTransitionName = 'obra'; img.setAttribute('data-viaja', '1');
    var p = img.closest('.pieza, .destacada'); if (p) p.classList.add('a-la-vista');
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-obra]'), img = a && a.querySelector('img');
    if (img) marcar(img);
  }, true);
  function cambiar() {
    alturas[hashActual] = window.scrollY;
    var destino = location.hash, y = alturas[destino] && !/^#\/obra\//.test(destino) ? alturas[destino] : 0;
    function hacer() { pintar(); window.scrollTo(0, y); }
    hashActual = destino;
    if (!quieto && document.startViewTransition) document.startViewTransition(hacer); else hacer();
  }
  window.addEventListener('resize', function () { if (columnas() !== colsActuales) { colsActuales = columnas(); if (!rutaObra) pintar(); } });
  // Textos fijos de la página (cabecera y pie) y selector de idioma.
  function fijos() {
    document.documentElement.lang = idioma;
    var contacto = whatsapp(t('wa.general'));
    document.getElementById('n-contacto').href = contacto;
    document.getElementById('f-whatsapp').href = contacto;
    document.getElementById('n-obras').textContent = t('nav.obras');
    document.getElementById('n-artistas').textContent = t('nav.artistas');
    document.getElementById('f-firma').textContent = t('pie.firma');
    document.querySelector('.marca').setAttribute('aria-label', t('marca.inicio'));
    [].forEach.call(document.querySelectorAll('[data-idioma]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-idioma') === idioma)); });
  }
  [].forEach.call(document.querySelectorAll('[data-idioma]'), function (b) {
    b.addEventListener('click', function () {
      idioma = b.getAttribute('data-idioma'); try { localStorage.setItem('creamdo-idioma', idioma); } catch (e) {}
      fijos(); pintar();
    });
  });
  fijos();
  document.getElementById('f-instagram').href = 'https://www.instagram.com/' + (C.INSTAGRAM || '') + '/';
  window.addEventListener('hashchange', cambiar);
  var espera = cargar(); pintar(); espera.then(pintar);
})();
