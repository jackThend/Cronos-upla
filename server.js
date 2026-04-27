const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const { poolPromise, sql } = require('./db');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------
// RUTAS DE LA API (Backend)
// ---------------------------------------------------------

// 1. POST /api/registro: Para crear un usuario en la tabla Usuarios
app.post('/api/registro', async (req, res) => {
    try {
        const { rut, id_perfil, nombre_completo, email, password } = req.body;
        
        if (!rut || !id_perfil || !nombre_completo || !email || !password) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }

        const pool = await poolPromise;

        // Verificar si el usuario ya existe
        const userExist = await pool.request()
            .input('rut', sql.VarChar, rut)
            .query('SELECT rut_usuario FROM Usuarios WHERE rut_usuario = @rut');

        if (userExist.recordset.length > 0) {
            return res.status(400).json({ error: 'El usuario ya está registrado' });
        }

        // Hash de contraseña
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Insertar usuario
        await pool.request()
            .input('rut', sql.VarChar, rut)
            .input('id_perfil', sql.Int, id_perfil)
            .input('nombre_completo', sql.VarChar, nombre_completo)
            .input('email', sql.VarChar, email)
            .input('password_hash', sql.VarChar, password_hash)
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

// 2. POST /api/login: Para validar email y contraseña
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });
        }

        const pool = await poolPromise;
        const result = await pool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT rut_usuario, nombre_completo, email, password_hash FROM Usuarios WHERE email = @email');

        const user = result.recordset[0];

        if (!user) {
            return res.status(400).json({ error: 'Credenciales inválidas' });
        }

        // Validar contraseña
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(400).json({ error: 'Credenciales inválidas' });
        }

        res.status(200).json({
            mensaje: 'Login exitoso',
            usuario: {
                rut: user.rut_usuario,
                nombre: user.nombre_completo,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Error en login:', error.message);
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor al hacer login' });
    }
});

// 3. POST /api/escenas: Crea una nueva "Escena Crono"
app.post('/api/escenas', async (req, res) => {
    try {
        const { nombre_escena, rut_usuario } = req.body;

        if (!nombre_escena || !rut_usuario) {
            return res.status(400).json({ error: 'nombre_escena y rut_usuario son requeridos' });
        }

        const pool = await poolPromise;
        await pool.request()
            .input('nombre_escena', sql.VarChar, nombre_escena)
            .input('rut_usuario', sql.VarChar, rut_usuario)
            .query(`
                INSERT INTO Escenas_Crono (nombre_escena, rut_usuario)
                VALUES (@nombre_escena, @rut_usuario)
            `);

        res.status(201).json({ mensaje: 'Escena creada exitosamente' });
    } catch (error) {
        console.error('Error al crear escena:', error.message);
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor al crear escena' });
    }
});

// 4. POST /api/lineas: Agrega una "Línea de Tiempo" a una Escena
app.post('/api/lineas', async (req, res) => {
    try {
        const { id_escena, id_zona, nombre_linea, color_personalizado } = req.body;

        if (!id_escena || !id_zona || !nombre_linea || !color_personalizado) {
            return res.status(400).json({ error: 'Todos los campos de la línea son requeridos' });
        }

        const pool = await poolPromise;
        await pool.request()
            .input('id_escena', sql.Int, id_escena)
            .input('id_zona', sql.Int, id_zona)
            .input('nombre_linea', sql.VarChar, nombre_linea)
            .input('color_personalizado', sql.VarChar, color_personalizado)
            .query(`
                INSERT INTO Lineas_Tiempo (id_escena, id_zona, nombre_linea, color_personalizado)
                VALUES (@id_escena, @id_zona, @nombre_linea, @color_personalizado)
            `);

        res.status(201).json({ mensaje: 'Línea de tiempo creada exitosamente' });
    } catch (error) {
        console.error('Error al crear línea:', error.message);
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor al crear línea' });
    }
});

// 5. POST /api/eventos: Crea un "Evento Histórico" dentro de una Línea
app.post('/api/eventos', async (req, res) => {
    try {
        const { id_linea, id_categoria, titulo_evento, anio_inicio, anio_fin, descripcion, imagen_url } = req.body;

        if (!id_linea || !titulo_evento || !anio_inicio) {
            return res.status(400).json({ error: 'id_linea, titulo_evento y anio_inicio son requeridos' });
        }

        const pool = await poolPromise;
        await pool.request()
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

// 6. GET /api/escenas: Lista todas las escenas
app.get('/api/escenas', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Escenas_Crono');
        res.status(200).json({ resultados: result.recordset });
    } catch (error) {
        console.error('Error al buscar escenas:', error.message);
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor al buscar escenas' });
    }
});

// 7. GET /api/escenas/:id/detalle: Devuelve la escena con líneas y eventos
app.get('/api/escenas/:id/detalle', async (req, res) => {
    try {
        const id_escena = req.params.id;
        const pool = await poolPromise;
        
        // Obtenemos la escena
        const escenaRes = await pool.request()
            .input('id_escena', sql.Int, id_escena)
            .query('SELECT * FROM Escenas_Crono WHERE id_escena = @id_escena');
            
        if (escenaRes.recordset.length === 0) {
            return res.status(404).json({ error: 'Escena no encontrada' });
        }
        const escena = escenaRes.recordset[0];

        // Obtenemos las líneas de esa escena (con join a Zonas para tener el nombre)
        const lineasRes = await pool.request()
            .input('id_escena', sql.Int, id_escena)
            .query(`
                SELECT L.*, Z.nombre_zona 
                FROM Lineas_Tiempo L
                LEFT JOIN Zonas_Geograficas Z ON L.id_zona = Z.id_zona
                WHERE L.id_escena = @id_escena
            `);
        escena.lineas = lineasRes.recordset;

        // Obtenemos todos los eventos para estas líneas
        if (escena.lineas.length > 0) {
            const lineasIds = escena.lineas.map(l => l.id_linea);
            // Usaremos IN clause
            const eventosRes = await pool.request()
                .query(`
                    SELECT E.*, C.nombre_categoria 
                    FROM Eventos_Historicos E
                    LEFT JOIN Categorias C ON E.id_categoria = C.id_categoria
                    WHERE E.id_linea IN (${lineasIds.join(',')})
                    ORDER BY E.anio_inicio ASC
                `);
            
            // Agrupar eventos por línea
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

// 8. Endpoints auxiliares para poblar selects
app.get('/api/zonas', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Zonas_Geograficas');
        res.status(200).json({ resultados: result.recordset });
    } catch (error) {
        res.status(500).json({ error: 'Error al buscar zonas' });
    }
});

app.get('/api/categorias', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Categorias');
        res.status(200).json({ resultados: result.recordset });
    } catch (error) {
        res.status(500).json({ error: 'Error al buscar categorias' });
    }
});

app.get('/api/lineas/escena/:id_escena', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id_escena', sql.Int, req.params.id_escena)
            .query('SELECT * FROM Lineas_Tiempo WHERE id_escena = @id_escena');
        res.status(200).json({ resultados: result.recordset });
    } catch (error) {
        res.status(500).json({ error: 'Error al buscar lineas' });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
    console.log(`📍 Accede a http://localhost:${PORT}`);
});
