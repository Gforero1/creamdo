const {chromium,devices}=require('playwright-core');const fs=require('fs');
let ok=0,mal=0;const t=(n,c,x)=>{c?ok++:mal++;console.log((c?'bien  ':'FALLA ')+n+(x?'  '+x:''))};
const obras=[
 {id:'o1',estado:'Publicada',titulo:'Marina',artista:'Enrique Lobo',tipo:'Pintura',tecnica:'Acrílico sobre lienzo',anchoCm:150,altoCm:103,fondoCm:0,precio:1000,imagenes:['marina','salaA','salaB'],enSala:2},
 {id:'o2',estado:'Publicada',titulo:'Virgen de Coromoto',artista:'María Lea Cerdá',tipo:'Arte sacro',tecnica:'Madera tallada y policromada',anchoCm:12,altoCm:20,fondoCm:6,precio:115,imagenes:['coromoto','escsala'],enSala:0},
 {id:'o3',estado:'Vendida',titulo:'Los Canales',artista:'Pedro Gentil',tipo:'Pintura',tecnica:'Óleo sobre lienzo',anchoCm:120,altoCm:80,fondoCm:0,precio:1800,imagenes:['salaB'],enSala:0},
 {id:'o4',estado:'Publicada',titulo:'Amanecer <script>alert(1)</script>',artista:'Enrique Lobo',tipo:'Pintura',tecnica:'',anchoCm:0,altoCm:60,fondoCm:0,precio:0,imagenes:['marina'],enSala:0}];
