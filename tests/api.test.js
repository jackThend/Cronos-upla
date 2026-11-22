const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const PUERTO = 3997;
const BASE = `http://localhost:${PUERTO}`;
const USUARIO_A = { rut: '11111111-1', email: 'a@test.cl', clave: 'clave-segura-123' };
const USUARIO_B = { rut: '22222222-2', email: 'b@test.cl', clave: 'clave-segura-456' };
const USUARIO_C = { rut: '33333333-3', email: 'c@test.cl', clave: 'clave-segura-789' };

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

async function crearEscenaConEventos(token, nombre, lineas) {
    const { status, datos } = await pedir('POST', '/api/escenas/importar', {
        token,
        cuerpo: { nombre_escena: nombre, lineas }
    });
    assert.equal(status, 201, 'la escena de prueba debe crearse');
    const detalle = await pedir('GET', `/api/escenas/${datos.id_escena}/detalle`);
    const eventos = detalle.datos.lineas.flatMap(l => l.eventos);
    return { id_escena: datos.id_escena, eventos };
}

const LINEAS_PRUEBA = [
    { nombre_linea: 'Europa', nombre_zona: 'Europa', eventos: [{ titulo_evento: 'Gran Guerra', anio_inicio: 1914, anio_fin: 1918, nombre_categoria: 'Guerra', descripcion: 'x' }] },
    { nombre_linea: 'Asia', nombre_zona: 'Asia', eventos: [{ titulo_evento: 'Guerra sino-japonesa', anio_inicio: 1937, anio_fin: 1945, nombre_categoria: 'Guerra', descripcion: 'x' }] }
];

describe('relaciones causales', () => {
    let escena;

    before(async () => {
        escena = await crearEscenaConEventos(tokenA, 'Relaciones', LINEAS_PRUEBA);
    });

    test('crea una relación entre dos eventos de la misma escena', async () => {
        const [origen, destino] = escena.eventos;
        const { status } = await pedir('POST', '/api/relaciones', {
            token: tokenA,
            cuerpo: { id_evento_origen: origen.id_evento, id_evento_destino: destino.id_evento, tipo: 'influencia', nota: 'Ejemplo' }
        });
        assert.equal(status, 201);
    });

    test('la relación aparece en el detalle público de la escena', async () => {
        const detalle = await pedir('GET', `/api/escenas/${escena.id_escena}/detalle`);
        assert.ok(detalle.datos.relaciones.length >= 1);
    });

    test('rechaza tipos de relación no válidos', async () => {
        const [origen, destino] = escena.eventos;
        const { status } = await pedir('POST', '/api/relaciones', {
            token: tokenA,
            cuerpo: { id_evento_origen: origen.id_evento, id_evento_destino: destino.id_evento, tipo: 'magia' }
        });
        assert.equal(status, 400);
    });

    test('no permite relacionar eventos de otro usuario', async () => {
        const [origen, destino] = escena.eventos;
        const { status } = await pedir('POST', '/api/relaciones', {
            token: tokenB,
            cuerpo: { id_evento_origen: origen.id_evento, id_evento_destino: destino.id_evento, tipo: 'causa' }
        });
        assert.equal(status, 403);
    });

    test('no permite relacionar eventos de escenas distintas', async () => {
        const otra = await crearEscenaConEventos(tokenA, 'Otra', [LINEAS_PRUEBA[0]]);
        const { status, datos } = await pedir('POST', '/api/relaciones', {
            token: tokenA,
            cuerpo: { id_evento_origen: escena.eventos[0].id_evento, id_evento_destino: otra.eventos[0].id_evento, tipo: 'causa' }
        });
        assert.equal(status, 400);
        assert.match(datos.error, /misma escena/);
    });

    test('solo el dueño puede borrar una relación', async () => {
        const [origen, destino] = escena.eventos;
        const creada = await pedir('POST', '/api/relaciones', {
            token: tokenA,
            cuerpo: { id_evento_origen: origen.id_evento, id_evento_destino: destino.id_evento, tipo: 'causa' }
        });
        const id = creada.datos.id_relacion;
        assert.equal((await pedir('DELETE', `/api/relaciones/${id}`, { token: tokenB })).status, 403);
        assert.equal((await pedir('DELETE', `/api/relaciones/${id}`, { token: tokenA })).status, 200);
    });
});

