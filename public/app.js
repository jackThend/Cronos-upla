// URLs base
const API_URL = 'http://localhost:3000/api';

// Utilidad: Parsear JSON o lanzar error
const handleResponse = async (res) => {
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || 'Error desconocido');
    }
    return data;
};

// ==========================================
// LÓGICA DE AUTENTICACIÓN (index.html)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    // Alternar entre login y registro
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    const loginCard = document.getElementById('loginCard');
    const registerCard = document.getElementById('registerCard');

    if (showRegister && showLogin) {
        showRegister.addEventListener('click', (e) => {
            e.preventDefault();
            loginCard.classList.add('hidden');
            registerCard.classList.remove('hidden');
        });

        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            registerCard.classList.add('hidden');
            loginCard.classList.remove('hidden');
        });
    }

    // Login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            try {
                const res = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await handleResponse(res);
                alert(data.mensaje);
                
                // Guardar sesión simple
                localStorage.setItem('usuario_cronos', JSON.stringify(data.usuario));
                window.location.href = 'dashboard.html';

            } catch (error) {
                alert(`Error en Login: ${error.message}`);
            }
        });
    }

    // Registro
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rut = document.getElementById('regRut').value;
            const nombre_completo = document.getElementById('regNombre').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            const id_perfil = document.getElementById('reg-perfil').value;

            try {
                const res = await fetch(`${API_URL}/registro`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rut, id_perfil, nombre_completo, email, password })
                });
                
                const data = await handleResponse(res);
                alert(data.mensaje);
                
                // Volver al login
                showLogin.click();
                registerForm.reset();

            } catch (error) {
                alert(`Error en Registro: ${error.message}`);
            }
        });
    }
});

