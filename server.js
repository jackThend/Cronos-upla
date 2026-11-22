const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { promesaPool, sql } = require('./db');
const ia = require('./ia');
const sesion = require('./sesion');
const limitador = require('./limitador');

require('dotenv').config();
sesion.obtenerSecreto();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Inicio autenticacion de la API
const RUTAS_PUBLICAS = new Set([
    'POST /api/registro',
    'POST /api/login',
    'GET /api/zonas',
    'GET /api/categorias',
    'GET /api/escenas',
    'GET /api/plantillas',
    'GET /api/ia/proveedores'
]);
const PATRON_DETALLE_PUBLICO = /^\/api\/escenas\/\d+\/detalle$/;

app.use((req, res, next) => {
    if (!req.path.startsWith('/api/')) return next();
    if (RUTAS_PUBLICAS.has(`${req.method} ${req.path}`)) return next();
    if (req.method === 'GET' && PATRON_DETALLE_PUBLICO.test(req.path)) return next();

    const usuario = sesion.verificarToken((req.headers.authorization || '').replace(/^Bearer /, ''));
    if (!usuario) return res.status(401).json({ error: 'Sesión no válida o expirada' });

    req.usuario = usuario;
    if (req.body && typeof req.body === 'object') req.body.rut_usuario = usuario.rut;
    next();
});

async function escenaDelUsuario(id_escena, rut) {
    const conexionPool = await promesaPool;
    const resultado = await conexionPool.request()
        .input('id_escena', sql.Int, id_escena)
        .input('rut', sql.VarChar, rut)
        .query('SELECT 1 AS ok FROM Escenas_Crono WHERE id_escena = @id_escena AND rut_usuario = @rut');
    return resultado.recordset.length > 0;
}

async function lineaDelUsuario(id_linea, rut) {
    const conexionPool = await promesaPool;
    const resultado = await conexionPool.request()
        .input('id_linea', sql.Int, id_linea)
        .input('rut', sql.VarChar, rut)
        .query(`
            SELECT 1 AS ok FROM Lineas_Tiempo L
            JOIN Escenas_Crono E ON L.id_escena = E.id_escena
            WHERE L.id_linea = @id_linea AND E.rut_usuario = @rut
        `);
    return resultado.recordset.length > 0;
}

async function eventoDelUsuario(id_evento, rut) {
    const conexionPool = await promesaPool;
    const resultado = await conexionPool.request()
        .input('id_evento', sql.Int, id_evento)
        .input('rut', sql.VarChar, rut)
        .query(`
            SELECT 1 AS ok FROM Eventos_Historicos V
            JOIN Lineas_Tiempo L ON V.id_linea = L.id_linea
            JOIN Escenas_Crono E ON L.id_escena = E.id_escena
            WHERE V.id_evento = @id_evento AND E.rut_usuario = @rut
        `);
    return resultado.recordset.length > 0;
}

const SIN_PERMISO = { error: 'No tienes permiso para esta acción' };
// Fin autenticacion de la API

// ---------------------------------------------------------
// RUTAS DE LA API (Backend)
// ---------------------------------------------------------

// Inicio logica registro
app.post('/api/registro', async (req, res) => {
    try {
        const { rut, id_perfil, nombre_completo, email, password } = req.body;
        
        if (!rut || !id_perfil || !nombre_completo || !email || !password) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }

        const conexionPool = await promesaPool;

        // Verificacion usuario existente
        const usuarioExiste = await conexionPool.request()
            .input('rut', sql.VarChar, rut)
            .query('SELECT rut_usuario FROM Usuarios WHERE rut_usuario = @rut');

        if (usuarioExiste.recordset.length > 0) {
            return res.status(400).json({ error: 'El usuario ya está registrado' });
        }

        // Hash clave
        const semilla = await bcrypt.genSalt(10);
        const hashClave = await bcrypt.hash(password, semilla);

        // Insercion DB
        await conexionPool.request()
            .input('rut', sql.VarChar, rut)
            .input('id_perfil', sql.Int, id_perfil)
            .input('nombre_completo', sql.VarChar, nombre_completo)
            .input('email', sql.VarChar, email)
            .input('password_hash', sql.VarChar, hashClave)
            .query(`
                INSERT INTO Usuarios (rut_usuario, id_perfil, nombre_completo, email, password_hash)
                VALUES (@rut, @id_perfil, @nombre_completo, @email, @password_hash)
            `);

        res.status(201).json({ mensaje: 'Usuario registrado exitosamente' });
    } catch (error) {
        console.error('Error en registro:', error.message);
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor al registrar' });
    }
});

