// Base de datos simulada en memoria para probar la API sin SQL Server.
// Responde a las consultas que usa server.js, identificándolas por su texto.
const bcrypt = require('bcryptjs');

const USUARIOS = {
    a: { rut: '11111111-1', email: 'a@test.cl', clave: 'clave-segura-123' },
    b: { rut: '22222222-2', email: 'b@test.cl', clave: 'clave-segura-456' }
};

const estado = {
    usuarios: [],
    escenas: [],
    lineas: [],
    eventos: [],
    configIA: [],
    zonas: [
        { id_zona: 1, nombre_zona: 'Europa', continente: 'Europa' },
        { id_zona: 2, nombre_zona: 'Asia', continente: 'Asia' },
        { id_zona: 3, nombre_zona: 'América', continente: 'América' }
    ],
    categorias: [
        { id_categoria: 1, nombre_categoria: 'Guerra' },
        { id_categoria: 2, nombre_categoria: 'Política' },
        { id_categoria: 3, nombre_categoria: 'Social' }
    ],
    siguienteId: 1
};

function reiniciar() {
    estado.usuarios = Object.values(USUARIOS).map(u => ({
        rut_usuario: u.rut,
        id_perfil: 1,
        nombre_completo: `Usuario ${u.email}`,
        email: u.email,
        password_hash: bcrypt.hashSync(u.clave, 4)
    }));
    estado.escenas = [];
    estado.lineas = [];
    estado.eventos = [];
    estado.configIA = [];
    estado.siguienteId = 1;
}
reiniciar();

const filas = (registros) => ({ recordset: registros });
const siguiente = () => estado.siguienteId++;

function ejecutar(texto, p) {
    const t = texto.replace(/\s+/g, ' ');
    const rut = p.rut ?? p.rut_usuario;

    if (t.includes('FROM Usuarios WHERE email')) {
        return filas(estado.usuarios.filter(u => u.email === p.email));
    }

    if (t.includes('SELECT 1 AS ok FROM Escenas_Crono')) {
        return filas(estado.escenas.filter(e => String(e.id_escena) === String(p.id_escena) && e.rut_usuario === rut).map(() => ({ ok: 1 })));
    }

    if (t.includes('SELECT id_escena, nombre_escena FROM Escenas_Crono')) {
        return filas(estado.escenas.filter(e => String(e.id_escena) === String(p.id_escena) && e.rut_usuario === rut)
            .map(e => ({ id_escena: e.id_escena, nombre_escena: e.nombre_escena })));
    }

    if (t.includes('SELECT 1 AS ok FROM Lineas_Tiempo L')) {
        return filas(estado.lineas.filter(l => String(l.id_linea) === String(p.id_linea)
            && estado.escenas.some(e => e.id_escena === l.id_escena && e.rut_usuario === rut)).map(() => ({ ok: 1 })));
    }

    if (t.includes('SELECT 1 AS ok FROM Eventos_Historicos V')) {
        return filas(estado.eventos.filter(v => String(v.id_evento) === String(p.id_evento)).filter(v => {
            const linea = estado.lineas.find(l => l.id_linea === v.id_linea);
            return linea && estado.escenas.some(e => e.id_escena === linea.id_escena && e.rut_usuario === rut);
        }).map(() => ({ ok: 1 })));
    }

    if (t.includes('SELECT * FROM Escenas_Crono WHERE rut_usuario')) {
        return filas(estado.escenas.filter(e => e.rut_usuario === p.rut));
    }

    if (t.includes('FROM Zonas_Geograficas')) return filas(estado.zonas);
    if (t.includes('FROM Categorias')) return filas(estado.categorias);

    if (t.includes('INSERT INTO Escenas_Crono')) {
        const id_escena = siguiente();
        estado.escenas.push({ id_escena, nombre_escena: p.nombre_escena, rut_usuario: p.rut_usuario });
        return filas([{ id_escena }]);
    }

    if (t.includes('SELECT id_linea, nombre_linea FROM Lineas_Tiempo WHERE id_escena')) {
        return filas(estado.lineas.filter(l => l.id_escena === p.id_escena).map(l => ({ id_linea: l.id_linea, nombre_linea: l.nombre_linea })));
    }

    if (t.includes('INSERT INTO Lineas_Tiempo')) {
        const id_linea = siguiente();
        estado.lineas.push({ id_linea, id_escena: p.id_escena, id_zona: p.id_zona, nombre_linea: p.nombre_linea, color_personalizado: p.color_personalizado });
        return filas([{ id_linea }]);
    }

    if (t.includes('INSERT INTO Eventos_Historicos')) {
        const id_evento = siguiente();
        estado.eventos.push({ id_evento, id_linea: p.id_linea, titulo_evento: p.titulo_evento, fuente_url: p.fuente_url });
        return filas([]);
    }

    if (t.includes('MERGE Configuracion_IA')) {
        const existente = estado.configIA.find(c => c.rut_usuario === p.rut);
        const registro = { rut_usuario: p.rut, proveedor: p.proveedor, modelo: p.modelo, clave_cifrada: p.clave_cifrada, clave_final: p.clave_final };
        if (existente) Object.assign(existente, registro);
        else estado.configIA.push(registro);
        return filas([]);
    }

    if (t.startsWith('SELECT') && t.includes('FROM Configuracion_IA WHERE rut_usuario')) {
        return filas(estado.configIA.filter(c => c.rut_usuario === p.rut));
    }

    if (t.includes('DELETE FROM Configuracion_IA')) {
        estado.configIA = estado.configIA.filter(c => c.rut_usuario !== p.rut);
        return filas([]);
    }

    if (t.includes('SELECT * FROM Escenas_Crono WHERE id_escena')) {
        return filas(estado.escenas.filter(e => String(e.id_escena) === String(p.id_escena)));
    }

    return filas([]);
}

class FakeRequest {
    constructor() {
        this.p = {};
    }
    input(nombre, _tipo, valor) {
        this.p[nombre] = valor;
        return this;
    }
    query(texto) {
        try {
            return Promise.resolve(ejecutar(texto, this.p));
        } catch (error) {
            return Promise.reject(error);
        }
    }
}

class FakeTransaction {
    constructor() {}
    begin() { return Promise.resolve(); }
    commit() { return Promise.resolve(); }
    rollback() { return Promise.resolve(); }
}

const sql = {
    Int: 'Int',
    VarChar: 'VarChar',
    Text: 'Text',
    Request: FakeRequest,
    Transaction: FakeTransaction
};

const pool = { request: () => new FakeRequest() };

module.exports = { sql, pool, estado, reiniciar, USUARIOS };
