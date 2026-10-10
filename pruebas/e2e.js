const {chromium,devices}=require('playwright-core');const fs=require('fs');
let ok=0,mal=0;const t=(n,c,extra)=>{c?ok++:mal++;console.log((c?'bien  ':'FALLA ')+n+(extra?'  '+extra:''))};
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const nueva=async(api)=>{const c=await b.newContext({...devices['Pixel 7']});const p=await c.newPage();
  p.on('pageerror',e=>{mal++;console.log('ERROR DE PAGINA',e.message)});
  await p.route('**/config.js',r=>r.fulfill({contentType:'text/javascript',body:`window.CREAMDO={API:${JSON.stringify(api)}};`}));
  await p.goto('http://localhost:8765/');return p;};
const visible=(p,id)=>p.evaluate(i=>document.getElementById(i).classList.contains('visible'),id);
const textoAvisos=(p,id)=>p.evaluate(i=>document.getElementById(i).innerText,id);

// --- 1. obra con foto limpia ---
let p=await nueva('http://localhost:8765/api');
t('arranca en acceso',await visible(p,'p-entrar'));
await p.fill('#clave','mala');await p.click('#b-entrar');await p.waitForSelector('#entrar-error:not(.oculto)');
t('clave mala muestra error',(await p.innerText('#entrar-error')).includes('incorrecta'));
await p.screenshot({path:'cap-1-entrar.png'});
await p.fill('#clave','prueba123');await p.click('#b-entrar');await p.waitForSelector('#p-foto.visible');
await p.screenshot({path:'cap-2-foto.png'});
await p.setInputFiles('#archivo','marina.jpg');await p.waitForSelector('#p-esquinas.visible');await p.waitForTimeout(300);
console.log('   nitidez foto limpia',Math.round(await p.evaluate(()=>__panel.E.nitidez)));
await p.screenshot({path:'cap-3-esquinas.png'});
await p.click('#b-recortada');await p.waitForSelector('#p-medidas.visible');
await p.fill('#ancho','60');await p.fill('#alto','150');await p.waitForTimeout(500);
t('avisa si las medidas no cuadran con la foto',(await textoAvisos(p,'med-avisos')).includes('no coinciden'));
await p.fill('#ancho','150');await p.fill('#alto','103');await p.waitForTimeout(500);
t('medidas correctas sin aviso',(await textoAvisos(p,'med-avisos'))==='');
await p.fill('#titulo','Marina');await p.fill('#artista','Enrique Lobo');
await p.screenshot({path:'cap-4-medidas.png',fullPage:true});
await p.click('#b-med-sig');await p.waitForSelector('#p-sala.visible');
await p.click('[data-sala=romanilla]');await p.waitForSelector('#sala-acciones:not(.oculto)');
await p.screenshot({path:'cap-5-sala.png',fullPage:true});
await p.click('#b-integrar');await p.waitForSelector('#p-resultado.visible',{timeout:60000});
let v=await p.evaluate(()=>({...__panel.E.verificacion,ia:__panel.E.conIA,w:__panel.E.final.width,h:__panel.E.final.height}));
t('integra con IA y repega la obra',v.ia&&v.w===1684,JSON.stringify(v));
t('mensaje de obra verificada',(await textoAvisos(p,'res-avisos')).includes('tu foto'));
await p.screenshot({path:'cap-6-resultado.png',fullPage:true});
fs.writeFileSync('e2e-final-romanilla.jpg',Buffer.from((await p.evaluate(()=>__panel.E.final.toDataURL('image/jpeg',.92))).split(',')[1],'base64'));
const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#b-descargar')]);
t('nombre de archivo',dl.suggestedFilename()==='creamdo-marina-romanilla.jpg',dl.suggestedFilename());
// enviar a Shopify
t('título y artista ya rellenos',await p.inputValue('#sh-titulo')==='Marina'&&await p.inputValue('#sh-artista')==='Enrique Lobo');
await p.fill('#sh-precio','1000');await p.fill('#sh-tecnica','Acrílico sobre lienzo');await p.click('#b-shopify');
await p.waitForSelector('#sh-avisos .bien');
t('envía a Shopify y enseña el enlace',(await textoAvisos(p,'sh-avisos')).includes('borrador')&&await p.evaluate(()=>document.querySelector('#sh-avisos a').href)==='https://admin.shopify.com/store/creamdo/products/123');
const ult=await (await fetch('http://localhost:8765/api/ultima',{method:'POST',body:'{}'})).json();
t('manda la obra real y la escena',ult.n===2&&ult.precio===1000&&ult.tipo==='Pintura',JSON.stringify(ult));
t('no deja enviar dos veces',await p.evaluate(()=>document.getElementById('b-shopify').disabled));
await p.screenshot({path:'cap-10-shopify.png',fullPage:true});
// otra sala donde la IA devuelve una escena que no corresponde: debe descartarla
t('sala pequeña desactivada para obra de 150 cm',await p.evaluate(()=>document.querySelector('[data-sala=colonial]').disabled));
await p.route('**/api',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,mime:'image/png',imagen:fs.readFileSync('gemini-A.png').toString('base64')})}));
await p.click('#b-otra-sala');await p.click('[data-sala=penthouse]');await p.waitForTimeout(900);
await p.click('#b-integrar');await p.waitForSelector('#p-resultado.visible',{timeout:60000});
v=await p.evaluate(()=>({...__panel.E.verificacion,ia:__panel.E.conIA}));
t('descarta la escena si la obra no está donde debe',!v.ia&&(await textoAvisos(p,'res-avisos')).includes('descartó'),JSON.stringify(v));
await p.unroute('**/api');
// obra enorme
await p.click('#b-nueva');await p.setInputFiles('#archivo','marina.jpg');await p.waitForSelector('#p-esquinas.visible');await p.click('#b-recortada');
await p.fill('#ancho','380');await p.fill('#alto','261');await p.waitForTimeout(500);await p.click('#b-med-sig');await p.waitForSelector('#p-sala.visible');
t('obra enorme: ninguna sala disponible',await p.evaluate(()=>!document.querySelector('#salas button:not(:disabled)'))&&(await textoAvisos(p,'sala-avisos')).includes('no cabe'));
await p.context().close();

