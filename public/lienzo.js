// Motor del lienzo: carriles, eje temporal, relaciones y herramientas de analisis.

let _datosEscena = null;
let _escala = 4;
let _minimo = 0;
let _modo = 'lineal';
let _relativo = false;
let _categoriasActivas = null;
let _periodo = null;
let _eventosPorId = new Map();
let _cursorLinea = null;
let _cursorEtiqueta = null;
let _presentacion = [];
let _presentacionIndice = 0;
let _controlesListos = false;

const _ESCALA_MIN = 0.5;
const _ESCALA_MAX = 150;
const _SUBLANE_H = 55;
const _CINTA_H = 34;
const _CINTA_OFFSET_TOP = 10;
const _MARGEN = 500;
const _FACTOR_LOG = 100;
const _COLORES_RELACION = { causa: '#e74c3c', consecuencia: '#f39c12', contemporaneo: '#9b59b6', influencia: '#1abc9c', respuesta: '#3498db' };
const _ETIQUETAS_RELACION = { causa: 'Causa', consecuencia: 'Consecuencia', contemporaneo: 'Contemporáneo', influencia: 'Influencia', respuesta: 'Respuesta' };

function _formatearAnio(anio) {
    if (anio === 0) return 'A.D. 0';
    return anio < 0 ? `${Math.abs(anio)} a.C.` : String(anio);
}

function _etiquetaEje(valor) {
    if (_relativo) return valor > 0 ? `+${valor}` : String(valor);
    return _formatearAnio(valor);
}

// Transformacion del eje: lineal, o logaritmica para larga duracion
function _pos(valor) {
    return _modo === 'larga' ? Math.sign(valor) * Math.log10(Math.abs(valor) + 1) * _FACTOR_LOG : valor;
}

function _invPos(posicion) {
    return _modo === 'larga' ? Math.sign(posicion) * (Math.pow(10, Math.abs(posicion) / _FACTOR_LOG) - 1) : posicion;
}

function _px(valor) {
    return (_pos(valor) - _pos(_minimo)) * _escala;
}

function _valorDePixel(x) {
    return _invPos(_pos(_minimo) + x / _escala);
}

// En vista relativa cada linea empieza en su primer evento
function _offsetLinea(linea) {
    if (!_relativo || !linea.eventos || linea.eventos.length === 0) return 0;
    return Math.min(...linea.eventos.map(e => e.anio_inicio));
}

function _inicioVal(evento, linea) {
    return evento.anio_inicio - _offsetLinea(linea);
}

function _finVal(evento, linea) {
    return (evento.anio_fin ?? evento.anio_inicio) - _offsetLinea(linea);
}

function _eventosDe(datos) {
    return datos.lineas.flatMap(linea => linea.eventos || []);
}

function _rangoValores() {
    if (_periodo) return { min: _periodo.desde, max: _periodo.hasta };
    const valores = [];
    _datosEscena.lineas.forEach(linea => (linea.eventos || []).forEach(evento => {
        valores.push(_inicioVal(evento, linea), _finVal(evento, linea));
    }));
    if (valores.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...valores), max: Math.max(...valores) };
}

function _ajustarEscala(rango) {
    const extension = Math.abs(_pos(rango.max) - _pos(rango.min)) || 1;
    const ancho = window.innerWidth * 0.85;
    _escala = Math.round(Math.max(_ESCALA_MIN, Math.min(_ESCALA_MAX, ancho / extension)) * 10) / 10;
}

function _eventoVisible(evento, linea) {
    if (_categoriasActivas && !_categoriasActivas.has(evento.nombre_categoria || 'General')) return false;
    if (_periodo) {
        if (_finVal(evento, linea) < _periodo.desde || _inicioVal(evento, linea) > _periodo.hasta) return false;
    }
    return true;
}