describe('fuentes, precisión e interpretación', () => {
    let escena;

    before(async () => {
        escena = await crearEscenaConEventos(tokenA, 'Fuentes', LINEAS_PRUEBA);
    });

    test('añade una fuente a un evento y la devuelve en el detalle', async () => {
        const idEvento = escena.eventos[0].id_evento;
        const { status } = await pedir('POST', `/api/eventos/${idEvento}/fuentes`, {
            token: tokenA,
            cuerpo: { titulo: 'Tratado de Versalles', autor: 'Keynes', anio: 1919, url: 'https://example.org/versalles', tipo: 'primaria' }
        });
        assert.equal(status, 201);
        const detalle = await pedir('GET', `/api/escenas/${escena.id_escena}/detalle`);
        const evento = detalle.datos.lineas.flatMap(l => l.eventos).find(e => e.id_evento === idEvento);
        assert.ok(evento.fuentes.length >= 1);
    });

    test('rechaza fuentes con tipo inválido o URL no http(s)', async () => {
        const idEvento = escena.eventos[0].id_evento;
        const tipo = await pedir('POST', `/api/eventos/${idEvento}/fuentes`, { token: tokenA, cuerpo: { titulo: 'X', tipo: 'rumor' } });
        const url = await pedir('POST', `/api/eventos/${idEvento}/fuentes`, { token: tokenA, cuerpo: { titulo: 'X', tipo: 'otra', url: 'javascript:1' } });
        assert.equal(tipo.status, 400);
        assert.equal(url.status, 400);
    });

    test('no permite añadir fuentes a eventos de otro usuario', async () => {
        const { status } = await pedir('POST', `/api/eventos/${escena.eventos[0].id_evento}/fuentes`, {
            token: tokenB,
            cuerpo: { titulo: 'X', tipo: 'otra' }
        });
        assert.equal(status, 403);
    });

    test('rechaza una precisión de fecha inválida al importar', async () => {
        const { status, datos } = await pedir('POST', '/api/escenas/importar', {
            token: tokenA,
            cuerpo: {
                nombre_escena: 'Precision',
                lineas: [{ nombre_linea: 'L', nombre_zona: 'Europa', eventos: [{ titulo_evento: 'Antiguo', anio_inicio: -3100, nombre_categoria: 'Política', precision_fecha: 'magico' }] }]
            }
        });
        assert.equal(status, 400);
        assert.match(datos.error, /precisión/);
    });

    test('acepta precisión aproximada al importar', async () => {
        const { status } = await pedir('POST', '/api/escenas/importar', {
            token: tokenA,
            cuerpo: {
                nombre_escena: 'Precision ok',
                lineas: [{ nombre_linea: 'L', nombre_zona: 'Europa', eventos: [{ titulo_evento: 'Antiguo', anio_inicio: -3100, nombre_categoria: 'Política', precision_fecha: 'aproximada' }] }]
            }
        });
        assert.equal(status, 201);
    });
});

describe('preguntas y asignaciones', () => {
    const CORREO_ESTUDIANTE = '33333333-3';
    let escena;

    before(async () => {
        escena = await crearEscenaConEventos(tokenA, 'Clase', LINEAS_PRUEBA);
    });

    test('el dueño añade preguntas guiadas y aparecen en el detalle', async () => {
        const { status } = await pedir('POST', `/api/escenas/${escena.id_escena}/preguntas`, {
            token: tokenA,
            cuerpo: { texto: '¿Qué conecta la guerra de Europa con la de Asia?' }
        });
        assert.equal(status, 201);
        const detalle = await pedir('GET', `/api/escenas/${escena.id_escena}/detalle`);
        assert.equal(detalle.datos.preguntas.length, 1);
    });

    test('otro usuario no puede añadir preguntas', async () => {
        const { status } = await pedir('POST', `/api/escenas/${escena.id_escena}/preguntas`, { token: tokenB, cuerpo: { texto: 'x' } });
        assert.equal(status, 403);
    });

    test('solo se asigna a estudiantes (perfil 2)', async () => {
        const { status, datos } = await pedir('POST', `/api/escenas/${escena.id_escena}/asignaciones`, {
            token: tokenA,
            cuerpo: { rut_estudiante: USUARIO_B.rut }
        });
        assert.equal(status, 400);
        assert.match(datos.error, /estudiantes/);
    });

    test('asigna la escena a un estudiante, lo lista y evita duplicados', async () => {
        const asignar = await pedir('POST', `/api/escenas/${escena.id_escena}/asignaciones`, {
            token: tokenA,
            cuerpo: { rut_estudiante: CORREO_ESTUDIANTE }
        });
        assert.equal(asignar.status, 201);

        const lista = await pedir('GET', `/api/escenas/${escena.id_escena}/asignaciones`, { token: tokenA });
        assert.ok(lista.datos.resultados.some(a => a.rut_estudiante === CORREO_ESTUDIANTE));

        const repetida = await pedir('POST', `/api/escenas/${escena.id_escena}/asignaciones`, {
            token: tokenA,
            cuerpo: { rut_estudiante: CORREO_ESTUDIANTE }
        });
        assert.equal(repetida.status, 400);
    });

    test('el estudiante ve sus escenas asignadas y pueden quitarse', async () => {
        const tokenC = await login(USUARIO_C);
        const mias = await pedir('GET', '/api/asignaciones/mias', { token: tokenC });
        assert.ok(mias.datos.resultados.some(e => e.id_escena === escena.id_escena));

        await pedir('DELETE', `/api/escenas/${escena.id_escena}/asignaciones/${CORREO_ESTUDIANTE}`, { token: tokenA });
        const despues = await pedir('GET', '/api/asignaciones/mias', { token: tokenC });
        assert.ok(!despues.datos.resultados.some(e => e.id_escena === escena.id_escena));
    });
});

