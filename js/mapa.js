//colores semáforo
const PALETA_5 = ["#1a9850", "#66bd63", "#ffffbf", "#fdae61", "#d73027"];

// =======================================================
// TOOLTIP: helpers
// =======================================================
function getTooltipEl() {
  return document.querySelector('aside[data-role="info"].tooltip');
}

// Muestra tooltip con:
// - nombre del municipio
// - indicador actual
// - valor
// y lo posiciona cerca del ratón (ev.clientX/Y) evitando salirse de la pantalla.
function mostrarInfo(indicadorActual, municipio, valor, ev) {
  const tooltip = getTooltipEl();
  if (!tooltip) return;

  tooltip.querySelector('[data-info="nombre"]').textContent = municipio ?? "";
  tooltip.querySelector('[data-info="indicador"]').textContent = indicadorActual || "";
  tooltip.querySelector('[data-info="valor"]').textContent =
    (typeof valor === "number" && !isNaN(valor)) ? valor.toFixed(3) : "n/d";

  if (ev && typeof ev.clientX === "number") {
    const margin = 12;
    tooltip.style.position = "fixed";
    tooltip.style.left = "0px";
    tooltip.style.top = "0px";

    tooltip.classList.add("show");
    const rect = tooltip.getBoundingClientRect();

    let x = ev.clientX + margin;
    let y = ev.clientY + margin;

    if (x + rect.width > window.innerWidth - margin) x = ev.clientX - rect.width - margin;
    if (y + rect.height > window.innerHeight - margin) y = ev.clientY - rect.height - margin;

    x = Math.max(margin, x);
    y = Math.max(margin, y);

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  tooltip.classList.add("show");
}

//ocultar tooltip
function cerrarInfo() {
  const tooltip = getTooltipEl();
  if (!tooltip) return;
  tooltip.classList.remove("show");
}

// =======================================================
// CLASIFICACIÓN EN 5 RANGOS (breaks)
// =======================================================

// Calcula 6 puntos de corte para 5 clases:
// breaks = [min, b1, b2, b3, b4, max]
// Si min==max o no son finitos, devuelve todo repetido (no hay rangos reales)
// Se asume que no ocurre eso
function getBreaks5(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return [min, min, min, min, min, min];
  }
  const step = (max - min) / 5;
  return [min, min + step, min + 2*step, min + 3*step, min + 4*step, max];
}

// Dado un valor y unos cortes breaks, asigna uno de los 5 colores.
function colorPorRango5(valor, breaks, invertido = false) {
  if (!Number.isFinite(valor)) return "transparent";

  const pal = invertido ? [...PALETA_5].reverse() : PALETA_5;

  if (valor <= breaks[1]) return pal[0];
  if (valor <= breaks[2]) return pal[1];
  if (valor <= breaks[3]) return pal[2];
  if (valor <= breaks[4]) return pal[3];
  return pal[4];
}

// =======================================================
// LEYENDA: helpers
// =======================================================
function getLegendContainer() {
  return document.querySelector('[data-leyenda="contenido"]');
}

function clearLegend() {
  const el = getLegendContainer();
  if (el) el.innerHTML = "";
}

// Pinta una leyenda de rangos (5 items) para el indicador actual.
function renderLegendRangos({ indicadorActual, min, max, invertido = false }) {
  const legend = getLegendContainer();
  if (!legend) return;

  legend.innerHTML = "";

  const title = document.createElement("div");
  title.className = "legend-title";
  title.textContent = `${indicadorActual}`;
  legend.appendChild(title);

  const items = document.createElement("div");
  items.className = "legend-items";
  legend.appendChild(items);

  //si es invertido el indicador, va al revés los colores
  const baseColors = ["#2E7D32","#7CB342","#FFF9C4","#F6B26B","#C62828"];
  const colors = invertido ? [...baseColors].reverse() : baseColors;
  const minNum = Number(min), maxNum = Number(max);
  if (!Number.isFinite(minNum) || !Number.isFinite(maxNum) || minNum === maxNum) return;

  const step = (maxNum - minNum) / colors.length;

  for (let i = 0; i < colors.length; i++) {
    const from = minNum + step * i;
    const to = (i === colors.length - 1) ? maxNum : (minNum + step * (i + 1));

    const item = document.createElement("div");
    item.className = "legend-item";

    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.backgroundColor = colors[i];

    const label = document.createElement("span");
    label.className = "legend-label";
    label.textContent = `${from.toFixed(2)} – ${to.toFixed(2)}`;

    item.appendChild(swatch);
    item.appendChild(label);
    items.appendChild(item);
  }
}

