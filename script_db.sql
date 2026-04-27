/* PROYECTO: CRONOS UPLA - COMPARADOR CRONO-ESPACIAL
   DICCIONARIO DE DATOS Y ESTRUCTURA DE TABLAS
*/

-- 1. CREACIÓN DE TABLAS MAESTRAS (Sin dependencias)
CREATE TABLE Perfiles (
    id_perfil INT PRIMARY KEY,
    nombre_perfil VARCHAR(50) NOT NULL
);

CREATE TABLE Zonas_Geograficas (
    id_zona INT IDENTITY(1,1) PRIMARY KEY,
    nombre_zona VARCHAR(100) NOT NULL,
    continente VARCHAR(50) NOT NULL
);

CREATE TABLE Categorias (
    id_categoria INT IDENTITY(1,1) PRIMARY KEY,
    nombre_categoria VARCHAR(50) NOT NULL
);

-- 2. TABLAS CON DEPENDENCIAS (Foreign Keys)
CREATE TABLE Usuarios (
    rut_usuario VARCHAR(12) PRIMARY KEY,
    id_perfil INT NOT NULL,
    nombre_completo VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    FOREIGN KEY (id_perfil) REFERENCES Perfiles(id_perfil)
);

CREATE TABLE Escenas_Crono (
    id_escena INT IDENTITY(1,1) PRIMARY KEY,
    nombre_escena VARCHAR(150) NOT NULL,
    rut_usuario VARCHAR(12) NOT NULL,
    FOREIGN KEY (rut_usuario) REFERENCES Usuarios(rut_usuario)
);

CREATE TABLE Lineas_Tiempo (
    id_linea INT IDENTITY(1,1) PRIMARY KEY,
    id_escena INT NOT NULL,
    id_zona INT NOT NULL,
    nombre_linea VARCHAR(100) NOT NULL,
    color_personalizado VARCHAR(7) DEFAULT '#3498db',
    FOREIGN KEY (id_escena) REFERENCES Escenas_Crono(id_escena),
    FOREIGN KEY (id_zona) REFERENCES Zonas_Geograficas(id_zona)
);

CREATE TABLE Eventos_Historicos (
    id_evento INT IDENTITY(1,1) PRIMARY KEY,
    id_linea INT NOT NULL,
    id_categoria INT NOT NULL,
    titulo_evento VARCHAR(150) NOT NULL,
    anio_inicio INT NOT NULL,
    anio_fin INT NULL,
    descripcion TEXT NOT NULL,
    imagen_url VARCHAR(255) NULL,
    FOREIGN KEY (id_linea) REFERENCES Lineas_Tiempo(id_linea),
    FOREIGN KEY (id_categoria) REFERENCES Categorias(id_categoria)
);

-- 3. INSERCIÓN DE DATOS MAESTROS (Configuración Inicial)
INSERT INTO Perfiles (id_perfil, nombre_perfil) VALUES (1, 'Docente'), (2, 'Estudiante');
INSERT INTO Categorias (nombre_categoria) VALUES ('Guerra'), ('Arte'), ('Ciencia'), ('Política'), ('Social');
INSERT INTO Zonas_Geograficas (nombre_zona, continente) VALUES ('Chile', 'América'), ('España', 'Europa'), ('Japón', 'Asia'), ('Egipto', 'África');