function _calcularIntervalo() {
    const aniosPorMarca = 80 / _escala;
    const escalones = [1, 2, 5, 10, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
    return escalones.find(paso => paso >= aniosPorMarca) || 5000;
}

function _marcasLineales(desde, hasta) {
    const intervalo = _calcularIntervalo();
    const marcas = [];
    for (let valor = Math.ceil(desde / intervalo) * intervalo; valor <= hasta; valor += intervalo) marcas.push(valor);
    return marcas;
}

function _marcasLogaritmicas(desde, hasta) {
    const marcas = new Set([0]);
    for (let potencia = 0; potencia <= 4; potencia++) {
        [1, 2, 5].forEach(multiplo => {
            marcas.add(multiplo * 10 ** potencia);
            marcas.add(-multiplo * 10 ** potencia);
        });
    }
    return [...marcas].filter(v => v >= desde && v <= hasta).sort((a, b) => a - b);
}

function _renderizarRegla(contenedor, maximo, ancho) {
    const regla = document.createElement('div');
    regla.className = 'time-ruler';
    regla.style.width = `${ancho}px`;

    const marcas = _modo === 'larga' ? _marcasLogaritmicas(_minimo, maximo) : _marcasLineales(_minimo, maximo);
    marcas.forEach(valor => {
        const marca = document.createElement('div');
        marca.className = 'time-marker';
        marca.textContent = _etiquetaEje(valor);
        marca.style.left = `${_px(valor)}px`;
        regla.appendChild(marca);
    });
    contenedor.appendChild(regla);
}

function _crearGrupo(evento, linea, inicioX, cintaAncho, subcarril, inicioV, finV) {
    const grupo = document.createElement('div');
    grupo.className = 'event-group';
    grupo.dataset.idEvento = evento.id_evento;
    grupo.dataset.inicio = inicioV;
    grupo.dataset.fin = finV;
    grupo.dataset.startX = inicioX;
    grupo.dataset.anchoCinta = cintaAncho;
    grupo.style.left = `${inicioX}px`;
    grupo.style.top = `${_CINTA_OFFSET_TOP + subcarril * _SUBLANE_H}px`;
    grupo.style.width = `${cintaAncho}px`;
    grupo.style.height = `${_CINTA_H}px`;

    const cinta = document.createElement('div');
    cinta.className = 'event-ribbon';
    cinta.style.width = `${cintaAncho}px`;
    cinta.style.backgroundColor = linea.color_personalizado;
    cinta.title = `${evento.titulo_evento} (${formatearFecha(evento.anio_inicio, evento.precision_fecha)}${evento.anio_fin ? ' – ' + formatearFecha(evento.anio_fin, evento.precision_fecha) : ''})`;

    const etiqueta = document.createElement('div');
    etiqueta.className = 'ribbon-label';
    etiqueta.textContent = `${evento.titulo_evento} (${formatearFecha(evento.anio_inicio, evento.precision_fecha)})`;

    grupo.addEventListener('click', (e) => {
        e.stopPropagation();
        _abrirModal(evento, linea.color_personalizado);
    });
    grupo.append(cinta, etiqueta);
    return grupo;
}

function _renderizarCarril(contenedor, linea, ancho) {
    const carril = document.createElement('div');
    carril.className = 'lane';

    const cabecera = document.createElement('div');
    cabecera.className = 'lane-header';
    const detalleRelativo = _relativo ? ` · inicio ${_formatearAnio(_offsetLinea(linea))}` : '';
    cabecera.innerHTML = `
        <h3 class="lane-title" style="border-left-color: ${escaparHTML(linea.color_personalizado)}; color: white;">
            ${escaparHTML(linea.nombre_linea)}
            <span style="font-size:0.75rem; font-weight:400; opacity:0.6;">(${escaparHTML(linea.nombre_zona)}${escaparHTML(detalleRelativo)})</span>
        </h3>`;
    carril.appendChild(cabecera);

    const pista = document.createElement('div');
    pista.className = 'lane-track';
    pista.style.width = `${ancho}px`;

    const visibles = (linea.eventos || [])
        .filter(evento => _eventoVisible(evento, linea))
        .sort((a, b) => a.anio_inicio - b.anio_inicio);

    if (visibles.length === 0) {
        const hayEventos = (linea.eventos || []).length > 0;
        pista.innerHTML = `<p style="color: rgba(255,255,255,0.25); padding: 1.5rem 2rem; font-style: italic;">${hayEventos ? 'Sin eventos visibles con los filtros actuales.' : 'Sin eventos en esta línea.'}</p>`;
        pista.style.minHeight = '80px';
    } else {
        const finesSubcarril = [];
        let maxSubcarril = 0;
        visibles.forEach(evento => {
            const inicioV = _inicioVal(evento, linea);
            const finV = _finVal(evento, linea);
            const inicioX = _px(inicioV);
            const cintaAncho = Math.max(_px(finV) - inicioX, _CINTA_H);

            let subcarril = finesSubcarril.findIndex(fin => fin <= inicioX);
            if (subcarril === -1) subcarril = finesSubcarril.length;
            finesSubcarril[subcarril] = inicioX + cintaAncho + 16;
            maxSubcarril = Math.max(maxSubcarril, subcarril);

            pista.appendChild(_crearGrupo(evento, linea, inicioX, cintaAncho, subcarril, inicioV, finV));
        });
        pista.style.minHeight = `${(maxSubcarril + 1) * _SUBLANE_H + _CINTA_OFFSET_TOP * 2}px`;
    }

    carril.appendChild(pista);
    contenedor.appendChild(carril);
}

function _crearCursor(contenedor) {
    _cursorLinea = document.createElement('div');
    _cursorLinea.style.cssText = 'position:absolute; top:0; bottom:0; width:1px; background: rgba(255,255,255,0.5); pointer-events:none; display:none; z-index:5;';
    _cursorEtiqueta = document.createElement('div');
    _cursorEtiqueta.style.cssText = 'position:absolute; top:40px; padding:2px 6px; background: rgba(0,0,0,0.75); color:#fff; border-radius:4px; font-size:0.8rem; pointer-events:none; display:none; z-index:6;';
    contenedor.append(_cursorLinea, _cursorEtiqueta);
}

function _dibujarRelaciones(contenedor) {
    const relaciones = _datosEscena.relaciones || [];
    const rectContenedor = contenedor.getBoundingClientRect();
    const centro = (id) => {
        const grupo = contenedor.querySelector(`.event-group[data-id-evento="${id}"]`);
        if (!grupo) return null;
        const rect = grupo.getBoundingClientRect();
        return { x: rect.left - rectContenedor.left + rect.width / 2, y: rect.top - rectContenedor.top + rect.height / 2 };
    };

    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', contenedor.offsetWidth);
    svg.setAttribute('height', contenedor.scrollHeight);
    svg.style.cssText = 'position:absolute; left:0; top:0; overflow:visible; pointer-events:none; z-index:4;';

    relaciones.forEach(relacion => {
        const origen = centro(relacion.id_evento_origen);
        const destino = centro(relacion.id_evento_destino);
        if (!origen || !destino) return;

        const cy = Math.max(10, Math.min(origen.y, destino.y) - 40);
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', `M ${origen.x} ${origen.y} Q ${(origen.x + destino.x) / 2} ${cy} ${destino.x} ${destino.y}`);
        path.setAttribute('stroke', _COLORES_RELACION[relacion.tipo] || '#fff');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('opacity', '0.85');
        path.style.pointerEvents = 'stroke';
        if (relacion.tipo === 'contemporaneo') path.setAttribute('stroke-dasharray', '6 4');

        const titulo = document.createElementNS(NS, 'title');
        titulo.textContent = `${_ETIQUETAS_RELACION[relacion.tipo]}${relacion.nota ? ': ' + relacion.nota : ''}`;
        path.appendChild(titulo);
        svg.appendChild(path);
    });

    contenedor.appendChild(svg);
}

function _actualizarLeyenda() {
    const leyenda = document.getElementById('leyendaRelaciones');
    if (!leyenda) return;
    const tipos = [...new Set((_datosEscena.relaciones || []).map(r => r.tipo))];
    leyenda.innerHTML = tipos.map(tipo => `<span style="color: ${_COLORES_RELACION[tipo]};">${_ETIQUETAS_RELACION[tipo]}</span>`).join('');
}

function _renderizar() {
    const contenedor = document.getElementById('timelineGlobalContainer');
    if (!contenedor || !_datosEscena) return;

    const rango = _rangoValores();
    const margen = _periodo ? 0 : _MARGEN;
    _minimo = rango.min - margen;
    const maximo = rango.max + margen;
    const ancho = Math.max(_px(maximo), window.innerWidth * 3);

    contenedor.innerHTML = '';
    contenedor.style.position = 'relative';
    contenedor.style.width = `${ancho}px`;

    _renderizarRegla(contenedor, maximo, ancho);
    _datosEscena.lineas.forEach(linea => _renderizarCarril(contenedor, linea, ancho));
    _crearCursor(contenedor);
    _dibujarRelaciones(contenedor);
    _actualizarLeyenda();

    const etiquetaEscala = document.getElementById('zoomLabel');
    if (etiquetaEscala) etiquetaEscala.textContent = `${_escala} px/año`;
}

function _posicionarEtiquetas() {
    const area = document.getElementById('canvasScrollArea');
    const desplazamiento = area.scrollLeft;
    const MARGEN_ETIQUETA = 14;
    document.querySelectorAll('.event-group').forEach(grupo => {
        const etiqueta = grupo.querySelector('.ribbon-label');
        if (!etiqueta) return;
        const inicioX = parseFloat(grupo.dataset.startX || 0);
        const anchoCinta = parseFloat(grupo.dataset.anchoCinta || 0);
        const anchoTexto = etiqueta.offsetWidth || 120;
        const maximo = Math.max(0, anchoCinta - anchoTexto - MARGEN_ETIQUETA * 2);
        const efectivo = Math.min(maximo, Math.max(0, desplazamiento - inicioX + MARGEN_ETIQUETA));
        etiqueta.style.left = `${efectivo + MARGEN_ETIQUETA}px`;
    });
}

function _todosLosEventosVisibles() {
    return _datosEscena.lineas.flatMap(linea => (linea.eventos || [])
        .filter(evento => _eventoVisible(evento, linea))
        .map(evento => ({ evento, linea })));
}

function citarAPA(fuente) {
    const autor = fuente.autor ? `${escaparHTML(fuente.autor)}. ` : '';
    const url = fuente.url ? ` ${escaparHTML(fuente.url)}` : '';
    return `${autor}(${fuente.anio || 's.f.'}). <em>${escaparHTML(fuente.titulo)}</em>.${url}`;
}

function _htmlExtraModal(evento) {
    let html = '';
    if (evento.interpretacion) {
        html += `<h4>Interpretación</h4><p style="font-style: italic;">${escaparHTML(evento.interpretacion)}</p>`;
    }
    const fuentes = evento.fuentes || [];
    if (fuentes.length) {
        html += `<h4>Fuentes</h4><ul>${fuentes.map(f => `<li>${citarAPA(f)} <small>(${escaparHTML(f.tipo)})</small></li>`).join('')}</ul>`;
    }
    const relaciones = (_datosEscena.relaciones || []).filter(r => r.id_evento_origen === evento.id_evento || r.id_evento_destino === evento.id_evento);
    if (relaciones.length) {
        html += `<h4>Relaciones</h4><ul>${relaciones.map(r => {
            const esOrigen = r.id_evento_origen === evento.id_evento;
            const otro = _eventosPorId.get(esOrigen ? r.id_evento_destino : r.id_evento_origen);
            const flecha = esOrigen ? '→' : '←';
            return `<li>${escaparHTML(_ETIQUETAS_RELACION[r.tipo])} ${flecha} ${escaparHTML(otro ? otro.titulo_evento : 'evento')}${r.nota ? ` <small>(${escaparHTML(r.nota)})</small>` : ''}</li>`;
        }).join('')}</ul>`;
    }
    return html;
}

function _abrirModal(evento, colorLinea) {
    const capa = document.getElementById('eventModalOverlay');
    const contenedorImg = document.getElementById('modalImageContainer');
    if (!capa) return;

    if (evento.imagen_url && evento.imagen_url.trim() !== '') {
        contenedorImg.innerHTML = `<img src="${escaparHTML(evento.imagen_url.trim())}" alt="${escaparHTML(evento.titulo_evento)}" style="width: 100%; height: 220px; object-fit: cover; border-radius: 20px 20px 0 0; display: block;">`;
        contenedorImg.style.display = 'block';
    } else {
        contenedorImg.innerHTML = '';
        contenedorImg.style.display = 'none';
    }

    capa.querySelector('.modal-content').style.borderTop = `4px solid ${colorLinea}`;
    document.getElementById('modalTitle').textContent = evento.titulo_evento;
    document.getElementById('modalYears').textContent = formatearFecha(evento.anio_inicio, evento.precision_fecha)
        + (evento.anio_fin ? ` – ${formatearFecha(evento.anio_fin, evento.precision_fecha)}` : '');

    const categoria = document.getElementById('modalCategory');
    categoria.textContent = evento.nombre_categoria || 'General';
    categoria.style.background = colorLinea;
    document.getElementById('modalDesc').textContent = evento.descripcion || 'Sin descripción detallada.';

    const fuente = document.getElementById('modalFuente');
    fuente.innerHTML = evento.fuente_url
        ? `<a href="${escaparHTML(evento.fuente_url)}" target="_blank" rel="noopener" style="color: #4a90e2;">Ver fuente</a>`
        : '';
    document.getElementById('modalExtra').innerHTML = _htmlExtraModal(evento);

    capa.classList.remove('hidden');
}

function _construirFiltros() {
    const contenedor = document.getElementById('filtrosCategorias');
    if (!contenedor) return;
    const categorias = [...new Set(_eventosDe(_datosEscena).map(e => e.nombre_categoria || 'General'))].sort();
    contenedor.innerHTML = '';
    categorias.forEach(categoria => {
        const etiqueta = document.createElement('label');
        const casilla = document.createElement('input');
        casilla.type = 'checkbox';
        casilla.checked = true;
        casilla.value = categoria;
        casilla.addEventListener('change', () => {
            _categoriasActivas = new Set([...contenedor.querySelectorAll('input:checked')].map(c => c.value));
            _renderizar();
        });
        etiqueta.append(casilla, document.createTextNode(` ${categoria}`));
        contenedor.appendChild(etiqueta);
    });
}

function _quitarPeriodoYFiltros() {
    _categoriasActivas = null;
    _periodo = null;
    document.querySelectorAll('#filtrosCategorias input').forEach(c => { c.checked = true; });
    document.getElementById('periodoDesde').value = '';
    document.getElementById('periodoHasta').value = '';
}

function _normalizar(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function _irAEvento(idEvento) {
    const evento = _eventosPorId.get(Number(idEvento));
    if (!evento) return;
    const linea = _datosEscena.lineas.find(l => (l.eventos || []).some(e => e.id_evento === evento.id_evento));
    _quitarPeriodoYFiltros();
    _renderizar();

    const area = document.getElementById('canvasScrollArea');
    area.scrollLeft = _px(_inicioVal(evento, linea)) - area.clientWidth / 2;
    _posicionarEtiquetas();
    if (linea) _abrirModal(evento, linea.color_personalizado);
}

function _centrarEvento(evento, linea) {
    const area = document.getElementById('canvasScrollArea');
    area.scrollLeft = _px(_inicioVal(evento, linea)) - area.clientWidth / 2;
    _posicionarEtiquetas();
}

function _zoom(factor) {
    const area = document.getElementById('canvasScrollArea');
    const contenedor = document.getElementById('timelineGlobalContainer');
    const anchoActual = parseFloat(contenedor.style.width) || 1;
    const proporcion = (area.scrollLeft + area.clientWidth / 2) / anchoActual;

    _escala = Math.min(_ESCALA_MAX, Math.max(_ESCALA_MIN, parseFloat((_escala * factor).toFixed(2))));
    _renderizar();

    const anchoNuevo = parseFloat(contenedor.style.width) || 1;
    area.scrollLeft = proporcion * anchoNuevo - area.clientWidth / 2;
}

function _configurarControles() {
    if (_controlesListos) return;
    _controlesListos = true;

    const area = document.getElementById('canvasScrollArea');
    const contenedor = document.getElementById('timelineGlobalContainer');

    document.getElementById('btnZoomIn').addEventListener('click', () => _zoom(1.5));
    document.getElementById('btnZoomOut').addEventListener('click', () => _zoom(1 / 1.5));

    document.getElementById('modoEscala').addEventListener('change', (e) => {
        _modo = e.target.value;
        _ajustarEscala(_rangoValores());
        _renderizar();
    });

    document.getElementById('relativoCheck').addEventListener('change', (e) => {
        _relativo = e.target.checked;
        _ajustarEscala(_rangoValores());
        _renderizar();
    });

    document.getElementById('btnAplicarPeriodo').addEventListener('click', () => {
        const desde = Number(document.getElementById('periodoDesde').value);
        const hasta = Number(document.getElementById('periodoHasta').value);
        if (document.getElementById('periodoDesde').value === '' || document.getElementById('periodoHasta').value === '' || desde > hasta) {
            window.mostrarNotificacion('Indica un periodo válido (desde ≤ hasta)', true);
            return;
        }
        _periodo = { desde, hasta };
        _ajustarEscala(_rangoValores());
        _renderizar();
    });

    document.getElementById('btnQuitarPeriodo').addEventListener('click', () => {
        _quitarPeriodoYFiltros();
        _ajustarEscala(_rangoValores());
        _renderizar();
    });

    const buscador = document.getElementById('buscadorEvento');
    const resultados = document.getElementById('resultadosBusqueda');
    buscador.addEventListener('input', () => {
        const consulta = _normalizar(buscador.value.trim());
        resultados.innerHTML = '';
        if (!consulta) {
            resultados.classList.add('hidden');
            return;
        }
        const coincidencias = [..._eventosPorId.values()]
            .filter(e => _normalizar(e.titulo_evento).includes(consulta))
            .slice(0, 20);
        coincidencias.forEach(evento => {
            const fila = document.createElement('div');
            fila.textContent = `${evento.titulo_evento} (${formatearFecha(evento.anio_inicio, evento.precision_fecha)})`;
            fila.addEventListener('click', () => {
                resultados.classList.add('hidden');
                buscador.value = '';
                _irAEvento(evento.id_evento);
            });
            resultados.appendChild(fila);
        });
        resultados.classList.toggle('hidden', coincidencias.length === 0);
    });

    area.addEventListener('scroll', _posicionarEtiquetas);
    area.addEventListener('wheel', (e) => {
        e.preventDefault();
        area.scrollLeft += e.deltaY * 3;
    }, { passive: false });

    let arrastrando = false;
    let inicioX = 0;
    let scrollInicial = 0;
    area.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('event-ribbon') || e.target.classList.contains('event-group')) return;
        arrastrando = true;
        area.style.cursor = 'grabbing';
        inicioX = e.pageX - area.offsetLeft;
        scrollInicial = area.scrollLeft;
    });
    document.addEventListener('mouseup', () => {
        arrastrando = false;
        area.style.cursor = 'grab';
    });
    area.addEventListener('mousemove', (e) => {
        if (!arrastrando) return;
        e.preventDefault();
        const x = e.pageX - area.offsetLeft;
        area.scrollLeft = scrollInicial - (x - inicioX) * 1.5;
    });

    contenedor.addEventListener('mousemove', (e) => {
        if (!_cursorLinea) return;
        const x = e.clientX - contenedor.getBoundingClientRect().left;
        const valor = Math.round(_valorDePixel(x));
        _cursorLinea.style.left = `${x}px`;
        _cursorLinea.style.display = 'block';
        _cursorEtiqueta.style.left = `${x + 8}px`;
        _cursorEtiqueta.textContent = _etiquetaEje(valor);
        _cursorEtiqueta.style.display = 'block';
        document.querySelectorAll('.event-group').forEach(grupo => {
            grupo.classList.toggle('activo', valor >= Number(grupo.dataset.inicio) && valor <= Number(grupo.dataset.fin));
        });
    });
    contenedor.addEventListener('mouseleave', () => {
        if (_cursorLinea) _cursorLinea.style.display = 'none';
        if (_cursorEtiqueta) _cursorEtiqueta.style.display = 'none';
        document.querySelectorAll('.event-group.activo').forEach(g => g.classList.remove('activo'));
    });

    const capa = document.getElementById('eventModalOverlay');
    document.getElementById('btnCloseModal').onclick = () => capa.classList.add('hidden');
    capa.addEventListener('click', (e) => {
        if (e.target === capa) capa.classList.add('hidden');
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.overlay-panel, #eventModalOverlay').forEach(p => p.classList.add('hidden'));
        }
        if (!document.getElementById('panelPresentacion').classList.contains('hidden')) {
            if (e.key === 'ArrowRight') window.pasoPresentacion(1);
            if (e.key === 'ArrowLeft') window.pasoPresentacion(-1);
        }
    });
}

