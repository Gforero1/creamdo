// Prueba del backend con dobles de los servicios de Google.
const fs=require('fs'),crypto=require('crypto'),vm=require('vm');
const props={},cache={},filas=[];let llamadas=[],respuesta={code:200,body:{steps:[{type:'model_output',content:[{type:'image',mime_type:'image/png',data:'A'.repeat(2000)}]}]}};
const bytes=b=>Array.from(b).map(x=>x>127?x-256:x);
const ctx={console:{error(){},log(){}},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>{props[k]=v}})},
 CacheService:{getScriptCache:()=>({get:k=>cache[k]||null,put:(k,v)=>{cache[k]=v},remove:k=>{delete cache[k]}})},
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
 Utilities:{getUuid:()=>crypto.randomUUID(),sleep(){},DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1},
  computeDigest:(a,t)=>bytes(crypto.createHash('sha256').update(t,'utf8').digest()),
  computeHmacSha256Signature:(v,k)=>bytes(crypto.createHmac('sha256',k).update(v).digest()),
  formatDate:()=> '2026-10-10'},
 UrlFetchApp:{fetch:(u,o)=>{llamadas.push({u,o});return{getResponseCode:()=>respuesta.code,getContentText:()=>JSON.stringify(respuesta.body)}}},
 SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:()=>({appendRow:r=>filas.push(r)})})},
 ContentService:{MimeType:{JSON:1},createTextOutput:t=>({setMimeType(){return this},t})}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('../apps-script/Code.gs','utf8'),ctx);
const post=o=>JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(o)}}).t);
let ok=0,mal=0;const t=(n,c)=>{c?ok++:(mal++,console.log('FALLA:',n))};
t('sin contraseña creada',post({accion:'entrar',clave:'x'}).ok===false);
props.PANEL_SAL='sal';props.PANEL_HUELLA=crypto.createHash('sha256').update('sal'+'clave-de-prueba').digest('hex');props.SECRETO_SESION='secreto';props.GEMINI_API_KEY='CLAVE-FALSA-DE-PRUEBA';
t('clave mala',post({accion:'entrar',clave:'no'}).ok===false);
const e=post({accion:'entrar',clave:'clave-de-prueba'});t('clave buena da token',e.ok&&/^\d+\.[0-9a-f]{64}$/.test(e.token));
const img='B'.repeat(5000);
t('sin token',post({accion:'integrar',tipo:'pintura',imagen:img}).error==='sesion');
t('token manipulado',post({accion:'integrar',token:(Date.now()+9e9)+'.'+e.token.split('.')[1],tipo:'pintura',imagen:img}).error==='sesion');
t('token caducado',post({accion:'integrar',token:'1.'+crypto.createHmac('sha256','secreto').update('1').digest('hex'),tipo:'pintura',imagen:img}).error==='sesion');
t('tipo no admitido',post({accion:'integrar',token:e.token,tipo:'otra',imagen:img}).ok===false);
t('imagen no base64',post({accion:'integrar',token:e.token,tipo:'pintura',imagen:'<script>'.repeat(300)}).ok===false);
const g=post({accion:'integrar',token:e.token,tipo:'pintura',imagen:img,titulo:'=HYPERLINK("x")',sala:'romanilla',anchoCm:150,altoCm:103});
t('integra y devuelve imagen',g.ok&&g.imagen.length===2000&&g.quedan===39);
t('la respuesta no contiene la clave',!JSON.stringify(g).includes('CLAVE-FALSA'));
t('llama a interactions con la clave en cabecera',llamadas.length===1&&llamadas[0].u.endsWith('/v1beta/interactions')&&llamadas[0].o.headers['x-goog-api-key']==='CLAVE-FALSA-DE-PRUEBA'&&!llamadas[0].u.includes('CLAVE'));
const pl=JSON.parse(llamadas[0].o.payload);t('instrucción fija del servidor',pl.input[0].text.startsWith('This is a photo of a room')&&pl.model==='gemini-nano-banana-2.1'&&pl.response_format.image_size==='2K');
t('registro saneado',filas.length===1&&filas[0][1].startsWith("'="));
respuesta={code:429,body:{error:{message:'quota CLAVE-FALSA-DE-PRUEBA'}}};const f=post({accion:'integrar',token:e.token,tipo:'pintura',imagen:img});
t('error de Gemini sin filtrar detalle',f.ok===false&&!JSON.stringify(f).includes('quota'));
props['USO_2026-10-10']='40';t('tope diario',post({accion:'integrar',token:e.token,tipo:'pintura',imagen:img}).error.includes('tope'));
for(let i=0;i<8;i++)post({accion:'entrar',clave:'no'});t('bloqueo tras 8 fallos',post({accion:'entrar',clave:'clave-de-prueba'}).error.includes('Demasiados'));
console.log(ok+' pruebas bien, '+mal+' mal');
