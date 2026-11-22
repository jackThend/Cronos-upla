const crypto = require('crypto');

const DURACION_MS = 8 * 60 * 60 * 1000;

function obtenerSecreto() {
    const secreto = process.env.SECRETO_SESION;
    if (!secreto || secreto.length < 32) {
        throw new Error('SECRETO_SESION debe tener al menos 32 caracteres en .env');
    }
    return secreto;
}

function firmar(texto) {
    return crypto.createHmac('sha256', obtenerSecreto()).update(texto).digest('base64url');
}

function crearToken(rut) {
    const payload = Buffer.from(JSON.stringify({ rut, exp: Date.now() + DURACION_MS })).toString('base64url');
    return `${payload}.${firmar(payload)}`;
}

function verificarToken(token) {
    if (!token || typeof token !== 'string') return null;

    const [payload, firma] = token.split('.');
    if (!payload || !firma) return null;

    const esperada = firmar(payload);
    if (firma.length !== esperada.length || !crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) {
        return null;
    }

    try {
        const datos = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (!datos.rut || !datos.exp || datos.exp < Date.now()) return null;
        return { rut: datos.rut };
    } catch {
        return null;
    }
}

module.exports = { obtenerSecreto, crearToken, verificarToken };
