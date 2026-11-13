/* Datos del funnel de bajar de peso. SOLO información verificada con su fuente; lo que no se verificó no se carga.
   Regla de siempre: un campo vacío oculta su bloque. No cargar cifras, estrellas ni testimonios que no sean reales. */
const DATOS_PESO = {
  personas: '3.200',   // «+N peleadores lo probaron este mes» (primera pantalla del quiz de peso)
  /* Noticia de la pantalla «¿Llegaste a ver esto?». Misma forma que DATOS.noticia, más un aviso corto opcional. */
  noticia: {
    etiqueta: 'Salud · Estudio piloto',
    titular: '', // vacío = la pantalla no aparece: el único estudio verificado es de 12 personas, sin diferencia clara, y no prueba nada; en un funnel de venta no suma.
    // Texto original, por si algún día hay evidencia mejor: 'Boxeo intenso durante 12 semanas: la grasa corporal bajó, sin diferencia clara frente a caminar rápido (estudio piloto)'
    bajada: '12 adultos con exceso de grasa en la cintura (edad media 39), 6 por grupo: boxeo o caminata rápida, 4 sesiones de 50 minutos por semana durante 12 semanas.',
    cuerpo: 'En el grupo de boxeo la grasa corporal bajó de 33,5% a 29,5%. El peso y la cintura también bajaron, pero esos cambios no se pudieron distinguir del azar, y tampoco hubo diferencia clara con la caminata. Eran solo 12 personas y no se controló la dieta. El entrenamiento usó bolsa, manoplas y soga; no fue shadowboxing.',
    aviso: 'Es un estudio piloto: no prueba que el boxeo haga bajar de peso.',
    fuente: 'Cheema et al., BMC Sports Science, Medicine and Rehabilitation 7:3',
    fecha: '2015',
    enlace: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4429464/',
    imagen: '',
  },

  /* Slide «¿Llegaste a ver esto?» con una publicación. Vacío = en el sitio publicado la slide no aparece (en tu compu se ve el esqueleto, con el espacio de la imagen).
     Solo contenido con fuente propia y verificable: imagen y texto de lo que de verdad se publicó, con su fuente y enlace. */
  publicacion: {
    etiqueta: 'Salud · Medicina deportiva',
    titular: 'El boxeo de sombra, según el Dr. Néstor J. Medina',
    bajada: '«El boxeo de sombra es un aliado increíble para mejorar la resistencia, quemar grasa y mantenerse en forma.»',
    fuente: 'Dr. Néstor J. Medina (MN 9467), médico deportólogo',
    fecha: 'Mayo de 2026',
    enlace: '',
    imagen: '/media/publicacion.jpg',
    alt: 'El Dr. Néstor J. Medina, médico deportólogo, en un gimnasio de boxeo',
  },

  /* Fuentes citadas en el quiz. Cada una con su enlace; si falta `verificada` o `url`, el texto va sin cifra o se oculta. */
  fuentes: {
    musculo: {
      verificada: true,
      afirmacion: 'La masa muscular baja aprox. 3 a 8% por década después de los 30.',
      fuente: 'Volpi, Nazemi, Fujita. Muscle tissue changes with aging. Curr Opin Clin Nutr Metab Care',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2804956/',
      cita_corta: 'Muscle mass decreases approximately 3–8% per decade after the age of 30',
      fecha: '2004',
    },
    ritmo: {
      verificada: true,
      afirmacion: 'Bajar de a poco, 1 a 2 libras por semana (0,5 a 0,9 kg), ayuda a mantener el peso perdido.',
      fuente: 'CDC, Losing Weight',
      url: 'https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html',
      cita_corta: 'about 1 to 2 pounds a week—are more likely to keep the weight off',
      fecha: 'página vigente, consultada 2026-11-09',
    },
    beneficio: {
      verificada: true,
      afirmacion: 'Perder 5 a 10% del peso corporal probablemente mejora presión, colesterol y glucemia.',
      fuente: 'CDC, Losing Weight (copia archivada 2018; la página actual solo menciona 5%)',
      url: 'https://webharvest.gov/congress115th/20181203203029/https://www.cdc.gov/healthyweight/losing_weight/index.html',
      cita_corta: '5 to 10 percent of your total body weight, is likely to produce health benefits',
      fecha: '2018 (archivo)',
    },
  },

  /* Testimonios de personas reales con su permiso. Vacío = no se ve el bloque. */
  testimonios: [
    { nombre: 'Marcos', detalle: '34 años · Buenos Aires', texto: 'Venía bastante sedentario y necesitaba empezar a moverme. Arranqué haciendo shadowboxing en casa y me terminó enganchando. En unas semanas mejoré un montón el aire y empecé a notar cambios en la panza.' },
    { nombre: 'Federico', detalle: '39 años · Córdoba', texto: 'Siempre me costó mantener una rutina de entrenamiento. Lo bueno de la app es que puedo entrenar en casa, sin necesitar máquinas ni equipamiento. Transpirás, quemás calorías y sentís que realmente estás aprovechando el tiempo.' },
    { nombre: 'Diego', detalle: '46 años · Mendoza', texto: 'Mi objetivo era bajar unos kilos y recuperar el estado físico que había perdido. Me sorprendió lo completo que puede ser el boxeo de sombra. Ahora tengo más resistencia, me siento más liviano y disfruto entrenar. Lo puedo hacer sin salir de casa.' },
  ],
};
