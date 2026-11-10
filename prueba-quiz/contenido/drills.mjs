// Drills: ejercicios sueltos de 3 a 8 minutos, para sumar puntos entre sesiones.
// Cada paso: [ejercicio, seg, descanso, rondas, combo, nota]. Duración de un paso = rondas × (seg + descanso).
// minutos = suma de los pasos, redondeada al minuto; puntos = minutos × 10.

const DRILLS_PELEADOR = [
  ['drill-pies-guardia', 'Pies y guardia', 'e_pies', 'Base, pasos y pivote.', [
    ['postura-guardia', 30, 0, 1, '', 'Armá la guardia y revisá cada detalle.'],
    ['paso-adelante-atras', 40, 20, 3, '', 'Pasos cortos, sin juntar los pies.'],
    ['paso-lateral', 40, 20, 3, '', 'Sin cruzar los pies.'],
    ['pivote', 30, 15, 2, '', 'Girá sobre la punta del pie.'],
  ]],
  ['drill-jab-recto', 'Jab y recto', 'o_tecnica', 'Los dos golpes base, limpios y con la guardia arriba.', [
    ['jab', 45, 15, 2, '1', 'Salí y volvé por el mismo camino.'],
    ['recto', 45, 15, 2, '2', 'Girá la cadera.'],
    ['jab-recto', 45, 15, 3, '1-2', 'Que el segundo golpe no apure al primero.'],
  ]],
  ['drill-esquivas', 'Esquivas y vuelta a la guardia', 'e_pies', 'Esquiva lateral, esquiva baja y bloqueo.', [
    ['esquiva-lateral', 40, 20, 3, '', 'Con las rodillas, sin inclinar el cuello.'],
    ['esquiva-baja', 40, 20, 2, '', 'Bajá con las piernas, espalda larga.'],
    ['bloqueo', 40, 20, 2, '', 'Antebrazos pegados y mirada al frente.'],
  ]],
  ['drill-ganchos', 'Ganchos 3 y 4', 'o_resist', 'Arco corto y giro de cadera.', [
    ['gancho-adelante', 45, 15, 3, '3', 'Codo a la altura del puño.'],
    ['gancho-atras', 45, 15, 3, '4', 'Frená el giro cuando llegás.'],
  ]],
  ['drill-uppercuts', 'Uppercuts 5 y 6', 'n_seis', 'Golpes que suben desde las piernas, cortos y pegados al cuerpo.', [
    ['uppercut-adelante', 45, 15, 2, '5', 'Flexioná apenas las rodillas.'],
    ['uppercut-atras', 45, 15, 2, '6', 'Codo pegado al cuerpo.'],
    ['sombra-combos', 45, 15, 2, '1-2-5-6', 'Jab, recto y los dos uppercuts.'],
  ]],
  ['drill-combo-123', 'La combinación 1-2-3', 't3', 'Jab, recto y gancho sin perder la guardia.', [
    ['combo-123', 45, 15, 3, '1-2-3', 'Despacio, uno, dos y tres.'],
    ['sombra-combos', 60, 20, 2, '1-2-3', 'Ahora con pasos entre combinaciones.'],
  ]],
  ['drill-angulos', 'Pivote y cambios de ángulo', 'c_guardia', 'Terminar la combinación desde un ángulo nuevo.', [
    ['pivote', 40, 20, 3, '', 'Un cuarto de giro, sobre la punta.'],
    ['cambio-angulo', 40, 20, 3, '1-2', 'Pegá y salí por el costado.'],
  ]],
  ['drill-defensa-respuesta', 'Defendé y respondé', 'n_seis', 'Cada defensa termina con un golpe.', [
    ['defender-responder', 45, 15, 3, '1-2', 'Esquivá o bloqueá primero.'],
    ['sombra-defensa', 60, 20, 2, '1-2', 'Una defensa, una respuesta y un paso.'],
  ]],
  ['drill-round-3', 'Un round de 3 minutos', 't4', 'Un round completo, como en una pelea.', [
    ['rebote-guardia', 30, 0, 1, '', 'Entrá en calor con la guardia armada.'],
    ['round-completo', 180, 60, 1, '', 'Tres minutos con todo lo que sabés.'],
  ]],
  ['drill-velocidad', 'Velocidad de manos', 't2', 'Ráfagas cortas con técnica limpia.', [
    ['postura-guardia', 30, 0, 1, '', 'Revisá la guardia antes de arrancar.'],
    ['sombra-ritmo', 20, 10, 8, '1-2', '20 segundos rápidos y 10 de pausa.'],
  ]],
  ['drill-respiracion-golpes', 'Golpear sin quedarte sin aire', 'f_aburro', 'Exhalar con cada golpe y recuperar en el descanso.', [
    ['golpe-respiracion', 45, 15, 3, '1-2', 'Exhalá con cada golpe.'],
    ['respiracion-calma', 60, 0, 1, '', 'Inhalá 4 tiempos y exhalá 6.'],
  ]],
  ['drill-hombros-munecas', 'Hombros y muñecas listos', 'm_golpes', 'Movilidad y jab suave para llegar sin molestias al próximo entrenamiento.', [
    ['giros-hombros', 30, 0, 1, '', 'Círculos amplios, hacia atrás y hacia adelante.'],
    ['circulos-munecas', 30, 0, 1, '', 'Suave, sin forzar.'],
    ['jab', 40, 20, 3, '1', 'Relajá los hombros después de cada golpe.'],
    ['estirar-hombros', 30, 0, 2, '', 'Un lado y el otro.'],
  ]],
];

