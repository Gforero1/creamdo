// Editar obras ya guardadas desde el admin.
const {chromium,devices}=require('playwright-core');
let ok=0,mal=0;const t=(n,c,x)=>{c?ok++:mal++;console.log((c?'bien  ':'FALLA ')+n+(x?'  '+x:''))};
(async()=>{
await fetch('http://localhost:8765/reiniciar');
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const c=await b.newContext({...devices['Pixel 7']});const p=await c.newPage();
p.on('pageerror',e=>{mal++;console.log('ERROR DE PAGINA',e.message)});
await p.route('**/config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.CREAMDO={API:'http://localhost:8765/api'};"}));
await p.route('https://drive.google.com/thumbnail**',r=>r.fulfill({contentType:'image/jpeg',body:require('fs').readFileSync('marina.jpg')}));
await p.goto('http://localhost:8765/admin/');
t('marca: logo, tipografía y sin fuentes de Google',await p.evaluate(()=>!!document.querySelector('header.marca img')&&document.querySelector('header.marca i').textContent==='ADMIN'&&!document.querySelector('link[href*=googleapis]'))&&await p.evaluate(()=>document.fonts.ready.then(()=>document.fonts.check('900 20px Archivo'))));
await p.screenshot({path:'cap-15-admin-entrar.png'});
await p.fill('#clave','prueba123');await p.click('#b-entrar');await p.waitForSelector('#p-foto.visible');
await p.screenshot({path:'cap-16-admin-foto.png'});
// una obra con dos fotos reales y una en sala
await p.setInputFiles('#archivos-obj',['marina.jpg','mala.jpg','t-salaA.jpg']);await p.waitForSelector('#p-objeto.visible');
await p.fill('#obj-titulo','Marina');await p.fill('#obj-artista','Enrique Lobo');await p.fill('#obj-alto','103');await p.fill('#obj-precio','1000');await p.click('#b-obj-guardar');await p.waitForSelector('#obj-avisos .bien');
const estado=async()=>(await (await fetch('http://localhost:8765/pedidas')).json());
await p.click('#b-ver-obras');await p.waitForSelector('#obras-lista .obra');
await p.click('#obras-lista .obra .editar');await p.waitForSelector('#p-editar.visible');
t('abre con los datos de la obra',await p.inputValue('#ed-titulo')==='Marina'&&await p.inputValue('#ed-alto')==='103'&&await p.inputValue('#ed-precio')==='1000'&&await p.locator('#ed-fotos figure').count()===3);
t('la primera es la portada y no se puede subir más',(await p.locator('#ed-fotos figcaption').first().innerText()).toUpperCase()==='PORTADA'&&await p.locator('#ed-fotos figure').first().locator('button').first().isDisabled());
// tercera foto a portada, quitar la que era primera, añadir una nueva
await p.locator('#ed-fotos figure').nth(2).locator('button').first().click();
await p.locator('#ed-fotos figure').nth(1).locator('button').nth(1).click();
await p.setInputFiles('#ed-archivos',['t-coromoto.jpg']);await p.waitForFunction(()=>document.querySelectorAll('#ed-fotos figure').length===3);
await p.fill('#ed-titulo','');await p.click('#b-ed-guardar');t('sin título no guarda',(await p.evaluate(()=>document.getElementById('ed-avisos').innerText)).includes('título'));
await p.fill('#ed-titulo','Marina azul');await p.fill('#ed-artista','E. Lobo');await p.selectOption('#ed-tipo','Pintura');await p.selectOption('#ed-estado','Publicada');
await p.fill('#ed-tecnica','Acrílico sobre lienzo');await p.fill('#ed-alto','103');await p.fill('#ed-ancho','150');await p.fill('#ed-precio','');await p.check('#ed-destacada');
await p.screenshot({path:'cap-17-admin-editar.png',fullPage:true});
await p.click('#b-ed-guardar');await p.waitForSelector('#p-obras.visible');await p.waitForSelector('#obras-avisos .bien');
const e=await estado(),ca=e.cambios[e.cambios.length-1],o=e.obras[0];
t('envía todos los campos',ca.titulo==='Marina azul'&&ca.artista==='E. Lobo'&&ca.estado==='Publicada'&&ca.tecnica==='Acrílico sobre lienzo'&&ca.anchoCm===150&&ca.precio===0&&ca.destacada===true);
t('fotos: la tercera pasa a portada, una quitada, una nueva',ca.imagenes.length===3&&ca.imagenes[0].id==='idfalso2xxxxxxxx'&&ca.imagenes[1].id==='idfalso1xxxxxxxx'&&String(ca.imagenes[2].datos).startsWith('(foto'),JSON.stringify(ca.imagenes));
t('la lista enseña el cambio y el sello de portada',(await p.locator('#obras-lista .obra').first().innerText()).includes('Marina azul')&&(await p.locator('#obras-lista .obra').first().innerText()).includes('portada de la web'));
await p.screenshot({path:'cap-18-admin-obras.png',fullPage:true});
// tope de 6 fotos y volver sin guardar
await p.click('#obras-lista .obra .editar');await p.waitForSelector('#p-editar.visible');
await p.setInputFiles('#ed-archivos',['marina.jpg','mala.jpg','t-salaA.jpg','t-coromoto.jpg','t-salaB.jpg']);await p.waitForFunction(()=>document.querySelectorAll('#ed-fotos figure').length===6);
t('no pasa de 6 fotos',await p.locator('#ed-fotos figure').count()===6);
const n=(await estado()).cambios.length;await p.click('#b-ed-atras');await p.waitForSelector('#p-obras.visible');
t('volver sin guardar no envía nada',(await estado()).cambios.length===n);
await b.close();console.log(ok+' bien, '+mal+' mal');})();
