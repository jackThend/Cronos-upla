const sql = require('mssql');
require('dotenv').config();

const configBd = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

const promesaPool = new sql.ConnectionPool(configBd)
    .connect()
    .then(conexionPool => {
        console.log('✅ Conectado a la base de datos SQL Server: ' + process.env.DB_DATABASE);
        return conexionPool;
    })
    .catch(errorConexion => {
        console.error('❌ Error al conectar a la base de datos: ', errorConexion);
        process.exit(1);
    });

module.exports = {
    sql,
    promesaPool
};
