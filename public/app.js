// Inicio URLs
const API_URL = '/api';

// Inicio escape HTML para datos de usuario y de la base de datos
const escaparHTML = (texto) => String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Inicio formato de fechas segun su precision
function romano(n) {
    const simbolos = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let resultado = '';
    for (const [valor, simbolo] of simbolos) {
        while (n >= valor) {
            resultado += simbolo;
            n -= valor;
        }
    }
    return resultado;
}

function formatearFecha(anio, precision = 'exacta') {
    const texto = anio === 0 ? 'A.D. 0' : (anio < 0 ? `${Math.abs(anio)} a.C.` : String(anio));
    if (precision === 'aproximada') return `c. ${texto}`;
    if (precision === 'siglo') return `s. ${romano(Math.ceil(Math.abs(anio) / 100) || 1)}${anio < 0 ? ' a.C.' : ''}`;
    if (precision === 'decada') {
        const decada = Math.floor(anio / 10) * 10;
        return decada < 0 ? `${Math.abs(decada)}s a.C.` : `${decada}s`;
    }
    return texto;
}

// Inicio token de sesion en peticiones a la API
const fetchSinToken = window.fetch.bind(window);
window.fetch = (url, opciones = {}) => {
    const token = localStorage.getItem('token_cronos');
    if (typeof url === 'string' && url.startsWith(`${API_URL}/`) && token) {
        opciones = { ...opciones, headers: { ...(opciones.headers || {}), Authorization: `Bearer ${token}` } };
    }
    return fetchSinToken(url, opciones);
};

// Inicio parseo JSON
const manejarRespuesta = async (respuesta) => {
    if (respuesta.status === 401) {
        localStorage.removeItem('usuario_cronos');
        localStorage.removeItem('token_cronos');
        window.location.href = 'index.html';
    }
    const datos = await respuesta.json();
    if (!respuesta.ok) {
        throw new Error(datos.error || 'Error desconocido');
    }
    return datos;
};

// ==========================================
// Inicio logica autenticacion
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const formularioLogin = document.getElementById('loginForm');
    const formularioRegistro = document.getElementById('registerForm');
    
    // Inicio alternar vistas
    const btnMostrarRegistro = document.getElementById('showRegister');
    const btnMostrarLogin = document.getElementById('showLogin');
    const tarjetaLogin = document.getElementById('loginCard');
    const tarjetaRegistro = document.getElementById('registerCard');

    if (btnMostrarRegistro && btnMostrarLogin) {
        btnMostrarRegistro.addEventListener('click', (e) => {
            e.preventDefault();
            tarjetaLogin.classList.add('hidden');
            tarjetaRegistro.classList.remove('hidden');
        });

        btnMostrarLogin.addEventListener('click', (e) => {
            e.preventDefault();
            tarjetaRegistro.classList.add('hidden');
            tarjetaLogin.classList.remove('hidden');
        });
    }

    // Inicio login
    if (formularioLogin) {
        formularioLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            try {
                const respuesta = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const datos = await manejarRespuesta(respuesta);
                showToast(datos.mensaje);
                
                // Guardado sesion
                localStorage.setItem('usuario_cronos', JSON.stringify(datos.usuario));
                localStorage.setItem('token_cronos', datos.token);
                // Redireccion rol
                if (datos.usuario.id_perfil === 2) {
                    window.location.href = 'explorador.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
            } catch (error) {
                showToast(`Error en Login: ${error.message}`, true);
            }
        });
    }

    // Inicio registro
    if (formularioRegistro) {
        formularioRegistro.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rut = document.getElementById('regRut').value;
            const nombre_completo = document.getElementById('regNombre').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            const id_perfil = document.getElementById('reg-perfil').value;

            try {
                const respuesta = await fetch(`${API_URL}/registro`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rut, id_perfil, nombre_completo, email, password })
                });
                
                const datos = await manejarRespuesta(respuesta);
                showToast(datos.mensaje);
                
                // Redireccion login
                btnMostrarLogin.click();
                formularioRegistro.reset();

            } catch (error) {
                showToast(`Error en Registro: ${error.message}`, true);
            }
        });
    }
});

