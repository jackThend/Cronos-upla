const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: true, // Para Azure, usar true. Si es local, false si no tienes certificado
        trustServerCertificate: true // Útil en entorno local para ignorar error de certificado
    }
};

const poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then(pool => {
        console.log('✅ Conectado a la base de datos SQL Server: ' + process.env.DB_DATABASE);
        return pool;
    })
    .catch(err => {
        console.error('❌ Error al conectar a la base de datos: ', err);
        process.exit(1);
    });

module.exports = {
    sql,
    poolPromise
};