describe('propuesta de IA aceptada', () => {
    test('guarda eventos nuevos, relaciones válidas y preguntas, y descarta relaciones con títulos inexistentes', async () => {
        const escena = await crearEscenaConEventos(tokenA, 'IA aceptada', LINEAS_PRUEBA);
        const antes = await pedir('GET', `/api/escenas/${escena.id_escena}/detalle`);
        const relacionesAntes = antes.datos.relaciones.length;

        const { status } = await pedir('POST', `/api/escenas/${escena.id_escena}/lineas-importar`, {
            token: tokenA,
            cuerpo: {
                lineas: [{ nombre_linea: 'Europa', nombre_zona: 'Europa', eventos: [
                    { titulo_evento: 'Tratado de Versalles', anio_inicio: 1919, nombre_categoria: 'Política', descripcion: 'x' }
                ] }],
                relaciones: [
                    { titulo_origen: 'Gran Guerra', titulo_destino: 'Tratado de Versalles', tipo: 'consecuencia', nota: 'El tratado cierra la guerra' },
                    { titulo_origen: 'Gran Guerra', titulo_destino: 'Evento inventado', tipo: 'causa' }
                ],
                preguntas: ['¿Qué tienen en común el tratado de Versalles y la guerra sino-japonesa?']
            }
        });
        assert.equal(status, 201);

        const despues = await pedir('GET', `/api/escenas/${escena.id_escena}/detalle`);
        assert.equal(despues.datos.relaciones.length, relacionesAntes + 1);
        assert.ok(despues.datos.relaciones.some(r => r.tipo === 'consecuencia'));
        assert.equal(despues.datos.preguntas.length, 1);
        const nombres = despues.datos.lineas.flatMap(l => l.eventos).map(e => e.titulo_evento);
        assert.ok(nombres.includes('Tratado de Versalles'));
    });
});

describe('importacion completa (fuentes, relaciones y preguntas)', () => {
    const lineasConFuentes = (tipoFuente = 'primaria') => [
        { nombre_linea: 'Europa', nombre_zona: 'Europa', eventos: [
            { titulo_evento: 'Hito A', anio_inicio: 1914, nombre_categoria: 'Guerra', descripcion: 'x', fuentes: [{ titulo: 'Fuente A', autor: 'Autor', anio: 1990, url: 'https://example.org/a', tipo: tipoFuente }] },
            { titulo_evento: 'Hito B', anio_inicio: 1919, nombre_categoria: 'Política', descripcion: 'x' }
        ] }
    ];

    test('reimporta fuentes, relaciones y preguntas', async () => {
        const { status, datos } = await pedir('POST', '/api/escenas/importar', {
            token: tokenA,
            cuerpo: {
                nombre_escena: 'Ida y vuelta',
                lineas: lineasConFuentes(),
                relaciones: [{ titulo_origen: 'Hito A', titulo_destino: 'Hito B', tipo: 'causa', nota: 'Primero una cosa y luego otra' }],
                preguntas: ['¿Qué cambió entre ambos hitos?']
            }
        });
        assert.equal(status, 201);

        const detalle = await pedir('GET', `/api/escenas/${datos.id_escena}/detalle`);
        const hitoA = detalle.datos.lineas.flatMap(l => l.eventos).find(e => e.titulo_evento === 'Hito A');
        assert.equal(hitoA.fuentes.length, 1);
        assert.equal(hitoA.fuentes[0].autor, 'Autor');
        assert.equal(detalle.datos.preguntas.length, 1);
        assert.ok(detalle.datos.relaciones.some(r => r.id_evento_origen === hitoA.id_evento && r.tipo === 'causa'));
    });

    test('rechaza fuentes con tipo inválido al importar', async () => {
        const { status, datos } = await pedir('POST', '/api/escenas/importar', {
            token: tokenA,
            cuerpo: { nombre_escena: 'Mala fuente', lineas: lineasConFuentes('rumor') }
        });
        assert.equal(status, 400);
        assert.match(datos.error, /fuente/);
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
