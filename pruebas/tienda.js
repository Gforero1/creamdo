const {chromium,devices}=require('playwright-core');const fs=require('fs');
let ok=0,mal=0;const t=(n,c,x)=>{c?ok++:mal++;console.log((c?'bien  ':'FALLA ')+n+(x?'  '+x:''))};
const obras=[
 {id:'o1',estado:'Publicada',titulo:'Marina',artista:'Enrique Lobo',tipo:'Pintura',tecnica:'Acrílico sobre lienzo',anchoCm:150,altoCm:103,fondoCm:0,precio:1000,imagenes:['marina','salaA','salaB'],enSala:2},
 {id:'o2',estado:'Publicada',titulo:'Virgen de Coromoto',artista:'María Lea Cerdá',tipo:'Arte sacro',tecnica:'Madera tallada y policromada',anchoCm:12,altoCm:20,fondoCm:6,precio:115,imagenes:['coromoto','escsala'],enSala:0},
 {id:'o3',estado:'Vendida',titulo:'Los Canales',artista:'Pedro Gentil',tipo:'Pintura',tecnica:'Óleo sobre lienzo',anchoCm:120,altoCm:80,fondoCm:0,precio:1800,imagenes:['salaB'],enSala:0},
 {id:'o4',estado:'Publicada',titulo:'Amanecer <script>alert(1)</script>',artista:'Enrique Lobo',tipo:'Pintura',tecnica:'',anchoCm:0,altoCm:60,fondoCm:0,precio:0,imagenes:['marina'],enSala:0}];
const mapa={marina:'marina.jpg',salaA:'t-salaA.jpg',salaB:'t-salaB.jpg',coromoto:'t-coromoto.jpg',escsala:'t-esc-sala.jpg'};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const abrir=async(dev,lista)=>{const c=await b.newContext(dev||{viewport:{width:1280,height:900}});const p=await c.newPage();p.on('pageerror',e=>{mal++;console.log('ERROR',e.message)});
  let dialogo=false;p.on('dialog',d=>{dialogo=true;d.dismiss()});p.dialogo=()=>dialogo;
  await p.route('**/config.js',r=>r.fulfill({contentType:'text/javascript',body:"window.CREAMDO={WHATSAPP:'584148090559',INSTAGRAM:'creamdo.art',API:'http://localhost:8765/catalogo-falso'};"}));
  await p.route('**/catalogo-falso**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,obras:lista})}));
  await p.route('https://drive.google.com/thumbnail**',r=>{const id=new URL(r.request().url()).searchParams.get('id');r.fulfill({contentType:'image/jpeg',body:fs.readFileSync(mapa[id])})});
  await p.route('https://fonts.g*/**',r=>r.abort());
  await p.goto('http://localhost:8765/');await p.waitForTimeout(900);return p;};
let p=await abrir(null,obras);
t('inicio: cuatro obras y una destacada',await p.locator('.pieza').count()===4&&await p.locator('.destacada').count()===1);
t('fuente de la marca cargada',await p.evaluate(()=>document.fonts.check('900 20px Archivo')));
t('escritorio: sin desbordamiento horizontal',await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
t('filtros por tipo',(await p.locator('.filtros a').allTextContents()).join('|')==='Todo|Pintura|Arte sacro');
t('vendida marcada, sin precio',(await p.locator('.pieza',{hasText:'Los Canales'}).innerText()).includes('VENDIDA')&&!(await p.locator('.pieza',{hasText:'Los Canales'}).innerText()).includes('$'));
t('sin precio: a consultar',(await p.locator('.pieza',{hasText:'Amanecer'}).innerText()).includes('Precio a consultar'));
t('texto del catálogo no se ejecuta como HTML',!p.dialogo()&&await p.locator('script:not([src])').count()===0);
await p.screenshot({path:'web-1-inicio.png',fullPage:true});
await p.click('.pieza >> text=Marina');await p.waitForSelector('.ficha');
t('ficha: tres imágenes, dos referenciales',await p.locator('.ficha figure').count()===3&&await p.locator('.ficha figcaption').count()===2);
const wa=await p.getAttribute('.boton','href');
t('WhatsApp con la obra escrita',wa.startsWith('https://wa.me/584148090559?text=')&&decodeURIComponent(wa).includes('«Marina» de Enrique Lobo (ref. o1)'),decodeURIComponent(wa).slice(0,110));
t('medidas legibles',(await p.locator('dl').innerText()).includes('103 cm de alto × 150 de ancho'));
await p.screenshot({path:'web-2-obra.png',fullPage:true});
await p.goto('http://localhost:8765/#/obra/o3');await p.waitForSelector('.ficha');
t('vendida: botón de algo parecido',(await p.textContent('.boton')).trim()==='Buscar algo parecido');
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
await b.close();console.log(ok+' bien, '+mal+' mal');})();
