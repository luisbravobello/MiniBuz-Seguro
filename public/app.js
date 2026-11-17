const formReporte = document.getElementById('form-reporte');
const msgReporte = document.getElementById('msg-reporte');
const formLogin = document.getElementById('form-login');
const msgLogin = document.getElementById('msg-login');
const seccionLogin = document.getElementById('seccion-login');
const panelAdmin = document.getElementById('panel-admin');
const formBuscar = document.getElementById('form-buscar');
const inputBuscar = document.getElementById('buscar');
const lista = document.getElementById('lista-reportes');
const msgPanel = document.getElementById('msg-panel');
const btnSalir = document.getElementById('btn-salir');

const MAX_TITULO = 120;
const MAX_MENSAJE = 2000;
const MAX_IMG = 2 * 1024 * 1024;

let csrfToken = null;

function mostrar(el, texto, tipo) {
  if (!el) return;
  el.textContent = texto || '';
  el.className = tipo ? 'msg ' + tipo : 'msg';
}

async function leerJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function textoError(res, data) {
  if (data && (data.error || data.mensaje)) return data.error || data.mensaje;
  switch (res.status) {
    case 400: return 'Datos invalidos, revisa el formulario.';
    case 401: return 'Tienes que iniciar sesion.';
    case 403: return 'Solicitud rechazada.';
    case 404: return 'No se encontro el reporte.';
    case 413: return 'El archivo es muy grande.';
    case 429: return 'Demasiados intentos, espera un momento.';
    default: return 'Ocurrio un error, intenta de nuevo.';
  }
}

async function pedirCsrf() {
  const res = await fetch('/api/admin/csrf', { credentials: 'same-origin' });
  if (!res.ok) {
    csrfToken = null;
    return null;
  }
  const data = await leerJson(res);
  csrfToken = data.csrfToken || data.token || null;
  return csrfToken;
}

function validarReporte(titulo, mensaje, archivo) {
  if (titulo.length < 1 || titulo.length > MAX_TITULO) {
    return 'El titulo debe tener entre 1 y ' + MAX_TITULO + ' caracteres.';
  }
  if (mensaje.length < 1 || mensaje.length > MAX_MENSAJE) {
    return 'El mensaje debe tener entre 1 y ' + MAX_MENSAJE + ' caracteres.';
  }
  if (archivo) {
    const ok = ['image/jpeg', 'image/png'].includes(archivo.type);
    if (!ok) return 'Solo se permiten imagenes JPG o PNG.';
    if (archivo.size > MAX_IMG) return 'La imagen no puede pasar de 2 MB.';
  }
  return null;
}

if (formReporte) {
  formReporte.addEventListener('submit', async (e) => {
    e.preventDefault();
    mostrar(msgReporte, '');

    const titulo = formReporte.titulo.value.trim();
    const mensaje = formReporte.mensaje.value.trim();
    const archivo = formReporte.imagen && formReporte.imagen.files[0];

    const error = validarReporte(titulo, mensaje, archivo);
    if (error) {
      mostrar(msgReporte, error, 'error');
      return;
    }

    const fd = new FormData();
    fd.append('titulo', titulo);
    fd.append('mensaje', mensaje);
    if (archivo) fd.append('imagen', archivo);

    const boton = formReporte.querySelector('button[type="submit"]');
    if (boton) boton.disabled = true;

    try {
      const res = await fetch('/api/reportes', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin'
      });
      const data = await leerJson(res);
      if (!res.ok) {
        mostrar(msgReporte, textoError(res, data), 'error');
        return;
      }
      formReporte.reset();
      mostrar(msgReporte, 'Reporte enviado, gracias.', 'ok');
      if (panelAdmin && !panelAdmin.hidden) cargarReportes(inputBuscar ? inputBuscar.value : '');
    } catch {
      mostrar(msgReporte, 'No se pudo conectar con el servidor.', 'error');
    } finally {
      if (boton) boton.disabled = false;
    }
  });
}

function verPanel(logueado) {
  if (seccionLogin) seccionLogin.hidden = logueado;
  if (panelAdmin) panelAdmin.hidden = !logueado;
  if (!logueado) {
    csrfToken = null;
    if (lista) lista.replaceChildren();
  }
}

if (formLogin) {
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    mostrar(msgLogin, '');

    const password = formLogin.password.value;
    if (!password) {
      mostrar(msgLogin, 'Escribe la contrasena.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'same-origin'
      });
      formLogin.reset();
      if (!res.ok) {
        const data = await leerJson(res);
        mostrar(msgLogin, res.status === 401 ? 'Contrasena incorrecta.' : textoError(res, data), 'error');
        return;
      }
      verPanel(true);
      await pedirCsrf();
      cargarReportes('');
    } catch {
      mostrar(msgLogin, 'No se pudo conectar con el servidor.', 'error');
    }
  });
}

