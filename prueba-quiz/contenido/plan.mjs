// Contenido escrito para BeastCamp. Pendiente de revisión de Juan Medina antes de publicarlo.
//
// Plan de entrenamiento de la app del comprador: 2 perfiles (peleador y bajar de peso) × 4 niveles de carga × 4 semanas,
// más los drills y la guía bono «Guía de guardia y desplazamientos».
// Módulo ESM puro y determinista (sin fechas ni azar). Lo importa el servicio; la app lo recibe por la API.
//
// Reglas del contenido
//  - Sesiones por semana: Arranque 3, Ritmo 4, Impulso 5, Fighter 6.
//  - Estructura de cada sesión: calentamiento → técnica → rounds de sombra con el timer → fuerza o acondicionamiento
//    corto sin equipo → vuelta a la calma.
//  - Duración de un paso = rondas × (seg + descanso). El descanso va después de cada ronda, incluida la última, y sirve de
//    transición al paso siguiente. minutos = suma de todos los pasos, redondeada al minuto.
//  - puntos = minutos × 10, en sesiones y en drills.
//  - Todos los pasos son por tiempo (seg); las repeticiones se explican en la nota o en las indicaciones del ejercicio.
//  - Golpes: 1 jab, 2 recto, 3 gancho de adelante, 4 gancho de atrás, 5 uppercut de adelante, 6 uppercut de atrás.
//  - Perfil de bajar de peso: bajo impacto (sin saltos), ritmo en el que se puede hablar (test del habla), rodillas, cadera,
//    hombros y espalda cuidados. No incluye dieta ni promete kilos.
//  - Semana 4: rounds de 3 minutos con 1 de descanso.
//  - video: '' es el lugar reservado para el video (ruta futura /media/app/<id>.mp4).

import { ejerciciosDe } from './ejercicios.mjs';
import { drillsDe } from './drills.mjs';
import { guiaDe } from './guia.mjs';
import { SEMANAS_PELEADOR } from './semanas-peleador.mjs';
import { SEMANAS_PESO } from './semanas-peso.mjs';

export const VERSION = '1';

export const NIVELES = [
  { id: 't1', nombre: 'Arranque', dias: '2-3 días', minutos: '15-30 min', sesionesPorSemana: 3 },
  { id: 't2', nombre: 'Ritmo', dias: '3-4 días', minutos: '30-40 min', sesionesPorSemana: 4 },
  { id: 't3', nombre: 'Impulso', dias: '4-5 días', minutos: '45-60 min', sesionesPorSemana: 5 },
  { id: 't4', nombre: 'Fighter', dias: '5-6 días', minutos: '60-90 min', sesionesPorSemana: 6 },
];

// Títulos de semana: los mismos que prometen las ofertas (oferta.js y oferta-peso.js). Un test los compara.
const TITULOS = {
  peleador: ['Pies, guardia, jab y cross', 'Esquivas y sombra', 'Combinaciones y ritmo', 'Rounds completos de 3 minutos'],
  peso: ['Postura, pies y tus dos primeros golpes', 'Esquivas y boxeo al aire', 'Combinaciones y ritmo', 'Rondas completas de 3 minutos, con descanso'],
};
const SEMANAS = { peleador: SEMANAS_PELEADOR, peso: SEMANAS_PESO };

// Minutos objetivo por nivel y semana, y ajuste según el tipo de sesión (las suaves son más cortas, las de cardio más largas).
const MIN_BASE = { t1: [18, 21, 25, 28], t2: [32, 34, 36, 38], t3: [48, 51, 54, 57], t4: [66, 72, 78, 84] };
const AJUSTE = {
  t1: { tecnica: -1, cardio: 1, mixta: 0, suave: -2 },
  t2: { tecnica: 0, cardio: 1, mixta: 1, suave: -2 },
  t3: { tecnica: 0, cardio: 2, mixta: 1, suave: -3 },
  t4: { tecnica: 0, cardio: 3, mixta: 2, suave: -5 },
};

// Cuántos ejercicios lleva cada bloque según el nivel.
const CANTIDAD = {
  t1: { cal: 3, tec: 2, fza: 2, vu: 2 },
  t2: { cal: 3, tec: 3, fza: 3, vu: 3 },
  t3: { cal: 4, tec: 3, fza: 3, vu: 3 },
  t4: { cal: 4, tec: 4, fza: 4, vu: 3 },
};

// Duración de cada paso por nivel (segundos).
const TIEMPOS = {
  t1: { cal: 30, tec: 45, tecD: 15, fza: 30, fzaD: 20, vu: 40 },
  t2: { cal: 40, tec: 50, tecD: 15, fza: 35, fzaD: 20, vu: 45 },
  t3: { cal: 45, tec: 60, tecD: 15, fza: 40, fzaD: 20, vu: 60 },
  t4: { cal: 60, tec: 75, tecD: 15, fza: 45, fzaD: 20, vu: 60 },
};

