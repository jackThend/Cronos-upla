# Cronos UPLA

Aplicación web para construir escenas crono-espaciales: líneas de tiempo por zona geográfica, con eventos históricos que se comparan en un mismo eje temporal.

## Requisitos

- Node.js 18 o superior
- SQL Server con la base de datos del proyecto (`script_db.sql`)

## Instalación

1. Instalar dependencias:
   ```
   npm install
   ```
2. Crear la base de datos con `script_db.sql` y luego ejecutar, en este orden, `migracion_ia.sql` y `migracion_mejoras.sql`.
3. Copiar `.env.example` a `.env` y completar los valores. Las dos claves secretas se generan con:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   `SECRETO_SESION` necesita al menos 32 caracteres y `CLAVE_CIFRADO_IA` exactamente 64 caracteres hexadecimales.
4. Iniciar el servidor:
   ```
   npm start
   ```
   Luego abrir `http://localhost:3000`.

## Funcionalidades

- **Constructor de escenas**: escenas, líneas de tiempo y eventos con categoría, años (negativos para a.C.), descripción, imagen y fuente.
- **Lienzo**: vista comparativa de las líneas en un eje temporal con zoom, cursor que resalta los eventos activos en cada carril, filtros por categoría, periodo, alineación relativa al inicio de cada línea y escala de larga duración. Muestra relaciones causales como arcos entre eventos, y permite buscar un evento, presentarlo paso a paso, ver preguntas guiadas y un análisis automático (densidad por década, periodos sin eventos, solapamientos). Exporta a PNG, PDF y ficha comparativa.
- **Fechas con precisión**: exacta, aproximada, siglo o década.
- **Fuentes e interpretación**: varias fuentes por evento con cita estilo APA, y una nota de interpretación separada de la descripción.
- **Modo docente**: asignar escenas a estudiantes, que las ven en su explorador, y crear preguntas guiadas.
- **Importar / exportar**: escenas en JSON o CSV (separador `;`, compatible con Excel).
- **Plantillas**: escenas predefinidas en la carpeta `plantillas/`. Para agregar una, crear un JSON con el mismo formato que los existentes.
- **Asistente IA** (opcional): cada usuario guarda su propia API key de OpenAI, Groq, OpenRouter o Anthropic. La IA propone líneas y eventos para una escena, y el usuario los revisa antes de añadirlos. Las fuentes se comprueban y se descartan si no responden.

## Pruebas

```
npm test
```

Las pruebas de la API usan una base de datos simulada en memoria (`tests/fake-db.js`), así que no requieren SQL Server. Las pruebas del análisis son funciones puras. Las pruebas no cubren la interfaz del navegador.

## Seguridad

- Las sesiones usan tokens firmados que duran 8 horas.
- El login se bloquea tras 5 intentos fallidos en 15 minutos, por IP y por email.
- Las API keys de IA se guardan cifradas (AES-256-GCM) y nunca se devuelven completas.
- Usar HTTPS en cualquier despliegue fuera de la máquina local.

## Limitaciones conocidas

- El límite de intentos vive en memoria: se reinicia al reiniciar el servidor y no sirve con varias instancias.
- Los tokens no se pueden revocar antes de su vencimiento.
- El token se guarda en `localStorage`, por lo que un fallo de XSS podría exponerlo.
