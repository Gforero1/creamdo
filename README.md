# Creamdo Art

Web pública de la galería (raíz del sitio) y panel privado para cargar obras (`/admin/`).

## Web pública

`index.html` y `tienda.js` leen el catálogo del backend (`?catalogo=1`) y lo pintan: obras, ficha de obra, artistas.
No hay carrito: cada obra abre WhatsApp con su nombre escrito. Solo salen obras en estado Publicada o Vendida.

### Dirección de diseño

Sale del logo de la marca, no de una plantilla:

- **Color:** blanco y negro, con las tres rayas del logo como acento: cian `#009ED8`, naranja `#F26122`, magenta `#EC1163`.
- **Tipografía:** una sola familia, Archivo (alojada en `marca/`). El peso grueso y ancho se usa solo en el logotipo; títulos en peso 300 o 600 y como mucho 42 px, para que mande la obra (como en webs de galerías: White Cube 48 px máximo, Freites 26 px).
- **Proporción:** obras en tres columnas desfasadas en escritorio (dos en tableta, una en móvil); la foto destacada y la de la ficha nunca pasan de la altura de la pantalla.
- **Movimiento:** solo tres gestos y ninguno con `prefers-reduced-motion`: las obras se descubren al entrar en pantalla, las tres rayas se trazan al cargar, y al abrir una obra la foto viaja de la pared a la ficha (View Transitions) y vuelve a su sitio al regresar.
- **Sin eslogan:** la portada dice quién es y dónde está, y enseña una obra.
- **Motivo:** rayas inclinadas 22 grados hacia la derecha al bajar (\\), igual que el monograma.
- **Retícula:** obras en dos columnas desfasadas; sin tarjetas, sombras ni esquinas redondeadas.
- **Textos:** los de la galería (bio de Instagram y tienda anterior) y datos reales de cada obra.

## Panel: esculturas y objetos

Una escultura no se puede enderezar con cuatro esquinas, así que va por otro camino. La regla es la misma: **la pieza nunca la dibuja la IA**.

1. La dueña sube la foto, escribe el alto real (con base) y elige el mueble: consola, aparador o pedestal.
2. El panel pide dos imágenes a la vez a Gemini:
   - **Silueta:** la misma foto con todo lo que no es la pieza pintado de verde.
   - **Entorno:** la misma foto con la pieza intacta y solo lo de alrededor cambiado por una sala. El texto lleva el alto real para que el mueble salga a escala; el mueble sale de una lista fija del backend.
3. El navegador comprueba la silueta contra la foto (misma posición) y luego la sala contra la foto dentro de la silueta, entera y en 64 trozos. Con las pruebas reales: una pieza respetada da 0,87 de parecido y ningún trozo malo; una redibujada da 0 y todos malos. Umbral: 0,75 y como mucho 10 % de trozos malos.
4. Si pasa, se pegan encima los píxeles de la foto original: la pieza no cambia de tamaño ni de sitio. Si no pasa, la sala se descarta y queda la pieza real sobre un fondo liso. Si ni la silueta es fiable, se guardan las fotos tal cual.

La escala del mueble respecto a la pieza la decide la IA a partir del alto que se le da; es lo único que no se puede medir. Por eso esa imagen sale en la web como "Imagen referencial".

Pruebas: `node pruebas/esculturas.js` (usa salidas reales de Gemini guardadas como archivos).

## Panel: obra en sala

Panel privado de Creamdo Art. Se sube la foto de una pintura, se marcan sus esquinas y sus medidas,
y el panel la coloca a escala en una sala. Una IA integra luz y sombra, y después el panel vuelve a
pegar la foto real encima, para que la obra publicada sea siempre la obra de verdad.

## Piezas

- `admin/index.html`, `admin/app.js`: las pantallas del panel.
- `admin/imagen.js`: enderezar, corregir luz, colocar a escala, localizar y repegar. Corre en el navegador.
- `admin/salas.js` y `admin/salas/`: las plantillas de sala y su calibración.
- `config.js`: la URL del backend. No es un secreto.
- `apps-script/`: backend que vive en una hoja de Google. Guarda la clave de Gemini y la
  contraseña del panel en las propiedades del script. Ninguna de las dos está en este repositorio.

## Puesta en marcha

1. Crear una hoja de Google y abrir Extensiones > Apps Script.
2. Pegar `apps-script/Code.gs` y, en Configuración del proyecto, mostrar `appsscript.json` y pegar el del repo.
3. Recargar la hoja. En el menú Creamdo: preparar la hoja, guardar la clave de Gemini y crear la contraseña.
4. Implementar > Nueva implementación > Aplicación web (ejecutar como yo, acceso cualquier usuario).
5. Copiar la URL que termina en `/exec` en `config.js`.

Sin URL en `config.js` el panel funciona igual, pero solo con el montaje sin IA.

## Seguridad

- La clave de Gemini solo existe en las propiedades del script. La web nunca la recibe.
- La contraseña se guarda como huella SHA-256 con sal. Ocho fallos bloquean diez minutos.
- La sesión es un token firmado que caduca a las 12 horas. Cambiar la contraseña cierra todas las sesiones.
- El texto que se le envía a la IA está fijo en el servidor: una sesión robada no puede pedirle otra cosa.
- Tope de 40 imágenes al día (`LIMITE_DIARIO` en `Code.gs`).

## Añadir una sala

Imagen de 1024 x 1536 en `salas/` (más su miniatura `-mini.jpg`) y una entrada en `salas.js` con las
líneas de techo y suelo de la pared, el alto real de la pared en cm y la zona donde puede ir una obra.

## Pruebas

`pruebas/servidor.js` sirve el panel y simula el backend con salidas reales de Gemini.
`pruebas/e2e.js` recorre el panel en un Pixel 7 emulado. `pruebas/backend.js` prueba `Code.gs` con dobles
de los servicios de Google. Las imágenes de prueba no se suben al repositorio.

## Pendiente

- Esculturas en sala: necesitan recorte de fondo y plantillas de primer plano. Hoy se guardan con sus fotos tal cual.
- El envío a Shopify está escrito en el backend pero sin uso: la cuenta actual no puede crear apps en esa tienda.
