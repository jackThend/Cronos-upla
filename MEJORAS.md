# Listado de mejoras

## 1. Relaciones causales entre eventos
- [x] ~~Tabla `Relaciones_Eventos` con tipos: causa, consecuencia, contemporáneo, influencia, respuesta~~
- [x] ~~Endpoints para crear y borrar relaciones (solo dueño de la escena)~~
- [x] ~~Dibujo de arcos entre eventos en el lienzo~~
- [x] ~~Gestión de relaciones desde el gestor de escenas~~

## 2. Precisión de fechas
- [x] ~~Campo `precision_fecha`: exacta, aproximada, siglo, década~~
- [x] ~~Formato visible: "c. 3100 a.C.", "s. XX", "1940s"~~
- [x] ~~Soportado en importación, exportación y formularios~~

## 3. Sincronización y comparación entre carriles
- [x] ~~Cursor sincronizado: resalta eventos activos en todos los carriles para el año marcado~~
- [x] ~~Vista de periodo: filtrar un rango de años en todas las líneas~~
- [x] ~~Modo tiempo relativo: alinear cada línea a su primer evento~~

## 4. Análisis automático de la escena
- [x] ~~Densidad por década y categoría, por línea~~
- [x] ~~Periodos sin eventos entre líneas~~
- [x] ~~Detección de eventos solapados de la misma categoría~~
- [x] ~~Lógica en módulo puro, con pruebas~~

## 5. Filtros y capas
- [x] ~~Filtrar el lienzo por categoría sin borrar datos~~

## 6. Fuentes y trazabilidad
- [x] ~~Varias fuentes por evento (tipo, autor, año, URL)~~
- [x] ~~Cita formateada estilo APA~~
- [x] ~~Nota de interpretación separada de la descripción~~

## 7. Modo docente y estudiante
- [x] ~~Asignar escenas a estudiantes~~
- [x] ~~Preguntas guiadas por escena~~
- [x] ~~Modo presentación: recorre los eventos en orden~~

## 8. IA orientada a análisis
- [x] ~~La propuesta incluye relaciones causales con justificación~~
- [x] ~~La propuesta incluye preguntas de comparación~~
- [x] ~~La propuesta incluye advertencias de inconsistencia~~

## 9. Interacción y exportación
- [x] ~~Búsqueda de eventos dentro de la escena con salto al año~~
- [x] ~~Exportar ficha comparativa en PDF con tablas por carril~~
- [x] ~~Escala de larga duración (logarítmica)~~

## Pendiente o por verificar
- [x] ~~Probar el lienzo en el navegador: arcos, cursor, modo relativo, presentación, búsqueda, análisis y filtros~~ (verificado con `npm run demo`; la captura visual no estuvo disponible, así que el diseño no se revisó a ojo)
- [x] ~~Exportar y importar relaciones, fuentes y preguntas en JSON~~ (en CSV no; el formato CSV solo lleva eventos, precisión e interpretación)
- [ ] Validar en la práctica la calidad de las relaciones que propone la IA; el sistema las acepta solo si los títulos existen, pero no evalúa si el vínculo histórico es correcto.
- [ ] Revisión visual del lienzo y del dashboard en pantalla (diseño, legibilidad de los arcos y de las etiquetas).
