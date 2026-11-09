/*DATOS-INICIO*/
/* ============================================================================================
   ARCHIVO ÚNICO DE DATOS DEL QUIZ. Acá se completa TODO lo que es información real.
   Regla: un campo vacío ('' o []) oculta su bloque. No cargar cifras, estrellas ni testimonios que no sean reales.
   Los campos siguen la estructura del funnel de gatos (Animales Funnel) y del funnel de referencia.
   ============================================================================================ */
const DATOS = {
  /* Contadores de prueba social (solo cifras reales). Ej.: personas:'120' */
  personas: '',            // «+N personas ya lo probaron» (hook, oferta)
  diagnosticos: '',        // «+N diagnósticos realizados» (tarjeta del especialista)
  estrellas: '',           // valoración promedio real, ej. '4,8' (se muestra con estrellas)

  /* Testimonios de personas reales con su permiso: [{ nombre:'Nombre A.', detalle:'Nivel Ritmo', texto:'…' }] */
  testimonios: [],

  /* Especialista. Solo nombre y título están cargados; el resto es opcional. */
  especialista: {
    nombre: 'Juan Medina',
    titulo: 'Médico deportista',
    foto: '',              // ruta de una imagen, ej. '/media/juan-medina.jpg'
    matricula: '',         // número de matrícula, si corresponde
    universidad: '',       // ej. 'Universidad de Buenos Aires'
    posgrados: [],         // ej. ['Posgrado en …']
    resumen: '',           // 1 o 2 líneas sobre su trayectoria
  },

  /* Noticia / estudio de la slide «¿Llegaste a ver esto?». Con fuente real y enlace. La imagen se carga a mano. */
  noticia: {
    etiqueta: 'Salud · Estudio',
    titular: 'Seis semanas de boxeo bajaron la presión arterial en adultos jóvenes',
    bajada: 'Un ensayo aleatorizado de la Universidad de Texas en El Paso (UTEP) con 24 adultos de unos 25 años midió el efecto de un programa de entrenamiento de boxeo.',
    cuerpo: 'En el grupo que entrenó, la presión sistólica bajó en promedio 16 mmHg y la diastólica 10 mmHg, y mejoró la función de los vasos sanguíneos. Es un estudio chico y con boxeo en general, no con shadowboxing solo; no reemplaza una consulta médica.',
    fuente: 'Sports (MDPI) · Universidad de Texas en El Paso',
    fecha: 'Marzo de 2026',
    enlace: 'https://www.mdpi.com/2075-4663/14/1/5',
    imagen: '',            // ruta de una imagen para la tarjeta, ej. '/media/noticia.jpg'
  },

  /* Pago: único punto a reemplazar cuando exista el checkout (CAMP_SHOPIFY_CHECKOUT_URL). Vacío = no se cobra nada. */
  pagoUrl: '',

  /* Dirección de la app donde entra el comprador (botón «Entrar a mi plan» de /gracias). Vacío = el botón no se muestra. */
  appUrl: '',

  /* Contacto para pedir el borrado de datos (se muestra en Privacidad). Vacío = texto genérico. */
  contacto: '',

  garantiaDias: 30,

  /* PRECIOS: único lugar. Todo se lee de acá (páginas, barra fija, pantalla de reserva y lista de precios aceptados por el servicio). */
  precios: {
    principal: '$9.990',   // /oferta
    back1: '$7.990',       // /back1 (20% OFF)
    back2: '$4.990',       // /back2 (50% OFF)
    /* Escalones siguientes: solo datos configurables, todavía sin pantallas. */
    upsellPro: '$24.990',
    downsell: '$14.990',
    accesoDeVida: '$12.990',
  },
  /* Lista de «Valor total». La suma de los ítems tiene que dar `total` (hay un test). El total solo se muestra tachado. */
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
