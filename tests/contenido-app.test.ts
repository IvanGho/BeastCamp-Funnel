// Contenido del plan de la app (prueba-quiz/contenido): formato, coherencia con las ofertas, tiempos y reglas de redacción.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { planDe, NIVELES, VERSION } from "../prueba-quiz/contenido/plan.mjs";
import { textoParaRevisar } from "../prueba-quiz/contenido/exportar.mjs";

const leer = (r: string) => readFileSync(r, "utf8");
const PERFILES = ["peleador", "peso"];
const SEMANAS_POR_NIVEL: Record<string, number> = { t1: 3, t2: 4, t3: 5, t4: 6 };
const RANGOS: Record<string, [number, number]> = { t1: [15, 30], t2: [30, 40], t3: [45, 60], t4: [60, 90] };
const TIPOS = ["tecnica", "cardio", "mixta", "suave"];
const ORDEN_BLOQUES = ["calentamiento", "tecnica", "rounds", "fuerza", "vuelta"];
const IMPACTO = ["sentadilla-salto", "burpee", "rodillas-altas", "escaladores"];

const planes: Record<string, any> = Object.fromEntries(PERFILES.map((p) => [p, planDe(p)]));

const sesionesDe = (plan: any) => plan.niveles.flatMap((n: any) => n.semanas.flatMap((s: any) => s.sesiones.map((x: any) => ({ nivel: n.id, semana: s.n, ...x }))));
const duracion = (p: any) => p.rondas * (p.seg + p.descanso);
const segundosDe = (pasos: any[]) => pasos.reduce((a, p) => a + duracion(p), 0);
const textos = (v: any, salida: string[] = []): string[] => {
  if (typeof v === "string") salida.push(v);
  else if (Array.isArray(v)) v.forEach((x) => textos(x, salida));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => textos(x, salida));
  return salida;
};
// Textos que ve la persona (se excluyen ids, tipos y rutas de muñeco).
const visibles = (plan: any): string[] => {
  const salida: string[] = [];
  for (const n of plan.niveles) {
    salida.push(n.nombre, n.dias, n.minutos);
    for (const s of n.semanas) {
      salida.push(s.titulo, s.foco);
      for (const x of s.sesiones) {
        salida.push(x.titulo, x.objetivo);
        for (const b of x.bloques) {
          salida.push(b.titulo);
          for (const p of b.pasos) salida.push(p.nota || "", p.combo || "");
        }
      }
    }
  }
  for (const e of Object.values<any>(plan.ejercicios)) salida.push(e.nombre, ...e.como, e.cuidado);
  for (const d of plan.drills) {
    salida.push(d.titulo, d.foco);
    for (const p of d.pasos) salida.push(p.nota || "");
  }
  salida.push(plan.guia.titulo, ...textos(plan.guia.secciones.map((s: any) => [s.titulo, s.texto, s.puntos])));
  return salida.filter(Boolean);
};
const promedio = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