window.abrirAnalisis = function () {
    const lineas = _datosEscena.lineas;
    const densidad = Analisis.contarPorDecada(lineas);
    const vacios = Analisis.periodosSinEventos(lineas, 50);
    const pares = Analisis.solapamientos(lineas);

    const filasDensidad = densidad.map(linea => {
        const decadas = Object.keys(linea.decadas).map(Number).sort((a, b) => a - b);
        const detalle = decadas.map(decada => {
            const info = linea.decadas[decada];
            const categorias = Object.entries(info.categorias).map(([c, n]) => `${escaparHTML(c)} ${n}`).join(', ');
            return `<li>${_formatearAnio(decada)}: ${info.total} evento(s) <small>(${categorias})</small></li>`;
        }).join('');
        return `<tr><td>${escaparHTML(linea.nombre_linea)}</td><td><ul style="margin:0; padding-left: 18px;">${detalle || '<li>Sin eventos</li>'}</ul></td></tr>`;
    }).join('');

    const listaVacios = vacios.length
        ? vacios.map(v => `<li>Sin eventos entre ${_formatearAnio(v.desde)} y ${_formatearAnio(v.hasta)} (${v.hasta - v.desde} años)</li>`).join('')
        : '<li>No hay periodos de más de 50 años sin eventos.</li>';

    const listaPares = pares.length
        ? pares.map(p => `<li>${escaparHTML(p.categoria)}: <em>${escaparHTML(p.a.titulo)}</em> (${escaparHTML(p.a.linea)}) se solapa con <em>${escaparHTML(p.b.titulo)}</em> (${escaparHTML(p.b.linea)})</li>`).join('')
        : '<li>No se detectan solapamientos de la misma categoría.</li>';

    document.getElementById('contenidoAnalisis').innerHTML = `
        <h4 style="margin-top: 1rem;">Densidad por década</h4>
        <table><thead><tr><th>Línea</th><th>Eventos por década</th></tr></thead><tbody>${filasDensidad}</tbody></table>
        <h4 style="margin-top: 1rem;">Periodos sin eventos</h4>
        <ul>${listaVacios}</ul>
        <h4 style="margin-top: 1rem;">Solapamientos de la misma categoría</h4>
        <ul>${listaPares}</ul>
        <p style="color: rgba(255,255,255,0.6); font-size: 0.8rem; margin-top: 1rem;">Análisis automático: un punto de partida para discutir, no una conclusión histórica.</p>`;
    document.getElementById('panelAnalisis').classList.remove('hidden');
};