// Inicio logica login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });
        }

        const claves = [`ip:${req.ip}`, `email:${String(email).toLowerCase()}`];
        const esperaMs = limitador.tiempoBloqueoMs(claves);
        if (esperaMs > 0) {
            const minutos = Math.ceil(esperaMs / 60000);
            return res.status(429).json({ error: `Demasiados intentos fallidos. Intenta nuevamente en ${minutos} minuto(s)` });
        }

        const conexionPool = await promesaPool;
        const resultado = await conexionPool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT rut_usuario, id_perfil, nombre_completo, email, password_hash FROM Usuarios WHERE email = @email');

        const usuario = resultado.recordset[0];

        if (!usuario) {
            limitador.registrarFallo(claves);
            return res.status(400).json({ error: 'Credenciales inválidas' });
        }

        // Validacion clave
        const claveValida = await bcrypt.compare(password, usuario.password_hash);
        if (!claveValida) {
            limitador.registrarFallo(claves);
            return res.status(400).json({ error: 'Credenciales inválidas' });
        }

        limitador.limpiar(claves[1]);

        res.status(200).json({
            mensaje: 'Login exitoso',
            token: sesion.crearToken(usuario.rut_usuario),
            usuario: {
                rut: usuario.rut_usuario,
                id_perfil: usuario.id_perfil,
                nombre: usuario.nombre_completo,
                email: usuario.email
            }
        });
    } catch (error) {
        console.error('Error en login:', error.message);
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor al hacer login' });
    }
});

// Inicio logica creacion escena
app.post('/api/escenas', async (req, res) => {
    try {
        const { nombre_escena, rut_usuario } = req.body;

        if (!nombre_escena || !rut_usuario) {
            return res.status(400).json({ error: 'nombre_escena y rut_usuario son requeridos' });
        }

        const conexionPool = await promesaPool;
        const insertRes = await conexionPool.request()
            .input('nombre_escena', sql.VarChar, nombre_escena)
            .input('rut_usuario', sql.VarChar, rut_usuario)
            .query(`
                INSERT INTO Escenas_Crono (nombre_escena, rut_usuario)
                OUTPUT INSERTED.id_escena
                VALUES (@nombre_escena, @rut_usuario)
            `);

        res.status(201).json({ 
            mensaje: 'Escena creada exitosamente',
            id_escena: insertRes.recordset[0].id_escena
        });
    } catch (error) {
        console.error('Error al crear escena:', error.message);
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor al crear escena' });
    }
});

// Inicio logica creacion linea
app.post('/api/lineas', async (req, res) => {
    try {
        const { id_escena, id_zona, nombre_linea, color_personalizado } = req.body;

        if (!id_escena || !id_zona || !nombre_linea || !color_personalizado) {
            return res.status(400).json({ error: 'Todos los campos de la línea son requeridos' });
        }

        if (!(await escenaDelUsuario(id_escena, req.usuario.rut))) return res.status(403).json(SIN_PERMISO);

        const conexionPool = await promesaPool;
        const insertRes = await conexionPool.request()
            .input('id_escena', sql.Int, id_escena)
            .input('id_zona', sql.Int, id_zona)
            .input('nombre_linea', sql.VarChar, nombre_linea)
            .input('color_personalizado', sql.VarChar, color_personalizado)
            .query(`
                INSERT INTO Lineas_Tiempo (id_escena, id_zona, nombre_linea, color_personalizado)
                OUTPUT INSERTED.id_linea
                VALUES (@id_escena, @id_zona, @nombre_linea, @color_personalizado)
            `);

        res.status(201).json({ 
            mensaje: 'Línea de tiempo creada exitosamente',
            id_linea: insertRes.recordset[0].id_linea
        });
    } catch (error) {
        console.error('Error al crear línea:', error.message);
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor al crear línea' });
    }
});

// Inicio logica creacion evento
app.post('/api/eventos', async (req, res) => {
    try {
        const { id_linea, id_categoria, titulo_evento, anio_inicio, anio_fin, descripcion, imagen_url } = req.body;

        if (!id_linea || !titulo_evento || !anio_inicio) {
            return res.status(400).json({ error: 'id_linea, titulo_evento y anio_inicio son requeridos' });
        }

        if (!(await lineaDelUsuario(id_linea, req.usuario.rut))) return res.status(403).json(SIN_PERMISO);

        const conexionPool = await promesaPool;
        await conexionPool.request()
            .input('id_linea', sql.Int, id_linea)
            .input('id_categoria', sql.Int, id_categoria || null)
            .input('titulo_evento', sql.VarChar, titulo_evento)
            .input('anio_inicio', sql.Int, anio_inicio)
            .input('anio_fin', sql.Int, anio_fin || null)
            .input('descripcion', sql.Text, descripcion || null)
            .input('imagen_url', sql.VarChar, imagen_url || null)
            .query(`
                INSERT INTO Eventos_Historicos (id_linea, id_categoria, titulo_evento, anio_inicio, anio_fin, descripcion, imagen_url)
                VALUES (@id_linea, @id_categoria, @titulo_evento, @anio_inicio, @anio_fin, @descripcion, @imagen_url)
            `);

        res.status(201).json({ mensaje: 'Evento histórico creado exitosamente' });
    } catch (error) {
        console.error('Error al crear evento:', error.message);
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor al crear evento' });
    }
});

