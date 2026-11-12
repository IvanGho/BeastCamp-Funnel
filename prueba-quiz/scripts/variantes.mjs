// Los dos funnels salen en dominios distintos, cada uno con su quiz, sus ofertas y su app (PWA):
//   camp           → camp.infinixapp.com           → peleadores avanzados (/quiz/, /oferta/, /back1/, /back2/)
//   shadowboxing   → shadowboxing.infinixapp.com   → bajar de peso con shadowboxing (/quiz-peso/, /oferta-peso/, /back1-peso/, /back2-peso/)
// `construir-quiz.mjs` y `construir-app.mjs` leen BC_VARIANTE (camp | shadowboxing) y BC_DESTINO; sin variante arman el sitio completo en prueba-quiz/sitio/.
export const VARIANTES = {
  camp: {
    id: "camp",
    dominio: "camp.infinixapp.com",
    funnel: "peleador",
    og: "peleador",
    quiz: "/quiz/",
    paginas: ["quiz", "oferta", "back1", "back2"],
    vps: { carpeta: "/srv/ivg/apps/beast-camp-prueba", api: "beast-camp-prueba-api-1" },
    app: {
      nombre: "BeastCamp: shadowboxing para peleadores",
      corto: "BeastCamp",
      descripcion: "Tu plan de 4 semanas de shadowboxing para entrenar como peleador: sesiones con timer, drills, racha y ranking.",
    },
  },
  shadowboxing: {
    id: "shadowboxing",
    dominio: "shadowboxing.infinixapp.com",
    funnel: "peso",
    og: "peso",
    quiz: "/quiz-peso/",
    paginas: ["quiz-peso", "oferta-peso", "back1-peso", "back2-peso"],
    vps: { carpeta: "/srv/ivg/apps/beast-camp-shadow", api: "beast-camp-shadow-api-1" },
    app: {
      nombre: "Shadowboxing: bajá de peso en casa",
      corto: "Shadowboxing",
      descripcion: "Tu plan de 4 semanas para bajar de peso con shadowboxing en casa: sesiones con timer, rutinas guiadas, racha y ranking.",
    },
  },
};
export const variante = (id) => { if (!id) return null; const v = VARIANTES[id]; if (!v) throw new Error(`BC_VARIANTE desconocida: ${id}`); return v; };