window.abrirPreguntas = function () {
    const preguntas = _datosEscena.preguntas || [];
    document.getElementById('listaPreguntas').innerHTML = preguntas.length
        ? preguntas.map(p => `<li>${escaparHTML(p.texto)}</li>`).join('')
        : '<li style="list-style: none;">Esta escena no tiene preguntas guiadas.</li>';
    document.getElementById('panelPreguntas').classList.remove('hidden');
};

window.abrirPresentacion = function () {
    _presentacion = _todosLosEventosVisibles().sort((a, b) => a.evento.anio_inicio - b.evento.anio_inicio);
    if (_presentacion.length === 0) {
        window.mostrarNotificacion('No hay eventos visibles para presentar', true);
        return;
    }
    _presentacionIndice = 0;
    document.getElementById('panelPresentacion').classList.remove('hidden');
    _mostrarPaso();
};

function _mostrarPaso() {
    const { evento, linea } = _presentacion[_presentacionIndice];
    document.getElementById('presentacionContador').textContent = `${_presentacionIndice + 1} / ${_presentacion.length} · ${linea.nombre_linea}`;
    document.getElementById('presentacionTitulo').textContent = evento.titulo_evento;
    document.getElementById('presentacionFecha').textContent = formatearFecha(evento.anio_inicio, evento.precision_fecha)
        + (evento.anio_fin ? ` – ${formatearFecha(evento.anio_fin, evento.precision_fecha)}` : '');
    document.getElementById('presentacionDesc').textContent = evento.descripcion || '';
    document.getElementById('presentacionInterpretacion').textContent = evento.interpretacion ? `Interpretación: ${evento.interpretacion}` : '';
    _centrarEvento(evento, linea);
}

