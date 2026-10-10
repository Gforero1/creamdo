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
// ---- Shopify ----
(function(){
  delete props['USO_2026-10-10'];delete cache.fallos;
  const e=post({accion:'entrar',clave:'clave-de-prueba'});let ok2=0,mal2=0;const t2=(n,c)=>{c?ok2++:(mal2++,console.log('FALLA:',n))};
  const img='C'.repeat(4000);const base={accion:'publicar',token:e.token,titulo:'Marina <b>',artista:'Enrique Lobo',tipoObra:'Pintura',tecnica:'Acrílico',precio:1000,anchoCm:150,altoCm:103,imagenes:[{datos:img,alt:'a'},{datos:img,alt:'b'}]};
  t2('sin conectar avisa',post(base).error.includes('conectado'));
  props.SHOPIFY_TIENDA='creamdo.myshopify.com';props.SHOPIFY_CLIENT_ID='id-de-prueba-0000000';props.SHOPIFY_CLIENT_SECRET='SECRETO-FALSO-SHOPIFY';
  const vistas=[];
  ctx.Utilities.base64Decode=s=>Array.from(Buffer.from(s,'base64'));ctx.Utilities.newBlob=(b,m,n)=>({blob:true,n});
  ctx.UrlFetchApp.fetch=(u,o)=>{vistas.push({u,o});let body={},code=200;
    if(u.endsWith('/admin/oauth/access_token'))body={access_token:'TOKEN-TEMPORAL',expires_in:86399};
    else if(u.includes('/graphql.json')){const q=JSON.parse(o.payload);
      if(q.query.includes('stagedUploadsCreate'))body={data:{stagedUploadsCreate:{userErrors:[],stagedTargets:q.variables.input.map((x,i)=>({url:'https://subida.example/'+i,resourceUrl:'https://subida.example/r'+i,parameters:[{name:'key',value:'k'+i}]}))}}};
      else if(q.query.includes('productCreate'))body={data:{productCreate:{userErrors:[],product:{id:'gid://shopify/Product/987',handle:'marina',title:q.variables.product.title,status:'DRAFT',variants:{nodes:[{id:'gid://shopify/ProductVariant/1'}]}}}}};
      else body={data:{productVariantsBulkUpdate:{userErrors:[],productVariants:[{id:'x',price:'1000.00'}]}}};}
    else code=201;
    return{getResponseCode:()=>code,getContentText:()=>JSON.stringify(body)}};
  const r=post(base);
  t2('crea el borrador',r.ok&&r.enlace==='https://admin.shopify.com/store/creamdo/products/987');
  const pc=JSON.parse(vistas.find(v=>v.o.payload&&typeof v.o.payload==='string'&&v.o.payload.includes('productCreate')).o.payload).variables;
  t2('borrador, título saneado y dos imágenes',pc.product.status==='DRAFT'&&pc.product.title==='Marina b - Enrique Lobo'&&pc.media.length===2&&!pc.product.descriptionHtml.includes('<b>'));
  t2('medidas en la descripción',pc.product.descriptionHtml.includes('103 cm de alto por 150 cm de ancho'));
  t2('token en cabecera, no en la URL',vistas.filter(v=>v.u.includes('graphql')).every(v=>v.o.headers['X-Shopify-Access-Token']==='TOKEN-TEMPORAL'&&!v.u.includes('TOKEN')));
  t2('la respuesta no contiene secretos',!JSON.stringify(r).includes('SECRETO')&&!JSON.stringify(r).includes('TOKEN-TEMPORAL'));
  t2('pide el token una sola vez',vistas.filter(v=>v.u.endsWith('access_token')).length===1);
  t2('sin título no envía',post({...base,titulo:''}).ok===false);
  t2('sin sesión no envía',post({...base,token:'x'}).error==='sesion');
  console.log('Shopify: '+ok2+' pruebas bien, '+mal2+' mal');
})();
