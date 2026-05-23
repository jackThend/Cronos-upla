// Inicio URLs
const API_URL = '/api';

// Inicio parseo JSON
const manejarRespuesta = async (respuesta) => {
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

            if (targetId === 'tab-gestor') {
                cargarMisEscenas();
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
                selectorEscena.innerHTML += `<option value="${e.id_escena}">${e.nombre_escena}</option>`;
            });

            // Carga zonas
            const respZonas = await fetch(`${API_URL}/zonas`);
            const datosZonas = await manejarRespuesta(respZonas);
            const selectorZona = document.getElementById('zonaSeleccionada');
            selectorZona.innerHTML = '<option value="">-- Seleccionar Continente --</option>';
            datosZonas.resultados.forEach(z => {
                selectorZona.innerHTML += `<option value="${z.id_zona}">${z.nombre_zona}</option>`;
            });

            // Carga categorias
            const respCat = await fetch(`${API_URL}/categorias`);
            const datosCat = await manejarRespuesta(respCat);
            const selectorCat = document.getElementById('categoriaEvento');
            selectorCat.innerHTML = '<option value="">-- Seleccionar Categoría --</option>';
            datosCat.resultados.forEach(c => {
                selectorCat.innerHTML += `<option value="${c.id_categoria}">${c.nombre_categoria}</option>`;
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
                selectorLinea.innerHTML += `<option value="${l.id_linea}">${l.nombre_linea}</option>`;
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
            imagen_url: document.getElementById('imagenUrl').value || null
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
            
            datos.resultados.forEach(ev => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${ev.titulo_evento}</td>
                    <td>${ev.anio_inicio}</td>
                    <td>${ev.anio_fin || '-'}</td>
                    <td>${ev.nombre_categoria || 'General'}</td>
                    <td>
                        <button class="btn" style="padding: 5px 10px; font-size: 0.8rem; background-color: #f39c12; margin-right: 5px;" onclick="window.editarEventoC(${ev.id_evento}, '${ev.titulo_evento.replace(/'/g, "\\'")}', ${ev.anio_inicio}, ${ev.anio_fin || null}, ${ev.id_categoria || null}, '${(ev.descripcion || '').replace(/\n/g, "\\n").replace(/'/g, "\\'")}', '${(ev.imagen_url || '').replace(/'/g, "\\'")}')">Editar</button>
                        <button class="btn" style="padding: 5px 10px; font-size: 0.8rem; background-color: #e74c3c;" onclick="window.borrarEventoC(${ev.id_evento})">Borrar</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch(error) {
            tbody.innerHTML = `<tr><td colspan="5" style="color: #ff6b6b; text-align:center;">Error: ${error.message}</td></tr>`;
        }
    }

    window.editarEventoC = function(id, titulo, anio_inicio, anio_fin, id_categoria, descripcion, imagen_url) {
        document.getElementById('idEventoModificar').value = id;
        document.getElementById('tituloEvento').value = titulo;
        document.getElementById('anioInicio').value = anio_inicio;
        document.getElementById('anioFin').value = anio_fin || '';
        document.getElementById('categoriaEvento').value = id_categoria || '';
        document.getElementById('descEvento').value = descripcion || '';
        document.getElementById('imagenUrl').value = imagen_url || '';
        
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
                        <h3>${escena.nombre_escena}</h3>
                        <p style="color: #ccc; font-size: 0.9rem;">Escena Crono-Espacial</p>
                        <button class="btn" onclick="event.stopPropagation(); window.abrirEdicionProfunda(${escena.id_escena}, '${escena.nombre_escena.replace(/'/g, "\\'")}')">Editar Escena</button>
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
            <h3>${escena.nombre_escena}</h3>
            <p style="margin-top: 15px; font-weight: 600; color: #4a90e2; font-size: 0.95rem;">Explorar Escena ➔</p>
        `;
        grilla.appendChild(tarjeta);
    });
}

// ==========================================
// Inicio motor crono espacial
// ==========================================

// Variables estado motor
let _datosEscena = null;         
let _anioMin = 0;               
let _anioMax = 0;               
let _escala = 4;                
const _ESCALA_MIN = 0.5;        
const _ESCALA_MAX = 150;         
const _SUBLANE_H = 55;          
const _CINTA_H = 34;            
const _CINTA_OFFSET_TOP = 10;   

// Calculo intervalo ideal
function _calcularIntervalo() {
    const pxPorAnio = _escala;
    // Inicio asignacion proporcion
    const aniosPorMarca = 80 / pxPorAnio; 
    const escalones = [1, 2, 5, 10, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
    for (let i = 0; i < escalones.length; i++) {
        if (escalones[i] >= aniosPorMarca) return escalones[i];
    }
    return 5000;
}

// Formatear anio
function _formatearAnio(anio) {
    if (anio === 0) return 'A.D. 0';
    return anio < 0 ? `${Math.abs(anio)} a.C.` : String(anio);
}

// Inicio renderizado principal
function _renderizarLineasDeTiempo() {
    const contenedorGlobal = document.getElementById('timelineGlobalContainer');
    if (!contenedorGlobal || !_datosEscena) return;

    contenedorGlobal.innerHTML = '';

    // Inicio margen linea
    const margenAnio = 500;
    const minimoAnio = _anioMin - margenAnio;
    const maximoAnio = _anioMax + margenAnio;

    // Calculo ancho linea
    const anchoCalculado = (maximoAnio - minimoAnio) * _escala;
    const anchoGlobal = Math.max(anchoCalculado, window.innerWidth * 3);
    contenedorGlobal.style.width = `${anchoGlobal}px`;

    // Inicio conversion px
    const anioPixeles = (anio) => (anio - minimoAnio) * _escala;

    // Renderizado regla
    const reglaTemporal = document.createElement('div');
    reglaTemporal.className = 'time-ruler';
    reglaTemporal.style.width = `${anchoGlobal}px`;

    const interv = _calcularIntervalo();
    const primeraMarca = Math.ceil(minimoAnio / interv) * interv;

    // Inicio calculo submarcas
    let subInterv = interv;
    const posiblesSubInterv = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000];
    for (let i = posiblesSubInterv.length - 1; i >= 0; i--) {
        const val = posiblesSubInterv[i];
        if (val < interv && (interv % val === 0)) {
            // Inicio validacion espacio visual
            if ((val * _escala) >= 15) { 
                subInterv = val;
            }
        }
    }

    for (let anio = primeraMarca; anio <= maximoAnio; anio += interv) {
        // Inicio renderizado marca principal
        const marcaTiempo = document.createElement('div');
        marcaTiempo.className = 'time-marker';
        marcaTiempo.textContent = _formatearAnio(anio);
        marcaTiempo.style.left = `${anioPixeles(anio)}px`;
        reglaTemporal.appendChild(marcaTiempo);

        // Inicio renderizado submarcas
        if (subInterv < interv) {
            for (let subAnio = anio + subInterv; subAnio < anio + interv && subAnio <= maximoAnio; subAnio += subInterv) {
                const subMarca = document.createElement('div');
                subMarca.className = 'time-marker minor-tick';
                subMarca.style.left = `${anioPixeles(subAnio)}px`;
                reglaTemporal.appendChild(subMarca);
            }
        }
    }
    contenedorGlobal.appendChild(reglaTemporal);

    // Renderizado linea inicial
    const lineaInicial = document.createElement('div');
    lineaInicial.style.cssText = `
        position: absolute; top: 60px; bottom: 0;
        left: ${anioPixeles(0)}px;
        width: 1px;
        background: rgba(255,255,255,0.08);
        pointer-events: none;
    `;
    contenedorGlobal.appendChild(lineaInicial);

    // Renderizado carriles
    _datosEscena.lineas.forEach(linea => {
        const carril = document.createElement('div');
        carril.className = 'lane';

        // Renderizado cabecera
        const cabecera = document.createElement('div');
        cabecera.className = 'lane-header';
        cabecera.innerHTML = `
            <h3 class="lane-title" style="border-left-color: ${linea.color_personalizado}; color: white;">
                ${linea.nombre_linea}
                <span style="font-size:0.75rem; font-weight:400; opacity:0.6;">(${linea.nombre_zona})</span>
            </h3>
        `;
        carril.appendChild(cabecera);

        const pistaCarril = document.createElement('div');
        pistaCarril.className = 'lane-track';
        // Seteo ancho
        pistaCarril.style.width = `${anchoGlobal}px`;

        if (linea.eventos && linea.eventos.length > 0) {
            // Inicio ordenamiento
            linea.eventos.sort((a, b) => a.anio_inicio - b.anio_inicio);

            // Inicio calculo pistas
            const finSubcarrilesX = [-Infinity, -Infinity, -Infinity, -Infinity, -Infinity];
            let maxSubcarril = 0;

            linea.eventos.forEach(evento => {
                const anioFinal = evento.anio_fin ? evento.anio_fin : evento.anio_inicio;
                const inicioX = anioPixeles(evento.anio_inicio);
                const duracionPixeles = (anioFinal - evento.anio_inicio) * _escala;
                const cintaAncho = Math.max(duracionPixeles, _CINTA_H); 
                const finX = inicioX + cintaAncho + 16; 

                // Busqueda pista libre
                let subcarril = 0;
                for (let i = 0; i < finSubcarrilesX.length; i++) {
                    if (finSubcarrilesX[i] <= inicioX) {
                        subcarril = i;
                        finSubcarrilesX[i] = finX;
                        if (i > maxSubcarril) maxSubcarril = i;
                        break;
                    }
                }

                const grupo = document.createElement('div');
                grupo.className = 'event-group';
                grupo.style.left = `${inicioX}px`;
                grupo.style.top = `${_CINTA_OFFSET_TOP + (subcarril * _SUBLANE_H)}px`;
                grupo.style.width = `${cintaAncho}px`;
                grupo.style.height = `${_CINTA_H}px`;

                // Inicio renderizado linea guia
                grupo.onmouseenter = () => {
                    let guiaGlobal = document.getElementById('globalGuideLine');
                    if (!guiaGlobal) {
                        guiaGlobal = document.createElement('div');
                        guiaGlobal.id = 'globalGuideLine';
                        guiaGlobal.style.position = 'absolute';
                        guiaGlobal.style.width = '1px';
                        guiaGlobal.style.borderLeft = '1px dashed rgba(255, 255, 255, 0.6)';
                        guiaGlobal.style.pointerEvents = 'none';
                        // Inicio aplicacion indice z
                        guiaGlobal.style.zIndex = '1'; 
                        document.getElementById('timelineGlobalContainer').appendChild(guiaGlobal);
                    }
                    
                    // Inicio calculo coordenadas
                    const rectGrupo = grupo.getBoundingClientRect();
                    const contenedorGlobal = document.getElementById('timelineGlobalContainer');
                    const rectGlobal = contenedorGlobal.getBoundingClientRect();
                    const ruler = document.querySelector('.time-ruler');
                    const rectRuler = ruler ? ruler.getBoundingClientRect() : rectGlobal;
                    
                    const xLocal = rectGrupo.left - rectGlobal.left;
                    const yLocal = rectRuler.bottom - rectGlobal.top;
                    const altoLinea = rectGrupo.top - rectRuler.bottom;
                    
                    guiaGlobal.style.left = `${xLocal}px`;
                    guiaGlobal.style.top = `${yLocal}px`;
                    guiaGlobal.style.height = `${altoLinea}px`;
                    guiaGlobal.style.display = 'block';
                };
                grupo.onmouseleave = () => {
                    const guiaGlobal = document.getElementById('globalGuideLine');
                    if (guiaGlobal) guiaGlobal.style.display = 'none';
                };

                // Cinta
                const cinta = document.createElement('div');
                cinta.className = 'event-ribbon';
                cinta.style.width = `${cintaAncho}px`;
                cinta.style.backgroundColor = linea.color_personalizado;
                cinta.title = `${evento.titulo_evento} (${_formatearAnio(evento.anio_inicio)}${evento.anio_fin ? ' – ' + _formatearAnio(evento.anio_fin) : ''})`;

                // Etiqueta flotante interior
                const etiqueta = document.createElement('div');
                etiqueta.className = 'ribbon-label';
                etiqueta.textContent = `${evento.titulo_evento} (${_formatearAnio(evento.anio_inicio)})`;

                // Inicio click evento
                grupo.addEventListener('click', (e) => {
                    e.stopPropagation();
                    _abrirModal(evento, linea.color_personalizado);
                });

                grupo.appendChild(cinta);
                grupo.appendChild(etiqueta);
                pistaCarril.appendChild(grupo);
            });

            // Seteo altura carril
            const carrilAltura = (maxSubcarril + 1) * _SUBLANE_H + _CINTA_OFFSET_TOP * 2;
            pistaCarril.style.minHeight = `${carrilAltura}px`;

        } else {
            pistaCarril.innerHTML = `<p style="color: rgba(255,255,255,0.25); padding: 1.5rem 2rem; font-style: italic;">Sin eventos en esta línea.</p>`;
            pistaCarril.style.minHeight = '80px';
        }

        carril.appendChild(pistaCarril);
        contenedorGlobal.appendChild(carril);
    });

    // Actualizacion indicador
    const etiquetaEscala = document.getElementById('zoomLabel');
    if (etiquetaEscala) etiquetaEscala.textContent = `${_escala} px/año`;
}

// Inicio modal
function _abrirModal(evento, colorLinea) {
    const capa = document.getElementById('eventModalOverlay');
    const contenedorImg = document.getElementById('modalImageContainer');
    const tituloModal = document.getElementById('modalTitle');
    const aniosModal = document.getElementById('modalYears');
    const categoriaModal = document.getElementById('modalCategory');
    const descModal = document.getElementById('modalDesc');

    if (!capa) return;

    // Inicio renderizado de imagen modal
    if (evento.imagen_url && evento.imagen_url.trim() !== '') {
        contenedorImg.innerHTML = `<img src="${evento.imagen_url.trim()}" alt="${evento.titulo_evento}" style="width: 100%; height: 220px; object-fit: cover; border-radius: 20px 20px 0 0; display: block;">`;
        contenedorImg.style.display = 'block';
    } else {
        contenedorImg.innerHTML = '';
        contenedorImg.style.display = 'none';
    }

    // Color del borde superior del modal según línea
    capa.querySelector('.modal-content').style.borderTop = `4px solid ${colorLinea}`;

    tituloModal.textContent = evento.titulo_evento;
    aniosModal.textContent = `${evento.anio_inicio < 0 ? Math.abs(evento.anio_inicio) + ' a.C.' : evento.anio_inicio}` +
        (evento.anio_fin ? ` – ${evento.anio_fin < 0 ? Math.abs(evento.anio_fin) + ' a.C.' : evento.anio_fin}` : '');
    categoriaModal.textContent = evento.nombre_categoria || 'General';
    categoriaModal.style.background = colorLinea;
    descModal.textContent = evento.descripcion || 'Sin descripción detallada.';

    capa.classList.remove('hidden');
}

// Inicio carga escena api
window.cargarLienzo = async function(idEscena) {
    const objetoTitulo = document.getElementById('lienzoEscenaTitulo');
    const contenedorGlobal = document.getElementById('timelineGlobalContainer');
    if (!contenedorGlobal || !objetoTitulo) return;

    try {
        const respuesta = await fetch(`${API_URL}/escenas/${idEscena}/detalle`);
        const datos = await manejarRespuesta(respuesta);

        objetoTitulo.textContent = datos.nombre_escena;

        if (!datos.lineas || datos.lineas.length === 0) {
            contenedorGlobal.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%;"><h2 style="color: rgba(255,255,255,0.5);">Esta escena está vacía.</h2></div>';
            return;
        }

        // Extraer todos los eventos para calcular rango global
        let todosEventos = [];
        datos.lineas.forEach(l => { if (l.eventos) todosEventos = todosEventos.concat(l.eventos); });

        if (todosEventos.length === 0) {
            contenedorGlobal.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%;"><h2 style="color: rgba(255,255,255,0.5);">No hay eventos creados en esta escena aún.</h2></div>';
            return;
        }

        _anioMin = Math.min(...todosEventos.map(e => e.anio_inicio));
        _anioMax = Math.max(...todosEventos.map(e => e.anio_fin ? e.anio_fin : e.anio_inicio));
        _datosEscena = datos;

        // Ajustar escala inicial para que todo quepa razonablemente en pantalla
        const diferenciaAnios = _anioMax - _anioMin + 60;
        const anchoPantalla = window.innerWidth * 0.85;
        _escala = Math.max(_ESCALA_MIN, Math.min(_ESCALA_MAX, anchoPantalla / diferenciaAnios));
        _escala = Math.round(_escala * 10) / 10;

        // Renderizado inicial
        _renderizarLineasDeTiempo();

        // Inicio evento drag scroll
        const areaDeslizamiento = document.getElementById('canvasScrollArea');
        if (areaDeslizamiento && !areaDeslizamiento._dragListenerActivo) {
            areaDeslizamiento._dragListenerActivo = true;
            let estaArrastrando = false, inicioXScroll = 0, scrollIzquierda = 0;

            areaDeslizamiento.addEventListener('mousedown', (e) => {
                // Ignorar clic cinta
                if (e.target.classList.contains('event-ribbon') || e.target.classList.contains('event-group')) return;
                estaArrastrando = true;
                areaDeslizamiento.style.cursor = 'grabbing';
                inicioXScroll = e.pageX - areaDeslizamiento.offsetLeft;
                scrollIzquierda = areaDeslizamiento.scrollLeft;
            });
            document.addEventListener('mouseup', () => {
                estaArrastrando = false;
                areaDeslizamiento.style.cursor = 'grab';
            });
            areaDeslizamiento.addEventListener('mousemove', (e) => {
                if (!estaArrastrando) return;
                e.preventDefault();
                const x = e.pageX - areaDeslizamiento.offsetLeft;
                areaDeslizamiento.scrollLeft = scrollIzquierda - (x - inicioXScroll) * 1.5;
            });
        }

        // Inicio etiquetas flotantes
        // Calculo posicion etiquetas
        function _posicionarEtiquetas() {
            const desplazamientoIzquierda = areaDeslizamiento.scrollLeft;
            const MARGEN_ETIQUETA = 14; 
            document.querySelectorAll('.event-group').forEach(grupo => {
                const etiqueta = grupo.querySelector('.ribbon-label');
                if (!etiqueta) return;
                const grupoInicioX = parseFloat(grupo.dataset.startX || 0);
                const cintaAncho  = parseFloat(grupo.dataset.anchoCinta || 0);
                const anchoTexto  = etiqueta.offsetWidth || 120; 
                // Calculo limite desplazamiento
                const desplazamientoMaximo = Math.max(0, cintaAncho - anchoTexto - MARGEN_ETIQUETA * 2);
                // Calculo desplazamiento efectivo
                const desplazamientoEfectivo = Math.min(desplazamientoMaximo, Math.max(0, desplazamientoIzquierda - grupoInicioX + MARGEN_ETIQUETA));
                etiqueta.style.left = `${desplazamientoEfectivo + MARGEN_ETIQUETA}px`;
            });
        }

        // Escucha evento scroll
        if (areaDeslizamiento && !areaDeslizamiento._labelScrollActivo) {
            areaDeslizamiento._labelScrollActivo = true;
            areaDeslizamiento.addEventListener('scroll', _posicionarEtiquetas);
        }

        // Inicio controles escala
        const botonAcercar  = document.getElementById('btnZoomIn');
        const botonAlejar = document.getElementById('btnZoomOut');

        if (botonAcercar && !botonAcercar._zoomActivo) {
            botonAcercar._zoomActivo = true;
            botonAcercar.addEventListener('click', () => {
                // Calculo proporcion centro
                const areaLienzo = document.getElementById('canvasScrollArea');
                const proporcionCentro = (areaLienzo.scrollLeft + areaLienzo.clientWidth / 2) / parseFloat(document.getElementById('timelineGlobalContainer').style.width);
                
                _escala = Math.min(_ESCALA_MAX, parseFloat((_escala * 1.5).toFixed(2)));
                _renderizarLineasDeTiempo();

                // Reposicionamiento centrado
                const anchoNuevo = parseFloat(document.getElementById('timelineGlobalContainer').style.width);
                areaLienzo.scrollLeft = proporcionCentro * anchoNuevo - areaLienzo.clientWidth / 2;
            });
        }

        if (botonAlejar && !botonAlejar._zoomActivo) {
            botonAlejar._zoomActivo = true;
            botonAlejar.addEventListener('click', () => {
                const areaLienzo = document.getElementById('canvasScrollArea');
                const proporcionCentro = (areaLienzo.scrollLeft + areaLienzo.clientWidth / 2) / parseFloat(document.getElementById('timelineGlobalContainer').style.width);

                _escala = Math.max(_ESCALA_MIN, parseFloat((_escala / 1.5).toFixed(2)));
                _renderizarLineasDeTiempo();

                const anchoNuevo = parseFloat(document.getElementById('timelineGlobalContainer').style.width);
                areaLienzo.scrollLeft = proporcionCentro * anchoNuevo - areaLienzo.clientWidth / 2;
            });
        }

        // Inicio evento rueda raton
        const areaLienzoScroll = document.getElementById('canvasScrollArea');
        if (areaLienzoScroll && !areaLienzoScroll._wheelActivo) {
            areaLienzoScroll._wheelActivo = true;
            areaLienzoScroll.addEventListener('wheel', (e) => {
                e.preventDefault();
                // Evento ir pasado
                // Evento ir futuro
                const velocidadScroll = 3; 
                areaLienzoScroll.scrollLeft += e.deltaY * velocidadScroll;
            }, { passive: false });
        }

        // Inicio cierre modal
        const botonCerrar = document.getElementById('btnCloseModal');
        const capa   = document.getElementById('eventModalOverlay');
        if (botonCerrar && capa) {
            botonCerrar.onclick = () => capa.classList.add('hidden');
            capa.addEventListener('click', (e) => {
                if (e.target === capa) capa.classList.add('hidden');
            });
        }

    } catch (error) {
        objetoTitulo.textContent = 'Error';
        contenedorGlobal.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; height:100%;"><h2 style="color: #ff6b6b;">Error al cargar: ${error.message}</h2></div>`;
    }
};


