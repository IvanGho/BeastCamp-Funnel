// Lógica pura de la app del comprador (prueba-quiz/src/app/nucleo.js): racha, bonus, puntos, fusión de progreso, pasos del reproductor
// y ranking con rivales virtuales. Se prueba con el plan real (prueba-quiz/contenido/plan.mjs): mismas reglas de tiempo que el timer.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { planDe } from "../prueba-quiz/contenido/plan.mjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const N: any = new Function(`${readFileSync("prueba-quiz/src/app/nucleo.js", "utf8")}; return NUCLEO;`)();
const ACC = "14aaee8f-80c6-4bc1-964f-47ce4b68d557";
const dia = (n: number, h = 12) => new Date(2026, 10, n, h, 0, 0).getTime();   // noviembre de 2026, hora local

test("app: la racha cuenta días seguidos y sigue viva si entrenaste ayer", () => {
  const p = N.progVacio("t2", dia(1));
  assert.deepEqual(N.racha(p, dia(1)), { dias: 0, hoy: false, mejor: 0 });
  for (const d of [2, 3, 4]) p.sesiones["s" + d] = { fin: dia(d), min: 20, pts: 100 };
  assert.equal(N.racha(p, dia(4, 23)).dias, 3);
  assert.equal(N.racha(p, dia(5)).dias, 3, "ayer entrenó: la racha sigue");
  assert.equal(N.racha(p, dia(5)).hoy, false);
  assert.equal(N.racha(p, dia(6)).dias, 0, "dos días sin entrenar: se corta");
  assert.equal(N.racha(p, dia(6)).mejor, 3);
  p.drills["d1"] = { veces: 1, ultimo: dia(5), pts: 50 };
  assert.equal(N.racha(p, dia(5)).dias, 4, "un drill también cuenta para la racha");
});

test("app: bonus de racha, 10 puntos por día seguido después del primero, hasta 60 y una vez por día", () => {
  assert.deepEqual([1, 2, 3, 7, 8, 30].map(N.bonusRacha), [0, 10, 20, 60, 60, 60]);
  const p = N.progVacio("t1", dia(1));
  const r1 = N.completarSesion(p, { id: "a", puntos: 180 }, dia(1), 18);
  assert.deepEqual([r1.base, r1.bonus, r1.pts], [180, 0, 180]);
  const r2 = N.completarSesion(p, { id: "b", puntos: 200 }, dia(2), 20);
  assert.deepEqual([r2.base, r2.bonus, r2.pts, r2.racha.dias], [200, 10, 210, 2]);
  const r3 = N.completarSesion(p, { id: "c", puntos: 200 }, dia(2, 20), 20);
  assert.equal(r3.bonus, 0, "la segunda sesión del mismo día no repite el bonus");
  const rep = N.completarSesion(p, { id: "a", puntos: 180 }, dia(3), 18);
  assert.deepEqual([rep.repetida, rep.pts], [true, 0], "repetir una sesión hecha no suma");
  assert.equal(p.sesiones.a.pts, 180);
  assert.equal(N.totales(p).puntos, 180 + 210 + 200);
  assert.equal(N.totales(p).sesiones, 3);
});

test("app: un drill suma sus puntos una vez por día, pero se puede repetir", () => {
  const p = N.progVacio("t1", dia(1));
  const d = { id: "drill-x", puntos: 50 };
  assert.equal(N.completarDrill(p, d, dia(1, 9)).pts, 50);
  assert.equal(N.completarDrill(p, d, dia(1, 18)).pts, 0);
  assert.equal(N.completarDrill(p, d, dia(2)).pts, 50);
  assert.deepEqual(p.drills["drill-x"], { veces: 3, ultimo: dia(2), pts: 100 });
});

test("app: fusionar une sesiones y drills y deja lo más nuevo para el resto", () => {
  const a = N.progVacio("t1", dia(1), "Ana");
  a.sesiones.x = { fin: dia(3), min: 20, pts: 100 }; a.drills.d = { veces: 2, ultimo: dia(3), pts: 50 }; a.actualizado = dia(3);
  const b = N.progVacio("t3", dia(2), "Beto");
  b.sesiones.x = { fin: dia(2), min: 18, pts: 90 }; b.sesiones.y = { fin: dia(4), min: 25, pts: 120 }; b.drills.d = { veces: 3, ultimo: dia(2), pts: 100 }; b.actualizado = dia(5);
  const f = N.fusionar(a, b);
  assert.deepEqual(Object.keys(f.sesiones).sort(), ["x", "y"]);
  assert.equal(f.sesiones.x.fin, dia(2), "queda la primera vez que se hizo");
  assert.deepEqual(f.drills.d, { veces: 3, ultimo: dia(3), pts: 100 });
  assert.equal(f.apodo, "Beto"); assert.equal(f.nivel, "t3");
  assert.equal(f.inicio, dia(1)); assert.equal(f.actualizado, dia(5));
  assert.deepEqual(N.fusionar(null, b), b); assert.deepEqual(N.fusionar(a, null), a);
});

test("app: normalizarProg descarta lo que no es versión 1 y limpia valores raros", () => {
  assert.equal(N.normalizarProg(null), null);
  assert.equal(N.normalizarProg({ v: 2 }), null);
  const p = N.normalizarProg({ v: 1, apodo: "Ana <b>", nivel: "t9", inicio: 5, sesiones: { a: { fin: 1, min: 2, pts: 3 }, b: 7 }, drills: {}, ajustes: { sonido: false, voz: "sí" }, actualizado: 9 });
  assert.equal(p.apodo, "Ana b"); assert.equal(p.nivel, "t1");
  assert.deepEqual(Object.keys(p.sesiones), ["a"]);
  assert.deepEqual(p.ajustes, { sonido: false, voz: true, vibracion: true });
  assert.equal(N.apodoValido("Martín_9 .-"), true); assert.equal(N.apodoValido("x".repeat(21)), false); assert.equal(N.apodoValido("a<b"), false);
});

