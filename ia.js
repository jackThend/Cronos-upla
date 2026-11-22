const crypto = require('crypto');
const net = require('net');

const PROVEEDORES = {
    openai: { nombre: 'OpenAI', tipo: 'openai', url: 'https://api.openai.com/v1/chat/completions' },
    groq: { nombre: 'Groq', tipo: 'openai', url: 'https://api.groq.com/openai/v1/chat/completions' },
    openrouter: { nombre: 'OpenRouter', tipo: 'openai', url: 'https://openrouter.ai/api/v1/chat/completions' },
    anthropic: { nombre: 'Anthropic', tipo: 'anthropic', url: 'https://api.anthropic.com/v1/messages' }
};

const TIMEOUT_MODELO_MS = 90000;
const TIMEOUT_FUENTE_MS = 5000;

function errorIA(mensaje, status) {
    const error = new Error(mensaje);
    error.status = status;
    return error;
}

function listarProveedores() {
    return Object.entries(PROVEEDORES).map(([id, p]) => ({ id, nombre: p.nombre }));
}

function obtenerClaveCifrado() {
    const clave = process.env.CLAVE_CIFRADO_IA;
    if (!clave || !/^[0-9a-fA-F]{64}$/.test(clave)) {
        throw new Error('CLAVE_CIFRADO_IA no está configurada (64 caracteres hexadecimales)');
    }
    return Buffer.from(clave, 'hex');
}

function cifrar(texto) {
    const iv = crypto.randomBytes(12);
    const cifrador = crypto.createCipheriv('aes-256-gcm', obtenerClaveCifrado(), iv);
    const contenido = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
    const tag = cifrador.getAuthTag();
    return [iv, tag, contenido].map(parte => parte.toString('base64')).join(':');
}

function descifrar(valor) {
    const [iv, tag, contenido] = valor.split(':').map(parte => Buffer.from(parte, 'base64'));
    const descifrador = crypto.createDecipheriv('aes-256-gcm', obtenerClaveCifrado(), iv);
    descifrador.setAuthTag(tag);
    return Buffer.concat([descifrador.update(contenido), descifrador.final()]).toString('utf8');
}

async function llamarModelo({ proveedor, modelo, apiKey, sistema, usuario }) {
    const config = PROVEEDORES[proveedor];
    if (!config) throw errorIA('Proveedor de IA no soportado', 400);

    const esAnthropic = config.tipo === 'anthropic';
    const respuesta = await fetch(config.url, {
        method: 'POST',
        headers: esAnthropic
            ? { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
            : { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(esAnthropic
            ? { model: modelo, max_tokens: 4096, system: sistema, messages: [{ role: 'user', content: usuario }] }
            : { model: modelo, temperature: 0.2, messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }] }),
        signal: AbortSignal.timeout(TIMEOUT_MODELO_MS)
    });

    if (!respuesta.ok) {
        if (respuesta.status === 401 || respuesta.status === 403) {
            throw errorIA('La API key no es válida o no tiene permisos para este modelo', 400);
        }
        throw errorIA(`El proveedor de IA respondió con error ${respuesta.status}`, 502);
    }

    const datos = await respuesta.json();
    const texto = esAnthropic
        ? (datos.content || []).map(bloque => bloque.text || '').join('')
        : datos.choices?.[0]?.message?.content;
    if (!texto) throw errorIA('El modelo no devolvió contenido', 502);
    return texto;
}

function extraerJSON(texto) {
    const inicio = texto.indexOf('{');
    const fin = texto.lastIndexOf('}');
    if (inicio === -1 || fin <= inicio) throw errorIA('La IA no devolvió un JSON válido', 502);
    try {
        return JSON.parse(texto.slice(inicio, fin + 1));
    } catch {
        throw errorIA('La IA no devolvió un JSON válido', 502);
    }
}

function construirPrompt({ nombreEscena, lineasExistentes, titulosExistentes, zonas, categorias, instruccion }) {
    const lineas = lineasExistentes.length
        ? lineasExistentes.map(l => `${l.nombre_linea} (zona: ${l.nombre_zona})`).join('; ')
        : 'ninguna';
    const titulos = titulosExistentes.length ? titulosExistentes.join('; ') : 'ninguno';

    const sistema = [
        'Eres un asistente de historia para una aplicación de líneas de tiempo comparadas.',
        'Respondes únicamente con un objeto JSON válido, sin texto adicional, con este formato:',
        '{"lineas":[{"nombre_linea":"...","nombre_zona":"...","color_personalizado":"#RRGGBB","eventos":[{"titulo_evento":"...","anio_inicio":1914,"anio_fin":1918,"precision_fecha":"exacta|aproximada|siglo|decada","nombre_categoria":"...","descripcion":"...","interpretacion":"...","fuente_url":"https://..."}]}],',
        '"relaciones":[{"titulo_origen":"...","titulo_destino":"...","tipo":"causa|consecuencia|contemporaneo|influencia|respuesta","nota":"por qué se relacionan"}],',
        '"preguntas":["pregunta de comparación para discutir en clase"],"advertencias":["posible inconsistencia o dato a verificar"]}',
        `Reglas:`,
        `- nombre_zona debe ser exactamente uno de: ${zonas.join(', ')}.`,
        `- nombre_categoria debe ser exactamente una de: ${categorias.join(', ')}.`,
        '- Años enteros; los años a.C. son negativos; no existe el año 0. anio_fin es null si el evento es puntual.',
        '- precision_fecha: usa "aproximada" si el año es estimado, "siglo" o "decada" si solo conoces el periodo; "exacta" en otros casos.',
        '- interpretacion: una frase que explique la importancia del hecho para comparar las líneas. Separa esto de la descripción, que debe ser solo hechos.',
        '- relaciones: solo entre eventos de esta propuesta o ya existentes en la escena, con una nota que justifique la relación. Si no tienes una justificación clara, omítela.',
        '- preguntas: entre 2 y 5 preguntas que inviten a comparar las líneas de la escena.',
        '- advertencias: señala fechas que parezcan dudosas, eventos que puedan estar duplicados o datos que convenga verificar.',
        '- fuente_url: incluye la URL completa de una fuente confiable (sitio oficial, enciclopedia o archivo) solo si la conoces con certeza; si no, usa null.',
        '- No inventes fechas ni eventos. Si no estás seguro de un dato, omite el evento.',
        `- No repitas eventos que ya existen: ${titulos}.`,
        '- Máximo 30 eventos en total. Puedes reutilizar líneas existentes por nombre o crear líneas nuevas.',
        `- Líneas existentes en la escena: ${lineas}.`
    ].join('\n');

    const usuario = `Escena: ${nombreEscena}\nInstrucción: ${instruccion}`;
    return { sistema, usuario };
}

async function fuenteAccesible(url) {
    if (!url) return false;

    let destino;
    try {
        destino = new URL(url);
    } catch {
        return false;
    }
    if (destino.protocol !== 'https:' || destino.hostname === 'localhost' || net.isIP(destino.hostname)) return false;

    try {
        const cabecera = await fetch(destino, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_FUENTE_MS) });
        if (cabecera.ok) return true;
        const contenido = await fetch(destino, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_FUENTE_MS) });
        return contenido.ok;
    } catch {
        return false;
    }
}

module.exports = {
    PROVEEDORES,
    listarProveedores,
    cifrar,
    descifrar,
    llamarModelo,
    extraerJSON,
    construirPrompt,
    fuenteAccesible
};
