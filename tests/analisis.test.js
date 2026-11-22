const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { contarPorDecada, periodosSinEventos, solapamientos } = require('../public/analisis.js');

const lineas = [
    {
        nombre_linea: 'Europa',
        eventos: [
            { titulo_evento: 'Gran Guerra', anio_inicio: 1914, anio_fin: 1918, nombre_categoria: 'Guerra' },
            { titulo_evento: 'Versalles', anio_inicio: 1919, nombre_categoria: 'Política' }
        ]
    },
    {
        nombre_linea: 'Asia',
        eventos: [
            { titulo_evento: 'Guerra sino-japonesa', anio_inicio: 1937, anio_fin: 1945, nombre_categoria: 'Guerra' },
            { titulo_evento: 'Restauración Meiji', anio_inicio: 1868, nombre_categoria: 'Política' }
        ]
    }
];

describe('densidad por década', () => {
    test('cuenta eventos por década y categoría en cada línea', () => {
        const resultado = contarPorDecada(lineas);
        const europa = resultado.find(l => l.nombre_linea === 'Europa');
        assert.equal(europa.decadas[1910].total, 2);
        assert.deepEqual(europa.decadas[1910].categorias, { Guerra: 1, 'Política': 1 });
    });

    test('usa General cuando el evento no tiene categoría', () => {
        const resultado = contarPorDecada([{ nombre_linea: 'X', eventos: [{ anio_inicio: 1900 }] }]);
        assert.equal(resultado[0].decadas[1900].categorias.General, 1);
    });
});

describe('periodos sin eventos', () => {
    test('detecta el hueco entre el fin de la Gran Guerra y el inicio de la guerra sino-japonesa', () => {
        const vacios = periodosSinEventos(lineas, 10);
        assert.ok(vacios.some(v => v.desde === 1919 && v.hasta === 1937), JSON.stringify(vacios));
    });

    test('no reporta huecos menores que el umbral', () => {
        const vacios = periodosSinEventos(lineas, 50);
        assert.ok(!vacios.some(v => v.desde === 1919 && v.hasta === 1937));
    });

    test('un evento largo no deja ver huecos dentro de su duración', () => {
        const vacios = periodosSinEventos([{ eventos: [
            { anio_inicio: 1000, anio_fin: 2000 },
            { anio_inicio: 1500, anio_fin: 1600 }
        ] }], 1);
        assert.deepEqual(vacios, []);
    });
});

describe('solapamientos', () => {
    test('detecta eventos de la misma categoría en líneas distintas que coinciden en el tiempo', () => {
        const pares = solapamientos([
            { nombre_linea: 'A', eventos: [{ titulo_evento: 'x', anio_inicio: 1930, anio_fin: 1940, nombre_categoria: 'Guerra' }] },
            { nombre_linea: 'B', eventos: [{ titulo_evento: 'y', anio_inicio: 1935, nombre_categoria: 'Guerra' }] }
        ]);
        assert.equal(pares.length, 1);
        assert.equal(pares[0].categoria, 'Guerra');
    });

    test('ignora solapamientos de categorías distintas y dentro de la misma línea', () => {
        const pares = solapamientos([
            { nombre_linea: 'A', eventos: [
                { titulo_evento: 'x', anio_inicio: 1930, anio_fin: 1940, nombre_categoria: 'Guerra' },
                { titulo_evento: 'y', anio_inicio: 1935, nombre_categoria: 'Guerra' }
            ] },
            { nombre_linea: 'B', eventos: [{ titulo_evento: 'z', anio_inicio: 1935, nombre_categoria: 'Política' }] }
        ]);
        assert.deepEqual(pares, []);
    });
});