for (const funnel of ["peso", "peleador"] as const) {
  test(`app: los pasos del reproductor usan la misma regla de tiempo que el plan (${funnel})`, () => {
    const plan = planDe(funnel);
    let sesiones = 0;
    for (const nv of plan.niveles) for (const s of N.sesionesDe(nv)) {
      sesiones++;
      const pasos = N.pasosDe(s, plan);
      assert.ok(pasos.length > 0, s.id);
      assert.ok(pasos.every((x: { seg: number }) => x.seg > 0), "todos los pasos son por tiempo");
      assert.equal(Math.round(N.segTotales(pasos) / 60), s.minutos, `${s.id}: los minutos salen de rondas × (seg + descanso)`);
      assert.equal(pasos.filter((x: { t: string }) => x.t === "trabajo").length, s.bloques.flatMap((b: { pasos: { rondas: number }[] }) => b.pasos).reduce((a: number, p: { rondas: number }) => a + p.rondas, 0));
    }
    assert.ok(sesiones >= 48);
    for (const d of plan.drills) assert.equal(Math.round(N.segTotales(N.pasosDe(d, plan)) / 60), d.minutos, d.id);
  });
}

test("app: siguiente sesión, sesión por id y muñecos del plan", () => {
  const plan = planDe("peso");
  const nv = N.nivelDe(plan, "t2");
  const p = N.progVacio("t2", dia(1));
  const todas = N.sesionesDe(nv);
  assert.equal(N.siguienteSesion(nv, p).id, todas[0].id);
  p.sesiones[todas[0].id] = { fin: dia(1), min: 30, pts: 300 };
  assert.equal(N.siguienteSesion(nv, p).id, todas[1].id);
  assert.equal(N.buscarSesion(plan, todas[5].id).nivelId, "t2");
  assert.equal(N.buscarSesion(plan, "no-existe"), null);
  for (const k of N.munecosDelPlan(plan)) assert.ok(/^[a-z0-9_]+$/.test(k), k);
  assert.ok(N.MUNECOS_APP.includes("t1") && N.MUNECOS_APP.includes("o_competir"));
});

test("app: el ranking es determinista, depende del acceso y de la fecha, y todos los rivales son virtuales", () => {
  const plan = planDe("peso");
  const p = N.progVacio("t2", dia(1), "Martín");
  const a = N.ranking(ACC, plan, p, "Martín", dia(5));
  assert.deepEqual(N.ranking(ACC, plan, p, "Martín", dia(5, 23)), a, "mismo día, mismo ranking");
  const otro = N.ranking("0f4b6e1c-5d2a-4c3b-8a9e-1b2c3d4e5f60", plan, p, "Martín", dia(5));
  assert.notDeepEqual(otro.map((x: { nombre: string }) => x.nombre), a.map((x: { nombre: string }) => x.nombre));
  assert.equal(a.length, 8);
  assert.equal(a.filter((x: { virtual: boolean }) => !x.virtual).length, 1);
  assert.equal(a.filter((x: { virtual: boolean }) => x.virtual).length, 7);
  assert.equal(new Set(a.map((x: { nombre: string }) => x.nombre)).size, 8, "sin nombres repetidos");
  const yo = a.find((x: { virtual: boolean }) => !x.virtual);
  assert.equal(yo.nombre, "Martín"); assert.equal(yo.pts, 0);
  assert.deepEqual(a.map((x: { pos: number }) => x.pos), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(a.every((x: { pts: number }, i: number, l: { pts: number }[]) => i === 0 || l[i - 1].pts >= x.pts), "ordenado por puntos");
  // los rivales suman con los días y nunca bajan
  const rv = (d: number) => N.rivales(ACC, N.idxDia(dia(d)), N.idxDia(dia(1)), N.ritmoRef(plan));
  const [d3, d10] = [rv(3), rv(10)];
  assert.deepEqual(d3.map((x: { nombre: string }) => x.nombre), d10.map((x: { nombre: string }) => x.nombre));
  d3.forEach((x: { pts: number }, i: number) => assert.ok(d10[i].pts >= x.pts));
  assert.ok(d10.some((x: { pts: number }, i: number) => x.pts > d3[i].pts));
  // el comprador entra con sus puntos reales
  p.sesiones.s = { fin: dia(5), min: 30, pts: 99999 };
  const r2 = N.ranking(ACC, plan, p, "Martín", dia(5));
  assert.equal(r2[0].nombre, "Martín"); assert.equal(r2[0].pts, 99999);
});

test("app: tira de la semana y calendario de 28 días", () => {
  const p = N.progVacio("t1", dia(2));   // 2 de noviembre de 2026 = lunes
  p.sesiones.a = { fin: dia(3), min: 20, pts: 100 };
  const s = N.semanaDe(p, dia(4));
  assert.deepEqual(s.map((x: { letra: string }) => x.letra), ["L", "M", "X", "J", "V", "S", "D"]);
  assert.deepEqual(s.map((x: { hecho: boolean }) => x.hecho), [false, true, false, false, false, false, false]);
  assert.equal(s.findIndex((x: { hoy: boolean }) => x.hoy), 2);
  const c = N.calendario(p, dia(4));
  assert.equal(c.length, 28); assert.equal(c[0].num, 1); assert.equal(c[1].hecho, true);
  assert.equal(N.calendario(p, dia(2) + 40 * 864e5).length, 28);
  assert.equal(N.numeroDeDia(p, dia(4)), 3);
});
