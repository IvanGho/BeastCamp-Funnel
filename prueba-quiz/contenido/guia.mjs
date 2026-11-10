// Bono: «Guía de guardia y desplazamientos». Nueve secciones por perfil.
// Numeración de golpes: 1 jab, 2 recto, 3 gancho de adelante, 4 gancho de atrás, 5 uppercut de adelante, 6 uppercut de atrás.
// Las secciones de respiración, errores y «tu espacio en casa y seguridad» cambian según el perfil.

const FRENAR = 'Frená y consultá a tu médico si aparece dolor en el pecho, mareo, falta de aire fuerte o un dolor punzante en una articulación.';

function seccion(id, titulo, texto, puntos, muneco) {
  return { id, titulo, texto, puntos, muneco, video: '' };
}

export function guiaDe(funnel) {
  const peso = funnel === 'peso';

  const postura = seccion('postura-guardia', 'Postura y guardia', [
    'Todo empieza por la postura. Una buena base te da equilibrio, protege tu cara y te deja moverte con comodidad.',
    peso
      ? 'Con una base firme también cuidás las rodillas y la espalda: el peso se reparte y nada trabaja de más.'
      : 'Con la base correcta, cada golpe y cada defensa salen más rápido y con menos gasto de energía.',
  ], [
    'Diestro: pie izquierdo y puño izquierdo adelante. Zurdo: todo al revés. En toda la app, «adelante» es tu lado de adelante.',
    'Pies al ancho de hombros, el de atrás un paso atrás y con el talón apenas levantado.',
    'Rodillas flojas y peso repartido entre los dos pies.',
    'Puños a la altura de las mejillas, codos cerca del torso y mentón hacia abajo.',
    'Mirá al frente, por encima de los puños.',
  ], 'e_guardia');

  const distancia = seccion('distancia', 'Distancia', [
    'La distancia es el espacio entre vos y tu blanco imaginario. Si estás muy cerca, no tenés lugar para pegar; si estás muy lejos, no llegás.',
    'Se regula con los pies, no con el torso. Por eso practicamos primero los pasos y después los golpes.',
  ], [
    'Chequeo rápido: estirá el jab. El puño tiene que llegar con el brazo casi extendido.',
    'Si te sobra brazo, estás muy cerca: dá un paso atrás.',
    'Si tenés que estirarte, estás lejos: dá un paso adelante.',
    'Inclinar el torso para llegar es un error: movete con los pies.',
  ], 'o_tecnica');

  const desplazamientos = seccion('desplazamientos', 'Desplazamientos', [
    'Moverte bien es lo que hace que la guardia valga. Los pasos son cortos y deslizados, nunca saltos grandes.',
    'La regla es simple: el pie que está del lado al que vas se mueve primero, y el otro lo sigue.',
  ], [
    'Adelante: sale primero el pie de adelante. Atrás: sale primero el de atrás.',
    'A la derecha: primero el pie derecho. A la izquierda: primero el izquierdo.',
    'Los pies nunca se cruzan ni se juntan: la separación se mantiene.',
    'Pasos cortos, con las rodillas flojas y la guardia siempre arriba.',
    peso ? 'Sin saltos: los dos pies se despegan solo lo justo para deslizarse.' : 'Rebotá liviano en las puntas y mantené el peso hacia adelante.',
  ], 'e_pies');

  const pivote = seccion('pivote', 'Pivote', [
    'El pivote es girar sobre la punta del pie para cambiar el ángulo sin cambiar de lugar. Es la base del gancho, del recto y de los cambios de ángulo.',
    'La clave es girar sobre la punta, con el talón libre: el pie pegado al piso es lo que tuerce la rodilla.',
  ], [
    'Apoyá la punta del pie de adelante: es tu eje.',
    'Girá sobre esa punta y llevá el pie de atrás hacia un costado.',
    'Cadera y hombros giran juntos y los puños siguen arriba.',
    'Un cuarto de giro alcanza: no hace falta girar de más.',
    peso ? 'Si sentís la rodilla, hacé giros más cortos y con el talón apenas despegado.' : 'Después de pivotar, volvé siempre a la posición de guardia.',
  ], 'c_guardia');

  const golpes = seccion('golpes-numeracion', 'Golpes y numeración', [
    'Los golpes se llaman por número, así las combinaciones se dicen rápido: «1-2» es jab y recto, «1-2-3» es jab, recto y gancho de adelante.',
    'Para diestros, los golpes 1, 3 y 5 salen con la izquierda y los 2, 4 y 6 con la derecha. Para zurdos es al revés.',
  ], [
    '1 · Jab: el puño de adelante sale recto.',
    '2 · Recto (cross): el puño de atrás sale recto, con giro de cadera.',
    '3 · Gancho de adelante: arco corto con el puño de adelante.',
    '4 · Gancho de atrás: arco corto con el puño de atrás.',
    '5 · Uppercut de adelante: sube en línea, pegado al cuerpo.',
    '6 · Uppercut de atrás: sube en línea, con giro de cadera.',
    peso ? 'Al principio vas con el 1, el 2 y el 3. Los demás se suman de a poco, siempre sin forzar.' : 'Cada golpe vuelve a la guardia por el mismo camino por el que salió.',
  ], 'o_sparring');

  const defensa = seccion('defensa-basica', 'Defensa básica', [
    peso
      ? 'No hace falta pelear para aprender a defenderte. Las defensas del plan son suaves y entrenan equilibrio y coordinación.'
      : 'Una buena defensa es la mitad de la técnica. Primero defendés y después respondés: nunca al revés.',
    peso
      ? 'Siempre con las rodillas flexionadas y la espalda larga, sin movimientos bruscos.'
      : 'Practicá cada defensa lento y con la guardia arriba; la velocidad llega sola.',
  ], peso ? [
    'Bloqueo: antebrazos pegados, codos adentro y la mirada al frente.',
    'Esquiva lateral: sacá la cabeza hacia un costado con las rodillas, no con la espalda.',
    'Esquiva baja: bajá poco, con la espalda larga y la mirada al frente.',
    'Si algo molesta la espalda o las rodillas, quedate con el bloqueo y la esquiva lateral.',
  ] : [
    'Bloqueo: antebrazos pegados, codos adentro y la mirada al frente.',
    'Parada: con la mano abierta, empujá el golpe a un costado con un movimiento corto.',
    'Esquiva lateral: sacá la cabeza hacia un costado con las rodillas.',
    'Esquiva baja y rolling: bajá con las piernas, con la espalda larga, y volvé arriba.',
    'Defender y responder: cada defensa termina con un golpe.',
  ], 'e_resp');

  const errores = seccion('errores-comunes', 'Errores comunes', [
    peso
      ? 'Son los errores que más se ven cuando alguien empieza. Corregirlos temprano te cuida las articulaciones.'
      : 'Son los errores que más se ven en todos los niveles. Si los corregís pronto, todo lo demás mejora.',
    'Mientras entrenás, revisá una cosa por round, no todas a la vez.',
  ], peso ? [
    'Bajar la mano de atrás al tirar un golpe.',
    'Trabar las rodillas o arquear la espalda baja.',
    'Subir los hombros hasta las orejas: aflojalos después de cada golpe.',
    'Cruzar los pies al moverte.',
    'Ir más rápido de lo que podés sostener: si no podés hablar, bajá el ritmo.',
    'Aguantar la respiración al golpear.',
  ] : [
    'Bajar la mano de atrás al tirar un golpe.',
    'Golpear solo con el brazo, sin usar los pies ni la cadera.',
    'Cruzar los pies al moverte.',
    'Bajar la mirada al piso al esquivar.',
    'Inclinarte hacia adelante para llegar al blanco.',
    'Aguantar la respiración al golpear.',
  ], 'f_ojo');

  const respiracion = seccion('respiracion', 'Respiración', peso ? [
    'Respirar bien es lo que te permite seguir moviéndote sin quedarte sin aire. Es también tu mejor medidor de esfuerzo.',
    'Usá el test del habla: mientras te movés, tenés que poder decir una frase corta de corrido. Si no podés, bajá el ritmo hasta poder hacerlo.',
  ] : [
    'La respiración marca el ritmo de los rounds. Quien se queda sin aire pierde la técnica antes que la fuerza.',
    'Aprendé a soltar el aire con cada golpe y a recuperarlo en el descanso.',
  ], peso ? [
    'Exhalá con cada golpe, como un «ts» corto.',
    'Inhalá por la nariz mientras volvés a la guardia.',
    'Test del habla: si decís una frase corta de corrido, vas bien. Si no, bajá el ritmo.',
    'En el descanso, respirá hondo: inhalá 4 tiempos y exhalá 6.',
    'Tomá agua en los descansos y al terminar, en tragos chicos.',
  ] : [
    'Exhalá corto y fuerte con cada golpe.',
    'Inhalá por la nariz mientras volvés a la guardia.',
    'En el descanso, respirá hondo: inhalá 4 tiempos y exhalá 6.',
    'Si te agitás, no frenés en seco: bajá la velocidad y seguí moviéndote.',
  ], 'o_estres');

  const espacio = seccion('espacio-seguridad', 'Tu espacio en casa y seguridad', peso ? [
    'Para entrenar solo necesitás un lugar donde puedas abrir los brazos y moverte un par de pasos hacia cada lado. No hace falta ningún equipo.',
    'Antes de empezar, si tenés una lesión, un problema de salud o hace mucho que no entrenás, consultá a tu médico. Este plan no reemplaza a un profesional de la salud.',
  ] : [
    'Para entrenar solo necesitás un lugar donde puedas abrir los brazos y moverte un par de pasos hacia cada lado. No hace falta ningún equipo.',
    'Calentá siempre antes de empezar y, si tenés una lesión o un problema de salud, consultá a tu médico. Este plan no reemplaza a un profesional de la salud.',
  ], peso ? [
    'Piso firme y seco, sin alfombras sueltas. Usá zapatillas con buen agarre o entrená descalzo si el piso lo permite.',
    'Quitá del medio muebles, objetos y cosas que se puedan romper.',
    'Tené agua cerca y tomá en los descansos, en tragos chicos.',
    'El ritmo es el del test del habla. No hace falta ir al límite para que sirva.',
    'Cuidá rodillas, cadera, hombros y espalda: sin saltos, con movimientos cortos y sin forzar.',
    FRENAR,
    'Podés cambiar de nivel cuando quieras. Si un día no tenés energía, hacé la sesión suave.',
  ] : [
    'Piso firme y seco, y espacio libre alrededor. Zapatillas con buen agarre o descalzo si el piso lo permite.',
    'Quitá del medio muebles y objetos. Golpeá al aire, sin llegar a trabar el codo.',
    'Tené agua cerca y tomá en los descansos.',
    'Calentá siempre y no sumes carga de golpe: subí de nivel solo cuando el actual te resulte cómodo.',
    'Respetá los días suaves: ahí se consolida la técnica y se recupera el cuerpo.',
    FRENAR,
  ], 'l_casa');

  return {
    titulo: 'Guía de guardia y desplazamientos',
    secciones: [postura, distancia, desplazamientos, pivote, golpes, defensa, errores, respiracion, espacio],
  };
}
