// Escribe prueba-quiz/contenido/plan-para-revisar.md: todo el plan en forma legible, para que lo revise el médico sin leer código.
// Uso: node prueba-quiz/contenido/exportar.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { planDe, NIVELES, VERSION } from './plan.mjs';

const PERFILES = [
  ['peso', 'Perfil «bajar de peso»', 'Hombres de 30 años o más, sin experiencia en artes marciales, que quieren bajar de peso entrenando en casa.'],
  ['peleador', 'Perfil «peleador»', 'Gente que entrena o quiere entrenar boxeo o artes marciales, desde principiantes hasta más de 3 años.'],
];
const TIPOS = { tecnica: 'técnica', cardio: 'cardio', mixta: 'mixta', suave: 'suave' };

function tiempo(seg) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return m ? (s ? `${m} min ${s} s` : `${m} min`) : `${s} s`;
}

function linea(p, ejercicios) {
  const nombre = ejercicios[p.ej] ? ejercicios[p.ej].nombre : p.ej;
  let t = `${nombre}: `;
  if (p.rondas > 1) t += `${p.rondas} × ${tiempo(p.seg)}`;
  else t += tiempo(p.seg);
  if (p.descanso) t += `, descanso ${tiempo(p.descanso)}`;
  if (p.combo) t += ` · golpes ${p.combo}`;
  if (p.nota) t += ` · ${p.nota}`;
  return `- ${t}`;
}

function generar() {
  const out = [];
  out.push('# Plan de entrenamiento BeastCamp: para revisar');
  out.push('');
  out.push('Contenido escrito para BeastCamp. Pendiente de revisión de Néstor J. Medina antes de publicarlo.');
  out.push('');
  out.push(`Versión del contenido: ${VERSION}.`);
  out.push('');
  out.push('## Cómo leer este documento');
  out.push('');
  out.push('- Hay 2 perfiles, 4 niveles de carga y 4 semanas por nivel. Cada sesión tiene calentamiento, técnica, rounds de sombra con timer, fuerza o acondicionamiento corto sin equipo y vuelta a la calma.');
  out.push('- Niveles: ' + NIVELES.map((n) => `${n.nombre} (${n.dias}, ${n.minutos}, ${n.sesionesPorSemana} sesiones por semana)`).join('; ') + '.');
  out.push('- Un paso «3 × 45 s, descanso 15 s» son 3 series de 45 segundos con 15 segundos de descanso después de cada una.');
  out.push('- Los minutos de cada sesión son la suma de todos sus pasos, descansos incluidos. Los puntos son minutos × 10.');
  out.push('- La numeración de golpes es: 1 jab, 2 recto, 3 gancho de adelante, 4 gancho de atrás, 5 uppercut de adelante, 6 uppercut de atrás.');
  out.push('- El plan no incluye dieta ni promete kilos. Los videos de cada ejercicio todavía no están cargados.');
  out.push('- Si no podés hablar durante el esfuerzo, el perfil de bajar de peso indica bajar el ritmo (test del habla).');
  out.push('');

  for (const [funnel, titulo, quien] of PERFILES) {
    const plan = planDe(funnel);
    out.push(`# ${titulo}`);
    out.push('');
    out.push(quien);
    out.push('');
    for (const nv of plan.niveles) {
      out.push(`## ${titulo}: nivel ${nv.nombre} (${nv.id})`);
      out.push('');
      out.push(`${nv.dias} por semana, sesiones de ${nv.minutos}.`);
      out.push('');
      for (const sem of nv.semanas) {
        const total = sem.sesiones.reduce((a, s) => a + s.minutos, 0);
        out.push(`### Semana ${sem.n}: ${sem.titulo}`);
        out.push('');
        out.push(`${sem.foco}`);
        out.push('');
        out.push(`Sesiones: ${sem.sesiones.length}. Total de la semana: ${total} minutos.`);
        out.push('');
        for (const s of sem.sesiones) {
          out.push(`#### Sesión ${s.n}: ${s.titulo} (${TIPOS[s.tipo]}, ${s.minutos} min, ${s.puntos} puntos)`);
          out.push('');
          out.push(s.objetivo);
          out.push('');
          for (const b of s.bloques) {
            out.push(`**${b.titulo}**`);
            out.push('');
            for (const p of b.pasos) out.push(linea(p, plan.ejercicios));
            out.push('');
          }
        }
      }
    }

    out.push(`## ${titulo}: ejercicios`);
    out.push('');
    for (const [id, e] of Object.entries(plan.ejercicios)) {
      out.push(`### ${e.nombre} (${id})`);
      out.push('');
      for (const c of e.como) out.push(`- ${c}`);
      out.push('');
      out.push(`Cuidado: ${e.cuidado}`);
      out.push('');
    }

    out.push(`## ${titulo}: drills`);
    out.push('');
    for (const d of plan.drills) {
      out.push(`### ${d.titulo} (${d.minutos} min, ${d.puntos} puntos)`);
      out.push('');
      out.push(d.foco);
      out.push('');
      for (const p of d.pasos) out.push(linea(p, plan.ejercicios));
      out.push('');
    }

    out.push(`## ${titulo}: ${plan.guia.titulo}`);
    out.push('');
    for (const s of plan.guia.secciones) {
      out.push(`### ${s.titulo}`);
      out.push('');
      for (const t of s.texto) {
        out.push(t);
        out.push('');
      }
      for (const p of s.puntos) out.push(`- ${p}`);
      out.push('');
    }
  }
  return out.join('\n');
}

export function textoParaRevisar() {
  return generar();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const destino = fileURLToPath(new URL('./plan-para-revisar.md', import.meta.url));
  writeFileSync(destino, generar() + '\n');
  console.log(`Escrito ${destino}`);
}
