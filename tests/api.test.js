const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const PUERTO = 3999;
const BASE = `http://localhost:${PUERTO}`;
const USUARIO_A = { rut: '11111111-1', email: 'a@test.cl', clave: 'clave-segura-123' };
const USUARIO_B = { rut: '22222222-2', email: 'b@test.cl', clave: 'clave-segura-456' };

let servidor;
let tokenA;
let tokenB;

async function pedir(metodo, ruta, { token, cuerpo } = {}) {
    const cabeceras = {};
    if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
    if (token) cabeceras.Authorization = `Bearer ${token}`;
    const respuesta = await fetch(`${BASE}${ruta}`, {
        method: metodo,
        headers: cabeceras,
        body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined
    });
    const datos = await respuesta.json().catch(() => ({}));
    return { status: respuesta.status, datos };
}

async function login(usuario) {
    const { status, datos } = await pedir('POST', '/api/login', { cuerpo: { email: usuario.email, password: usuario.clave } });
    assert.equal(status, 200, 'el login de prueba debe funcionar');
    return datos.token;
}

function arrancarServidor() {
    return new Promise((resolve, reject) => {
        const env = {
            ...process.env,
            PORT: String(PUERTO),
            SECRETO_SESION: 'secreto-de-prueba-de-32-caracteres-o-mas',
            CLAVE_CIFRADO_IA: 'ab'.repeat(32)
        };
        servidor = spawn(process.execPath, ['--require', path.join(__dirname, 'preload.js'), path.join(RAIZ, 'server.js')], { env, cwd: RAIZ });

        let salida = '';
        const timeout = setTimeout(() => reject(new Error(`El servidor no arrancó. Salida:\n${salida}`)), 15000);
        servidor.stdout.on('data', (dato) => {
            salida += dato;
            if (salida.includes('Servidor corriendo')) {
                clearTimeout(timeout);
                resolve();
            }
        });
        servidor.stderr.on('data', (dato) => { salida += dato; });
        servidor.on('exit', (codigo) => {
            clearTimeout(timeout);
            reject(new Error(`El servidor se cerró con código ${codigo}. Salida:\n${salida}`));
        });
    });
}

before(async () => {
    await arrancarServidor();
    tokenA = await login(USUARIO_A);
    tokenB = await login(USUARIO_B);
});

after(() => {
    if (servidor) servidor.kill();
});

describe('autenticacion', () => {
    test('rechaza peticiones protegidas sin token', async () => {
        const { status } = await pedir('GET', `/api/escenas/usuario/${USUARIO_A.rut}`);
        assert.equal(status, 401);
    });

    test('rechaza un token falso', async () => {
        const { status } = await pedir('GET', `/api/escenas/usuario/${USUARIO_A.rut}`, { token: 'abc.def' });
        assert.equal(status, 401);
    });

    test('rechaza login con clave incorrecta', async () => {
        const { status, datos } = await pedir('POST', '/api/login', { cuerpo: { email: USUARIO_A.email, password: 'mala-clave' } });
        assert.equal(status, 400);
        assert.equal(datos.token, undefined);
    });

    test('devuelve token con login correcto', async () => {
        const { status, datos } = await pedir('POST', '/api/login', { cuerpo: { email: USUARIO_A.email, password: USUARIO_A.clave } });
        assert.equal(status, 200);
        assert.equal(typeof datos.token, 'string');
        assert.equal(datos.usuario.rut, USUARIO_A.rut);
    });

    test('deja públicas las rutas de consulta y el lienzo', async () => {
        assert.equal((await pedir('GET', '/api/zonas')).status, 200);
        assert.equal((await pedir('GET', '/api/escenas')).status, 200);
        assert.equal((await pedir('GET', '/api/escenas/999999/detalle')).status, 404);
    });
});

describe('propiedad de los datos', () => {
    let idEscenaA;

    test('crea escenas con el RUT del token, ignorando el del cuerpo', async () => {
        const { status, datos } = await pedir('POST', '/api/escenas', {
            token: tokenA,
            cuerpo: { nombre_escena: 'Escena de A', rut_usuario: USUARIO_B.rut }
        });
        assert.equal(status, 201);
        idEscenaA = datos.id_escena;

        const lista = await pedir('GET', `/api/escenas/usuario/${USUARIO_A.rut}`, { token: tokenA });
        assert.ok(lista.datos.resultados.some(e => e.id_escena === idEscenaA));
    });

    test('no permite listar las escenas de otro usuario', async () => {
        const { status } = await pedir('GET', `/api/escenas/usuario/${USUARIO_A.rut}`, { token: tokenB });
        assert.equal(status, 403);
    });

    test('no permite crear líneas en la escena de otro usuario', async () => {
        const { status } = await pedir('POST', '/api/lineas', {
            token: tokenB,
            cuerpo: { id_escena: idEscenaA, id_zona: 1, nombre_linea: 'Intrusa', color_personalizado: '#ff0000' }
        });
        assert.equal(status, 403);
    });

    test('no permite borrar la escena de otro usuario', async () => {
        const { status } = await pedir('DELETE', `/api/escenas/${idEscenaA}`, { token: tokenB });
        assert.equal(status, 403);
    });

    test('permite crear líneas en la escena propia', async () => {
        const { status } = await pedir('POST', '/api/lineas', {
            token: tokenA,
            cuerpo: { id_escena: idEscenaA, id_zona: 1, nombre_linea: 'Europa', color_personalizado: '#4a90e2' }
        });
        assert.equal(status, 201);
    });
});

