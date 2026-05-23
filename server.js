const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const { promesaPool, sql } = require('./db');

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

        const conexionPool = await promesaPool;
        const resultado = await conexionPool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT rut_usuario, id_perfil, nombre_completo, email, password_hash FROM Usuarios WHERE email = @email');

        const usuario = resultado.recordset[0];

        if (!usuario) {
            return res.status(400).json({ error: 'Credenciales inválidas' });
        }

        // Validacion clave
        const claveValida = await bcrypt.compare(password, usuario.password_hash);
        if (!claveValida) {
            return res.status(400).json({ error: 'Credenciales inválidas' });
        }

        res.status(200).json({
            mensaje: 'Login exitoso',
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


// Inicio servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
    console.log(`📍 Accede a http://localhost:${PORT}`);
});