// Inicio listado escenas globales (para explorador)
app.get('/api/escenas', async (req, res) => {
    try {
        const { q } = req.query;
        const conexionPool = await promesaPool;
        let query = 'SELECT TOP 20 * FROM Escenas_Crono';
        let request = conexionPool.request();

        if (q) {
            query += ' WHERE nombre_escena LIKE @q';
            request.input('q', sql.VarChar, `%${q}%`);
        }
        
        query += ' ORDER BY id_escena DESC';
        
        const resultado = await request.query(query);
        res.status(200).json({ resultados: resultado.recordset });
    } catch (error) {
        console.error('Error al buscar escenas:', error.message);
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor al buscar escenas' });
    }
});

// Inicio renombrado de escena
app.put('/api/escenas/:id', async (req, res) => {
    try {
        const { nombre_escena } = req.body;
        if (!nombre_escena) return res.status(400).json({ error: 'El nombre de la escena es requerido' });
        if (!(await escenaDelUsuario(req.params.id, req.usuario.rut))) return res.status(403).json(SIN_PERMISO);
        
        const conexionPool = await promesaPool;
        await conexionPool.request()
            .input('id', sql.Int, req.params.id)
            .input('nombre_escena', sql.VarChar, nombre_escena)
            .query('UPDATE Escenas_Crono SET nombre_escena = @nombre_escena WHERE id_escena = @id');
            
        res.status(200).json({ mensaje: 'Escena actualizada exitosamente' });
    } catch (error) {
        console.error('Error al renombrar escena:', error.message);
        res.status(500).json({ error: 'Error interno del servidor al actualizar escena' });
    }
});

// Inicio listado escenas por usuario (para dashboard)
app.get('/api/escenas/usuario/:rut', async (req, res) => {
    try {
        if (req.params.rut !== req.usuario.rut) return res.status(403).json(SIN_PERMISO);
        const conexionPool = await promesaPool;
        const resultado = await conexionPool.request()
            .input('rut', sql.VarChar, req.params.rut)
            .query('SELECT * FROM Escenas_Crono WHERE rut_usuario = @rut');
        res.status(200).json({ resultados: resultado.recordset });
    } catch (error) {
        console.error('Error al buscar escenas de usuario:', error.message);
        res.status(500).json({ error: 'Error interno del servidor al buscar escenas' });
    }
});

// Inicio detalle escena
app.get('/api/escenas/:id/detalle', async (req, res) => {
    try {
        const id_escena = req.params.id;
        const conexionPool = await promesaPool;
        
        // Consulta escena principal
        const escenaRes = await conexionPool.request()
            .input('id_escena', sql.Int, id_escena)
            .query('SELECT * FROM Escenas_Crono WHERE id_escena = @id_escena');
            
        if (escenaRes.recordset.length === 0) {
            return res.status(404).json({ error: 'Escena no encontrada' });
        }
        const escena = escenaRes.recordset[0];

        // Consulta lineas relacionadas
        const lineasRes = await conexionPool.request()
            .input('id_escena', sql.Int, id_escena)
            .query(`
                SELECT L.*, Z.nombre_zona 
                FROM Lineas_Tiempo L
                LEFT JOIN Zonas_Geograficas Z ON L.id_zona = Z.id_zona
                WHERE L.id_escena = @id_escena
            `);
        escena.lineas = lineasRes.recordset;

        // Consulta eventos relacionados
        if (escena.lineas.length > 0) {
            const lineasIds = escena.lineas.map(l => l.id_linea);
            // Clausula de inclusion
            const eventosRes = await conexionPool.request()
                .query(`
                    SELECT E.*, C.nombre_categoria 
                    FROM Eventos_Historicos E
                    LEFT JOIN Categorias C ON E.id_categoria = C.id_categoria
                    WHERE E.id_linea IN (${lineasIds.join(',')})
                    ORDER BY E.anio_inicio ASC
                `);
            
            // Agrupacion local
            escena.lineas.forEach(linea => {
                linea.eventos = eventosRes.recordset.filter(e => e.id_linea === linea.id_linea);
            });
        }

        res.status(200).json(escena);
    } catch (error) {
        console.error('Error al obtener detalle de escena:', error.message);
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor al obtener detalle' });
    }
});

// Inicio endpoints auxiliares
app.get('/api/zonas', async (req, res) => {
    try {
        const conexionPool = await promesaPool;
        const resultado = await conexionPool.request().query('SELECT * FROM Zonas_Geograficas');
        res.status(200).json({ resultados: resultado.recordset });
    } catch (error) {
        res.status(500).json({ error: 'Error al buscar zonas' });
    }
});

app.get('/api/categorias', async (req, res) => {
    try {
        const conexionPool = await promesaPool;
        const resultado = await conexionPool.request().query('SELECT * FROM Categorias');
        res.status(200).json({ resultados: resultado.recordset });
    } catch (error) {
        res.status(500).json({ error: 'Error al buscar categorias' });
    }
});