const mapa={marina:'marina.jpg',salaA:'t-salaA.jpg',salaB:'t-salaB.jpg',coromoto:'t-coromoto.jpg',escsala:'t-esc-sala.jpg'};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
let idiomaNav='es-VE';
const abrir=async(dev,lista)=>{const c=await b.newContext({locale:idiomaNav,...(dev||{viewport:{width:1280,height:900}})});const p=await c.newPage();p.on('pageerror',e=>{mal++;console.log('ERROR',e.message)});
  let dialogo=false;p.on('dialog',d=>{dialogo=true;d.dismiss()});p.dialogo=()=>dialogo;
  await p.route('**/config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.CREAMDO={WHATSAPP:'584148090559',INSTAGRAM:'creamdo.art',API:'http://localhost:8765/catalogo-falso'};"}));
  await p.route('**/catalogo-falso**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,obras:lista})}));
  await p.route('https://drive.google.com/thumbnail**',r=>{const id=new URL(r.request().url()).searchParams.get('id');r.fulfill({contentType:'image/jpeg',body:fs.readFileSync(mapa[id])})});
  await p.route('https://fonts.g*/**',r=>r.abort());
  await p.goto('http://localhost:8765/');await p.waitForTimeout(900);return p;};
let p=await abrir(null,obras);
t('inicio: cuatro obras y una destacada',await p.locator('.pieza').count()===4&&await p.locator('.destacada').count()===1);
{const sin=await p.locator('.destacada').innerText();t('portada sin marcar: una disponible, con su rótulo',/EN LA GALERÍA AHORA/i.test(sin)&&!sin.includes('Los Canales'));
 const q=await abrir(null,obras.map(o=>o.id==='o2'?{...o,destacada:true}:o));const con=await q.locator('.destacada').innerText();
 t('portada marcada: sale la destacada',/OBRA DESTACADA/i.test(con)&&con.includes('Virgen de Coromoto'));await q.context().close();}
t('fuente de la marca cargada',await p.evaluate(()=>document.fonts.check('900 20px Archivo')));
t('escritorio: sin desbordamiento horizontal',await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
t('filtros por tipo',(await p.locator('.filtros a').allTextContents()).join('|')==='Todo|Pintura|Arte sacro');
t('vendida marcada, sin precio',(await p.locator('.pieza',{hasText:'Los Canales'}).innerText()).includes('VENDIDA')&&!(await p.locator('.pieza',{hasText:'Los Canales'}).innerText()).includes('$'));
t('sin precio: a consultar',(await p.locator('.pieza',{hasText:'Amanecer'}).innerText()).includes('Precio a solicitud'));
t('texto del catálogo no se ejecuta como HTML',!p.dialogo()&&await p.locator('script:not([src])').count()===0);
await p.screenshot({path:'web-1-inicio.png',fullPage:true});
await p.click('.pieza >> text=Marina');await p.waitForSelector('.ficha');
t('ficha: tres imágenes, dos referenciales',await p.locator('.ficha figure').count()===3&&await p.locator('.ficha figcaption').count()===2);
const wa=await p.getAttribute('.boton','href');
t('WhatsApp con la obra escrita',wa.startsWith('https://wa.me/584148090559?text=')&&decodeURIComponent(wa).includes('«Marina» de Enrique Lobo (ref. o1)'),decodeURIComponent(wa).slice(0,110));
t('medidas legibles',(await p.locator('dl').innerText()).includes('103 cm de alto × 150 de ancho'));
await p.screenshot({path:'web-2-obra.png',fullPage:true});
await p.goto('http://localhost:8765/#/obra/o3');await p.waitForTimeout(700);await p.waitForSelector('.ficha');
t('vendida: botón de algo parecido',(await p.textContent('.boton')).trim()==='Consultar obras similares');
await p.click('#n-artistas');await p.waitForSelector('.lista-artistas');
t('artistas en orden, con conteo',(await p.locator('.lista-artistas li').evaluateAll(ls=>ls.map(l=>l.querySelector('b').textContent+' '+l.querySelector('span').textContent))).join('|')==='Enrique Lobo 2 obras|María Lea Cerdá 1 obra|Pedro Gentil 1 obra');
await p.screenshot({path:'web-3-artistas.png',fullPage:true});
await p.click('.lista-artistas a >> text=Enrique Lobo');await p.waitForSelector('.muro');t('página de artista',await p.locator('.pieza').count()===2);
await p.goto('http://localhost:8765/#/tipo/arte-sacro');await p.waitForTimeout(200);t('filtro de tipo',await p.locator('.pieza').count()===1);
await p.context().close();
p=await abrir(devices['Pixel 7'],obras);await p.screenshot({path:'web-4-movil.png',fullPage:true});
await p.click('.pieza >> text=Virgen de Coromoto');await p.waitForSelector('.ficha');await p.screenshot({path:'web-5-movil-obra.png',fullPage:true});
t('móvil: sin desbordamiento horizontal',await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));await p.context().close();
p=await abrir(devices['Pixel 7'],[]);t('catálogo vacío: mensaje y WhatsApp',(await p.textContent('.vacio')).includes('colgando')&&await p.locator('.vacio a').count()===1);await p.screenshot({path:'web-6-vacio.png'});
// --- idiomas ---
{const q=await abrir(null,obras.map(o=>({...o,tecnicaEn:o.tecnica?'Acrylic on canvas':''})));
 t('dispositivo en español: carga en español',await q.evaluate(()=>document.documentElement.lang)==='es'&&(await q.innerText('#n-obras')).toUpperCase()==='OBRAS');
 await q.click('[data-idioma=en]');
 t('cambia a inglés: cabecera, portada y filtros',await q.evaluate(()=>document.documentElement.lang)==='en'&&(await q.innerText('#n-obras')).toUpperCase()==='WORKS'&&(await q.innerText('.portada h1')).includes('gallery in Lechería')&&(await q.locator('.filtros a').allTextContents()).join('|')==='All|Painting|Sacred art');
 t('inglés: técnica traducida, vendida y precio',(await q.locator('.pieza',{hasText:'Marina'}).first().innerText()).includes('Acrylic on canvas')&&(await q.locator('.pieza',{hasText:'Los Canales'}).innerText()).includes('SOLD')&&(await q.locator('.pieza',{hasText:'Amanecer'}).innerText()).includes('Price on request'));
 await q.goto('http://localhost:8765/#/obra/o1');await q.waitForTimeout(700);await q.waitForSelector('.ficha');
 const dl=await q.locator('dl').innerText(),wa=decodeURIComponent(await q.getAttribute('.boton','href'));
 t('inglés: ficha y mensaje de WhatsApp',dl.includes('103 cm high × 150 wide')&&/MEDIUM/i.test(dl)&&(await q.textContent('.boton')).trim()==='Enquire about this work'&&wa.includes('I am interested in “Marina” by Enrique Lobo (ref. o1)')&&(await q.innerText('.precio-grande'))==='$1,000',dl.replace(/\n/g,' ').slice(0,80));
 t('el título de la obra no se traduce',(await q.innerText('.ficha h1'))==='Marina');
 await q.screenshot({path:'web-7-ingles.png',fullPage:true});
 await q.reload();await q.waitForSelector('.ficha');t('recuerda el idioma elegido',await q.evaluate(()=>document.documentElement.lang)==='en');
 await q.context().close();
 idiomaNav='de-DE';const r=await abrir(null,obras);t('dispositivo en otro idioma: carga en inglés',await r.evaluate(()=>document.documentElement.lang)==='en');await r.context().close();
 idiomaNav='en-GB';const m=await abrir(devices['iPhone 13'],obras);t('móvil en inglés: sin desbordamiento',await m.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));await m.screenshot({path:'web-8-movil-ingles.png'});await m.context().close();idiomaNav='es-VE';}
await b.close();console.log(ok+' bien, '+mal+' mal');})();
