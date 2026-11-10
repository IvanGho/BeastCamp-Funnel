/* Ilustraciones del quiz: muñecos 3D (un boxeador-mascota con cinta verde o Mongkon de Muay Thai) generados con Vertex.
   Cada opción apunta a una imagen de /img/muneco-<clave>.webp. Sin emojis. */
/* Los tres muñecos de las pantallas de medidas (altura, peso y meta) se dibujan grandes: tienen una versión @2x (720×960, remuestreada con Lanczos y un afilado suave a partir del mismo archivo) que solo usa .mu. */
const CON_2X = ['c_guardia', 'o_peso', 'o_tecnica'];
const img3d = (k, clase = 'im3d') => `<img class="${clase}" src="/img/muneco-${k}.webp"${clase === 'mu' && CON_2X.includes(k) ? ` srcset="/img/muneco-${k}@2x.webp 2x"` : ''} alt="" width="360" height="480" loading="eager" decoding="async">`;
const CLAVES_MUNECO = ['m_golpes', 'm_aire', 'm_plan', 'm_const', 'n_empiezo', 'n_seis', 'n_anios', 'n_mas', 'o_tecnica', 'o_peso', 'o_resist', 'o_sparring', 'o_estres', 'o_competir', 'f_ayuda', 'f_tiempo', 'f_const', 'f_aburro', 'f_ojo', 'f_equipo', 'l_casa', 'l_soga', 'l_arbol', 'l_pesa', 't1', 't2', 't3', 't4', 'p_gratis', 'p_5', 'p_10', 'p_20'];
const MUNECO = Object.fromEntries(CLAVES_MUNECO.map((k) => [k, () => img3d(k)]));

/* Escenas de «Entrenar mal te frena más»: el mismo muñeco, con movimiento por CSS. */
const ESCENA = {
  pies: img3d('e_pies', 'esc3d e-pies'),
  guardia: img3d('e_guardia', 'esc3d e-guardia'),
  respiracion: img3d('e_resp', 'esc3d e-resp'),
};

/* Ícono de línea: solo para el marcador de la tarjeta de noticia. */
const ICONO = {
  pulmon: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 8v22M32 30c-4 1-6 6-9 8-4 3-9 1-9 8 0 6 5 8 9 8 5 0 9-5 9-12M32 30c4 1 6 6 9 8 4 3 9 1 9 8 0 6-5 8-9 8-5 0-9-5-9-12"/></svg>',
};

if (typeof module !== 'undefined') module.exports = { MUNECO, ICONO, ESCENA };
