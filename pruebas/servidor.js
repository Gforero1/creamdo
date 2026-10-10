// Servidor de pruebas: sirve el panel y simula el backend devolviendo salidas reales de Gemini.
const http=require('http'),fs=require('fs'),path=require('path');
const raiz=path.join(__dirname,'..');const tipos={'.html':'text/html; charset=utf-8','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.css':'text/css','.json':'application/json'};
let escena='gemini-A.png';
http.createServer((q,r)=>{
  if(q.url.startsWith('/api')){let b='';q.on('data',d=>b+=d);q.on('end',()=>{let j={};try{j=JSON.parse(b)}catch(e){}
    r.setHeader('Content-Type','application/json');r.setHeader('Access-Control-Allow-Origin','*');
    if(j.accion==='entrar')return r.end(JSON.stringify(j.clave==='prueba123'?{ok:true,token:(globalThis.tk=(Date.now()+3600e3)+'.abc')}:{ok:false,error:'Clave incorrecta'}));
    if(j.accion==='integrar'){if(j.token!==globalThis.tk)return r.end(JSON.stringify({ok:false,error:'sesion'}));
      const f=j.sala==='penthouse'?'gemini-B.png':j.sala==='comedor'?'gemini-D.png':'gemini-A.png';
      return r.end(JSON.stringify({ok:true,mime:'image/png',imagen:fs.readFileSync(path.join(__dirname,f)).toString('base64'),quedan:39}));}
    if(j.accion==='publicar'){if(j.token!==globalThis.tk)return r.end(JSON.stringify({ok:false,error:'sesion'}));globalThis.ultima=j;
      return r.end(JSON.stringify({ok:true,titulo:j.titulo+' - '+j.artista,enlace:'https://admin.shopify.com/store/creamdo/products/123',aviso:''}));}
    if(q.url.startsWith('/api/ultima'))return r.end(JSON.stringify({n:(globalThis.ultima||{imagenes:[]}).imagenes.length,alts:(globalThis.ultima||{imagenes:[]}).imagenes.map(x=>x.alt),tam:(globalThis.ultima||{imagenes:[]}).imagenes.map(x=>x.datos.length),precio:(globalThis.ultima||{}).precio,tipo:(globalThis.ultima||{}).tipoObra}));
    r.end(JSON.stringify({ok:false,error:'accion'}));});return;}
  const f=path.join(raiz,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));
  fs.readFile(f,(e,d)=>{if(e){r.statusCode=404;return r.end('no')}r.setHeader('Content-Type',tipos[path.extname(f)]||'application/octet-stream');r.end(d)});
}).listen(8765,()=>console.log('listo'));
