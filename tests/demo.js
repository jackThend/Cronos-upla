// Levanta la app con la base simulada y una escena de ejemplo, para revisar la interfaz en el navegador.
// Uso: node tests/demo.js   (deja el servidor corriendo; Ctrl+C para cerrar)
const path = require('path');

process.env.PORT = process.env.PORT || '3999';
process.env.SECRETO_SESION = process.env.SECRETO_SESION || 'secreto-de-demostracion-de-32-caracteres-o-mas';
process.env.CLAVE_CIFRADO_IA = process.env.CLAVE_CIFRADO_IA || 'ab'.repeat(32);

require('./preload');
require(path.join(__dirname, '..', 'server.js'));

const BASE = `http://localhost:${process.env.PORT}`;
const USUARIO = { rut: '11111111-1', email: 'a@test.cl', clave: 'clave-segura-123' };

async function pedir(metodo, ruta, token, cuerpo) {
    const cabeceras = { 'Content-Type': 'application/json' };
    if (token) cabeceras.Authorization = `Bearer ${token}`;
    const respuesta = await fetch(`${BASE}${ruta}`, { method: metodo, headers: cabeceras, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    return respuesta.json();
}

async function sembrar() {
    const login = await pedir('POST', '/api/login', null, { email: USUARIO.email, password: USUARIO.clave });
    const token = login.token;

    const escena = await pedir('POST', '/api/escenas/importar', token, {
        nombre_escena: 'Siglo XX: guerras y política',
        lineas: [
            { nombre_linea: 'Europa', nombre_zona: 'Europa', color_personalizado: '#4a90e2', eventos: [
                { titulo_evento: 'Primera Guerra Mundial', anio_inicio: 1914, anio_fin: 1918, nombre_categoria: 'Guerra', descripcion: 'Conflicto entre las grandes potencias europeas.', interpretacion: 'Reordena el mapa político europeo.', fuente_url: 'https://es.wikipedia.org/wiki/Primera_Guerra_Mundial' },
                { titulo_evento: 'Tratado de Versalles', anio_inicio: 1919, nombre_categoria: 'Política', descripcion: 'Tratado de paz que cierra la guerra.' },
                { titulo_evento: 'Crisis económica de 1929', anio_inicio: 1929, nombre_categoria: 'Social', descripcion: 'Colapso bursátil que se extiende globalmente.' },
                { titulo_evento: 'Invasión de Polonia', anio_inicio: 1939, nombre_categoria: 'Guerra', precision_fecha: 'aproximada', descripcion: 'Inicio de la Segunda Guerra Mundial en Europa.' }
            ] },
            { nombre_linea: 'Asia', nombre_zona: 'Asia', color_personalizado: '#e74c3c', eventos: [
                { titulo_evento: 'Restauración Meiji', anio_inicio: 1868, nombre_categoria: 'Política', descripcion: 'Modernización política de Japón.' },
                { titulo_evento: 'Guerra sino-japonesa', anio_inicio: 1937, anio_fin: 1945, nombre_categoria: 'Guerra', descripcion: 'Conflicto entre China y Japón.' },
                { titulo_evento: 'Hiroshima', anio_inicio: 1945, nombre_categoria: 'Guerra', precision_fecha: 'exacta', descripcion: 'Primer uso bélico de una bomba atómica.' }
            ] },
            { nombre_linea: 'América', nombre_zona: 'América', color_personalizado: '#2ecc71', eventos: [
                { titulo_evento: 'Golpe de Estado en Chile', anio_inicio: 1973, nombre_categoria: 'Política', descripcion: 'Derrocamiento del gobierno de Allende.' }
            ] }
        ]
    });

    const detalle = await fetch(`${BASE}/api/escenas/${escena.id_escena}/detalle`).then(r => r.json());
    const eventos = detalle.lineas.flatMap(l => l.eventos);
    const id = titulo => eventos.find(e => e.titulo_evento === titulo).id_evento;

    await pedir('POST', '/api/relaciones', token, { id_evento_origen: id('Primera Guerra Mundial'), id_evento_destino: id('Tratado de Versalles'), tipo: 'consecuencia', nota: 'El tratado cierra la guerra' });
    await pedir('POST', '/api/relaciones', token, { id_evento_origen: id('Tratado de Versalles'), id_evento_destino: id('Invasión de Polonia'), tipo: 'influencia', nota: 'Las condiciones del tratado alimentan el conflicto' });
    await pedir('POST', '/api/relaciones', token, { id_evento_origen: id('Crisis económica de 1929'), id_evento_destino: id('Golpe de Estado en Chile'), tipo: 'contemporaneo', nota: 'Dos décadas separan ambos hechos' });
    await pedir('POST', '/api/relaciones', token, { id_evento_origen: id('Guerra sino-japonesa'), id_evento_destino: id('Hiroshima'), tipo: 'respuesta' });

    await pedir('POST', `/api/eventos/${id('Primera Guerra Mundial')}/fuentes`, token, { titulo: 'Historia de la Gran Guerra', autor: 'Keegan, J.', anio: 1998, url: 'https://example.org/gran-guerra', tipo: 'secundaria' });
    await pedir('POST', `/api/escenas/${escena.id_escena}/preguntas`, token, { texto: '¿Qué tienen en común la crisis de 1929 y el golpe de Chile?' });
    await pedir('POST', `/api/escenas/${escena.id_escena}/preguntas`, token, { texto: '¿Cómo se compara la guerra en Europa con la guerra sino-japonesa?' });

    return { id_escena: escena.id_escena, token };
}

setTimeout(() => {
    sembrar().then(({ id_escena }) => {
        console.log('\n=== Demo lista ===');
        console.log(`Lienzo:  ${BASE}/lienzo.html?id=${id_escena}`);
        console.log(`Login:   ${BASE}/index.html  (email ${USUARIO.email}, clave ${USUARIO.clave})`);
    });
}, 500);
