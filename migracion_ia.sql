/* PROYECTO: CRONOS UPLA - MIGRACION ASISTENTE IA
   Ejecutar una sola vez sobre la base de datos existente.
*/

-- Configuracion de IA por usuario (la API key se guarda cifrada)
CREATE TABLE Configuracion_IA (
    rut_usuario VARCHAR(12) PRIMARY KEY,
    proveedor VARCHAR(20) NOT NULL,
    modelo VARCHAR(100) NOT NULL,
    clave_cifrada VARCHAR(500) NOT NULL,
    clave_final VARCHAR(4) NOT NULL,
    fecha_actualizacion DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (rut_usuario) REFERENCES Usuarios(rut_usuario)
);

-- Fuente web de cada evento (opcional)
ALTER TABLE Eventos_Historicos ADD fuente_url VARCHAR(500) NULL;