// ==========================================
// Inicio logica dashboard
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    
    // Inicio logout
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('usuario_cronos');
            localStorage.removeItem('token_cronos');
            window.location.href = 'index.html';
        });
    }

    // Inicio navegacion sidebar
    const sidebarLinks = document.querySelectorAll('.sidebar-menu a');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            sidebarLinks.forEach(l => l.parentElement.classList.remove('active'));
            e.currentTarget.parentElement.classList.add('active');
        });
    });

    // Validacion sesion
    const isDashboard = window.location.pathname.includes('dashboard.html');
    let rutUsuario = null;
    
    if (isDashboard) {
        const cadenaUsuario = localStorage.getItem('usuario_cronos');
        if (cadenaUsuario) {
            rutUsuario = JSON.parse(cadenaUsuario).rut;
            const id_perfil = JSON.parse(cadenaUsuario).id_perfil;
            if (id_perfil === 2) {
                // Redireccion estudiante
                window.location.href = 'explorador.html';
                return;
            }
        } else {
            // Redireccion login
            window.location.href = 'index.html';
            return;
        }
    } else {
        // Obtencion rut otras paginas
        const cadenaUsuario = localStorage.getItem('usuario_cronos');
        if (cadenaUsuario) {
            rutUsuario = JSON.parse(cadenaUsuario).rut;
        }
    }

    // Inicio logica pestanas
    const tabs = document.querySelectorAll('[data-tab]');
    const tabViews = document.querySelectorAll('.tab-view');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            // Desactivacion general
            tabs.forEach(t => t.classList.remove('active'));
            tabViews.forEach(v => v.classList.remove('active'));
            // Activacion pestana
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-tab');
            document.getElementById(targetId).classList.add('active');

            if (targetId === 'tab-ia') {
                cargarConfigIA();
                cargarEscenasIA();
            }

            if (targetId === 'tab-gestor') {
                cargarMisEscenas();
                cargarPlantillas();
                document.getElementById('gestorListaEscenas').classList.remove('hidden');
                document.getElementById('gestorEdicionProfunda').classList.add('hidden');
            }
        });
    });

    // ========================================================
    // Inicio constructor escenas
    // ========================================================
    
    let idEscenaActual = null;
    let idLineaActual = null;
    let eventosCargados = new Map();

    // Elementos acordeon
    const accHeaderEscena = document.getElementById('acc-header-escena');
    const accContentEscena = document.getElementById('acc-content-escena');
    const accHeaderLinea = document.getElementById('acc-header-linea');
    const accContentLinea = document.getElementById('acc-content-linea');
    const accHeaderEvento = document.getElementById('acc-header-evento');
    const accContentEvento = document.getElementById('acc-content-evento');

    function alternarAcordeon(header, content, forzarApertura = false) {
        if (forzarApertura || !content.classList.contains('open')) {
            content.classList.add('open');
            header.classList.add('active');
        } else {
            content.classList.remove('open');
            header.classList.remove('active');
        }
    }

    if (accHeaderEscena) accHeaderEscena.addEventListener('click', () => alternarAcordeon(accHeaderEscena, accContentEscena));
    if (accHeaderLinea) accHeaderLinea.addEventListener('click', () => {
        if (idEscenaActual) alternarAcordeon(accHeaderLinea, accContentLinea);
    });
    if (accHeaderEvento) accHeaderEvento.addEventListener('click', () => {
        if (idLineaActual) alternarAcordeon(accHeaderEvento, accContentEvento);
    });

    // Inicializacion selects
    async function iniciarConstructor() {
        if (!document.getElementById('escenaGlobal')) return;
        
        try {
            // Carga escenas (solo del usuario)
            const respEscenas = await fetch(`${API_URL}/escenas/usuario/${rutUsuario}`);
            const datosEscenas = await manejarRespuesta(respEscenas);
            const selectorEscena = document.getElementById('escenaGlobal');
            selectorEscena.innerHTML = '<option value="">-- Seleccionar Escena Existente --</option>';
            datosEscenas.resultados.forEach(e => {
                selectorEscena.innerHTML += `<option value="${e.id_escena}">${escaparHTML(e.nombre_escena)}</option>`;
            });

            // Carga zonas
            const respZonas = await fetch(`${API_URL}/zonas`);
            const datosZonas = await manejarRespuesta(respZonas);
            const selectorZona = document.getElementById('zonaSeleccionada');
            selectorZona.innerHTML = '<option value="">-- Seleccionar Continente --</option>';
            datosZonas.resultados.forEach(z => {
                selectorZona.innerHTML += `<option value="${z.id_zona}">${escaparHTML(z.nombre_zona)}</option>`;
            });

            // Carga categorias
            const respCat = await fetch(`${API_URL}/categorias`);
            const datosCat = await manejarRespuesta(respCat);
            const selectorCat = document.getElementById('categoriaEvento');
            selectorCat.innerHTML = '<option value="">-- Seleccionar Categoría --</option>';
            datosCat.resultados.forEach(c => {
                selectorCat.innerHTML += `<option value="${c.id_categoria}">${escaparHTML(c.nombre_categoria)}</option>`;
            });

        } catch (error) {
            console.error('Error inicializando constructor:', error);
        }
    }
    
    iniciarConstructor();

    // -- NIVEL 1: Fijacion Escena --
    document.getElementById('btnFijarEscena')?.addEventListener('click', async () => {
        const selectorEscena = document.getElementById('escenaGlobal').value;
        const escenaNueva = document.getElementById('nombreNuevaEscena').value.trim();

        if (escenaNueva) {
            try {
                const respuesta = await fetch(`${API_URL}/escenas`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombre_escena: escenaNueva, rut_usuario: rutUsuario })
                });
                const datos = await manejarRespuesta(respuesta);
                idEscenaActual = datos.id_escena; 
                showToast("Nueva Escena Creada");
                // Recarga select
                await iniciarConstructor();
                document.getElementById('escenaGlobal').value = idEscenaActual;
                document.getElementById('nombreNuevaEscena').value = '';
            } catch (error) {
                showToast(`Error: ${error.message}`, true);
                return;
            }
        } else if (selectorEscena) {
            idEscenaActual = selectorEscena;
        } else {
            showToast("Debes seleccionar o crear una escena", true);
            return;
        }

        // Desbloqueo nivel 2
        accHeaderLinea.style.pointerEvents = 'auto';
        accHeaderLinea.style.opacity = '1';
        alternarAcordeon(accHeaderEscena, accContentEscena, false);
        alternarAcordeon(accHeaderLinea, accContentLinea, true);
        
        // Carga lineas escena actual
        cargarLineasNivel2(idEscenaActual);
        
        accHeaderEscena.innerHTML = `1. Escena: ✓ Fijada <span>▼</span>`;
    });

    async function cargarLineasNivel2(idEscena) {
        const selectorLinea = document.getElementById('lineaGlobal');
        selectorLinea.innerHTML = '<option value="">-- Cargando... --</option>';
        try {
            const respuesta = await fetch(`${API_URL}/lineas/escena/${idEscena}`);
            const datos = await manejarRespuesta(respuesta);
            selectorLinea.innerHTML = '<option value="">-- Seleccionar Línea Existente --</option>';
            datos.resultados.forEach(l => {
                selectorLinea.innerHTML += `<option value="${l.id_linea}">${escaparHTML(l.nombre_linea)}</option>`;
            });
        } catch(error) {
            selectorLinea.innerHTML = '<option value="">-- Error --</option>';
        }
    }

    // -- Mostrar/Ocultar boton borrar linea --
    document.getElementById('lineaGlobal')?.addEventListener('change', (e) => {
        const btnBorrar = document.getElementById('btnBorrarLinea');
        if(btnBorrar) {
            if(e.target.value) btnBorrar.classList.remove('hidden');
            else btnBorrar.classList.add('hidden');
        }
    });

    // -- NIVEL 2: Fijacion Linea --
    document.getElementById('btnFijarLinea')?.addEventListener('click', async () => {
        const selectorLinea = document.getElementById('lineaGlobal').value;
        const lineaNombre = document.getElementById('nombreLinea').value.trim();
        const zona = document.getElementById('zonaSeleccionada').value;
        const colorSel = document.getElementById('colorLinea').value;

        if (lineaNombre && zona) {
            try {
                const respuesta = await fetch(`${API_URL}/lineas`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id_escena: idEscenaActual,
                        id_zona: zona,
                        nombre_linea: lineaNombre,
                        color_personalizado: colorSel
                    })
                });
                const datos = await manejarRespuesta(respuesta);
                idLineaActual = datos.id_linea;
                showToast("Línea Creada");
                await cargarLineasNivel2(idEscenaActual);
                document.getElementById('lineaGlobal').value = idLineaActual;
                document.getElementById('nombreLinea').value = '';
            } catch (error) {
                showToast(`Error: ${error.message}`, true);
                return;
            }
        } else if (selectorLinea) {
            idLineaActual = selectorLinea;
        } else {
            showToast("Selecciona una línea o completa Nombre y Zona para crear una", true);
            return;
        }

        // Desbloqueo nivel 3
        accHeaderEvento.style.pointerEvents = 'auto';
        accHeaderEvento.style.opacity = '1';
        alternarAcordeon(accHeaderLinea, accContentLinea, false);
        alternarAcordeon(accHeaderEvento, accContentEvento, true);
        
        cargarEventosNivel3(idLineaActual);
        accHeaderLinea.innerHTML = `2. Línea: ✓ Fijada <span>▼</span>`;
    });

    // -- NIVEL 3: Guardado Evento --
    document.getElementById('formEvento')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!idLineaActual) {
            showToast("No hay línea seleccionada", true);
            return;
        }

        const idModificar = document.getElementById('idEventoModificar').value;
        const cargaDatos = {
            id_linea: idLineaActual,
            id_categoria: document.getElementById('categoriaEvento').value || null,
            titulo_evento: document.getElementById('tituloEvento').value,
            anio_inicio: document.getElementById('anioInicio').value,
            anio_fin: document.getElementById('anioFin').value || null,
            descripcion: document.getElementById('descEvento').value,
            imagen_url: document.getElementById('imagenUrl').value || null,
            precision_fecha: document.getElementById('precisionFecha').value,
            interpretacion: document.getElementById('interpretacionEvento').value || null
        };

        const metodo = idModificar ? 'PUT' : 'POST';
        const urlApi = idModificar ? `${API_URL}/eventos/${idModificar}` : `${API_URL}/eventos`;

        try {
            const respuesta = await fetch(urlApi, {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cargaDatos)
            });
            const datos = await manejarRespuesta(respuesta);
            showToast(datos.mensaje);
            
            document.getElementById('formEvento').reset();
            cancelarEdicionCons();
            cargarEventosNivel3(idLineaActual);
            
        } catch (error) {
            showToast(`Error: ${error.message}`, true);
        }
    });

    document.getElementById('btnCancelarEdicion')?.addEventListener('click', cancelarEdicionCons);

    function cancelarEdicionCons() {
        document.getElementById('idEventoModificar').value = '';
        document.getElementById('btnGuardarEvento').textContent = 'Añadir Evento a la Línea';
        document.getElementById('btnCancelarEdicion').classList.add('hidden');
        document.getElementById('formEvento').reset();
    }

    async function cargarEventosNivel3(id_linea) {
        const tbody = document.querySelector('#tablaEventosConstructor tbody');
        if (!tbody) return;
        
        try {
            const respuesta = await fetch(`${API_URL}/eventos/linea/${id_linea}`);
            const datos = await manejarRespuesta(respuesta);
            
            tbody.innerHTML = '';
            if (datos.resultados.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: rgba(255,255,255,0.5);">No hay eventos en esta línea.</td></tr>';
                return;
            }
            
            eventosCargados = new Map(datos.resultados.map(ev => [String(ev.id_evento), ev]));
            datos.resultados.forEach(ev => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${escaparHTML(ev.titulo_evento)}</td>
                    <td>${escaparHTML(formatearFecha(ev.anio_inicio, ev.precision_fecha))}</td>
                    <td>${ev.anio_fin ? Number(ev.anio_fin) : '-'}</td>
                    <td>${escaparHTML(ev.nombre_categoria || 'General')}</td>
                    <td>
                        <button class="btn" style="padding: 5px 10px; font-size: 0.8rem; background-color: #f39c12; margin-right: 5px;" onclick="window.editarEventoC(${Number(ev.id_evento)})">Editar</button>
                        <button class="btn" style="padding: 5px 10px; font-size: 0.8rem; background-color: #e74c3c;" onclick="window.borrarEventoC(${Number(ev.id_evento)})">Borrar</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch(error) {
            tbody.innerHTML = `<tr><td colspan="5" style="color: #ff6b6b; text-align:center;">Error: ${escaparHTML(error.message)}</td></tr>`;
        }
    }

    window.editarEventoC = function(id) {
        const evento = eventosCargados.get(String(id));
        if (!evento) return;
        document.getElementById('idEventoModificar').value = evento.id_evento;
        document.getElementById('tituloEvento').value = evento.titulo_evento;
        document.getElementById('anioInicio').value = evento.anio_inicio;
        document.getElementById('anioFin').value = evento.anio_fin || '';
        document.getElementById('categoriaEvento').value = evento.id_categoria || '';
        document.getElementById('descEvento').value = evento.descripcion || '';
        document.getElementById('imagenUrl').value = evento.imagen_url || '';
        document.getElementById('precisionFecha').value = evento.precision_fecha || 'exacta';
        document.getElementById('interpretacionEvento').value = evento.interpretacion || '';
        
        document.getElementById('btnGuardarEvento').textContent = 'Actualizar Evento';
        document.getElementById('btnCancelarEdicion').classList.remove('hidden');
    };

    window.borrarEventoC = async function(id_evento) {
        if (!confirm('¿Borrar este evento?')) return;
        try {
            const respuesta = await fetch(`${API_URL}/eventos/${id_evento}`, { method: 'DELETE' });
            const datos = await manejarRespuesta(respuesta);
            showToast(datos.mensaje);
            if (idLineaActual) cargarEventosNivel3(idLineaActual);
        } catch (error) {
            showToast(`Error: ${error.message}`, true);
        }
    };

    // Inicio borrado linea
    window.borrarLineaC = async function() {
        const id_linea = document.getElementById('lineaGlobal').value;
        if (!id_linea) return;

        if (!confirm('¿Estás completamente seguro de que deseas borrar esta línea y todos sus eventos? Esta acción no se puede deshacer.')) return;

        try {
            const respuesta = await fetch(`${API_URL}/lineas/${id_linea}`, { method: 'DELETE' });
            const datos = await manejarRespuesta(respuesta);
            showToast(datos.mensaje);
            
            await cargarLineasNivel2(idEscenaActual);
            document.getElementById('formLinea').reset();
            const btnBorrarLinea = document.getElementById('btnBorrarLinea');
            if(btnBorrarLinea) btnBorrarLinea.classList.add('hidden');
            
            document.getElementById('tablaEventosConstructor').querySelector('tbody').innerHTML = '<tr><td colspan="5" style="text-align: center; color: rgba(255,255,255,0.5);">No hay eventos aún.</td></tr>';
            idLineaActual = null;
            
            const accHeaderEvento = document.getElementById('acc-header-evento');
            if(accHeaderEvento) {
                accHeaderEvento.style.pointerEvents = 'none';
                accHeaderEvento.style.opacity = '0.5';
                accHeaderEvento.innerHTML = `3. Eventos Históricos <span>▼</span>`;
                document.getElementById('acc-content-evento').classList.remove('open');
            }
            
            const accHeaderLinea = document.getElementById('acc-header-linea');
            if(accHeaderLinea) {
                accHeaderLinea.innerHTML = `2. Línea de Tiempo <span>▼</span>`;
            }

        } catch (error) {
            showToast(`Error: ${error.message}`, true);
        }
    };
    // Fin borrado linea

    // Inicio borrado escena
    window.borrarEscenaC = async function() {
        const inputId = document.getElementById('idEscenaRenombrar');
        if(!inputId) return;
        const id_escena = inputId.value;
        if (!id_escena) return;

        if (!confirm('¡ADVERTENCIA! ¿Estás completamente seguro de que deseas borrar esta ESCENA COMPLETA? Se perderán todas sus líneas y eventos para siempre.')) return;

        try {
            const respuesta = await fetch(`${API_URL}/escenas/${id_escena}`, { method: 'DELETE' });
            const datos = await manejarRespuesta(respuesta);
            showToast(datos.mensaje);
            
            document.getElementById('gestorEdicionProfunda').classList.add('hidden');
            document.getElementById('gestorListaEscenas').classList.remove('hidden');
            
            renderizarMisEscenas();
            cargarEscenasGlobal();
            
            if (idEscenaActual == id_escena) {
                idEscenaActual = null;
                idLineaActual = null;
                document.getElementById('formEscena').reset();
                document.getElementById('formLinea').reset();
                document.getElementById('formEvento').reset();
                const btnBorrarLinea = document.getElementById('btnBorrarLinea');
                if(btnBorrarLinea) btnBorrarLinea.classList.add('hidden');
                
                const accHeaderLinea = document.getElementById('acc-header-linea');
                if(accHeaderLinea) {
                    accHeaderLinea.style.pointerEvents = 'none';
                    accHeaderLinea.style.opacity = '0.5';
                    accHeaderLinea.innerHTML = `2. Línea de Tiempo <span>▼</span>`;
                    document.getElementById('acc-content-linea').classList.remove('open');
                }
                
                const accHeaderEvento = document.getElementById('acc-header-evento');
                if(accHeaderEvento) {
                    accHeaderEvento.style.pointerEvents = 'none';
                    accHeaderEvento.style.opacity = '0.5';
                    accHeaderEvento.innerHTML = `3. Eventos Históricos <span>▼</span>`;
                    document.getElementById('acc-content-evento').classList.remove('open');
                }
                
                const accHeaderEscena = document.getElementById('acc-header-escena');
                if(accHeaderEscena) {
                    accHeaderEscena.innerHTML = `1. Escena Crono <span>▼</span>`;
                    document.getElementById('acc-content-escena').classList.add('open');
                }
            }

        } catch (error) {
            showToast(`Error: ${error.message}`, true);
        }
    };
    // Fin borrado escena

    // ========================================================
    // Inicio gestor escenas
    // ========================================================
    async function cargarMisEscenas() {
        const grilla = document.getElementById('gridMisEscenas');
        if (!grilla) return;
        
        try {
            const respuesta = await fetch(`${API_URL}/escenas/usuario/${rutUsuario}`);
            const datos = await manejarRespuesta(respuesta);
            grilla.innerHTML = '';
            
            if (datos.resultados.length === 0) {
                grilla.innerHTML = '<p style="text-align:center; color: #ccc; grid-column: 1 / -1;">No has creado ninguna escena aún.</p>';
                return;
            }

            datos.resultados.forEach(escena => {
                const tarjeta = document.createElement('div');
                tarjeta.className = 'scene-card glass-panel';
                tarjeta.style.cursor = 'pointer';
                tarjeta.onclick = () => window.location.href = `lienzo.html?id=${escena.id_escena}`;
                tarjeta.innerHTML = `
                    <div class="scene-card-content">
                        <h3>${escaparHTML(escena.nombre_escena)}</h3>
                        <p style="color: #ccc; font-size: 0.9rem;">Escena Crono-Espacial</p>
                        <button class="btn" onclick="event.stopPropagation(); window.abrirEdicionProfunda(${Number(escena.id_escena)}, this.dataset.nombre)" data-nombre="${escaparHTML(escena.nombre_escena)}">Editar Escena</button>
                    </div>
                `;
                grilla.appendChild(tarjeta);
            });
        } catch(error) {
            grilla.innerHTML = `<p style="color: #ff6b6b;">Error: ${error.message}</p>`;
        }
    }

    window.abrirEdicionProfunda = function(id_escena, nombre) {
        document.getElementById('gestorListaEscenas').classList.add('hidden');
        const editor = document.getElementById('gestorEdicionProfunda');
        editor.classList.remove('hidden');
        
        document.getElementById('tituloEdicionEscena').textContent = `Editando Escena: ${nombre}`;
        document.getElementById('idEscenaRenombrar').value = id_escena;
        document.getElementById('inputRenombrarEscena').value = nombre;
        cargarPanelAvanzado(id_escena);
    };

    document.getElementById('btnVolverGestor')?.addEventListener('click', () => {
        document.getElementById('gestorEdicionProfunda').classList.add('hidden');
        document.getElementById('gestorListaEscenas').classList.remove('hidden');
        cargarMisEscenas();
    });

    // Inicio formulario renombrar escena
    // Soporte futuro backend
    document.getElementById('formRenombrarEscena')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('idEscenaRenombrar').value;
        const nombre = document.getElementById('inputRenombrarEscena').value.trim();
        
        if (!nombre) {
            window.mostrarNotificacion("El nombre no puede estar vacío", true);
            return;
        }

        try {
            const res = await fetch(`${API_URL}/escenas/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre_escena: nombre })
            });
            await manejarRespuesta(res);
            window.mostrarNotificacion("Escena actualizada exitosamente");
            document.getElementById('tituloEdicionEscena').textContent = `Editando Escena: ${nombre}`;
            cargarMisEscenas(); // Recargar lista para reflejar el cambio
        } catch(err) {
            window.mostrarNotificacion(err.message, true);
        }
    });

    // ========================================================
    // Inicio panel avanzado de escena (relaciones, fuentes, preguntas, asignaciones)
    // ========================================================
    let eventosEscenaActual = [];

    function idEscenaEditada() {
        return document.getElementById('idEscenaRenombrar').value;
    }

    async function cargarPanelAvanzado(idEscena) {
        try {
            const respuesta = await fetch(`${API_URL}/escenas/${idEscena}/detalle`);
            const escena = await manejarRespuesta(respuesta);
            eventosEscenaActual = escena.lineas.flatMap(linea => (linea.eventos || []).map(evento => ({ ...evento, nombre_linea: linea.nombre_linea })));

            const opciones = eventosEscenaActual.map(e => `<option value="${Number(e.id_evento)}">${escaparHTML(e.nombre_linea)}: ${escaparHTML(e.titulo_evento)} (${escaparHTML(formatearFecha(e.anio_inicio, e.precision_fecha))})</option>`).join('');
            document.getElementById('relOrigen').innerHTML = opciones;
            document.getElementById('relDestino').innerHTML = opciones;
            document.getElementById('fuenteEvento').innerHTML = opciones;

            renderizarRelaciones(escena.relaciones || []);
            renderizarFuentes();
            renderizarPreguntas(escena.preguntas || []);
            await cargarAsignaciones(idEscena);
        } catch (error) {
            showToast(`Error: ${error.message}`, true);
        }
    }

    function tituloDeEvento(id) {
        return eventosEscenaActual.find(e => e.id_evento === id)?.titulo_evento || 'evento';
    }

    function renderizarRelaciones(relaciones) {
        document.getElementById('listaRelaciones').innerHTML = relaciones.length
            ? relaciones.map(r => `<li>${escaparHTML(tituloDeEvento(r.id_evento_origen))} → <em>${escaparHTML(r.tipo)}</em> → ${escaparHTML(tituloDeEvento(r.id_evento_destino))} <button type="button" class="btn" style="width: auto; padding: 2px 8px; background: #e74c3c;" onclick="window.borrarRelacionC(${Number(r.id_relacion)})">Quitar</button></li>`).join('')
            : '<li>Sin relaciones aún.</li>';
    }

    function renderizarFuentes() {
        const idEvento = Number(document.getElementById('fuenteEvento').value);
        const fuentes = eventosEscenaActual.find(e => e.id_evento === idEvento)?.fuentes || [];
        document.getElementById('listaFuentes').innerHTML = fuentes.length
            ? fuentes.map(f => `<li>${escaparHTML(f.titulo)} <small>(${escaparHTML(f.tipo)})</small> <button type="button" class="btn" style="width: auto; padding: 2px 8px; background: #e74c3c;" onclick="window.borrarFuenteC(${Number(f.id_fuente)})">Quitar</button></li>`).join('')
            : '<li>Este evento no tiene fuentes.</li>';
    }

    function renderizarPreguntas(preguntas) {
        document.getElementById('listaPreguntasEdicion').innerHTML = preguntas.length
            ? preguntas.map(p => `<li>${escaparHTML(p.texto)} <button type="button" class="btn" style="width: auto; padding: 2px 8px; background: #e74c3c;" onclick="window.borrarPreguntaC(${Number(p.id_pregunta)})">Quitar</button></li>`).join('')
            : '<li>Sin preguntas aún.</li>';
    }

    async function cargarAsignaciones(idEscena) {
        const lista = document.getElementById('listaAsignaciones');
        const respuesta = await fetch(`${API_URL}/escenas/${idEscena}/asignaciones`);
        const datos = await manejarRespuesta(respuesta);
        lista.innerHTML = datos.resultados.length
            ? datos.resultados.map(a => `<li>${escaparHTML(a.nombre_completo)} (${escaparHTML(a.rut_estudiante)}) <button type="button" class="btn" style="width: auto; padding: 2px 8px; background: #e74c3c;" onclick="window.quitarAsignacionC('${escaparHTML(a.rut_estudiante)}')">Quitar</button></li>`).join('')
            : '<li>Sin estudiantes asignados.</li>';
    }

    async function peticionAvanzada(metodo, ruta, cuerpo, mensajeOk) {
        try {
            const respuesta = await fetch(`${API_URL}${ruta}`, {
                method: metodo,
                headers: cuerpo ? { 'Content-Type': 'application/json' } : {},
                body: cuerpo ? JSON.stringify(cuerpo) : undefined
            });
            const datos = await manejarRespuesta(respuesta);
            showToast(mensajeOk || datos.mensaje);
            await cargarPanelAvanzado(idEscenaEditada());
        } catch (error) {
            showToast(`Error: ${error.message}`, true);
        }
    }

    document.getElementById('fuenteEvento')?.addEventListener('change', renderizarFuentes);

    document.getElementById('btnAgregarRelacion')?.addEventListener('click', () => {
        const origen = document.getElementById('relOrigen').value;
        const destino = document.getElementById('relDestino').value;
        if (!origen || !destino) return showToast('Selecciona el evento origen y el destino', true);
        peticionAvanzada('POST', '/relaciones', {
            id_evento_origen: Number(origen),
            id_evento_destino: Number(destino),
            tipo: document.getElementById('relTipo').value,
            nota: document.getElementById('relNota').value.trim() || null
        }, 'Relación añadida');
    });

    document.getElementById('btnAgregarFuente')?.addEventListener('click', () => {
        const idEvento = document.getElementById('fuenteEvento').value;
        const titulo = document.getElementById('fuenteTitulo').value.trim();
        if (!idEvento || !titulo) return showToast('Selecciona un evento e indica el título de la fuente', true);
        peticionAvanzada('POST', `/eventos/${Number(idEvento)}/fuentes`, {
            titulo,
            autor: document.getElementById('fuenteAutor').value.trim() || null,
            anio: document.getElementById('fuenteAnio').value || null,
            url: document.getElementById('fuenteUrl').value.trim() || null,
            tipo: document.getElementById('fuenteTipo').value
        }, 'Fuente añadida');
        document.getElementById('fuenteTitulo').value = '';
        document.getElementById('fuenteAutor').value = '';
        document.getElementById('fuenteAnio').value = '';
        document.getElementById('fuenteUrl').value = '';
    });

    document.getElementById('btnAgregarPregunta')?.addEventListener('click', () => {
        const texto = document.getElementById('nuevaPregunta').value.trim();
        if (!texto) return showToast('Escribe la pregunta', true);
        peticionAvanzada('POST', `/escenas/${idEscenaEditada()}/preguntas`, { texto }, 'Pregunta añadida');
        document.getElementById('nuevaPregunta').value = '';
    });

    document.getElementById('btnAsignarEstudiante')?.addEventListener('click', () => {
        const rut = document.getElementById('rutEstudianteAsignar').value.trim();
        if (!rut) return showToast('Escribe el RUT del estudiante', true);
        peticionAvanzada('POST', `/escenas/${idEscenaEditada()}/asignaciones`, { rut_estudiante: rut }, 'Escena asignada');
        document.getElementById('rutEstudianteAsignar').value = '';
    });

    window.borrarRelacionC = (id) => peticionAvanzada('DELETE', `/relaciones/${id}`, null, 'Relación quitada');
    window.borrarFuenteC = (id) => peticionAvanzada('DELETE', `/fuentes/${id}`, null, 'Fuente quitada');
    window.borrarPreguntaC = (id) => peticionAvanzada('DELETE', `/preguntas/${id}`, null, 'Pregunta quitada');
    window.quitarAsignacionC = (rut) => peticionAvanzada('DELETE', `/escenas/${idEscenaEditada()}/asignaciones/${encodeURIComponent(rut)}`, null, 'Asignación quitada');

    // ========================================================
    // Inicio asistente IA
    // ========================================================
    let propuestaIA = null;

    async function cargarConfigIA() {
        const selectorProveedor = document.getElementById('iaProveedor');
        const estado = document.getElementById('iaEstado');
        if (!selectorProveedor) return;

        try {
            if (selectorProveedor.options.length <= 1) {
                const respProv = await fetch(`${API_URL}/ia/proveedores`);
                const datosProv = await manejarRespuesta(respProv);
                datosProv.resultados.forEach(p => {
                    selectorProveedor.innerHTML += `<option value="${p.id}">${escaparHTML(p.nombre)}</option>`;
                });
            }

            const respuesta = await fetch(`${API_URL}/ia/configuracion/${rutUsuario}`);
            const config = await manejarRespuesta(respuesta);
            if (config.configurado) {
                selectorProveedor.value = config.proveedor;
                document.getElementById('iaModelo').value = config.modelo;
                estado.textContent = `Clave guardada: ${config.clave_mascarada}`;
            } else {
                estado.textContent = 'Aún no has guardado una API key.';
            }
        } catch (error) {
            estado.textContent = `Error: ${error.message}`;
        }
    }

    async function cargarEscenasIA() {
        const selector = document.getElementById('iaEscena');
        if (!selector) return;

        try {
            const respuesta = await fetch(`${API_URL}/escenas/usuario/${rutUsuario}`);
            const datos = await manejarRespuesta(respuesta);
            const valorActual = selector.value;
            selector.innerHTML = '<option value="">-- Seleccionar Escena --</option>';
            datos.resultados.forEach(e => {
                selector.innerHTML += `<option value="${e.id_escena}">${escaparHTML(e.nombre_escena)}</option>`;
            });
            selector.value = valorActual;
        } catch (error) {
            showToast(`Error: ${error.message}`, true);
        }
    }

    document.getElementById('btnGuardarIA')?.addEventListener('click', async () => {
        const proveedor = document.getElementById('iaProveedor').value;
        const modelo = document.getElementById('iaModelo').value.trim();
        const apiKey = document.getElementById('iaApiKey').value.trim();
        if (!proveedor || !modelo || !apiKey) {
            showToast("Completa proveedor, modelo y API key", true);
            return;
        }

        try {
            const respuesta = await fetch(`${API_URL}/ia/configuracion`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rut_usuario: rutUsuario, proveedor, modelo, api_key: apiKey })
            });
            const datos = await manejarRespuesta(respuesta);
            showToast(datos.mensaje);
            document.getElementById('iaApiKey').value = '';
            cargarConfigIA();
        } catch (error) {
            showToast(`Error: ${error.message}`, true);
        }
    });

    document.getElementById('btnEliminarIA')?.addEventListener('click', async () => {
        if (!confirm('¿Eliminar tu API key de IA?')) return;

        try {
            const respuesta = await fetch(`${API_URL}/ia/configuracion/${rutUsuario}`, { method: 'DELETE' });
            const datos = await manejarRespuesta(respuesta);
            showToast(datos.mensaje);
            cargarConfigIA();
        } catch (error) {
            showToast(`Error: ${error.message}`, true);
        }
    });

    function renderizarPropuestaIA(datos) {
        const contenedor = document.getElementById('iaPropuesta');
        const filas = datos.lineas.flatMap(linea => (linea.eventos || []).map(evento => {
            const fuente = evento.fuente_url
                ? `<a href="${escaparHTML(evento.fuente_url)}" target="_blank" rel="noopener">Ver fuente</a>`
                : '<span style="color: #f39c12;">Sin fuente verificada</span>';
            return `
                <tr>
                    <td>${escaparHTML(linea.nombre_linea)}</td>
                    <td>${escaparHTML(evento.titulo_evento)}</td>
                    <td>${escaparHTML(evento.anio_inicio)}${evento.anio_fin ? ' – ' + escaparHTML(evento.anio_fin) : ''}</td>
                    <td>${escaparHTML(evento.nombre_categoria)}</td>
                    <td>${fuente}</td>
                </tr>`;
        }));

        contenedor.innerHTML = `
            <p style="color: #ccc; margin-bottom: 10px;">${datos.lineas.length} línea(s) y ${filas.length} evento(s) propuestos. ${datos.fuentes_no_verificadas} fuente(s) no respondieron y se quitaron. Revisa fechas y contenido antes de añadirlos: la IA puede equivocarse.</p>
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>Línea</th><th>Evento</th><th>Años</th><th>Categoría</th><th>Fuente</th></tr>
                    </thead>
                    <tbody>${filas.join('')}</tbody>
                </table>
            </div>
            ${datos.advertencias.length ? `<h4 style="color: #f39c12; margin-top: 15px;">Advertencias</h4><ul>${datos.advertencias.map(a => `<li>${escaparHTML(a)}</li>`).join('')}</ul>` : ''}
            ${datos.relaciones.length ? `<h4 style="color: #fff; margin-top: 15px;">Relaciones propuestas</h4><ul>${datos.relaciones.map(r => `<li>${escaparHTML(r.titulo_origen)} → <em>${escaparHTML(r.tipo)}</em> → ${escaparHTML(r.titulo_destino)}${r.nota ? ` <small>(${escaparHTML(r.nota)})</small>` : ''}</li>`).join('')}</ul>` : ''}
            ${datos.preguntas.length ? `<h4 style="color: #fff; margin-top: 15px;">Preguntas de comparación</h4><ol>${datos.preguntas.map(p => `<li>${escaparHTML(p)}</li>`).join('')}</ol>` : ''}
            ${datos.relaciones_descartadas ? `<p style="color: #ccc; font-size: 0.85rem;">${datos.relaciones_descartadas} relación(es) descartadas por usar títulos que no existen.</p>` : ''}
            <button type="button" id="btnAceptarPropuesta" class="btn" style="margin-top: 15px;">Añadir Propuesta a la Escena</button>
        `;
        document.getElementById('btnAceptarPropuesta').addEventListener('click', aceptarPropuestaIA);
    }

    document.getElementById('btnGenerarPropuesta')?.addEventListener('click', async () => {
        const idEscena = document.getElementById('iaEscena').value;
        const instruccion = document.getElementById('iaInstruccion').value.trim();
        const contenedor = document.getElementById('iaPropuesta');
        if (!idEscena || !instruccion) {
            showToast("Selecciona una escena y escribe una instrucción", true);
            return;
        }

        propuestaIA = null;
        contenedor.innerHTML = '<p style="color: #ccc;">Generando propuesta...</p>';
        try {
            const respuesta = await fetch(`${API_URL}/ia/propuesta`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rut_usuario: rutUsuario, id_escena: idEscena, instruccion })
            });
            const datos = await manejarRespuesta(respuesta);
            propuestaIA = { id_escena: idEscena, lineas: datos.lineas, relaciones: datos.relaciones, preguntas: datos.preguntas };
            renderizarPropuestaIA(datos);
        } catch (error) {
            contenedor.innerHTML = `<p style="color: #ff6b6b;">Error: ${escaparHTML(error.message)}</p>`;
        }
    });

    async function aceptarPropuestaIA() {
        if (!propuestaIA) return;

        try {
            const respuesta = await fetch(`${API_URL}/escenas/${propuestaIA.id_escena}/lineas-importar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rut_usuario: rutUsuario, lineas: propuestaIA.lineas, relaciones: propuestaIA.relaciones, preguntas: propuestaIA.preguntas })
            });
            const datos = await manejarRespuesta(respuesta);
            showToast(datos.mensaje);
            propuestaIA = null;
            document.getElementById('iaPropuesta').innerHTML = '';
            document.getElementById('iaInstruccion').value = '';
            await refrescarEscenas();
        } catch (error) {
            showToast(`Error: ${error.message}`, true);
        }
    }

    // ========================================================
    // Inicio plantillas, importacion y exportacion
    // ========================================================
    async function cargarPlantillas() {
        const selector = document.getElementById('selectPlantilla');
        if (!selector) return;

        try {
            const respuesta = await fetch(`${API_URL}/plantillas`);
            const datos = await manejarRespuesta(respuesta);
            selector.innerHTML = '<option value="">-- Seleccionar Plantilla --</option>';
            datos.resultados.forEach(p => {
                selector.innerHTML += `<option value="${escaparHTML(p.id)}">${escaparHTML(p.nombre)} (${Number(p.total_lineas)} líneas)</option>`;
            });
        } catch (error) {
            selector.innerHTML = '<option value="">-- Error al cargar plantillas --</option>';
        }
    }

    async function refrescarEscenas() {
        await iniciarConstructor();
        cargarMisEscenas();
    }

    document.getElementById('btnCrearDesdePlantilla')?.addEventListener('click', async () => {
        const idPlantilla = document.getElementById('selectPlantilla').value;
        if (!idPlantilla) {
            showToast("Selecciona una plantilla", true);
            return;
        }

        const nombreEscena = document.getElementById('nombrePlantillaEscena').value.trim();
        try {
            const respuesta = await fetch(`${API_URL}/plantillas/${idPlantilla}/crear-escena`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre_escena: nombreEscena, rut_usuario: rutUsuario })
            });
            const datos = await manejarRespuesta(respuesta);
            showToast(datos.mensaje);
            document.getElementById('nombrePlantillaEscena').value = '';
            await refrescarEscenas();
        } catch (error) {
            showToast(`Error: ${error.message}`, true);
        }
    });

    function parsearCSV(texto) {
        const contenido = texto.replace(/^\uFEFF/, '');
        const primeraLinea = contenido.split(/\r?\n/)[0] || '';
        const separador = primeraLinea.includes(';') ? ';' : ',';
        const filas = [];
        let fila = [];
        let campo = '';
        let enComillas = false;

        for (let i = 0; i < contenido.length; i++) {
            const caracter = contenido[i];
            if (enComillas) {
                if (caracter === '"' && contenido[i + 1] === '"') {
                    campo += '"';
                    i++;
                } else if (caracter === '"') {
                    enComillas = false;
                } else {
                    campo += caracter;
                }
            } else if (caracter === '"') {
                enComillas = true;
            } else if (caracter === separador) {
                fila.push(campo);
                campo = '';
            } else if (caracter === '\n' || caracter === '\r') {
                if (caracter === '\r' && contenido[i + 1] === '\n') i++;
                fila.push(campo);
                filas.push(fila);
                fila = [];
                campo = '';
            } else {
                campo += caracter;
            }
        }
        if (campo !== '' || fila.length > 0) {
            fila.push(campo);
            filas.push(fila);
        }

        return filas.filter(f => f.some(valor => valor.trim() !== ''));
    }

    function convertirCSVAEscena(texto) {
        const [cabecera, ...filas] = parsearCSV(texto);
        if (!cabecera) throw new Error('El archivo CSV está vacío');

        const columnas = cabecera.map(c => c.trim().toLowerCase());
        ['linea', 'zona'].forEach(requerida => {
            if (!columnas.includes(requerida)) throw new Error(`Falta la columna "${requerida}" en el CSV`);
        });

        const lineas = new Map();
        filas.forEach((fila, indice) => {
            const valor = (nombre) => {
                const posicion = columnas.indexOf(nombre);
                return posicion >= 0 ? (fila[posicion] || '').trim() : '';
            };

            const nombreLinea = valor('linea');
            if (!nombreLinea) throw new Error(`La fila ${indice + 2} no tiene nombre de línea`);

            if (!lineas.has(nombreLinea)) {
                lineas.set(nombreLinea, {
                    nombre_linea: nombreLinea,
                    nombre_zona: valor('zona'),
                    color_personalizado: valor('color'),
                    eventos: []
                });
            }

            const titulo = valor('titulo');
            if (titulo) {
                lineas.get(nombreLinea).eventos.push({
                    titulo_evento: titulo,
                    anio_inicio: valor('anio_inicio'),
                    anio_fin: valor('anio_fin'),
                    nombre_categoria: valor('categoria'),
                    descripcion: valor('descripcion'),
                    imagen_url: valor('imagen_url'),
                    fuente_url: valor('fuente_url'),
                    precision_fecha: valor('precision'),
                    interpretacion: valor('interpretacion')
                });
            }
        });

        return { lineas: [...lineas.values()] };
    }

    function convertirJSONAEscena(texto) {
        const datos = JSON.parse(texto);
        if (!Array.isArray(datos.lineas)) throw new Error('El archivo JSON no contiene líneas');
        return datos;
    }

    document.getElementById('btnImportarEscena')?.addEventListener('click', async () => {
        const archivo = document.getElementById('archivoImportar').files[0];
        if (!archivo) {
            showToast("Selecciona un archivo CSV o JSON", true);
            return;
        }

        try {
            const texto = await archivo.text();
            const escena = archivo.name.toLowerCase().endsWith('.json')
                ? convertirJSONAEscena(texto)
                : convertirCSVAEscena(texto);
            const nombreEscena = document.getElementById('nombreImportarEscena').value.trim()
                || escena.nombre_escena
                || archivo.name.replace(/\.(csv|json)$/i, '');

            const respuesta = await fetch(`${API_URL}/escenas/importar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre_escena: nombreEscena, rut_usuario: rutUsuario, lineas: escena.lineas })
            });
            const datos = await manejarRespuesta(respuesta);
            showToast(datos.mensaje);
            document.getElementById('archivoImportar').value = '';
            document.getElementById('nombreImportarEscena').value = '';
            await refrescarEscenas();
        } catch (error) {
            showToast(`Error: ${error.message}`, true);
        }
    });

    async function obtenerEscenaParaExportar(idEscena) {
        const respuesta = await fetch(`${API_URL}/escenas/${idEscena}/detalle`);
        const escena = await manejarRespuesta(respuesta);
        return {
            formato: 'cronos-escena',
            version: 1,
            nombre_escena: escena.nombre_escena,
            lineas: escena.lineas.map(linea => ({
                nombre_linea: linea.nombre_linea,
                nombre_zona: linea.nombre_zona,
                color_personalizado: linea.color_personalizado,
                eventos: (linea.eventos || []).map(evento => ({
                    titulo_evento: evento.titulo_evento,
                    anio_inicio: evento.anio_inicio,
                    anio_fin: evento.anio_fin,
                    nombre_categoria: evento.nombre_categoria,
                    descripcion: evento.descripcion,
                    imagen_url: evento.imagen_url,
                    fuente_url: evento.fuente_url,
                    precision_fecha: evento.precision_fecha,
                    interpretacion: evento.interpretacion
                }))
            }))
        };
    }

    function celdaCSV(valor) {
        const texto = valor === null || valor === undefined ? '' : String(valor);
        return /["\n\r;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
    }

    function nombreArchivoSeguro(nombre) {
        return nombre.replace(/[^\p{L}\p{N}\-]+/gu, '_').replace(/^_+|_+$/g, '') || 'escena';
    }

    function descargarArchivo(contenido, nombreArchivo, tipo) {
        const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = nombreArchivo;
        enlace.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    document.getElementById('btnExportarJSON')?.addEventListener('click', async () => {
        const idEscena = document.getElementById('idEscenaRenombrar').value;
        if (!idEscena) return;

        try {
            const escena = await obtenerEscenaParaExportar(idEscena);
            descargarArchivo(JSON.stringify(escena, null, 2), `${nombreArchivoSeguro(escena.nombre_escena)}.json`, 'application/json');
        } catch (error) {
            showToast(`Error: ${error.message}`, true);
        }
    });

    document.getElementById('btnExportarCSV')?.addEventListener('click', async () => {
        const idEscena = document.getElementById('idEscenaRenombrar').value;
        if (!idEscena) return;

        try {
            const escena = await obtenerEscenaParaExportar(idEscena);
            const filas = ['linea;zona;color;titulo;anio_inicio;anio_fin;categoria;descripcion;imagen_url;fuente_url;precision;interpretacion'];
            escena.lineas.forEach(linea => {
                const base = [linea.nombre_linea, linea.nombre_zona, linea.color_personalizado];
                if (linea.eventos.length === 0) {
                    filas.push([...base, '', '', '', '', '', '', '', '', ''].map(celdaCSV).join(';'));
                }
                linea.eventos.forEach(evento => {
                    filas.push([...base, evento.titulo_evento, evento.anio_inicio, evento.anio_fin, evento.nombre_categoria, evento.descripcion, evento.imagen_url, evento.fuente_url, evento.precision_fecha, evento.interpretacion].map(celdaCSV).join(';'));
                });
            });
            descargarArchivo('\uFEFF' + filas.join('\r\n'), `${nombreArchivoSeguro(escena.nombre_escena)}.csv`, 'text/csv;charset=utf-8');
        } catch (error) {
            showToast(`Error: ${error.message}`, true);
        }
    });

});

// ==========================================
// Inicio sistema notificaciones
// ==========================================
window.mostrarNotificacion = function(mensajeNotificacion, esError = false) {
    const contenedor = document.getElementById('toastContainer');
    if(!contenedor) return;
    
    const notificacion = document.createElement('div');
    notificacion.className = `toast ${esError ? 'error' : ''}`;
    notificacion.textContent = mensajeNotificacion;
    
    contenedor.appendChild(notificacion);
    
    // Inicio animacion
    setTimeout(() => notificacion.classList.add('show'), 10);
    
    // Ocultamiento notificacion
    setTimeout(() => {
        notificacion.classList.remove('show');
        setTimeout(() => notificacion.remove(), 300);
    }, 3500);
};

// Fallback notificaciones
if(!window.mostrarNotificacion) {
    window.mostrarNotificacion = (msj) => alert(msj);
}
window.showToast = window.mostrarNotificacion;

// ==========================================
// Inicio explorador
// ==========================================
window.todasLasEscenas = [];

window.cargarExplorador = async function() {
    const grilla = document.getElementById('scenesGrid');
    const buscador = document.getElementById('buscadorEscenas');
    if(!grilla) return;
    
    const cargarDatos = async (termino = '') => {
        try {
            grilla.innerHTML = '<p style="text-align:center; color: #ccc; grid-column: 1 / -1;">Cargando escenas...</p>';
            const respuesta = await fetch(`${API_URL}/escenas${termino ? `?q=${encodeURIComponent(termino)}` : ''}`);
            const datos = await manejarRespuesta(respuesta);
            renderizarEscenas(datos.resultados || []);
        } catch(error) {
            grilla.innerHTML = `<p style="color: #ff6b6b; text-align: center; grid-column: 1 / -1;">Error al cargar las escenas: ${error.message}</p>`;
        }
    };

    // Carga inicial
    await cargarDatos();
    cargarAsignadasAlumno();
    
    if (buscador) {
        let timeoutBusqueda;
        buscador.addEventListener('input', (e) => {
            clearTimeout(timeoutBusqueda);
            // Debounce para evitar sobrecargar el servidor
            timeoutBusqueda = setTimeout(() => {
                cargarDatos(e.target.value.trim());
            }, 300);
        });
    }
};

async function cargarAsignadasAlumno() {
    const seccion = document.getElementById('seccionAsignadas');
    const grilla = document.getElementById('gridAsignadas');
    if (!seccion || !grilla) return;

    try {
        const respuesta = await fetch(`${API_URL}/asignaciones/mias`);
        const datos = await manejarRespuesta(respuesta);
        if (datos.resultados.length === 0) return;

        grilla.innerHTML = '';
        datos.resultados.forEach(escena => {
            const tarjeta = document.createElement('div');
            tarjeta.className = 'scene-card glass-panel';
            tarjeta.onclick = () => window.location.href = `lienzo.html?id=${Number(escena.id_escena)}`;
            tarjeta.innerHTML = `
                <h3>${escaparHTML(escena.nombre_escena)}</h3>
                <p style="margin-top: 15px; font-weight: 600; color: #4a90e2; font-size: 0.95rem;">Abrir y responder ➔</p>
            `;
            grilla.appendChild(tarjeta);
        });
        seccion.classList.remove('hidden');
    } catch (error) {
        console.error('Error al cargar escenas asignadas:', error.message);
    }
}

function renderizarEscenas(escenas) {
    const grilla = document.getElementById('scenesGrid');
    if(!grilla) return;
    
    grilla.innerHTML = '';
    
    if(escenas.length === 0) {
        grilla.innerHTML = '<p style="text-align:center; color: #ccc; grid-column: 1 / -1;">No se encontraron escenas.</p>';
        return;
    }
    
    escenas.forEach(escena => {
        const tarjeta = document.createElement('div');
        tarjeta.className = 'scene-card glass-panel';
        tarjeta.onclick = () => window.location.href = `lienzo.html?id=${escena.id_escena}`;
        
        tarjeta.innerHTML = `
            <h3>${escaparHTML(escena.nombre_escena)}</h3>
            <p style="margin-top: 15px; font-weight: 600; color: #4a90e2; font-size: 0.95rem;">Explorar Escena ➔</p>
        `;
        grilla.appendChild(tarjeta);
    });
}
