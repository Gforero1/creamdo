// Obra pequeña: vista de cerca en vez de la sala entera.
const {chromium,devices}=require('playwright-core');
let ok=0,mal=0;const t=(n,c,x)=>{c?ok++:mal++;console.log((c?'bien  ':'FALLA ')+n+(x?'  '+x:''))};
(async()=>{
await fetch('http://localhost:8765/reiniciar');
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const c=await b.newContext({...devices['Pixel 7']});const p=await c.newPage();
p.on('pageerror',e=>{mal++;console.log('ERROR DE PAGINA',e.message)});
await p.route('**/config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.CREAMDO={API:'http://localhost:8765/api'};"}));
await p.goto('http://localhost:8765/admin/');await p.fill('#clave','prueba123');await p.click('#b-entrar');await p.waitForSelector('#p-inicio.visible');
const medir=()=>p.evaluate(()=>{const E=__panel.E,q=E.q,w=E.montaje.width,h=E.montaje.height;return{w,h,parte:(q[1][0]-q[0][0])/w,dentro:q.every(p=>p[0]>=0&&p[1]>=0&&p[0]<=w&&p[1]<=h)}});
const ir=async(ancho,alto,sala)=>{await p.click('#b-inicio');await p.click('#b-ini-cuadro');await p.setInputFiles('#archivo','marina.jpg');await p.waitForSelector('#p-esquinas.visible');await p.waitForTimeout(300);
  await p.click('#b-recortada');await p.waitForSelector('#p-medidas.visible');await p.fill('#ancho',String(ancho));await p.fill('#alto',String(alto));await p.waitForTimeout(500);
  await p.click('#b-med-sig');await p.waitForSelector('#p-sala.visible');await p.click('[data-sala='+sala+']');await p.waitForSelector('#sala-acciones:not(.oculto)');};
await ir(40,27,'colonial');
let m=await medir();console.log('   de cerca',JSON.stringify(m));
t('obra pequeña: se muestra de cerca por defecto',await p.locator('#b-cerca').isVisible()&&(await p.innerText('#b-cerca'))==='Ver la sala completa'&&m.parte>0.3&&m.parte<0.5&&m.dentro);
t('la vista de cerca es vertical y con buena resolución',Math.abs(m.h/m.w-1.25)<0.02&&m.w>=900);
await p.screenshot({path:'cap-22-cerca.png',fullPage:true});
await p.evaluate(()=>document.getElementById('c-montaje').toBlob(async b=>{window.__fin=new Uint8Array(await b.arrayBuffer())},'image/jpeg',0.9));await p.waitForTimeout(500);
require('fs').writeFileSync('cerca-montaje.jpg',Buffer.from(await p.evaluate(()=>Array.from(window.__fin))));
await p.click('#b-cerca');m=await medir();console.log('   completa',JSON.stringify(m));
t('se puede volver a la sala completa',(await p.innerText('#b-cerca'))==='Ver la obra de cerca'&&m.w===1024&&m.parte<0.25);
await p.click('#b-cerca');await p.click('#b-sin-ia');await p.waitForSelector('#p-resultado.visible');
t('el resultado sale con la vista de cerca',await p.evaluate(()=>{const c=document.getElementById('c-final');return Math.abs(c.height/c.width-1.25)<0.02}));
await ir(150,103,'romanilla');
t('obra grande: sin botón de cerca, sala entera',!(await p.locator('#b-cerca').isVisible())&&(await medir()).w===1024);
// salas para formatos pequeños
await ir(36,20,'repisa');let r=await medir();
t('repisa: una obra de 36 cm ocupa un tercio del ancho, sin recorte',r.w===1152&&r.parte>0.3&&r.parte<0.36&&!(await p.locator('#b-cerca').isVisible()),JSON.stringify(r));
await p.click('[data-sala=rincon]');await p.waitForTimeout(600);r=await medir();t('rincón: la obra cabe y queda dentro de la pared libre',r.dentro&&r.parte>0.18);
await p.click('[data-sala=escritorio]');await p.waitForTimeout(600);r=await medir();t('escritorio: la obra cabe',r.dentro&&r.parte>0.2);
await ir(150,103,'romanilla');t('obra grande: las salas pequeñas se desactivan solas',await p.evaluate(()=>['rincon','escritorio','repisa'].every(s=>document.querySelector('[data-sala='+s+']').disabled)));
await b.close();console.log(ok+' bien, '+mal+' mal');})();
