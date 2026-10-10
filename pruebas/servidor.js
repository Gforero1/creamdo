// Servidor de pruebas: sirve el panel y simula el backend devolviendo salidas reales de Gemini.
const http=require('http'),fs=require('fs'),path=require('path');
const raiz=path.join(__dirname,'..');const tipos={'.html':'text/html; charset=utf-8','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml'};
let escena='gemini-A.png';
http.createServer((q,r)=>{
  if(q.url==='/reiniciar'){globalThis.pedidas=[];globalThis.obras=[];globalThis.cambios=[];globalThis.perdidas=0;globalThis.vistos={};return r.end('ok');}
  if(q.url==='/pedidas'){r.setHeader('Content-Type','application/json');return r.end(JSON.stringify({pedidas:globalThis.pedidas||[],obras:globalThis.obras||[],cambios:globalThis.cambios||[],perdidas:globalThis.perdidas||0}));}
  if(q.url.startsWith('/api')){let b='';q.on('data',d=>b+=d);q.on('end',()=>{let j={};try{j=JSON.parse(b)}catch(e){}
    r.setHeader('Content-Type','application/json');r.setHeader('Access-Control-Allow-Origin','*');
    globalThis.vistos=globalThis.vistos||{};if(j.pid){globalThis.vistos[j.pid]=(globalThis.vistos[j.pid]||0)+1;}
    // simula la respuesta perdida de Google: la primera vez de cada petición marcada con 'pierde' llega la portada del servicio
    if(j.pid&&/pierde/i.test(j.titulo||'')&&globalThis.vistos[j.pid]===1&&j.accion==='integrar'){globalThis.perdidas=(globalThis.perdidas||0)+1;return r.end(JSON.stringify({ok:true,servicio:'creamdo-admin'}));}
    if(j.accion==='entrar'&&j.clave==='html'){r.setHeader('Content-Type','text/html');return r.end('<html><body>Error</body></html>');}
    if(j.accion==='entrar'&&j.clave==='portada')return r.end(JSON.stringify({ok:true,servicio:'creamdo-admin'}));
    if(j.accion==='entrar')return r.end(JSON.stringify(j.clave==='prueba123'?{ok:true,token:(globalThis.tk=(Date.now()+3600e3)+'.abc')}:{ok:false,error:'Clave incorrecta'}));
    if(j.accion==='integrar'){if(j.token!==globalThis.tk)return r.end(JSON.stringify({ok:false,error:'sesion'}));
      globalThis.pedidas=globalThis.pedidas||[];globalThis.pedidas.push({tipo:j.tipo,mueble:j.mueble,altoCm:j.altoCm});
      if(j.tipo==='mascara'||j.tipo==='entorno'){const pieza=/cubos/i.test(j.titulo||'')?'cubos':'caja';
        if(/sinsala/i.test(j.titulo||'')&&j.tipo==='entorno')return r.end(JSON.stringify({ok:false,error:'La IA no devolvió una imagen (código 500)'}));
        if(/pierde/i.test(j.titulo||''))return r.end(JSON.stringify({ok:true,archivo:'esc-'+pieza+(j.tipo==='mascara'?'-mascara':'-sala'),quedan:30}));
        return r.end(JSON.stringify({ok:true,mime:'image/jpeg',imagen:fs.readFileSync(path.join(__dirname,'esc-'+pieza+(j.tipo==='mascara'?'-mascara':'-sala')+'.jpg')).toString('base64'),quedan:30}));}
      const f=j.sala==='penthouse'?'gemini-B.png':j.sala==='comedor'?'gemini-D.png':'gemini-A.png';
      return r.end(JSON.stringify({ok:true,mime:'image/png',imagen:fs.readFileSync(path.join(__dirname,f)).toString('base64'),quedan:39}));}
    globalThis.obras=globalThis.obras||[];
    if(['guardarObra','listarObras','cambiarObra'].includes(j.accion)&&j.token!==globalThis.tk)return r.end(JSON.stringify({ok:false,error:'sesion'}));
    if(j.accion==='guardarObra'){const o={id:'o'+globalThis.obras.length,estado:j.estado,titulo:j.titulo,artista:j.artista,tipo:j.tipoObra,tecnica:j.tecnica,anchoCm:j.anchoCm,altoCm:j.altoCm,fondoCm:j.fondoCm||0,precio:j.precio,imagenes:j.imagenes.map((x,n)=>'idfalso'+n+'xxxxxxxx'),_tam:j.imagenes.map(x=>x.datos.length),_enSala:j.enSala||0,enSala:j.enSala||0};globalThis.obras.push(o);
      return r.end(JSON.stringify({ok:true,id:o.id,estado:o.estado,titulo:o.titulo}));}
    if(j.accion==='listarObras')return r.end(JSON.stringify({ok:true,obras:globalThis.obras.slice().reverse()}));
    if(j.accion==='cambiarObra'){const o=globalThis.obras.find(x=>x.id===j.id);if(!o)return r.end(JSON.stringify({ok:false,error:'No se encontró la obra'}));globalThis.cambios=(globalThis.cambios||[]);globalThis.cambios.push(JSON.parse(JSON.stringify(j,(k,v)=>k==='datos'?'(foto '+String(v).length+')':v)));for(const k of ['estado','precio','titulo','artista','tecnica','altoCm','anchoCm','fondoCm','destacada'])if(j[k]!==undefined)o[k]=j[k];if(j.tipoObra!==undefined)o.tipo=j.tipoObra;if(j.imagenes){o.imagenes=j.imagenes.map((x,n)=>x.id||('idnueva'+n+'xxxxxxxx'));o.enSala=j.enSala||0}return r.end(JSON.stringify({ok:true}));}
    r.end(JSON.stringify({ok:false,error:'accion'}));});return;}
  const f=path.join(raiz,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));
  fs.readFile(f,(e,d)=>{if(e){r.statusCode=404;return r.end('no')}r.setHeader('Content-Type',tipos[path.extname(f)]||'application/octet-stream');r.end(d)});
}).listen(8765,()=>console.log('listo'));