app.get('/api/lineas/escena/:id_escena', async (req, res) => {
    try {
        if (!(await escenaDelUsuario(req.params.id_escena, req.usuario.rut))) return res.status(403).json(SIN_PERMISO);
        const conexionPool = await promesaPool;
        const resultado = await conexionPool.request()
            .input('id_escena', sql.Int, req.params.id_escena)
            .query('SELECT * FROM Lineas_Tiempo WHERE id_escena = @id_escena');
        res.status(200).json({ resultados: resultado.recordset });
    } catch (error) {
        res.status(500).json({ error: 'Error al buscar lineas' });
    }
});

// Inicio listado eventos linea
app.get('/api/eventos/linea/:id_linea', async (req, res) => {
    try {
        if (!(await lineaDelUsuario(req.params.id_linea, req.usuario.rut))) return res.status(403).json(SIN_PERMISO);
        const conexionPool = await promesaPool;
        const resultado = await conexionPool.request()
            .input('id_linea', sql.Int, req.params.id_linea)
            .query(`
                SELECT E.*, C.nombre_categoria 
                FROM Eventos_Historicos E
                LEFT JOIN Categorias C ON E.id_categoria = C.id_categoria
                WHERE E.id_linea = @id_linea
                ORDER BY E.anio_inicio ASC
            `);
        res.status(200).json({ resultados: resultado.recordset });
    } catch (error) {
        res.status(500).json({ error: 'Error al buscar eventos de la línea' });
    }
});

// Inicio actualizacion evento
app.put('/api/eventos/:id', async (req, res) => {
    try {
        if (!(await eventoDelUsuario(req.params.id, req.usuario.rut))) return res.status(403).json(SIN_PERMISO);
        const id_evento = req.params.id;
        const { id_categoria, titulo_evento, anio_inicio, anio_fin, descripcion, imagen_url } = req.body;

        if (!titulo_evento || !anio_inicio) {
            return res.status(400).json({ error: 'titulo_evento y anio_inicio son requeridos' });
        }

        const conexionPool = await promesaPool;
        await conexionPool.request()
            .input('id_evento', sql.Int, id_evento)
            .input('id_categoria', sql.Int, id_categoria || null)
            .input('titulo_evento', sql.VarChar, titulo_evento)
            .input('anio_inicio', sql.Int, anio_inicio)
            .input('anio_fin', sql.Int, anio_fin || null)
            .input('descripcion', sql.Text, descripcion || null)
            .input('imagen_url', sql.VarChar, imagen_url || null)
            .query(`
                UPDATE Eventos_Historicos
                SET id_categoria = @id_categoria, 
                    titulo_evento = @titulo_evento, 
                    anio_inicio = @anio_inicio, 
                    anio_fin = @anio_fin, 
                    descripcion = @descripcion, 
                    imagen_url = @imagen_url
                WHERE id_evento = @id_evento
            `);

        res.status(200).json({ mensaje: 'Evento actualizado exitosamente' });
    } catch (error) {
        console.error('Error al actualizar evento:', error.message);
        res.status(500).json({ error: 'Error interno del servidor al actualizar evento' });
    }
});

// Inicio borrado evento
app.delete('/api/eventos/:id', async (req, res) => {
    try {
        if (!(await eventoDelUsuario(req.params.id, req.usuario.rut))) return res.status(403).json(SIN_PERMISO);
        const id_evento = req.params.id;
        const conexionPool = await promesaPool;
        
        await conexionPool.request()
            .input('id_evento', sql.Int, id_evento)
            .query('DELETE FROM Eventos_Historicos WHERE id_evento = @id_evento');

        res.status(200).json({ mensaje: 'Evento eliminado exitosamente' });
    } catch (error) {
        console.error('Error al borrar evento:', error.message);
        res.status(500).json({ error: 'Error interno del servidor al borrar evento' });
    }
});
// Fin borrado evento

// Inicio borrado linea
app.delete('/api/lineas/:id', async (req, res) => {
    try {
        if (!(await lineaDelUsuario(req.params.id, req.usuario.rut))) return res.status(403).json(SIN_PERMISO);
        const id_linea = req.params.id;
        const conexionPool = await promesaPool;
        
        await conexionPool.request()
            .input('id_linea', sql.Int, id_linea)
            .query('DELETE FROM Eventos_Historicos WHERE id_linea = @id_linea');
            
        await conexionPool.request()
            .input('id_linea', sql.Int, id_linea)
            .query('DELETE FROM Lineas_Tiempo WHERE id_linea = @id_linea');

        res.status(200).json({ mensaje: 'Linea eliminada exitosamente' });
    } catch (error) {
        console.error('Error al borrar linea:', error.message);
        res.status(500).json({ error: 'Error interno del servidor al borrar linea' });
    }
});
// Fin borrado linea

