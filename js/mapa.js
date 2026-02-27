export function initMapa(state) {
  // cerrar tooltip con botón
  document.addEventListener("click", (e) => {
    if (e.target.closest('[data-action="cerrar"]')) cerrarInfo();
  });

  // cerrar tooltip al salir del contenedor del mapa
  document.addEventListener("mouseover", () => {
    // nada aquí (placeholder si quieres ampliar)
  });
}

const PALETA_5 = ["#1a9850", "#66bd63", "#ffffbf", "#fdae61", "#d73027"];

function getTooltipEl() {
  return document.querySelector('aside[data-role="info"].tooltip');
}

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

function cerrarInfo() {
  const tooltip = getTooltipEl();
  if (!tooltip) return;
  tooltip.classList.remove("show");
}

function getBreaks5(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return [min, min, min, min, min, min];
  }
  const step = (max - min) / 5;
  return [min, min + step, min + 2*step, min + 3*step, min + 4*step, max];
}

function colorPorRango5(valor, breaks) {
  if (!Number.isFinite(valor)) return "transparent";
  if (valor <= breaks[1]) return PALETA_5[0];
  if (valor <= breaks[2]) return PALETA_5[1];
  if (valor <= breaks[3]) return PALETA_5[2];
  if (valor <= breaks[4]) return PALETA_5[3];
  return PALETA_5[4];
}

function getLegendContainer() {
  return document.querySelector('[data-leyenda="contenido"]');
}

function clearLegend() {
  const el = getLegendContainer();
  if (el) el.innerHTML = "";
}

function renderLegendRangos({ indicadorActual, min, max }) {
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

  const colors = ["#2E7D32","#7CB342","#FFF9C4","#F6B26B","#C62828"];
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

function renderListaConcejosPosicion(state, AST_KEY) {
  const cont = document.getElementById("rankingConcejos");
  if (!cont) return;

  if (!state.añoActual || !state.indicadorActual || !state.datosJSON?.[state.añoActual]) {
    cont.innerHTML = "";
    return;
  }

  const datosAño = state.datosJSON[state.añoActual];
  const concejos = Object.keys(datosAño).filter(c => c !== AST_KEY);

  cont.innerHTML = "";

  const titulo = document.createElement("div");
  titulo.textContent = `Posición por concejo — ${state.indicadorActual} (${state.añoActual}):`;
  titulo.style.margin = "10px 0 6px 0";
  titulo.style.fontWeight = "bold";
  cont.appendChild(titulo);

  const linea = document.createElement("div");
  linea.style.lineHeight = "1.6";

  concejos.forEach((nombre, i) => {
    const arr = datosAño?.[nombre]?.[state.indicadorActual];
    const pos = arr?.[1];

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

      // disparamos "actualizarVista" simulando click en botón ranking:
      document.getElementById("btn-ranking")?.click();

      document.getElementById("rankingPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    linea.appendChild(a);
    if (i < concejos.length - 1) linea.appendChild(document.createTextNode(", "));
  });

  cont.appendChild(linea);
}

export function pintarMapa(state, { AST_KEY }) {
  cerrarInfo();

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
  renderLegendRangos({ indicadorActual: state.indicadorActual, min, max });

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

    path.style.fill = colorPorRango5(valor, breaks);

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