describe('importacion de escenas', () => {
    const escenaValida = (zona = 'Europa', extra = {}) => ({
        nombre_escena: 'Importada',
        lineas: [{
            nombre_linea: 'Línea importada',
            nombre_zona: zona,
            color_personalizado: '#123456',
            eventos: [{ titulo_evento: 'Hito', anio_inicio: 1914, anio_fin: 1918, nombre_categoria: 'guerra', descripcion: 'Texto', ...extra }]
        }]
    });

    test('importa una escena válida y acepta categorías sin distinguir mayúsculas', async () => {
        const { status, datos } = await pedir('POST', '/api/escenas/importar', { token: tokenA, cuerpo: escenaValida() });
        assert.equal(status, 201);
        assert.ok(datos.id_escena);
    });

    test('rechaza una zona inexistente con mensaje claro', async () => {
        const { status, datos } = await pedir('POST', '/api/escenas/importar', { token: tokenA, cuerpo: escenaValida('Narnia') });
        assert.equal(status, 400);
        assert.match(datos.error, /zona "Narnia" no existe/);
    });

    test('rechaza un año de fin anterior al de inicio', async () => {
        const { status, datos } = await pedir('POST', '/api/escenas/importar', { token: tokenA, cuerpo: escenaValida('Europa', { anio_fin: 1900 }) });
        assert.equal(status, 400);
        assert.match(datos.error, /año de fin/);
    });

    test('rechaza fuentes que no son http(s)', async () => {
        const { status, datos } = await pedir('POST', '/api/escenas/importar', { token: tokenA, cuerpo: escenaValida('Europa', { fuente_url: 'javascript:alert(1)' }) });
        assert.equal(status, 400);
        assert.match(datos.error, /http\(s\)/);
    });
});

describe('clave de IA', () => {
    const clave = 'sk-prueba-1234567890abcdef';

    test('guarda la clave cifrada y solo muestra los últimos 4 caracteres', async () => {
        const guardar = await pedir('PUT', '/api/ia/configuracion', {
            token: tokenA,
            cuerpo: { proveedor: 'openai', modelo: 'modelo-prueba', api_key: clave }
        });
        assert.equal(guardar.status, 200);

        const leer = await pedir('GET', `/api/ia/configuracion/${USUARIO_A.rut}`, { token: tokenA });
        assert.equal(leer.datos.configurado, true);
        assert.equal(leer.datos.clave_mascarada, '•••• cdef');
        assert.ok(!JSON.stringify(leer.datos).includes(clave), 'la respuesta no debe incluir la clave completa');
    });

    test('no permite leer la configuración de otro usuario', async () => {
        const { status } = await pedir('GET', `/api/ia/configuracion/${USUARIO_A.rut}`, { token: tokenB });
        assert.equal(status, 403);
    });

    test('rechaza claves con formato inválido', async () => {
        const { status } = await pedir('PUT', '/api/ia/configuracion', {
            token: tokenA,
            cuerpo: { proveedor: 'openai', modelo: 'x', api_key: 'corta' }
        });
        assert.equal(status, 400);
    });

    test('rechaza proveedores fuera de la lista permitida', async () => {
        const { status } = await pedir('PUT', '/api/ia/configuracion', {
            token: tokenA,
            cuerpo: { proveedor: 'https://evil.example', modelo: 'x', api_key: clave }
        });
        assert.equal(status, 400);
    });

    test('elimina la clave guardada', async () => {
        const borrar = await pedir('DELETE', `/api/ia/configuracion/${USUARIO_A.rut}`, { token: tokenA });
        assert.equal(borrar.status, 200);
        const leer = await pedir('GET', `/api/ia/configuracion/${USUARIO_A.rut}`, { token: tokenA });
        assert.equal(leer.datos.configurado, false);
    });
});

// Va al final: el límite de intentos bloquea la IP para el resto de las pruebas.
describe('limite de intentos de login', () => {
    test('bloquea con 429 tras 5 intentos fallidos', async () => {
        const estados = [];
        for (let i = 0; i < 6; i++) {
            const { status } = await pedir('POST', '/api/login', { cuerpo: { email: 'nadie@test.cl', password: 'x' } });
            estados.push(status);
        }
        assert.ok(estados.includes(429), `estados recibidos: ${estados.join(', ')}`);
        assert.equal(estados[estados.length - 1], 429);
    });
});