// --- 2. foto mala ---
p=await nueva('http://localhost:8765/api');await p.fill('#clave','prueba123');await p.click('#b-entrar');await p.waitForSelector('#p-foto.visible');
await p.setInputFiles('#archivo','mala.jpg');await p.waitForSelector('#p-esquinas.visible');
console.log('   nitidez foto mala',Math.round(await p.evaluate(()=>__panel.E.nitidez)),'| avisos:',await textoAvisos(p,'esq-avisos'));
await p.evaluate(()=>__panel.ponerEsquinas([[1290,150],[330,250],[300,860],[1330,930]]));   // desordenadas a propósito
await p.waitForTimeout(200);await p.screenshot({path:'cap-7-mala-esquinas.png'});
await p.click('#b-esq-sig');await p.waitForSelector('#p-medidas.visible');
await p.fill('#ancho','150');await p.fill('#alto','103');await p.waitForTimeout(600);
t('foto con pared: ofrece corregir color',await p.evaluate(()=>!document.getElementById('l-color').classList.contains('oculto')));
await p.screenshot({path:'cap-8-mala-medidas.png',fullPage:true});
await p.click('#b-med-sig');await p.click('[data-sala=comedor]');await p.waitForSelector('#sala-acciones:not(.oculto)');
await p.click('#b-integrar');await p.waitForSelector('#p-resultado.visible',{timeout:60000});
v=await p.evaluate(()=>({...__panel.E.verificacion,ia:__panel.E.conIA}));
t('foto mala: integra y repega',v.ia,JSON.stringify(v));
fs.writeFileSync('e2e-final-comedor.jpg',Buffer.from((await p.evaluate(()=>__panel.E.final.toDataURL('image/jpeg',.92))).split(',')[1],'base64'));
await p.context().close();

// --- 3. foto cortada ---
p=await nueva('');t('sin backend arranca en foto, sin acceso',await visible(p,'p-foto'));
await p.setInputFiles('#archivo','cortada.jpg');await p.waitForSelector('#p-esquinas.visible');
console.log('   nitidez foto de eBay',Math.round(await p.evaluate(()=>__panel.E.nitidez)));
await p.evaluate(()=>__panel.ponerEsquinas([[130,205],[1600,290],[1600,1040],[110,1070]]));
await p.click('#b-esq-sig');await p.waitForTimeout(200);
t('obra cortada: bloquea y explica',await visible(p,'p-esquinas')&&(await textoAvisos(p,'esq-avisos')).includes('cortada'));
await p.screenshot({path:'cap-9-cortada.png'});
await p.evaluate(()=>__panel.ponerEsquinas([[130,205],[1500,290],[1500,1040],[110,1070]]));await p.click('#b-esq-sig');await p.waitForSelector('#p-medidas.visible');
await p.fill('#ancho','120');await p.fill('#alto','50');await p.waitForTimeout(500);await p.click('#b-med-sig');await p.click('[data-sala=penthouse]');await p.waitForSelector('#sala-acciones:not(.oculto)');
t('sin backend: botón de IA apagado',await p.evaluate(()=>document.getElementById('b-integrar').disabled));
await p.click('#b-sin-ia');await p.waitForSelector('#p-resultado.visible');t('sin IA llega al resultado',true);
await p.context().close();
await b.close();console.log(ok+' bien, '+mal+' mal');})();