// =======================================================
// RANKING INLINE (debajo del mapa): lista de concejos con posición
// =======================================================
// Pinta una lista horizontal con enlaces tipo:
// "Avilés(3), Gijón(10), ..."
// Y al clicar:
// - cambia el estado para ir a ranking por municipio
function renderListaConcejosPosicion(state, AST_KEY) {
  const cont = document.getElementById("rankingConcejos");
  if (!cont) return;

  if (!state.añoActual || !state.indicadorActual || !state.datosJSON?.[state.añoActual]) {
    cont.innerHTML = "";
    return;
  }

  const datosAño = state.datosJSON[state.añoActual];
  // Todos los concejos del año, excluyendo Asturias/total regional
  const concejos = Object.keys(datosAño).filter(c => c !== AST_KEY);

  cont.innerHTML = "";

  const titulo = document.createElement("div");
  titulo.textContent = `Posición por concejo — ${state.indicadorActual} (${state.añoActual}):`;
  titulo.style.margin = "10px 0 6px 0";
  titulo.style.fontWeight = "bold";
  cont.appendChild(titulo);

  // Línea con los enlaces
  const linea = document.createElement("div");
  linea.style.lineHeight = "1.6";

  concejos.forEach((nombre, i) => {
    const arr = datosAño?.[nombre]?.[state.indicadorActual];
    const pos = arr?.[1];

    // Link “clicable”
    const a = document.createElement("a");
    a.textContent = `${nombre}(${pos ?? "n/d"})`;
    a.href = "#ranking";
    a.style.cursor = "pointer";
    a.style.textDecoration = "underline";

    a.addEventListener("click", (ev) => {
      ev.preventDefault();

      // ir a ranking municipio
      state.modoActual = "ranking";
      state.rankingModo = "municipio";
      state.concejoActual = nombre;

      // sincronizar selects
      const rankingModoSelect = document.getElementById("rankingModoSelect");
      if (rankingModoSelect) rankingModoSelect.value = "municipio";

      const selectorConcejo = document.getElementById("concejoSelect");
      if (selectorConcejo) selectorConcejo.value = nombre;

      // dispara "actualizarVista" simulando click en botón ranking:
      document.getElementById("btn-ranking")?.click();

      document.getElementById("rankingPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    linea.appendChild(a);
    if (i < concejos.length - 1) linea.appendChild(document.createTextNode(", "));
  });

  cont.appendChild(linea);
}

function bindTooltipClose() {
  const tooltip = getTooltipEl();
  if (!tooltip) return;

  // Evita duplicar listeners si se llama más de una vez
  if (tooltip.dataset.boundClose === "1") return;
  tooltip.dataset.boundClose = "1";

  tooltip.addEventListener("click", (e) => {
    if (e.target.closest('[data-action="cerrar"]')) {
      e.preventDefault();
      cerrarInfo();
    }
  });
}

// =======================================================
// pintarMapa(state, { AST_KEY })
// =======================================================
// Pinta el mapa para el indicador y año actuales:
// 1) Cierra tooltip previo
// 2) Calcula min/max y rangos
// 3) Pinta leyenda
// 4) Recorre SVG y colorea cada concejo
// 5) Añade tooltip al mouseenter
// 6) Añade cierre del tooltip al salir del contenedor SVG
// 7) Pinta el ranking inline con posiciones
export function pintarMapa(state, { AST_KEY }) {
  bindTooltipClose()
  cerrarInfo();

  const invertido = esIndicadorInvertido(state.indicadorActual);

  if (!state.indicadorActual || !state.datosJSON || !state.añoActual) return;

  const datosAño = state.datosJSON[state.añoActual];

  const valores = Object.values(datosAño)
    .map(concejoObj => Number(concejoObj?.[state.indicadorActual]?.[0]))
    .filter(v => Number.isFinite(v));

  if (!valores.length) return;

  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const breaks = getBreaks5(min, max);

  clearLegend();
  renderLegendRangos({ indicadorActual: state.indicadorActual, min, max, invertido });

  document.querySelectorAll("svg a").forEach(a => {
    const municipio = a.getAttribute("title");
    const path = a.querySelector("path");

    const valor = datosAño[municipio]
      ? Number(datosAño[municipio]?.[state.indicadorActual]?.[0])
      : NaN;

    if (!path || !Number.isFinite(valor)) {
      if (path) path.style.fill = "transparent";
      return;
    }

  path.style.fill = colorPorRango5(valor, breaks, invertido);

  a.onmouseenter = (ev) => {
      ev.preventDefault();
      mostrarInfo(state.indicadorActual, municipio, valor, ev);
    };
  });

  // cerrar al salir del área svg contenedora
  const cont = document.querySelector('[data-role="mapa-svg"]');
  cont?.addEventListener("mouseleave", cerrarInfo, { once: true });

  renderListaConcejosPosicion(state, AST_KEY);
}

// Indicadores donde "más = mejor"
const INDICADORES_INVERTIDOS = new Set([
  normKeyLocal("Reciclaje de residuos (kg/persona)"),
  normKeyLocal("No consumo de alcohol en los últimos 12 meses (%)")
]);

function normKeyLocal(s) {
  return String(s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function esIndicadorInvertido(indicadorActual) {
  return INDICADORES_INVERTIDOS.has(normKeyLocal(indicadorActual));
}