// Títulos que prometen las ofertas, leídos de sus archivos.
function semanasDeOferta(archivo: string, nombre: string): string[] {
  const bloque = leer(archivo).match(new RegExp(`const ${nombre} = \\[([\\s\\S]*?)\\n\\];`));
  assert.ok(bloque, `no se encontró ${nombre} en ${archivo}`);
  return [...bloque[1].matchAll(/\['Semana (\d)',\s*'([^']+)'\]/g)].sort((a, b) => Number(a[1]) - Number(b[1])).map((m) => m[2]);
}

test("contenido: versión, niveles y formato válido para los dos perfiles", () => {
  assert.equal(typeof VERSION, "string");
  assert.deepEqual(NIVELES.map((n: any) => n.id), ["t1", "t2", "t3", "t4"]);
  assert.deepEqual(NIVELES.map((n: any) => n.nombre), ["Arranque", "Ritmo", "Impulso", "Fighter"]);
  assert.deepEqual(NIVELES.map((n: any) => n.dias), ["2-3 días", "3-4 días", "4-5 días", "5-6 días"]);
  assert.deepEqual(NIVELES.map((n: any) => n.minutos), ["15-30 min", "30-40 min", "45-60 min", "60-90 min"]);
  assert.throws(() => planDe("otro"));
  for (const funnel of PERFILES) {
    const plan = planes[funnel];
    assert.equal(plan.funnel, funnel);
    assert.equal(plan.version, VERSION);
    assert.deepEqual(plan.niveles.map((n: any) => n.id), ["t1", "t2", "t3", "t4"]);
    for (const nv of plan.niveles) {
      assert.equal(typeof nv.nombre, "string");
      assert.equal(nv.sesionesPorSemana, SEMANAS_POR_NIVEL[nv.id]);
      assert.deepEqual(nv.semanas.map((s: any) => s.n), [1, 2, 3, 4]);
      for (const sem of nv.semanas) {
        assert.ok(sem.titulo && sem.foco.length > 30, `foco de ${funnel} ${nv.id} semana ${sem.n}`);
        for (const [i, s] of sem.sesiones.entries()) {
          assert.equal(s.n, i + 1);
          assert.match(s.id, new RegExp(`^${funnel}-${nv.id}-s${sem.n}-${i + 1}$`));
          assert.ok(TIPOS.includes(s.tipo), s.id);
          assert.ok(s.titulo.length > 5 && s.objetivo.length > 30, s.id);
          assert.ok(Number.isInteger(s.minutos) && Number.isInteger(s.puntos), s.id);
          assert.deepEqual(s.bloques.map((b: any) => b.tipo), ORDEN_BLOQUES, s.id);
          for (const b of s.bloques) assert.ok(b.titulo && b.pasos.length > 0, `${s.id} ${b.tipo}`);
        }
      }
    }
    assert.ok(plan.ejercicios && plan.drills && plan.guia);
  }
});

test("contenido: los títulos de semana son los que prometen las ofertas", () => {
  const peleador = semanasDeOferta("prueba-quiz/src/oferta.js", "semanas");
  const peso = semanasDeOferta("prueba-quiz/src/peso/oferta-peso.js", "SEMANAS_PLAN");
  assert.equal(peleador.length, 4);
  assert.equal(peso.length, 4);
  for (const nv of planes.peleador.niveles) assert.deepEqual(nv.semanas.map((s: any) => s.titulo), peleador, `peleador ${nv.id}`);
  for (const nv of planes.peso.niveles) assert.deepEqual(nv.semanas.map((s: any) => s.titulo), peso, `peso ${nv.id}`);
});

test("contenido: sesiones por semana según el nivel y variedad de tipos", () => {
  for (const funnel of PERFILES) {
    for (const nv of planes[funnel].niveles) {
      for (const sem of nv.semanas) {
        assert.equal(sem.sesiones.length, SEMANAS_POR_NIVEL[nv.id], `${funnel} ${nv.id} semana ${sem.n}`);
        const tipos = new Set(sem.sesiones.map((s: any) => s.tipo));
        assert.ok(tipos.size >= 3, `variedad en ${funnel} ${nv.id} semana ${sem.n}`);
        if (nv.id === "t3" || nv.id === "t4") assert.ok(tipos.has("suave"), `sesión suave en ${funnel} ${nv.id} semana ${sem.n}`);
        // Dos sesiones seguidas del mismo tipo no se repiten.
        sem.sesiones.slice(1).forEach((s: any, i: number) => assert.notEqual(s.tipo, sem.sesiones[i].tipo, `${funnel} ${nv.id} semana ${sem.n}`));
      }
    }
    // Totales por perfil: 3 + 4 + 5 + 6 sesiones por semana, 4 semanas.
    assert.equal(sesionesDe(planes[funnel]).length, (3 + 4 + 5 + 6) * 4);
  }
});

test("contenido: minutos dentro del rango, progresivos e iguales a la suma de los pasos", () => {
  for (const funnel of PERFILES) {
    for (const nv of planes[funnel].niveles) {
      const [min, max] = RANGOS[nv.id];
      const [a, b] = nv.minutos.match(/\d+/g).map(Number);
      assert.deepEqual([a, b], [min, max]);
      const medias: number[] = [];
      for (const sem of nv.semanas) {
        for (const s of sem.sesiones) {
          assert.ok(s.minutos >= min && s.minutos <= max, `${s.id}: ${s.minutos} min fuera de ${min}-${max}`);
          const real = s.bloques.reduce((acc: number, bl: any) => acc + segundosDe(bl.pasos), 0) / 60;
          assert.ok(Math.abs(real - s.minutos) <= 1, `${s.id}: dice ${s.minutos} min y los pasos suman ${real.toFixed(1)}`);
          assert.equal(s.puntos, s.minutos * 10, s.id);
        }
        medias.push(promedio(sem.sesiones.map((s: any) => s.minutos)));
      }
      for (let i = 1; i < medias.length; i++) assert.ok(medias[i] > medias[i - 1], `${funnel} ${nv.id}: la semana ${i + 1} no sube respecto de la ${i}`);
    }
  }
});

test("contenido: semana 4 con rounds de 3 minutos y 1 de descanso", () => {
  for (const funnel of PERFILES) {
    for (const nv of planes[funnel].niveles) {
      for (const s of nv.semanas[3].sesiones) {
        const rounds = s.bloques.find((b: any) => b.tipo === "rounds").pasos.filter((p: any) => p.ej !== "test-habla");
        assert.ok(rounds.length > 0);
        for (const p of rounds) assert.deepEqual([p.seg, p.descanso], [180, 60], `${s.id} ${p.ej}`);
      }
      // En las semanas anteriores los rounds son más cortos.
      for (const sem of nv.semanas.slice(0, 3)) {
        for (const s of sem.sesiones) {
          for (const p of s.bloques.find((b: any) => b.tipo === "rounds").pasos.filter((q: any) => q.ej !== "test-habla")) assert.ok(p.seg < 180, s.id);
        }
      }
    }
  }
});

test("contenido: cada paso apunta a un ejercicio que existe y está bien formado", () => {
  for (const funnel of PERFILES) {
    const plan = planes[funnel];
    const pasos: any[] = [
      ...sesionesDe(plan).flatMap((s: any) => s.bloques.flatMap((b: any) => b.pasos.map((p: any) => ({ donde: s.id, ...p })))),
      ...plan.drills.flatMap((d: any) => d.pasos.map((p: any) => ({ donde: d.id, ...p }))),
    ];
    const usados = new Set<string>();
    for (const p of pasos) {
      assert.ok(plan.ejercicios[p.ej], `${p.donde}: no existe el ejercicio ${p.ej}`);
      usados.add(p.ej);
      assert.ok(Number.isInteger(p.seg) && p.seg > 0, `${p.donde} ${p.ej}: seg`);
      assert.ok(Number.isInteger(p.rondas) && p.rondas >= 1, `${p.donde} ${p.ej}: rondas`);
      assert.ok(Number.isInteger(p.descanso) && p.descanso >= 0, `${p.donde} ${p.ej}: descanso`);
      if (p.combo !== undefined) assert.match(p.combo, /^[1-6](-[1-6])*$/, `${p.donde}: combo ${p.combo}`);
      if (p.nota !== undefined) assert.ok(p.nota.length > 0 && p.nota.length <= 110, `${p.donde}: nota`);
    }
    // No quedan ejercicios sin usar.
    assert.deepEqual([...Object.keys(plan.ejercicios)].filter((id) => !usados.has(id)), [], `ejercicios sin usar en ${funnel}`);
  }
});

test("contenido: ejercicios con indicaciones, cuidado y muñeco que existe", () => {
  for (const funnel of PERFILES) {
    for (const [id, e] of Object.entries<any>(planes[funnel].ejercicios)) {
      assert.ok(e.nombre.length > 2, id);
      assert.ok(Array.isArray(e.como) && e.como.length >= 2 && e.como.length <= 4, `${id}: de 2 a 4 indicaciones`);
      for (const c of e.como) assert.ok(typeof c === "string" && c.length > 10 && c.length <= 140, `${id}: indicación`);
      assert.ok(e.cuidado.length > 15 && e.cuidado.length <= 220, `${id}: cuidado`);
      assert.ok(existsSync(`prueba-quiz/sitio/img/muneco-${e.muneco}.webp`), `${id}: no existe muneco-${e.muneco}.webp`);
      assert.equal(e.video, "", `${id}: video vacío`);
    }
    // Hay variedad de muñecos: no se usa uno solo para todo.
    assert.ok(new Set(Object.values<any>(planes[funnel].ejercicios).map((e) => e.muneco)).size >= 10);
  }
});

test("contenido: drills de 3 a 8 minutos, entre 10 y 12, con puntos = minutos × 10", () => {
  for (const funnel of PERFILES) {
    const { drills } = planes[funnel];
    assert.ok(drills.length >= 10 && drills.length <= 12, `${funnel}: ${drills.length} drills`);
    for (const d of drills) {
      assert.ok(d.titulo && d.foco, d.id);
      assert.ok(d.minutos >= 3 && d.minutos <= 8, `${d.id}: ${d.minutos} min`);
      assert.ok(Math.abs(segundosDe(d.pasos) / 60 - d.minutos) <= 1, `${d.id}: minutos y pasos no coinciden`);
      assert.equal(d.puntos, d.minutos * 10, d.id);
      assert.ok(existsSync(`prueba-quiz/sitio/img/muneco-${d.muneco}.webp`), `${d.id}: muñeco`);
      assert.equal(d.video, "");
      assert.match(d.id, /^drill-[a-z0-9-]+$/);
    }
  }
});

test("contenido: guía bono de 7 a 9 secciones con las partes pedidas", () => {
  for (const funnel of PERFILES) {
    const { guia } = planes[funnel];
    assert.equal(guia.titulo, "Guía de guardia y desplazamientos");
    assert.ok(guia.secciones.length >= 7 && guia.secciones.length <= 9);
    const ids = guia.secciones.map((s: any) => s.id);
    for (const id of ["postura-guardia", "distancia", "desplazamientos", "pivote", "golpes-numeracion", "defensa-basica", "errores-comunes", "respiracion", "espacio-seguridad"]) assert.ok(ids.includes(id), `${funnel}: falta ${id}`);
    for (const s of guia.secciones) {
      assert.ok(s.titulo && s.texto.length >= 1 && s.puntos.length >= 3, s.id);
      assert.ok(existsSync(`prueba-quiz/sitio/img/muneco-${s.muneco}.webp`), `${s.id}: muñeco`);
      assert.equal(s.video, "");
    }
    // La numeración estándar de golpes está explicada, para diestros y zurdos.
    const golpes = guia.secciones.find((s: any) => s.id === "golpes-numeracion");
    const t = [...golpes.texto, ...golpes.puntos].join(" ");
    for (const c of ["1 · Jab", "2 · Recto", "3 · Gancho de adelante", "4 · Gancho de atrás", "5 · Uppercut de adelante", "6 · Uppercut de atrás", "diestros", "zurdos"]) assert.ok(t.includes(c), `${funnel}: ${c}`);
  }
});

test("contenido: ids únicos y ejercicios de bajo impacto en el perfil de peso", () => {
  for (const funnel of PERFILES) {
    const plan = planes[funnel];
    const ids = [...sesionesDe(plan).map((s: any) => s.id), ...plan.drills.map((d: any) => d.id), ...plan.guia.secciones.map((s: any) => s.id)];
    assert.equal(new Set(ids).size, ids.length, `ids repetidos en ${funnel}`);
    // Títulos y objetivos distintos dentro de cada nivel.
    for (const nv of plan.niveles) {
      const ses = nv.semanas.flatMap((s: any) => s.sesiones);
      assert.equal(new Set(ses.map((s: any) => s.titulo)).size, ses.length, `títulos repetidos en ${funnel} ${nv.id}`);
      assert.equal(new Set(ses.map((s: any) => s.objetivo)).size, ses.length, `objetivos repetidos en ${funnel} ${nv.id}`);
    }
  }
  const usados = new Set(Object.keys(planes.peso.ejercicios));
  for (const id of IMPACTO) assert.ok(!usados.has(id), `el perfil de peso no puede usar ${id}`);
  for (const e of Object.values<any>(planes.peso.ejercicios)) assert.doesNotMatch(e.nombre, /salto/i);
  // En el perfil de peso, cada sesión arranca los rounds con el test del habla y termina con una pausa de agua.
  for (const s of sesionesDe(planes.peso)) {
    const rounds = s.bloques.find((b: any) => b.tipo === "rounds").pasos;
    assert.equal(rounds[0].ej, "test-habla", s.id);
    assert.equal(s.bloques[4].pasos[0].ej, "pausa-agua", s.id);
  }
});

test("contenido: seguridad y promesas del perfil de peso", () => {
  const guia = planes.peso.guia.secciones.map((s: any) => [...s.texto, ...s.puntos].join(" ")).join(" ").toLowerCase();
  for (const c of ["dolor en el pecho", "mareo", "falta de aire", "dolor punzante", "test del habla", "médico"]) assert.ok(guia.includes(c), `la guía de peso no dice «${c}»`);
  const todo = visibles(planes.peso).join("\n");
  assert.doesNotMatch(todo, /\b(kilos?|kg|adelgaz\w*|quemar|grasa|dieta|calor[ií]as)\b/i, "sin dieta ni promesas de kilos");
  assert.doesNotMatch(todo, /\d+\s*%|\bfrecuencia cardíaca\b|\bpulsaciones por minuto\b|\blatidos\b/i, "sin datos médicos inventados");
});

test("contenido: sin palabras prohibidas, sin emojis y en voseo", () => {
  for (const funnel of PERFILES) {
    const todo = visibles(planes[funnel]).join("\n");
    assert.doesNotMatch(todo, /\b(prueba|pruebas|ejemplo|ejemplos|lorem|ipsum|demo|pr[oó]ximamente)\b/i, funnel);
    assert.doesNotMatch(todo, /\bTODO\b/, funnel);
    assert.doesNotMatch(todo, /\p{Extended_Pictographic}/u, `emoji en ${funnel}`);
    // Voseo: ninguna indicación empieza con un imperativo en «tú» (cierra, baja, sube, mueve, respira...).
    assert.doesNotMatch(todo, /(^|[.;]\s+)(cierra|baja|sube|mueve|respira|mantén|apoya|gira|lleva|empuja|flexiona|estira|camina|exhala|inhala|dobla|toma|pasa|haz|ten)(?![\p{L}])/imu, `imperativos en tuteo en ${funnel}`);
    for (const t of visibles(planes[funnel])) assert.ok(!/\s{2,}/.test(t) && t === t.trim(), `espacios sobrantes en «${t}»`);
  }
});

test("contenido: determinista y sin dependencias del entorno", () => {
  for (const funnel of PERFILES) assert.equal(JSON.stringify(planDe(funnel)), JSON.stringify(planDe(funnel)));
  assert.deepEqual(planDe("peso"), planes.peso);
  // El plan viaja por JSON hacia la app.
  assert.deepEqual(JSON.parse(JSON.stringify(planes.peleador)), planes.peleador);
  const fuentes = readdirSync("prueba-quiz/contenido").filter((f) => f.endsWith(".mjs") && f !== "exportar.mjs");
  assert.ok(fuentes.includes("plan.mjs"));
  for (const f of fuentes) {
    const codigo = leer(`prueba-quiz/contenido/${f}`);
    assert.doesNotMatch(codigo, /Date\.now|new Date|Math\.random|process\.env|from 'node:|from "node:/, f);
  }
  assert.ok(leer("prueba-quiz/contenido/plan.mjs").startsWith("// Contenido escrito para BeastCamp. Pendiente de revisión de Juan Medina antes de publicarlo."));
});

test("contenido: el documento para revisar está al día", () => {
  const md = leer("prueba-quiz/contenido/plan-para-revisar.md");
  assert.equal(md, textoParaRevisar() + "\n", "corré: node prueba-quiz/contenido/exportar.mjs");
  assert.match(md, /^# Plan de entrenamiento BeastCamp: para revisar/);
  assert.match(md, /Pendiente de revisión de Juan Medina antes de publicarlo\./);
});