// Rounds de sombra por semana y nivel: [segundos de round, segundos de descanso].
// Semana 4: siempre 3 minutos con 1 de descanso.
const ROUNDS = {
  peleador: {
    1: { t1: [90, 30], t2: [90, 30], t3: [120, 30], t4: [120, 30] },
    2: { t1: [120, 30], t2: [120, 30], t3: [120, 30], t4: [120, 30] },
    3: { t1: [150, 30], t2: [150, 30], t3: [150, 30], t4: [150, 30] },
    4: { t1: [180, 60], t2: [180, 60], t3: [180, 60], t4: [180, 60] },
  },
  peso: {
    1: { t1: [60, 30], t2: [60, 30], t3: [90, 30], t4: [90, 30] },
    2: { t1: [90, 30], t2: [90, 30], t3: [90, 30], t4: [120, 30] },
    3: { t1: [120, 45], t2: [120, 45], t3: [120, 45], t4: [120, 45] },
    4: { t1: [180, 60], t2: [180, 60], t3: [180, 60], t4: [180, 60] },
  },
};

const MAX_ROUNDS = { t1: 7, t2: 9, t3: 12, t4: 16 };

// Rangos de series por tipo de sesión y parte del tiempo que ocupan los rounds.
const FORMA = {
  tecnica: { tr: [2, 3, 4], f: [1, 2, 3], parteRounds: 0.3 },
  cardio: { tr: [1, 2], f: [2, 3, 4], parteRounds: 0.45 },
  mixta: { tr: [2, 3], f: [2, 3], parteRounds: 0.38 },
  suave: { tr: [1, 2, 3], f: [1, 2], parteRounds: 0.3 },
};

const FOCO_NIVEL = {
  t1: 'Son sesiones cortas: lo importante es la constancia.',
  t2: 'Ritmo medio: alcanza para progresar sin llegar al límite.',
  t3: 'Cinco días de entrenamiento: respetá el día suave y los descansos.',
  t4: 'Seis días por semana: es la carga más alta. Cuidá el sueño y los descansos.',
};
const FOCO_NIVEL_PESO = {
  t3: 'Cinco días de entrenamiento: respetá el día suave y los descansos. Si venís de no entrenar hace tiempo, podés bajar de nivel cuando quieras.',
  t4: 'Seis días por semana: es la carga más alta. Si venís de no entrenar hace tiempo, empezá por un nivel más corto y subí de a poco.',
};

const lista = (s) => s.split(/\s+/).filter(Boolean);
const duracion = (p) => p.rondas * (p.seg + p.descanso);

function paso(ej, seg, descanso, rondas, combo, nota) {
  const p = { ej, seg, descanso, rondas };
  if (combo) p.combo = combo;
  if (nota) p.nota = nota;
  return p;
}

// Reparte N rondas en hasta 3 grupos (el último se lleva el resto).
function repartir(n) {
  const grupos = Math.min(3, n);
  const base = Math.floor(n / grupos);
  const sobra = n - base * grupos;
  return Array.from({ length: grupos }, (_, i) => base + (i >= grupos - sobra ? 1 : 0));
}