window.pasoPresentacion = function (direccion) {
    if (_presentacion.length === 0) return;
    _presentacionIndice = Math.min(_presentacion.length - 1, Math.max(0, _presentacionIndice + direccion));
    _mostrarPaso();
};

window.cerrarPresentacion = function () {
    document.getElementById('panelPresentacion').classList.add('hidden');
};

window.exportarFicha = function () {
    const ventana = window.open('', '_blank');
    if (!ventana) {
        window.mostrarNotificacion('Permite las ventanas emergentes para exportar la ficha', true);
        return;
    }

    const secciones = _datosEscena.lineas.map(linea => {
        const filas = (linea.eventos || []).map(e => `
            <tr>
                <td>${escaparHTML(formatearFecha(e.anio_inicio, e.precision_fecha))}${e.anio_fin ? ' – ' + escaparHTML(formatearFecha(e.anio_fin, e.precision_fecha)) : ''}</td>
                <td>${escaparHTML(e.titulo_evento)}</td>
                <td>${escaparHTML(e.nombre_categoria || 'General')}</td>
                <td>${escaparHTML(e.interpretacion || '')}</td>
                <td>${(e.fuentes || []).map(f => citarAPA(f)).join('<br>')}</td>
            </tr>`).join('');
        return `<h2 style="border-left: 6px solid ${escaparHTML(linea.color_personalizado)}; padding-left: 8px;">${escaparHTML(linea.nombre_linea)} <small>(${escaparHTML(linea.nombre_zona)})</small></h2>
            <table><thead><tr><th>Fecha</th><th>Evento</th><th>Categoría</th><th>Interpretación</th><th>Fuentes</th></tr></thead><tbody>${filas || '<tr><td colspan="5">Sin eventos</td></tr>'}</tbody></table>`;
    }).join('');

    const relaciones = (_datosEscena.relaciones || []).map(r => {
        const origen = _eventosPorId.get(r.id_evento_origen);
        const destino = _eventosPorId.get(r.id_evento_destino);
        return `<tr><td>${escaparHTML(origen ? origen.titulo_evento : '')}</td><td>${escaparHTML(_ETIQUETAS_RELACION[r.tipo])}</td><td>${escaparHTML(destino ? destino.titulo_evento : '')}</td><td>${escaparHTML(r.nota || '')}</td></tr>`;
    }).join('');

    const titulo = escaparHTML(_datosEscena.nombre_escena);
    ventana.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${titulo}</title>
        <style>
            @page { size: landscape; margin: 12mm; }
            body { font-family: Arial, sans-serif; font-size: 11px; color: #222; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
            th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
            th { background: #eee; }
        </style></head><body>
        <h1>${titulo}</h1>
        ${secciones}
        ${relaciones ? `<h2>Relaciones causales</h2><table><thead><tr><th>Origen</th><th>Tipo</th><th>Destino</th><th>Nota</th></tr></thead><tbody>${relaciones}</tbody></table>` : ''}
        </body></html>`);
    ventana.document.title = _datosEscena.nombre_escena;
    ventana.document.close();
    ventana.addEventListener('load', () => ventana.print());
};

async function _capturarLienzo() {
    if (typeof html2canvas === 'undefined') throw new Error('No se pudo cargar la librería de captura');
    if (!_datosEscena) throw new Error('La escena aún no está cargada');

    const contenedor = document.getElementById('timelineGlobalContainer');
    const captura = await html2canvas(contenedor, { backgroundColor: '#0a0f1e', scale: 1, useCORS: true });

    const alturaCabecera = 70;
    const salida = document.createElement('canvas');
    salida.width = captura.width;
    salida.height = captura.height + alturaCabecera;

    const contexto = salida.getContext('2d');
    contexto.fillStyle = '#0a0f1e';
    contexto.fillRect(0, 0, salida.width, salida.height);
    contexto.fillStyle = '#ffffff';
    contexto.font = 'bold 32px sans-serif';
    contexto.fillText(_datosEscena.nombre_escena, 24, 46);
    contexto.drawImage(captura, 0, alturaCabecera);
    return salida;
}

window.exportarLienzoPNG = async function () {
    try {
        const imagen = await _capturarLienzo();
        const enlace = document.createElement('a');
        enlace.href = imagen.toDataURL('image/png');
        enlace.download = `${_datosEscena.nombre_escena}.png`;
        enlace.click();
    } catch (error) {
        window.mostrarNotificacion(`Error al exportar PNG: ${error.message}`, true);
    }
};

window.exportarLienzoPDF = async function () {
    const ventana = window.open('', '_blank');
    if (!ventana) {
        window.mostrarNotificacion('Permite las ventanas emergentes para exportar a PDF', true);
        return;
    }

    try {
        const imagen = await _capturarLienzo();
        ventana.document.write(`<!DOCTYPE html><html><head><style>@page { size: landscape; margin: 8mm; } body { margin: 0; } img { width: 100%; height: auto; }</style></head><body><img src="${imagen.toDataURL('image/png')}"></body></html>`);
        ventana.document.title = _datosEscena.nombre_escena;
        ventana.document.close();
        ventana.addEventListener('load', () => ventana.print());
    } catch (error) {
        ventana.close();
        window.mostrarNotificacion(`Error al exportar PDF: ${error.message}`, true);
    }
};

window.cargarLienzo = async function (idEscena) {
    const objetoTitulo = document.getElementById('lienzoEscenaTitulo');
    const contenedor = document.getElementById('timelineGlobalContainer');
    if (!contenedor || !objetoTitulo) return;

    try {
        const respuesta = await fetch(`${API_URL}/escenas/${idEscena}/detalle`);
        const datos = await manejarRespuesta(respuesta);
        objetoTitulo.textContent = datos.nombre_escena;

        const todos = _eventosDe(datos);
        if (!datos.lineas || datos.lineas.length === 0) {
            contenedor.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%;"><h2 style="color: rgba(255,255,255,0.5);">Esta escena está vacía.</h2></div>';
            return;
        }
        if (todos.length === 0) {
            contenedor.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%;"><h2 style="color: rgba(255,255,255,0.5);">No hay eventos creados en esta escena aún.</h2></div>';
            return;
        }

        _datosEscena = datos;
        _eventosPorId = new Map(todos.map(e => [e.id_evento, e]));
        _categoriasActivas = null;
        _periodo = null;
        _ajustarEscala(_rangoValores());

        _construirFiltros();
        _configurarControles();
        _renderizar();
    } catch (error) {
        objetoTitulo.textContent = 'Error';
        contenedor.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; height:100%;"><h2 style="color: #ff6b6b;">Error al cargar: ${escaparHTML(error.message)}</h2></div>`;
    }
};
