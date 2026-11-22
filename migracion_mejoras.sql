/* PROYECTO: CRONOS UPLA - MIGRACION MEJORAS DE ANALISIS
   Ejecutar una sola vez, despues de script_db.sql y migracion_ia.sql.
*/

-- 2. Precision de fechas y nota de interpretacion
ALTER TABLE Eventos_Historicos ADD precision_fecha VARCHAR(20) NOT NULL DEFAULT 'exacta';
ALTER TABLE Eventos_Historicos ADD interpretacion TEXT NULL;

-- 1. Relaciones causales entre eventos
CREATE TABLE Relaciones_Eventos (
    id_relacion INT IDENTITY(1,1) PRIMARY KEY,
    id_evento_origen INT NOT NULL,
    id_evento_destino INT NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    nota VARCHAR(300) NULL,
    FOREIGN KEY (id_evento_origen) REFERENCES Eventos_Historicos(id_evento),
    FOREIGN KEY (id_evento_destino) REFERENCES Eventos_Historicos(id_evento)
);

-- 6. Fuentes por evento
CREATE TABLE Fuentes_Evento (
    id_fuente INT IDENTITY(1,1) PRIMARY KEY,
    id_evento INT NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    autor VARCHAR(150) NULL,
    anio INT NULL,
    url VARCHAR(500) NULL,
    tipo VARCHAR(20) NOT NULL,
    FOREIGN KEY (id_evento) REFERENCES Eventos_Historicos(id_evento)
);

-- 7. Asignacion de escenas a estudiantes
CREATE TABLE Asignaciones_Escena (
    id_escena INT NOT NULL,
    rut_estudiante VARCHAR(12) NOT NULL,
    PRIMARY KEY (id_escena, rut_estudiante),
    FOREIGN KEY (id_escena) REFERENCES Escenas_Crono(id_escena),
    FOREIGN KEY (rut_estudiante) REFERENCES Usuarios(rut_usuario)
);

-- 7. Preguntas guiadas por escena
CREATE TABLE Preguntas_Escena (
    id_pregunta INT IDENTITY(1,1) PRIMARY KEY,
    id_escena INT NOT NULL,
    texto VARCHAR(400) NOT NULL,
    FOREIGN KEY (id_escena) REFERENCES Escenas_Crono(id_escena)
);
