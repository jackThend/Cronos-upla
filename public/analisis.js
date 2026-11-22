// Analisis puro de una escena: sin DOM, para poder probarlo con Node.
(function (raiz) {
    const decada = (anio) => Math.floor(anio / 10) * 10;
    const categoriaDe = (evento) => evento.nombre_categoria || 'General';
    const finDe = (evento) => (evento.anio_fin ?? evento.anio_inicio);

    function contarPorDecada(lineas) {
        return lineas.map(linea => {
            const decadas = {};
            (linea.eventos || []).forEach(evento => {
                const clave = decada(evento.anio_inicio);
                const categoria = categoriaDe(evento);
                decadas[clave] = decadas[clave] || { total: 0, categorias: {} };
                decadas[clave].total++;
                decadas[clave].categorias[categoria] = (decadas[clave].categorias[categoria] || 0) + 1;
            });
            return { nombre_linea: linea.nombre_linea, decadas };
        });
    }

    function periodosSinEventos(lineas, umbral) {
        const intervalos = lineas
            .flatMap(linea => linea.eventos || [])
            .map(evento => ({ desde: evento.anio_inicio, hasta: finDe(evento) }))
            .sort((a, b) => a.desde - b.desde);

        const vacios = [];
        let cursor = null;
        intervalos.forEach(intervalo => {
            if (cursor !== null && intervalo.desde - cursor >= umbral) {
                vacios.push({ desde: cursor, hasta: intervalo.desde });
            }
            cursor = cursor === null ? intervalo.hasta : Math.max(cursor, intervalo.hasta);
        });
        return vacios;
    }

    function solapamientos(lineas) {
        const eventos = lineas.flatMap(linea => (linea.eventos || []).map(evento => ({ linea: linea.nombre_linea, evento })));
        const pares = [];
        for (let i = 0; i < eventos.length; i++) {
            for (let j = i + 1; j < eventos.length; j++) {
                const a = eventos[i];
                const b = eventos[j];
                if (a.linea === b.linea) continue;
                if (categoriaDe(a.evento) !== categoriaDe(b.evento)) continue;
                const se_solapan = a.evento.anio_inicio <= finDe(b.evento) && b.evento.anio_inicio <= finDe(a.evento);
                if (se_solapan) {
                    pares.push({
                        categoria: categoriaDe(a.evento),
                        a: { linea: a.linea, titulo: a.evento.titulo_evento, anio: a.evento.anio_inicio },
                        b: { linea: b.linea, titulo: b.evento.titulo_evento, anio: b.evento.anio_inicio }
                    });
                }
            }
        }
        return pares;
    }

    const api = { contarPorDecada, periodosSinEventos, solapamientos };
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        raiz.Analisis = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