function crearTarjeta(r) {
  const li = document.createElement('li');
  li.className = 'reporte';

  const h3 = document.createElement('h3');
  h3.textContent = r.titulo;

  const fecha = document.createElement('small');
  fecha.textContent = '#' + r.id + ' - ' + (r.fecha || '');

  const p = document.createElement('p');
  p.textContent = r.mensaje;

  li.append(h3, fecha, p);

  if (r.tieneImagen) {
    const btnImg = document.createElement('button');
    btnImg.type = 'button';
    btnImg.textContent = 'Ver imagen';
    btnImg.addEventListener('click', () => {
      const img = document.createElement('img');
      img.alt = 'Imagen del reporte ' + r.id;
      img.src = '/api/admin/reportes/' + encodeURIComponent(r.id) + '/imagen';
      img.addEventListener('error', () => {
        img.remove();
        mostrar(msgPanel, 'No se pudo cargar la imagen.', 'error');
      });
      btnImg.replaceWith(img);
    });
    li.append(btnImg);
  }

  const btnBorrar = document.createElement('button');
  btnBorrar.type = 'button';
  btnBorrar.className = 'borrar';
  btnBorrar.textContent = 'Eliminar';
  btnBorrar.addEventListener('click', () => eliminarReporte(r.id, li));
  li.append(btnBorrar);

  return li;
}

async function cargarReportes(texto) {
  if (!lista) return;
  mostrar(msgPanel, '');

  const buscar = (texto || '').trim().slice(0, 100);
  let url = '/api/admin/reportes';
  if (buscar) url += '?buscar=' + encodeURIComponent(buscar);

  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    const data = await leerJson(res);
    if (res.status === 401) {
      verPanel(false);
      mostrar(msgLogin, 'La sesion expiro, vuelve a entrar.', 'error');
      return;
    }
    if (!res.ok) {
      mostrar(msgPanel, textoError(res, data), 'error');
      return;
    }

    const reportes = Array.isArray(data) ? data : (data.reportes || []);
    lista.replaceChildren();

    if (reportes.length === 0) {
      const vacio = document.createElement('li');
      vacio.textContent = buscar ? 'No hay reportes con ese titulo.' : 'Todavia no hay reportes.';
      lista.append(vacio);
      return;
    }

    reportes.forEach((r) => lista.append(crearTarjeta(r)));
  } catch {
    mostrar(msgPanel, 'No se pudo conectar con el servidor.', 'error');
  }
}

async function eliminarReporte(id, li) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return;
  if (!confirm('Seguro que quieres eliminar el reporte #' + n + '?')) return;

  if (!csrfToken) await pedirCsrf();

  try {
    let res = await borrar(n);
    if (res.status === 403) {
      await pedirCsrf();
      res = await borrar(n);
    }
    const data = await leerJson(res);
    if (res.status === 401) {
      verPanel(false);
      mostrar(msgLogin, 'La sesion expiro, vuelve a entrar.', 'error');
      return;
    }
    if (!res.ok) {
      mostrar(msgPanel, textoError(res, data), 'error');
      return;
    }
    li.remove();
    mostrar(msgPanel, 'Reporte eliminado.', 'ok');
    if (lista && lista.children.length === 0) cargarReportes(inputBuscar ? inputBuscar.value : '');
  } catch {
    mostrar(msgPanel, 'No se pudo conectar con el servidor.', 'error');
  }
}

function borrar(id) {
  return fetch('/api/admin/reportes/' + id, {
    method: 'DELETE',
    headers: { 'X-CSRF-Token': csrfToken || '' },
    credentials: 'same-origin'
  });
}

if (formBuscar) {
  formBuscar.addEventListener('submit', (e) => {
    e.preventDefault();
    cargarReportes(inputBuscar.value);
  });
}

if (btnSalir) {
  btnSalir.addEventListener('click', async () => {
    if (!csrfToken) await pedirCsrf();
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrfToken || '' },
        credentials: 'same-origin'
      });
    } catch {}
    verPanel(false);
    mostrar(msgLogin, 'Sesion cerrada.', 'ok');
  });
}

async function revisarSesion() {
  try {
    const res = await fetch('/api/admin/session', { credentials: 'same-origin' });
    const data = await leerJson(res);
    const activa = res.ok && data.autenticado !== false && data.ok !== false;
    if (activa) {
      verPanel(true);
      await pedirCsrf();
      cargarReportes('');
    } else {
      verPanel(false);
    }
  } catch {
    verPanel(false);
  }
}

revisarSesion();
