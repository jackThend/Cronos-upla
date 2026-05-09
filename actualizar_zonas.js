const { promesaPool, sql } = require('./db');

async function actualizarZonas() {
    try {
        const pool = await promesaPool;
        
        // 1. Actualizar zonas existentes para no romper Foriegn Keys
        await pool.request().query("UPDATE Zonas_Geograficas SET nombre_zona = 'América', continente = 'América' WHERE id_zona = 1");
        await pool.request().query("UPDATE Zonas_Geograficas SET nombre_zona = 'Europa', continente = 'Europa' WHERE id_zona = 2");
        await pool.request().query("UPDATE Zonas_Geograficas SET nombre_zona = 'Asia', continente = 'Asia' WHERE id_zona = 3");
        await pool.request().query("UPDATE Zonas_Geograficas SET nombre_zona = 'África', continente = 'África' WHERE id_zona = 4");

        // 2. Insertar Oceanía y Antártida si no existen
        const checkOceania = await pool.request().query("SELECT * FROM Zonas_Geograficas WHERE nombre_zona = 'Oceanía'");
        if (checkOceania.recordset.length === 0) {
            await pool.request().query("INSERT INTO Zonas_Geograficas (nombre_zona, continente) VALUES ('Oceanía', 'Oceanía')");
        }

        const checkAntartida = await pool.request().query("SELECT * FROM Zonas_Geograficas WHERE nombre_zona = 'Antártida'");
        if (checkAntartida.recordset.length === 0) {
            await pool.request().query("INSERT INTO Zonas_Geograficas (nombre_zona, continente) VALUES ('Antártida', 'Antártida')");
        }

        console.log("Zonas geográficas actualizadas correctamente.");
        process.exit(0);
    } catch (error) {
        console.error("Error actualizando zonas:", error);
        process.exit(1);
    }
}

actualizarZonas();
