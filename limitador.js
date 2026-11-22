const VENTANA_MS = 15 * 60 * 1000;
const MAX_INTENTOS = 5;
const intentos = new Map();

function obtenerRegistro(clave) {
    const registro = intentos.get(clave);
    if (!registro) return null;
    if (Date.now() - registro.inicio > VENTANA_MS) {
        intentos.delete(clave);
        return null;
    }
    return registro;
}

function tiempoBloqueoMs(claves) {
    return claves.reduce((mayor, clave) => {
        const registro = obtenerRegistro(clave);
        if (!registro || registro.cantidad < MAX_INTENTOS) return mayor;
        return Math.max(mayor, VENTANA_MS - (Date.now() - registro.inicio));
    }, 0);
}

function registrarFallo(claves) {
    claves.forEach(clave => {
        const registro = obtenerRegistro(clave);
        if (registro) {
            registro.cantidad++;
        } else {
            intentos.set(clave, { cantidad: 1, inicio: Date.now() });
        }
    });
}

function limpiar(clave) {
    intentos.delete(clave);
}

module.exports = { tiempoBloqueoMs, registrarFallo, limpiar };
