const {chromium,devices}=require('playwright-core');const fs=require('fs');
let ok=0,mal=0;const t=(n,c,extra)=>{c?ok++:mal++;console.log((c?'bien  ':'FALLA ')+n+(extra?'  '+extra:''))};
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const nueva=async(api)=>{const c=await b.newContext({...devices['Pixel 7']});const p=await c.newPage();
  p.on('pageerror',e=>{mal++;console.log('ERROR DE PAGINA',e.message)});
  await p.route('**/config.js*',r=>r.fulfill({contentType:'text/javascript',body:`window.CREAMDO={API:${JSON.stringify(api)}};`}));
  await p.goto('http://localhost:8765/admin/');return p;};
const visible=(p,id)=>p.evaluate(i=>document.getElementById(i).classList.contains('visible'),id);
const textoAvisos=(p,id)=>p.evaluate(i=>document.getElementById(i).innerText,id);

// --- 1. obra con foto limpia ---
await fetch('http://localhost:8765/reiniciar');
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
// guardar en el catálogo
t('título y artista ya rellenos',await p.inputValue('#cat-titulo')==='Marina'&&await p.inputValue('#cat-artista')==='Enrique Lobo');
await p.fill('#cat-precio','1000');await p.fill('#cat-tecnica','Acrílico sobre lienzo');await p.click('#b-catalogo');
await p.waitForSelector('#cat-avisos .bien');
t('guarda como borrador y lo dice',(await textoAvisos(p,'cat-avisos')).includes('borrador'));
t('no deja guardar dos veces',await p.evaluate(()=>document.getElementById('b-catalogo').disabled));
await p.screenshot({path:'cap-10-catalogo.png',fullPage:true});
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
// escultura: fotos tal cual
await p.reload();await p.waitForSelector('#p-foto.visible');await p.setInputFiles('#archivos-obj',['marina.jpg','mala.jpg']);await p.waitForSelector('#p-objeto.visible');
t('escultura: enseña las dos fotos',await p.evaluate(()=>document.querySelectorAll('#obj-fotos img').length)===2);
await p.click('#b-obj-guardar');t('escultura: pide título y artista',(await textoAvisos(p,'obj-avisos')).includes('título'));
await p.fill('#obj-titulo','Virgen de Coromoto');await p.fill('#obj-artista','María Lea Cerdá');await p.click('#b-obj-guardar');
t('escultura: pide el alto',(await textoAvisos(p,'obj-avisos')).includes('alto'));
await p.fill('#obj-alto','20');await p.fill('#obj-ancho','12');await p.fill('#obj-precio','115');await p.check('#obj-publicar');await p.click('#b-obj-guardar');await p.waitForSelector('#obj-avisos .bien');
t('escultura: guardada y publicada',(await textoAvisos(p,'obj-avisos')).includes('publicada'));
await p.screenshot({path:'cap-11-objeto.png',fullPage:true});
// lista de obras
await p.click('#b-ver-obras');await p.waitForSelector('#obras-lista .obra');
t('lista: dos obras, la última primero',await p.evaluate(()=>[...document.querySelectorAll('#obras-lista .obra b')].map(b=>b.textContent).join('|'))==='Virgen de Coromoto|Marina');
await p.selectOption('#obras-lista .obra:nth-child(2) select','Publicada');await p.waitForSelector('#obras-avisos .bien');
const lista=await (await fetch('http://localhost:8765/api',{method:'POST',body:JSON.stringify({accion:'listarObras',token:await p.evaluate(()=>__panel.E.token)})})).json();
t('lista: el cambio de estado llega al servidor',lista.obras[1].estado==='Publicada'&&lista.obras[1]._tam.length===2&&lista.obras[0].tipo==='Escultura',JSON.stringify(lista.obras.map(o=>[o.titulo,o.estado,o._tam])));
await p.screenshot({path:'cap-12-obras.png',fullPage:true});
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
