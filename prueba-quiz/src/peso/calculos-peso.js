/* Cálculos del funnel de bajar de peso. Funciones puras, sin DOM: se usan en el quiz y en la oferta.
   Las cifras salen solo de acá (IMC, meta, semanas, fecha). El ritmo de 0,5 kg por semana es una estimación prudente, no una promesa. */
const CALC = {
  RITMO_KG_SEMANA: 0.5,
  LIMITES: { altura: [140, 220], peso: [40, 250] },

  /* IMC sin redondear. */
  imc(pesoKg, alturaCm) {
    const m = alturaCm / 100;
    return pesoKg / (m * m);
  },

  categoria(imc) {
    if (imc < 18.5) return 'bajo';
    if (imc < 25) return 'normal';
    if (imc < 30) return 'sobrepeso';
    return 'obesidad';
  },

  /* Peso más bajo que sigue dentro del rango normal para esa altura (IMC 18,5), redondeado hacia arriba. */
  pesoMinimoSano(alturaCm) {
    const m = alturaCm / 100;
    return Math.ceil(18.5 * m * m);
  },

  /* motivo: '' si está bien, 'igual' si la meta no es menor al peso actual, 'bajo' si queda por debajo del mínimo sano. */
  validarMeta(peso, meta, alturaCm) {
    const minimo = CALC.pesoMinimoSano(alturaCm);
    if (!Number.isFinite(peso) || !Number.isFinite(meta)) return { ok: false, motivo: 'igual', minimo };
    if (meta >= peso) return { ok: false, motivo: 'igual', minimo };
    if (meta < minimo) return { ok: false, motivo: 'bajo', minimo };
    return { ok: true, motivo: '', minimo };
  },

  /* Porcentaje del peso actual que hay que bajar, entero. */
  porcentaje(peso, meta) {
    return Math.round(((peso - meta) / peso) * 100);
  },

  semanas(peso, meta) {
    return Math.max(1, Math.ceil((peso - meta) / CALC.RITMO_KG_SEMANA));
  },

  fechaMeta(desdeDate, semanas) {
    const d = new Date(desdeDate.getTime());
    d.setDate(d.getDate() + semanas * 7);
    return d;
  },

  /* 'marzo de 2027' (es-AR), con meses propios para no depender del navegador. */
  mesAnio(date) {
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${meses[date.getMonth()]} de ${date.getFullYear()}`;
  },

  /* Descenso suave de peso a meta: arranca un poco más rápido y se aplana al final, siempre bajando (sin rebotes).
     Devuelve `puntos` valores {x: 0..1, kg}; el primero es el peso actual y el último, la meta. */
  curva(peso, meta, puntos = 12) {
    const n = Math.max(2, Math.floor(puntos));
    const salida = [];
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      const avance = 0.6 * x * (2 - x) + 0.4 * x;   // 0 en x=0, 1 en x=1, creciente
      salida.push({ x, kg: i === n - 1 ? meta : peso - (peso - meta) * avance });
    }
    return salida;
  },
};

if (typeof module !== 'undefined') module.exports = { CALC };