// ==========================================
// LÓGICA DEL DASHBOARD (dashboard.html)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    
    // Logout
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('usuario_cronos');
            window.location.href = 'index.html';
        });
    }

    // Navegación Sidebar (Scroll suave y clases activas)
    const sidebarLinks = document.querySelectorAll('.sidebar-menu a');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            sidebarLinks.forEach(l => l.parentElement.classList.remove('active'));
            e.currentTarget.parentElement.classList.add('active');
        });
    });

    // Validar Sesion
    const userStr = localStorage.getItem('usuario_cronos');
    let rutUsuario = null;
    if (userStr) {
        rutUsuario = JSON.parse(userStr).rut;
    } else {
        return; // No está logueado
    }

    // Funciones Auxiliares para Cargar Datos
    async function loadEscenas() {
        try {
            const res = await fetch(`${API_URL}/escenas`);
            const data = await handleResponse(res);
            
            // Llenar selects de escenas
            const selectoresEscenas = document.querySelectorAll('#escenaSeleccionada, #escenaParaEvento, #escenaVisualizar');
            selectoresEscenas.forEach(select => {
                select.innerHTML = '<option value="">-- Seleccionar Escena --</option>';
                data.resultados.forEach(escena => {
                    select.innerHTML += `<option value="${escena.id_escena}">${escena.nombre_escena}</option>`;
                });
            });
        } catch(error) {
            console.error('Error cargando escenas:', error);
        }
    }

    async function loadZonas() {
        try {
            const res = await fetch(`${API_URL}/zonas`);
            const data = await handleResponse(res);
            const selectZona = document.getElementById('zonaSeleccionada');
            if(selectZona) {
                selectZona.innerHTML = '<option value="">-- Seleccionar Zona --</option>';
                data.resultados.forEach(zona => {
                    selectZona.innerHTML += `<option value="${zona.id_zona}">${zona.nombre_zona} (${zona.continente})</option>`;
                });
            }
        } catch(error) {
            console.error('Error cargando zonas:', error);
        }
    }

    async function loadCategorias() {
        try {
            const res = await fetch(`${API_URL}/categorias`);
            const data = await handleResponse(res);
            const selectCategoria = document.getElementById('categoriaEvento');
            if(selectCategoria) {
                selectCategoria.innerHTML = '<option value="">-- Seleccionar Categoría --</option>';
                data.resultados.forEach(cat => {
                    selectCategoria.innerHTML += `<option value="${cat.id_categoria}">${cat.nombre_categoria}</option>`;
                });
            }
        } catch(error) {
            console.error('Error cargando categorias:', error);
        }
    }

    // Inicializar Selects si estamos en el dashboard
    if (document.getElementById('formEscena')) {
        loadEscenas();
        loadZonas();
        loadCategorias();
    }

    // Cascading Select: Cuando elige Escena para crear Evento, cargar Líneas
    const escenaParaEvento = document.getElementById('escenaParaEvento');
    const lineaSeleccionada = document.getElementById('lineaSeleccionada');
    
    if (escenaParaEvento && lineaSeleccionada) {
        escenaParaEvento.addEventListener('change', async (e) => {
            const idEscena = e.target.value;
            lineaSeleccionada.innerHTML = '<option value="">-- Seleccionar Línea --</option>';
            if (!idEscena) return;
            
            try {
                const res = await fetch(`${API_URL}/lineas/escena/${idEscena}`);
                const data = await handleResponse(res);
                data.resultados.forEach(linea => {
                    lineaSeleccionada.innerHTML += `<option value="${linea.id_linea}">${linea.nombre_linea}</option>`;
                });
            } catch(error) {
                console.error('Error cargando lineas:', error);
            }
        });
    }

    // Formulario A: Crear Escena
    const formEscena = document.getElementById('formEscena');
    if (formEscena) {
        formEscena.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                nombre_escena: document.getElementById('nombreEscena').value,
                rut_usuario: rutUsuario
            };
            try {
                const res = await fetch(`${API_URL}/escenas`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await handleResponse(res);
                alert(data.mensaje);
                formEscena.reset();
                loadEscenas(); // Recargar lista de escenas
            } catch (error) {
                alert(`Error al crear escena: ${error.message}`);
            }
        });
    }

    // Formulario B: Añadir Línea
    const formLinea = document.getElementById('formLinea');
    if (formLinea) {
        formLinea.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                id_escena: document.getElementById('escenaSeleccionada').value,
                id_zona: document.getElementById('zonaSeleccionada').value,
                nombre_linea: document.getElementById('nombreLinea').value,
                color_personalizado: document.getElementById('colorLinea').value
            };
            try {
                const res = await fetch(`${API_URL}/lineas`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await handleResponse(res);
                alert(data.mensaje);
                formLinea.reset();
                // Si la escena seleccionada para el evento es la misma a la que se le agregó la línea, recargamos las líneas
                if(escenaParaEvento && escenaParaEvento.value === payload.id_escena) {
                    escenaParaEvento.dispatchEvent(new Event('change'));
                }
            } catch (error) {
                alert(`Error al crear línea: ${error.message}`);
            }
        });
    }

    // Formulario C: Crear Evento
    const formEvento = document.getElementById('formEvento');
    if (formEvento) {
        formEvento.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                id_linea: document.getElementById('lineaSeleccionada').value,
                id_categoria: document.getElementById('categoriaEvento').value || null,
                titulo_evento: document.getElementById('tituloEvento').value,
                anio_inicio: document.getElementById('anioInicio').value,
                anio_fin: document.getElementById('anioFin').value || null,
                descripcion: document.getElementById('descEvento').value
            };
            try {
                const res = await fetch(`${API_URL}/eventos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await handleResponse(res);
                alert(data.mensaje);
                formEvento.reset();
                escenaParaEvento.value = '';
                lineaSeleccionada.innerHTML = '<option value="">-- Primero selecciona una Escena --</option>';
            } catch (error) {
                alert(`Error al crear evento: ${error.message}`);
            }
        });
    }

    // Visor de Simultaneidad Básica
    const escenaVisualizar = document.getElementById('escenaVisualizar');
    const lienzoContenedor = document.getElementById('lienzoContenedor');
    
    if (escenaVisualizar && lienzoContenedor) {
        escenaVisualizar.addEventListener('change', async (e) => {
            const idEscena = e.target.value;
            if (!idEscena) {
                lienzoContenedor.innerHTML = '<p style="text-align:center; color: var(--text-light);">Selecciona una escena para ver sus líneas apiladas</p>';
                return;
            }

            try {
                const res = await fetch(`${API_URL}/escenas/${idEscena}/detalle`);
                const data = await handleResponse(res);
                
                lienzoContenedor.innerHTML = '';
                
                if (!data.lineas || data.lineas.length === 0) {
                    lienzoContenedor.innerHTML = '<p style="text-align:center;">Esta escena aún no tiene líneas de tiempo.</p>';
                    return;
                }

                data.lineas.forEach(linea => {
                    const lineaDiv = document.createElement('div');
                    lineaDiv.style.borderLeft = `5px solid ${linea.color_personalizado}`;
                    lineaDiv.style.padding = '10px 15px';
                    lineaDiv.style.background = '#f9f9f9';
                    lineaDiv.style.borderRadius = '4px';
                    
                    let html = `<h4 style="margin-bottom: 10px;">${linea.nombre_linea} (Zona: ${linea.nombre_zona})</h4>`;
                    
                    if (!linea.eventos || linea.eventos.length === 0) {
                        html += '<p style="font-size:0.9em; color:#777;">Sin eventos registrados.</p>';
                    } else {
                        html += '<div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:10px;">';
                        linea.eventos.forEach(evento => {
                            html += `
                                <div style="min-width:200px; background:white; border:1px solid #ddd; padding:10px; border-radius:4px; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                                    <strong style="color:${linea.color_personalizado};">${evento.anio_inicio} ${evento.anio_fin ? '- ' + evento.anio_fin : ''}</strong>
                                    <h5 style="margin:5px 0;">${evento.titulo_evento}</h5>
                                    <span style="font-size:0.8em; background:#eee; padding:2px 5px; border-radius:3px;">${evento.nombre_categoria || 'General'}</span>
                                </div>
                            `;
                        });
                        html += '</div>';
                    }
                    
                    lineaDiv.innerHTML = html;
                    lienzoContenedor.appendChild(lineaDiv);
                });

            } catch (error) {
                lienzoContenedor.innerHTML = `<p style="color:red;">Error al cargar detalle: ${error.message}</p>`;
            }
        });
    }

});