// Inicio borrado escena
app.delete('/api/escenas/:id', async (req, res) => {
    try {
        if (!(await escenaDelUsuario(req.params.id, req.usuario.rut))) return res.status(403).json(SIN_PERMISO);
        const id_escena = req.params.id;
        const conexionPool = await promesaPool;
        
        await conexionPool.request()
            .input('id_escena', sql.Int, id_escena)
            .query('DELETE FROM Eventos_Historicos WHERE id_linea IN (SELECT id_linea FROM Lineas_Tiempo WHERE id_escena = @id_escena)');
            
        await conexionPool.request()
            .input('id_escena', sql.Int, id_escena)
            .query('DELETE FROM Lineas_Tiempo WHERE id_escena = @id_escena');
            
        await conexionPool.request()
            .input('id_escena', sql.Int, id_escena)
            .query('DELETE FROM Escenas_Crono WHERE id_escena = @id_escena');

        res.status(200).json({ mensaje: 'Escena eliminada exitosamente' });
    } catch (error) {
        console.error('Error al borrar escena:', error.message);
        res.status(500).json({ error: 'Error interno del servidor al borrar escena' });
    }
});
// Fin borrado escena


// Inicio importacion y plantillas
const DIR_PLANTILLAS = path.join(__dirname, 'plantillas');
const MAX_LINEAS = 50;
const MAX_EVENTOS = 2000;
const REGEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function errorValidacion(mensaje) {
    const error = new Error(mensaje);
    error.status = 400;
    return error;
}

function aEntero(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    const numero = Number(valor);
    return Number.isInteger(numero) ? numero : NaN;
}

