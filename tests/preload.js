// Reemplaza db.js por la base simulada antes de que server.js lo cargue.
const path = require('path');
const fake = require('./fake-db');

const rutaDb = path.join(__dirname, '..', 'db.js');
require.cache[rutaDb] = {
    id: rutaDb,
    filename: rutaDb,
    loaded: true,
    exports: { sql: fake.sql, promesaPool: Promise.resolve(fake.pool) }
};
