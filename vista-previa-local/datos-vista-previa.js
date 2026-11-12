/*DATOS-INICIO*/
/* SOLO VISTA PREVIA LOCAL. Valores de relleno para ver el diseño completo. NUNCA se despliega:
   este archivo vive fuera de prueba-quiz/ y un test falla si estos valores aparecen en el sitio publicado. */
const DATOS = {
  __VISTA_PREVIA__: true,
  personas: '3.200',
  diagnosticos: '3.200',
  estrellas: '4,8',
  testimonios: [
    { nombre: 'Martín R.', detalle: 'Nivel Ritmo', texto: 'Por fin una rutina clara, semana a semana.' },
    { nombre: 'Lucía P.', detalle: 'Nivel Arranque', texto: 'El timer de rounds me hizo constante.' },
    { nombre: 'Diego F.', detalle: 'Nivel Impulso', texto: 'Entreno en casa y noto la diferencia en el sparring.' },
  ],
  especialista: {
    nombre: 'Néstor J. Medina',
    titulo: 'Médico deportista',
    foto: '',
    matricula: 'MN 00000',
    universidad: 'Universidad de relleno',
    posgrados: ['Posgrado de relleno'],
    resumen: 'Texto de relleno para ver cómo se acomoda la trayectoria.',
  },
  noticia: {
    etiqueta: 'Salud · Estudio',
    titular: 'Seis semanas de boxeo bajaron la presión arterial en adultos jóvenes',
    bajada: 'Un ensayo aleatorizado de la Universidad de Texas en El Paso (UTEP) con 24 adultos de unos 25 años midió el efecto de un programa de entrenamiento de boxeo.',
    cuerpo: 'En el grupo que entrenó, la presión sistólica bajó en promedio 16 mmHg y la diastólica 10 mmHg, y mejoró la función de los vasos sanguíneos. Es un estudio chico y con boxeo en general, no con shadowboxing solo; no reemplaza una consulta médica.',
    fuente: 'Sports (MDPI) · Universidad de Texas en El Paso',
    fecha: 'Marzo de 2026',
    enlace: 'https://www.mdpi.com/2075-4663/14/1/5',
    imagen: '',
  },
  pagoUrl: { base: '', b1: '', b2: '' },
  appUrl: '/app/',
  sitioUrl: '',
  responsable: '',
  contacto: '',
  garantiaDias: 30,
  /* Precios y valor: los mismos que en prueba-quiz/src/datos.js (no son relleno). */
  precios: { principal: '$9.990', back1: '$7.990', back2: '$4.990', upsellPro: '$24.990', downsell: '$14.990', accesoDeVida: '$12.990' },
  valor: {
    total: '$29.990',
    items: [
      ['Plan de 4 semanas por nivel', '$13.990'],
      ['Timer de rounds + rutinas guiadas', '$7.000'],
      ['Drills y ranking con tu apodo', '$5.000'],
      ['Bono: guía de guardia y desplazamientos', '$4.000'],
    ],
  },
};
/*DATOS-FIN*/