async function validarLineas(conexionPool, lineas) {
    if (!Array.isArray(lineas)) throw errorValidacion('lineas es requerido');
    if (lineas.length === 0 || lineas.length > MAX_LINEAS) {
        throw errorValidacion(`La escena debe tener entre 1 y ${MAX_LINEAS} líneas`);
    }

    const zonasRes = await conexionPool.request().query('SELECT id_zona, nombre_zona FROM Zonas_Geograficas');
    const categoriasRes = await conexionPool.request().query('SELECT id_categoria, nombre_categoria FROM Categorias');
    const zonas = new Map(zonasRes.recordset.map(z => [z.nombre_zona.toLowerCase(), z.id_zona]));
    const categorias = new Map(categoriasRes.recordset.map(c => [c.nombre_categoria.toLowerCase(), c.id_categoria]));

    let totalEventos = 0;
    return lineas.map((linea, i) => {
        const etiqueta = `Línea ${i + 1}`;
        if (!linea.nombre_linea) throw errorValidacion(`${etiqueta}: falta el nombre de la línea`);

        const id_zona = zonas.get(String(linea.nombre_zona || '').trim().toLowerCase());
        if (!id_zona) throw errorValidacion(`${etiqueta} (${linea.nombre_linea}): la zona "${linea.nombre_zona || ''}" no existe`);

        const color = linea.color_personalizado || '#3498db';
        if (!REGEX_COLOR.test(color)) throw errorValidacion(`${etiqueta} (${linea.nombre_linea}): el color "${color}" no es válido`);

        const eventos = Array.isArray(linea.eventos) ? linea.eventos : [];
        totalEventos += eventos.length;
        if (totalEventos > MAX_EVENTOS) throw errorValidacion(`La escena no puede tener más de ${MAX_EVENTOS} eventos`);

        const eventosValidos = eventos.map((evento, j) => {
            const etiquetaEvento = `${etiqueta} (${linea.nombre_linea}), evento ${j + 1}`;
            if (!evento.titulo_evento) throw errorValidacion(`${etiquetaEvento}: falta el título`);

            const anio_inicio = aEntero(evento.anio_inicio);
            if (!Number.isInteger(anio_inicio)) throw errorValidacion(`${etiquetaEvento}: el año de inicio no es válido`);

            const anio_fin = aEntero(evento.anio_fin);
            if (anio_fin !== null && (!Number.isInteger(anio_fin) || anio_fin < anio_inicio)) {
                throw errorValidacion(`${etiquetaEvento}: el año de fin no es válido`);
            }

            const id_categoria = categorias.get(String(evento.nombre_categoria || '').trim().toLowerCase());
            if (!id_categoria) throw errorValidacion(`${etiquetaEvento}: la categoría "${evento.nombre_categoria || ''}" no existe`);

            const fuente_url = evento.fuente_url ? String(evento.fuente_url).trim() : null;
            if (fuente_url && (fuente_url.length > 500 || !/^https?:\/\//i.test(fuente_url))) {
                throw errorValidacion(`${etiquetaEvento}: la fuente debe ser una URL http(s)`);
            }

            return {
                titulo_evento: evento.titulo_evento,
                anio_inicio,
                anio_fin,
                id_categoria,
                descripcion: evento.descripcion || '',
                imagen_url: evento.imagen_url || null,
                fuente_url
            };
        });

        return { nombre_linea: linea.nombre_linea, id_zona, color, eventos: eventosValidos };
    });
}

async function insertarLineas(transaccion, id_escena, lineasValidas) {
    const existentesRes = await new sql.Request(transaccion)
        .input('id_escena', sql.Int, id_escena)
        .query('SELECT id_linea, nombre_linea FROM Lineas_Tiempo WHERE id_escena = @id_escena');
    const existentes = new Map(existentesRes.recordset.map(l => [l.nombre_linea.toLowerCase(), l.id_linea]));

    for (const linea of lineasValidas) {
        let id_linea = existentes.get(linea.nombre_linea.toLowerCase());

        if (!id_linea) {
            const lineaRes = await new sql.Request(transaccion)
                .input('id_escena', sql.Int, id_escena)
                .input('id_zona', sql.Int, linea.id_zona)
                .input('nombre_linea', sql.VarChar, linea.nombre_linea)
                .input('color_personalizado', sql.VarChar, linea.color)
                .query(`
                    INSERT INTO Lineas_Tiempo (id_escena, id_zona, nombre_linea, color_personalizado)
                    OUTPUT INSERTED.id_linea
                    VALUES (@id_escena, @id_zona, @nombre_linea, @color_personalizado)
                `);
            id_linea = lineaRes.recordset[0].id_linea;
            existentes.set(linea.nombre_linea.toLowerCase(), id_linea);
        }

        for (const evento of linea.eventos) {
            await new sql.Request(transaccion)
                .input('id_linea', sql.Int, id_linea)
                .input('id_categoria', sql.Int, evento.id_categoria)
                .input('titulo_evento', sql.VarChar, evento.titulo_evento)
                .input('anio_inicio', sql.Int, evento.anio_inicio)
                .input('anio_fin', sql.Int, evento.anio_fin)
                .input('descripcion', sql.Text, evento.descripcion)
                .input('imagen_url', sql.VarChar, evento.imagen_url)
                .input('fuente_url', sql.VarChar, evento.fuente_url)
                .query(`
                    INSERT INTO Eventos_Historicos (id_linea, id_categoria, titulo_evento, anio_inicio, anio_fin, descripcion, imagen_url, fuente_url)
                    VALUES (@id_linea, @id_categoria, @titulo_evento, @anio_inicio, @anio_fin, @descripcion, @imagen_url, @fuente_url)
                `);
        }
    }
}

async function ejecutarEnTransaccion(conexionPool, operacion) {
    const transaccion = new sql.Transaction(conexionPool);
    await transaccion.begin();
    try {
        const resultado = await operacion(transaccion);
        await transaccion.commit();
        return resultado;
    } catch (error) {
        await transaccion.rollback();
        throw error;
    }
}

async function obtenerEscenaDeUsuario(conexionPool, id_escena, rut_usuario) {
    const resultado = await conexionPool.request()
        .input('id_escena', sql.Int, id_escena)
        .input('rut', sql.VarChar, rut_usuario)
        .query('SELECT id_escena, nombre_escena FROM Escenas_Crono WHERE id_escena = @id_escena AND rut_usuario = @rut');
    return resultado.recordset[0] || null;
}

async function crearEscenaCompleta(conexionPool, { nombre_escena, rut_usuario, lineas }) {
    if (!nombre_escena || !rut_usuario) {
        throw errorValidacion('nombre_escena y rut_usuario son requeridos');
    }
    if (nombre_escena.length > 150) {
        throw errorValidacion('El nombre de la escena no puede superar los 150 caracteres');
    }

    const lineasValidas = await validarLineas(conexionPool, lineas);

    return ejecutarEnTransaccion(conexionPool, async (transaccion) => {
        const escenaRes = await new sql.Request(transaccion)
            .input('nombre_escena', sql.VarChar, nombre_escena)
            .input('rut_usuario', sql.VarChar, rut_usuario)
            .query(`
                INSERT INTO Escenas_Crono (nombre_escena, rut_usuario)
                OUTPUT INSERTED.id_escena
                VALUES (@nombre_escena, @rut_usuario)
            `);
        const id_escena = escenaRes.recordset[0].id_escena;
        await insertarLineas(transaccion, id_escena, lineasValidas);
        return id_escena;
    });
}

// Inicio importacion escena
app.post('/api/escenas/importar', async (req, res) => {
    try {
        const { nombre_escena, rut_usuario, lineas } = req.body;
        const conexionPool = await promesaPool;
        const id_escena = await crearEscenaCompleta(conexionPool, { nombre_escena, rut_usuario, lineas });
        res.status(201).json({ mensaje: 'Escena importada exitosamente', id_escena });
    } catch (error) {
        if (error.status === 400) return res.status(400).json({ error: error.message });
        console.error('Error al importar escena:', error.message);
        res.status(500).json({ error: 'Error interno del servidor al importar escena' });
    }
});

// Inicio agregar lineas a escena existente (usado por la propuesta de IA)
app.post('/api/escenas/:id/lineas-importar', async (req, res) => {
    try {
        const { rut_usuario, lineas } = req.body;
        const conexionPool = await promesaPool;
        const escena = await obtenerEscenaDeUsuario(conexionPool, req.params.id, rut_usuario);
        if (!escena) return res.status(404).json({ error: 'Escena no encontrada para este usuario' });

        const lineasValidas = await validarLineas(conexionPool, lineas);
        await ejecutarEnTransaccion(conexionPool, (transaccion) => insertarLineas(transaccion, escena.id_escena, lineasValidas));
        res.status(201).json({ mensaje: 'Propuesta añadida a la escena' });
    } catch (error) {
        if (error.status === 400) return res.status(400).json({ error: error.message });
        console.error('Error al añadir lineas a escena:', error.message);
        res.status(500).json({ error: 'Error interno del servidor al añadir lineas' });
    }
});

function leerPlantilla(id) {
    if (!/^[a-z0-9-]+$/.test(id)) return null;
    const ruta = path.join(DIR_PLANTILLAS, `${id}.json`);
    if (!fs.existsSync(ruta)) return null;
    return JSON.parse(fs.readFileSync(ruta, 'utf8'));
}

// Inicio listado plantillas
app.get('/api/plantillas', (req, res) => {
    try {
        const resultados = fs.readdirSync(DIR_PLANTILLAS)
            .filter(archivo => archivo.endsWith('.json'))
            .map(archivo => {
                const id = archivo.replace(/\.json$/, '');
                const datos = leerPlantilla(id);
                return {
                    id,
                    nombre: datos.nombre,
                    descripcion: datos.descripcion || '',
                    total_lineas: datos.lineas.length
                };
            });
        res.status(200).json({ resultados });
    } catch (error) {
        console.error('Error al listar plantillas:', error.message);
        res.status(500).json({ error: 'Error interno del servidor al listar plantillas' });
    }
});

// Inicio creacion escena desde plantilla
app.post('/api/plantillas/:id/crear-escena', async (req, res) => {
    try {
        const { nombre_escena, rut_usuario } = req.body;
        const plantilla = leerPlantilla(req.params.id);
        if (!plantilla) return res.status(404).json({ error: 'Plantilla no encontrada' });

        const conexionPool = await promesaPool;
        const id_escena = await crearEscenaCompleta(conexionPool, {
            nombre_escena: nombre_escena || plantilla.nombre,
            rut_usuario,
            lineas: plantilla.lineas
        });
        res.status(201).json({ mensaje: 'Escena creada desde plantilla', id_escena });
    } catch (error) {
        if (error.status === 400) return res.status(400).json({ error: error.message });
        console.error('Error al crear escena desde plantilla:', error.message);
        res.status(500).json({ error: 'Error interno del servidor al crear escena desde plantilla' });
    }
});
// Fin importacion y plantillas

// Inicio configuracion IA
app.get('/api/ia/proveedores', (req, res) => {
    res.status(200).json({ resultados: ia.listarProveedores() });
});

app.put('/api/ia/configuracion', async (req, res) => {
    try {
        const { rut_usuario, proveedor, modelo, api_key } = req.body;
        if (!rut_usuario || !ia.PROVEEDORES[proveedor]) {
            return res.status(400).json({ error: 'rut_usuario y un proveedor válido son requeridos' });
        }
        if (!modelo || modelo.length > 100) {
            return res.status(400).json({ error: 'Indica el modelo a usar (máx. 100 caracteres)' });
        }
        if (!api_key || api_key.length < 10 || api_key.length > 300) {
            return res.status(400).json({ error: 'La API key no tiene un formato válido' });
        }

        const clave_cifrada = ia.cifrar(api_key);
        const clave_final = api_key.slice(-4);
        const conexionPool = await promesaPool;
        await conexionPool.request()
            .input('rut', sql.VarChar, rut_usuario)
            .input('proveedor', sql.VarChar, proveedor)
            .input('modelo', sql.VarChar, modelo)
            .input('clave_cifrada', sql.VarChar, clave_cifrada)
            .input('clave_final', sql.VarChar, clave_final)
            .query(`
                MERGE Configuracion_IA AS destino
                USING (SELECT @rut AS rut_usuario) AS origen
                ON destino.rut_usuario = origen.rut_usuario
                WHEN MATCHED THEN
                    UPDATE SET proveedor = @proveedor, modelo = @modelo, clave_cifrada = @clave_cifrada,
                               clave_final = @clave_final, fecha_actualizacion = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (rut_usuario, proveedor, modelo, clave_cifrada, clave_final)
                    VALUES (@rut, @proveedor, @modelo, @clave_cifrada, @clave_final);
            `);

        res.status(200).json({ mensaje: 'Configuración de IA guardada' });
    } catch (error) {
        console.error('Error al guardar configuración IA:', error.message);
        res.status(500).json({ error: error.message.includes('CLAVE_CIFRADO_IA')
            ? 'El servidor no tiene configurada la clave de cifrado de IA'
            : 'Error interno del servidor al guardar la configuración de IA' });
    }
});

app.get('/api/ia/configuracion/:rut', async (req, res) => {
    try {
        if (req.params.rut !== req.usuario.rut) return res.status(403).json(SIN_PERMISO);
        const conexionPool = await promesaPool;
        const resultado = await conexionPool.request()
            .input('rut', sql.VarChar, req.params.rut)
            .query('SELECT proveedor, modelo, clave_final FROM Configuracion_IA WHERE rut_usuario = @rut');
        const config = resultado.recordset[0];
        if (!config) return res.status(200).json({ configurado: false });

        res.status(200).json({
            configurado: true,
            proveedor: config.proveedor,
            modelo: config.modelo,
            clave_mascarada: `•••• ${config.clave_final}`
        });
    } catch (error) {
        console.error('Error al leer configuración IA:', error.message);
        res.status(500).json({ error: 'Error interno del servidor al leer la configuración de IA' });
    }
});

app.delete('/api/ia/configuracion/:rut', async (req, res) => {
    try {
        if (req.params.rut !== req.usuario.rut) return res.status(403).json(SIN_PERMISO);
        const conexionPool = await promesaPool;
        await conexionPool.request()
            .input('rut', sql.VarChar, req.params.rut)
            .query('DELETE FROM Configuracion_IA WHERE rut_usuario = @rut');
        res.status(200).json({ mensaje: 'Configuración de IA eliminada' });
    } catch (error) {
        console.error('Error al eliminar configuración IA:', error.message);
        res.status(500).json({ error: 'Error interno del servidor al eliminar la configuración de IA' });
    }
});

// Inicio propuesta IA (borrador, no guarda nada)
app.post('/api/ia/propuesta', async (req, res) => {
    try {
        const { rut_usuario, id_escena, instruccion } = req.body;
        if (!rut_usuario || !id_escena || !instruccion || instruccion.length > 1000) {
            return res.status(400).json({ error: 'rut_usuario, id_escena e instruccion (máx. 1000 caracteres) son requeridos' });
        }

        const conexionPool = await promesaPool;
        const escena = await obtenerEscenaDeUsuario(conexionPool, id_escena, rut_usuario);
        if (!escena) return res.status(404).json({ error: 'Escena no encontrada para este usuario' });

        const configRes = await conexionPool.request()
            .input('rut', sql.VarChar, rut_usuario)
            .query('SELECT proveedor, modelo, clave_cifrada FROM Configuracion_IA WHERE rut_usuario = @rut');
        const config = configRes.recordset[0];
        if (!config) return res.status(400).json({ error: 'Configura primero tu API key de IA' });

        const lineasRes = await conexionPool.request()
            .input('id_escena', sql.Int, escena.id_escena)
            .query(`
                SELECT L.nombre_linea, Z.nombre_zona
                FROM Lineas_Tiempo L
                JOIN Zonas_Geograficas Z ON L.id_zona = Z.id_zona
                WHERE L.id_escena = @id_escena
            `);
        const titulosRes = await conexionPool.request()
            .input('id_escena', sql.Int, escena.id_escena)
            .query(`
                SELECT E.titulo_evento
                FROM Eventos_Historicos E
                JOIN Lineas_Tiempo L ON E.id_linea = L.id_linea
                WHERE L.id_escena = @id_escena
            `);
        const zonasRes = await conexionPool.request().query('SELECT nombre_zona FROM Zonas_Geograficas');
        const categoriasRes = await conexionPool.request().query('SELECT nombre_categoria FROM Categorias');

        const prompt = ia.construirPrompt({
            nombreEscena: escena.nombre_escena,
            lineasExistentes: lineasRes.recordset,
            titulosExistentes: titulosRes.recordset.map(t => t.titulo_evento),
            zonas: zonasRes.recordset.map(z => z.nombre_zona),
            categorias: categoriasRes.recordset.map(c => c.nombre_categoria),
            instruccion
        });

        const texto = await ia.llamarModelo({
            proveedor: config.proveedor,
            modelo: config.modelo,
            apiKey: ia.descifrar(config.clave_cifrada),
            sistema: prompt.sistema,
            usuario: prompt.usuario
        });
        const datos = ia.extraerJSON(texto);

        const lineas = Array.isArray(datos.lineas) ? datos.lineas : [];
        const eventos = lineas.flatMap(linea => Array.isArray(linea.eventos) ? linea.eventos : []);
        const accesibles = await Promise.all(eventos.map(evento => ia.fuenteAccesible(evento.fuente_url)));
        eventos.forEach((evento, i) => {
            evento.fuente_verificada = accesibles[i];
            if (!accesibles[i]) evento.fuente_url = null;
        });

        try {
            await validarLineas(conexionPool, lineas);
        } catch (error) {
            if (error.status === 400) {
                return res.status(422).json({ error: `La propuesta de la IA no es válida: ${error.message}` });
            }
            throw error;
        }

        res.status(200).json({
            lineas,
            fuentes_no_verificadas: accesibles.filter(a => !a).length
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ error: error.message });
        console.error('Error al generar propuesta IA:', error.message);
        res.status(500).json({ error: 'Error interno del servidor al generar la propuesta' });
    }
});
// Fin configuracion IA


// Inicio servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
    console.log(`📍 Accede a http://localhost:${PORT}`);
});
