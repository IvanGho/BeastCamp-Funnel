/* Gracias (/gracias/), compartida por los dos funnels. Hilvapay redirige acá con los datos de la compra en la dirección:
   nombre, email, acceso (el que viajó en el link de pago) y la campaña (utm_*, fbclid). La campaña ya la guardó comun.js.
   Se muestran con esc(), nunca sin escapar: vienen de la URL. */
(function () {
  const q = new URLSearchParams(location.search);
  const limpio = (v, n) => String(v || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);

  /* Nombre y mail: de la dirección; si no vienen (por ejemplo al recargar), lo que quedó de esta sesión. */
  const nombreUrl = limpio(q.get('nombre'), 60);
  const mailUrl = limpio(q.get('email'), 120);
  if (nombreUrl) A.nombre = nombreUrl;
  if (mailUrl) A.mail = mailUrl;
  if (nombreUrl || mailUrl) guardaA();

  /* Los datos personales no se quedan en la barra de direcciones ni en el historial (el acceso y la campaña sí). */
  if (q.has('nombre') || q.has('email') || location.hash) {
    q.delete('nombre'); q.delete('email');
    const resto = q.toString();
    try { history.replaceState(null, '', location.pathname + (resto ? '?' + resto : '')); } catch (e) {}
  }

  /* Acceso: el de la dirección; si no vino, el que se creó al tocar «Ir al pago» en este navegador. */
  const deUrl = limpio(q.get('acceso'), 80).toLowerCase();
  const acceso = RE_ACCESO.test(deUrl) ? deUrl : accesoGuardado(false);
  if (acceso) lsGuardar('bc_app_ultimo', acceso);
  const destino = DATOS.appUrl ? DATOS.appUrl + (acceso ? acceso + '/' : '') : '';

  const nom = esc(A.nombre || 'Campeón');
  const mail = /^\S+@\S+\.\S+$/.test(A.mail || '') ? esc(A.mail) : 'tu mail';
  const confeti = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((k) => '<i class="cf cf-' + k + '"></i>').join('');
  $('app').innerHTML =
    '<div class="scr gracias"><div class="festejo" aria-hidden="true">' + confeti + '<span class="aro"></span><span class="aro dos"></span></div>' +
    '<div class="tick"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg></div>' +
    '<div class="tag cen">Bienvenido a BeastCamp</div>' +
    '<h1>Listo, ' + nom + '. Tu BeastCamp está activado.</h1>' +
    '<p>Te mandamos el acceso a <b>' + mail + '</b>. Revisá también spam.</p>' +
    (destino ? '<a class="cta" id="entrar" href="' + esc(destino) + '">Entrar a mi plan</a>' : '') +
    '<div class="box gr-aviso">' + I_CANDADO + '<span>Guardá el mail: ese link es tu acceso personal. No lo compartas.</span></div>' +
    '<p class="note" style="margin-top:14px">Garantía de devolución de ' + DATOS.garantiaDias + ' días.</p></div>';
  pie();
})();
