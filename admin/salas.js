// Plantillas de sala. Las cuatro primeras miden 1024 x 1536 px; las de formato pequeño, 1152 x 1536.
// En las de formato pequeño no se ve el techo (y a veces ni el suelo): techo y suelo son líneas calculadas
// para que la escala salga de los objetos de la foto (mesita de unos 45 cm, escritorio de 110, repisa de 80).
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
  },
  {
    id: 'rincon', nombre: 'Rincón con mesita', nota: 'Formatos pequeños, de 25 a 70 cm',
    techo: [-220, 0], suelo: [1380, 0], paredCm: 250,
    centroX: 576, centroCm: 102, zona: [80, 60, 1072, 880], sombra: [7, 7], maxCm: 90
  },
  {
    id: 'escritorio', nombre: 'Escritorio', nota: 'Formatos pequeños sobre la mesa de trabajo',
    techo: [-550, 0], suelo: [1400, 0], paredCm: 250,
    centroX: 540, centroCm: 108, zona: [60, 40, 1092, 780], sombra: [7, 7], maxCm: 90
  },
  {
    id: 'repisa', nombre: 'Repisa', nota: 'Miniaturas y obras de menos de 40 cm',
    techo: [-280, 0], suelo: [2345, 0], paredCm: 250,
    centroX: 590, centroCm: 158, zona: [90, 40, 1070, 930], sombra: [8, 8], maxCm: 60
  }
];
