// Flujo de esculturas con salidas reales de Gemini guardadas como archivos (no llama a la IA).
const {chromium,devices}=require('playwright-core');
let ok=0,mal=0;const t=(n,c,x)=>{c?ok++:mal++;console.log((c?'bien  ':'FALLA ')+n+(x?'  '+x:''))};
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const c=await b.newContext({...devices['Pixel 7']});const p=await c.newPage();
p.on('pageerror',e=>{mal++;console.log('ERROR DE PAGINA',e.message)});
await p.route('**/config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.CREAMDO={API:'http://localhost:8765/api'};"}));
await p.goto('http://localhost:8765/admin/');await p.fill('#clave','prueba123');await p.click('#b-entrar');await p.waitForSelector('#p-inicio.visible');
const texto=id=>p.evaluate(i=>document.getElementById(i).innerText,id);
const veri=()=>p.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(__panel.E.verificacionObjeto||{}).map(([k,v])=>[k,Math.round(v*1000)/1000]))));
await fetch('http://localhost:8765/reiniciar');
const estado=async()=>(await (await fetch('http://localhost:8765/pedidas')).json());

// 1. pieza que la IA respeta: sala con la pieza real pegada encima
await p.setInputFiles('#archivos-obj',['esc-caja.jpg']);await p.waitForSelector('#p-objeto.visible');
await p.fill('#obj-titulo','Caja pintada');await p.fill('#obj-artista','Prueba');
await p.click('#b-ambientar');t('sin alto no se ambienta',(await texto('amb-avisos')).includes('alto'));
await p.fill('#obj-alto','40');await p.selectOption('#obj-mueble','aparador');await p.click('#b-ambientar');
await p.waitForSelector('#amb-marco:not(.oculto)',{timeout:60000});
console.log('   caja',await veri());
t('caja: queda en sala',(await texto('amb-nota')).includes('Imagen referencial'));
let e=await estado();t('caja: dos peticiones, con mueble y alto',e.pedidas.length===2&&e.pedidas.some(x=>x.tipo==='mascara')&&e.pedidas.some(x=>x.tipo==='entorno'&&x.mueble==='aparador'&&x.altoCm===40));
// la pieza del resultado es la de la foto: se compara el centro de la pieza con el original
const dif=await p.evaluate(async()=>{const I=window.Imagen,E=__panel;const fin=document.getElementById('c-amb');
  const img=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src='/pruebas/esc-caja.jpg'});
  const w=400,h=Math.round(400*fin.height/fin.width);const a=I.escalar(fin,w,h).getContext('2d').getImageData(0,0,w,h).data;
  const oc=I.lienzo(w,h);oc.getContext('2d').drawImage(img,0,0,w,h);const o=oc.getContext('2d').getImageData(0,0,w,h).data;
  let s=0,n=0;for(let y=h*0.35|0;y<h*0.6;y++)for(let x=w*0.35|0;x<w*0.55;x++){const i=(y*w+x)*4;s+=Math.abs(a[i]-o[i])+Math.abs(a[i+1]-o[i+1])+Math.abs(a[i+2]-o[i+2]);n+=3}
  let f=0,m=0;for(let y=0;y<h*0.12;y++)for(let x=0;x<w*0.2;x++){const i=(y*w+x)*4;f+=Math.abs(a[i]-o[i])+Math.abs(a[i+1]-o[i+1])+Math.abs(a[i+2]-o[i+2]);m+=3}
  return {pieza:s/n,fondo:f/m}});
console.log('   diferencia media con la foto original: pieza',dif.pieza.toFixed(1),'fondo',dif.fondo.toFixed(1));
t('caja: los píxeles de la pieza son los de la foto',dif.pieza<6);t('caja: el fondo sí cambió',dif.fondo>25);
await p.screenshot({path:'cap-13-escultura-sala.png',fullPage:true});
await p.evaluate(()=>document.getElementById('c-amb').toBlob(async b=>{window.__fin=new Uint8Array(await b.arrayBuffer())},'image/jpeg',0.9));await p.waitForTimeout(600);
require('fs').writeFileSync('esc-caja-final.jpg',Buffer.from(await p.evaluate(()=>Array.from(window.__fin))));
await p.click('#b-obj-guardar');await p.waitForSelector('#obj-avisos .bien');
e=await estado();let o=e.obras[e.obras.length-1];t('caja: se guardan foto real y sala, la sala al final',o.imagenes.length===2&&o._enSala===1);

// 2. pieza que la IA redibuja: se descarta la sala y queda el fondo limpio
await p.click('#b-obj-atras');await p.setInputFiles('#archivos-obj',['esc-cubos.jpg']);await p.waitForSelector('#p-objeto.visible');
t('foto nueva: se borra la imagen anterior',await p.evaluate(()=>document.getElementById('amb-marco').classList.contains('oculto')));
await p.fill('#obj-titulo','Cubos');await p.fill('#obj-artista','Prueba');await p.fill('#obj-alto','55');await p.selectOption('#obj-mueble','consola');await p.click('#b-ambientar');
await p.waitForSelector('#amb-marco:not(.oculto)',{timeout:60000});
console.log('   cubos',await veri());
t('cubos: la sala se descarta',(await texto('amb-nota')).includes('fondo limpio'));
await p.screenshot({path:'cap-14-escultura-estudio.png',fullPage:true});
await p.evaluate(()=>document.getElementById('c-amb').toBlob(async b=>{window.__fin=new Uint8Array(await b.arrayBuffer())},'image/jpeg',0.9));await p.waitForTimeout(600);
require('fs').writeFileSync('esc-cubos-final.jpg',Buffer.from(await p.evaluate(()=>Array.from(window.__fin))));
await p.click('#b-obj-guardar');await p.waitForSelector('#obj-avisos .bien');
e=await estado();o=e.obras[e.obras.length-1];t('cubos: fondo limpio va primero y no cuenta como sala',o.imagenes.length===2&&o._enSala===0);

// 3. la sala falla en el servidor: la silueta sirve igual
await p.click('#b-obj-atras');await p.setInputFiles('#archivos-obj',['esc-caja.jpg']);await p.waitForSelector('#p-objeto.visible');
await p.fill('#obj-titulo','Caja sinsala');await p.fill('#obj-artista','Prueba');await p.fill('#obj-alto','40');await p.click('#b-ambientar');
await p.waitForSelector('#amb-marco:not(.oculto)',{timeout:60000});
t('sin sala: queda el fondo limpio',(await texto('amb-nota')).includes('fondo limpio'));
await p.click('#b-amb-quitar');t('se puede quitar la imagen',await p.evaluate(()=>document.getElementById('amb-marco').classList.contains('oculto')));

// 4. silueta que no corresponde a la foto: no se inventa nada
await p.click('#b-obj-atras');await p.setInputFiles('#archivos-obj',['marina.jpg']);await p.waitForSelector('#p-objeto.visible');
await p.fill('#obj-titulo','Otra');await p.fill('#obj-artista','Prueba');await p.fill('#obj-alto','40');await p.click('#b-ambientar');
await p.waitForSelector('#amb-avisos .aviso',{timeout:60000});
console.log('   foto ajena',await veri());
t('silueta ajena: avisa y no genera imagen',(await texto('amb-avisos')).includes('No se pudo separar')&&await p.evaluate(()=>document.getElementById('amb-marco').classList.contains('oculto')));
await b.close();console.log(ok+' bien, '+mal+' mal');})();