const DRILLS_PESO = [
  ['drill-postura', 'Postura y guardia', 'e_guardia', 'La base de todo: pararte bien.', [
    ['postura-guardia', 30, 0, 1, '', 'Armá la guardia y revisá cada detalle.'],
    ['balanceo-peso', 40, 20, 2, '', 'Despacio, con los dos pies apoyados.'],
    ['paso-adelante-atras', 40, 20, 2, '', 'Pasos cortos, sin saltar.'],
  ]],
  ['drill-jab-suave', 'Jab sin apuro', 'o_tecnica', 'Un solo golpe, bien hecho.', [
    ['jab', 40, 20, 3, '1', 'Salí y volvé por el mismo camino.'],
    ['golpe-respiracion', 40, 20, 2, '1', 'Exhalá al tirar el jab.'],
  ]],
  ['drill-jab-recto', 'Jab y recto', 'o_sparring', 'Los dos golpes base, en ritmo de conversación.', [
    ['jab', 40, 20, 2, '1', 'Con los hombros sueltos.'],
    ['recto', 40, 20, 2, '2', 'Giro corto de cadera.'],
    ['jab-recto', 40, 20, 2, '1-2', 'Ritmo parejo, sin apurar.'],
  ]],
  ['drill-pasos', 'Pasos sin saltos', 'e_pies', 'Moverte con la guardia armada y sin impacto.', [
    ['paso-toca', 40, 20, 2, '', 'Un ritmo en el que podés hablar.'],
    ['paso-adelante-atras', 40, 20, 2, '', 'Pasos cortos.'],
    ['paso-lateral', 40, 20, 2, '', 'Sin cruzar los pies.'],
  ]],
  ['drill-esquiva-lateral', 'Esquiva lateral', 'e_resp', 'Esquiva con las rodillas y bloqueo, sin forzar.', [
    ['esquiva-lateral', 40, 20, 3, '', 'Flexioná las rodillas, no la espalda.'],
    ['bloqueo', 40, 20, 2, '', 'Antebrazos pegados y mirada al frente.'],
  ]],
  ['drill-gancho-suave', 'Gancho de adelante, sin forzar', 'o_resist', 'Pivote corto y arco corto.', [
    ['pivote', 30, 15, 2, '', 'Giro corto, con el talón libre.'],
    ['gancho-adelante', 40, 20, 3, '3', 'Girá de a poco.'],
  ]],
  ['drill-hombros-espalda', 'Hombros y espalda sueltos', 'e_pies', 'Movilidad y estiramientos suaves, ideal para después de un día largo.', [
    ['giros-hombros', 40, 0, 1, '', 'Círculos amplios.'],
    ['circulos-munecas', 40, 0, 1, '', 'Suave y sin dolor.'],
    ['giros-torso', 40, 0, 1, '', 'Desde el torso, no desde las rodillas.'],
    ['estirar-pecho', 40, 0, 1, '', 'Abrí el pecho y respirá.'],
    ['estirar-hombros', 40, 0, 1, '', 'Un lado y el otro.'],
    ['estirar-espalda', 40, 0, 1, '', 'Girá suave, sin forzar.'],
  ]],
  ['drill-respiracion-calma', 'Respiración de calma', 'o_estres', 'Bajás el ritmo y soltás tensión.', [
    ['respiracion-calma', 60, 30, 3, '', 'Inhalá 4 tiempos y exhalá 6.'],
  ]],
  ['drill-ritmo-habla', 'Ritmo de conversación', 'f_ayuda', 'Practicás medir el esfuerzo con el test del habla.', [
    ['test-habla', 30, 0, 1, '', 'Decí una frase en voz alta mientras te movés.'],
    ['sombra-ritmo', 60, 30, 3, '1-2', 'Ajustá la velocidad para poder hablar.'],
  ]],
  ['drill-piernas', 'Piernas firmes, sin saltos', 'o_resist', 'Fuerza de piernas con apoyo y sin impacto.', [
    ['sentadilla-silla', 30, 30, 3, '', 'Rodillas en línea con los pies.'],
    ['puente-gluteo', 30, 30, 3, '', 'Subí hasta formar una línea recta.'],
    ['elevacion-talones', 30, 30, 2, '', 'Subí y bajá con control.'],
  ]],
  ['drill-combo-123', 'Tres golpes a media velocidad', 't3', 'Jab, recto y gancho, bien hechos y sin apuro.', [
    ['combo-123', 40, 20, 3, '1-2-3', 'Despacio, uno, dos y tres.'],
    ['sombra-suave', 60, 30, 2, '1-2-3', 'Sin fuerza y con la guardia arriba.'],
  ]],
];

function armar(lista) {
  return lista.map(([id, titulo, muneco, foco, pasos]) => {
    const ps = pasos.map(([ej, seg, descanso, rondas, combo, nota]) => {
      const p = { ej, seg, descanso, rondas };
      if (combo) p.combo = combo;
      if (nota) p.nota = nota;
      return p;
    });
    const segundos = ps.reduce((a, p) => a + p.rondas * (p.seg + p.descanso), 0);
    const minutos = Math.round(segundos / 60);
    return { id, titulo, minutos, puntos: minutos * 10, foco, muneco, video: '', pasos: ps };
  });
}

export function drillsDe(funnel) {
  return armar(funnel === 'peso' ? DRILLS_PESO : DRILLS_PELEADOR);
}