function armarSesion(funnel, nivel, semana, n, spec) {
  const [titulo, tipo, objetivo, cal, tec, som, fza, vu] = spec;
  const peso = funnel === 'peso';
  const T = TIEMPOS[nivel];
  const C = CANTIDAD[nivel];
  const [rSeg, rDesc] = ROUNDS[funnel][semana][nivel];
  const forma = FORMA[tipo];
  const objetivoSeg = (MIN_BASE[nivel][semana - 1] + AJUSTE[nivel][tipo]) * 60;

  const calPasos = lista(cal).slice(0, C.cal).map((ej) => paso(ej, T.cal, 0, 1));
  const tecIds = tec.slice(0, C.tec).map((t) => t.split('|'));
  const fzaIds = lista(fza).slice(0, C.fza);
  const vuIds = lista(vu).slice(0, C.vu);
  const aguaSeg = peso ? 30 : 0;
  const habla = peso ? 20 : 0;

  const fijo = calPasos.reduce((a, p) => a + duracion(p), 0) + habla + aguaSeg + vuIds.length * T.vu;
  
  // Busca la mejor combinación de series, duración de los pasos y cantidad de rounds para llegar al tiempo objetivo.
  let mejor = null;
  for (const tr of forma.tr) {
    for (const f of forma.f) {
      for (const dt of [0, 5, 10, -5, 15, -10, 20]) {
        for (const df of [0, 5, -5, 10]) {
          for (let r = 2; r <= MAX_ROUNDS[nivel]; r++) {
            const rounds = r * (rSeg + rDesc);
            const total = fijo + tr * tecIds.length * (T.tec + dt + T.tecD) + f * fzaIds.length * (T.fza + df + T.fzaD) + rounds;
            const costo = 30 * Math.abs(total - objetivoSeg) + Math.abs(rounds - forma.parteRounds * objetivoSeg) + 2 * (Math.abs(dt) + Math.abs(df));
            if (!mejor || costo < mejor.costo) mejor = { costo, tr, f, r, total, dt, df };
          }
        }
      }
    }
  }

  // El resto (menos de un minuto) se suma o resta en la última parte de la vuelta a la calma, de 5 en 5 segundos.
  const ajuste = Math.round((objetivoSeg - mejor.total) / 5) * 5;

  const bloques = [];
  bloques.push({ tipo: 'calentamiento', titulo: 'Calentamiento', pasos: calPasos });
  bloques.push({
    tipo: 'tecnica',
    titulo: 'Técnica',
    pasos: tecIds.map(([ej, nota]) => paso(ej, T.tec + mejor.dt, T.tecD, mejor.tr, '', nota)),
  });

  const rondasPasos = [];
  if (peso) rondasPasos.push(paso('test-habla', habla, 0, 1, '', 'Decí una frase en voz alta mientras te movés: si podés, el ritmo es el correcto.'));
  const grupos = repartir(mejor.r);
  grupos.forEach((cantidad, i) => {
    const [ej, combo, nota] = som[i].split('|');
    rondasPasos.push(paso(ej, rSeg, rDesc, cantidad, combo, nota));
  });
  bloques.push({ tipo: 'rounds', titulo: peso ? 'Rounds de sombra, a ritmo de conversación' : 'Rounds de sombra', pasos: rondasPasos });

  bloques.push({
    tipo: 'fuerza',
    titulo: tipo === 'cardio' ? 'Acondicionamiento sin equipo' : 'Fuerza sin equipo',
    pasos: fzaIds.map((ej) => paso(ej, T.fza + mejor.df, T.fzaD, mejor.f)),
  });

  const vuPasos = [];
  if (peso) vuPasos.push(paso('pausa-agua', aguaSeg, 0, 1));
  vuIds.forEach((ej, i) => vuPasos.push(paso(ej, T.vu + (i === vuIds.length - 1 ? ajuste : 0), 0, 1)));
  bloques.push({ tipo: 'vuelta', titulo: 'Vuelta a la calma', pasos: vuPasos });

  const segundos = bloques.reduce((a, b) => a + b.pasos.reduce((x, p) => x + duracion(p), 0), 0);
  const minutos = Math.round(segundos / 60);
  return {
    id: `${funnel}-${nivel}-s${semana}-${n}`,
    n,
    titulo,
    tipo,
    minutos,
    puntos: minutos * 10,
    objetivo,
    bloques,
  };
}

// Qué sesiones de la semana usa cada nivel: Arranque toma la primera técnica, la primera de cardio y la primera mixta;
// Ritmo, Impulso y Fighter toman las primeras 4, 5 y 6.
function indicesDeNivel(nivel, specs) {
  if (nivel === 't1') {
    return ['tecnica', 'cardio', 'mixta'].map((tipo) => specs.findIndex((s) => s[1] === tipo));
  }
  const cantidad = { t2: 4, t3: 5, t4: 6 }[nivel];
  return Array.from({ length: cantidad }, (_, i) => i);
}

function armarNivel(funnel, nivel) {
  const semanas = SEMANAS[funnel].map((sem, i) => {
    const sesiones = indicesDeNivel(nivel.id, sem.sesiones).map((idx, k) => armarSesion(funnel, nivel.id, i + 1, k + 1, sem.sesiones[idx]));
    const cola = funnel === 'peso' && FOCO_NIVEL_PESO[nivel.id] ? FOCO_NIVEL_PESO[nivel.id] : FOCO_NIVEL[nivel.id];
    return { n: i + 1, titulo: TITULOS[funnel][i], foco: `${sem.foco} ${cola}`, sesiones };
  });
  return { ...nivel, semanas };
}

function idsUsados(niveles, drills) {
  const usados = new Set();
  const recorrer = (pasos) => pasos.forEach((p) => usados.add(p.ej));
  for (const nv of niveles) for (const sem of nv.semanas) for (const s of sem.sesiones) for (const b of s.bloques) recorrer(b.pasos);
  for (const d of drills) recorrer(d.pasos);
  return usados;
}

/** Plan completo de un perfil. Siempre devuelve lo mismo para el mismo perfil. */
export function planDe(funnel) {
  if (funnel !== 'peleador' && funnel !== 'peso') throw new Error(`Perfil desconocido: ${funnel}`);
  const niveles = NIVELES.map((nv) => armarNivel(funnel, nv));
  const drills = drillsDe(funnel);
  return {
    funnel,
    version: VERSION,
    niveles,
    ejercicios: ejerciciosDe(funnel, idsUsados(niveles, drills)),
    drills,
    guia: guiaDe(funnel),
  };
}
