const { poolPromise, sql } = require('./db');

async function seedDatabase() {
    try {
        const pool = await poolPromise;

        console.log('⏳ Poblando tabla Perfiles...');
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM Perfiles WHERE id_perfil = 1)
            BEGIN
                SET IDENTITY_INSERT Perfiles ON;
                INSERT INTO Perfiles (id_perfil, nombre_perfil) VALUES (1, 'Docente');
                INSERT INTO Perfiles (id_perfil, nombre_perfil) VALUES (2, 'Estudiante');
                SET IDENTITY_INSERT Perfiles OFF;
            END
        `);

        console.log('⏳ Poblando tabla Categorias...');
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM Categorias WHERE id_categoria = 1)
            BEGIN
                SET IDENTITY_INSERT Categorias ON;
                INSERT INTO Categorias (id_categoria, nombre_categoria) VALUES (1, 'Guerra');
                INSERT INTO Categorias (id_categoria, nombre_categoria) VALUES (2, 'Descubrimiento');
                INSERT INTO Categorias (id_categoria, nombre_categoria) VALUES (3, 'Política');
                SET IDENTITY_INSERT Categorias OFF;
            END
        `);

        console.log('⏳ Poblando tabla Zonas_Geograficas...');
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM Zonas_Geograficas WHERE id_zona = 1)
            BEGIN
                SET IDENTITY_INSERT Zonas_Geograficas ON;
                INSERT INTO Zonas_Geograficas (id_zona, nombre_zona, continente) VALUES (1, 'Europa', 'Europa');
                INSERT INTO Zonas_Geograficas (id_zona, nombre_zona, continente) VALUES (2, 'Asia', 'Asia');
                INSERT INTO Zonas_Geograficas (id_zona, nombre_zona, continente) VALUES (3, 'América', 'América');
                SET IDENTITY_INSERT Zonas_Geograficas OFF;
            END
        `);

        console.log('✅ Base de datos poblada parcialmente (Perfiles, Categorías, Zonas).');

        console.log('✅ Base de datos poblada con éxito. Ya puedes probar el registro y creación de eventos.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error al poblar la base de datos:', error.message);
        console.error(error);
        process.exit(1);
    }
}

seedDatabase();
