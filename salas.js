// Plantillas de sala. Todas miden 1024 x 1536 px.
// techo(x) y suelo(x): líneas donde la pared toca el techo y el suelo (dan la perspectiva).
// paredCm: alto real de esa pared. De ahí sale la escala en cada punto.
// zona: rectángulo [x0, y0, x1, y1] donde puede ir una obra sin tapar muebles ni salirse.
// sombra: desplazamiento de la sombra según por dónde entra la luz.
window.SALAS = [
  {
    id: 'romanilla', nombre: 'Sala con romanilla', nota: 'Pinturas medianas sobre el aparador',
    techo: [176.7, -0.0711], suelo: [1084.7, 0.0325], paredCm: 253,
    centroX: 540, centroCm: 150, zona: [120, 190, 985, 930], sombra: [9, 7]
  },
  {
    id: 'penthouse', nombre: 'Penthouse con vista al mar', nota: 'Obras grandes sobre el sofá',
    techo: [230, 0], suelo: [975, 0], paredCm: 219,
    centroX: 555, centroCm: 140, zona: [110, 250, 950, 770], sombra: [-6, 8]
  },
  {
    id: 'colonial', nombre: 'Casa colonial', nota: 'Arte sacro, retablos y formatos pequeños',
    techo: [20, 0], suelo: [1175, 0], paredCm: 207,
    centroX: 550, centroCm: 140, zona: [190, 60, 900, 840], sombra: [8, 8]
  },
  {
    id: 'comedor', nombre: 'Comedor con bloques calados', nota: 'Formatos medianos y verticales',
    techo: [105, 0], suelo: [1010, 0], paredCm: 255,
    centroX: 500, centroCm: 150, zona: [80, 120, 930, 820], sombra: [-7, 8]
  }
];
