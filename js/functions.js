let datosJSON = {};
let indicadorActual = null;
let añoActual = null;
let modoActual = "mapa";
let tipoGrafico = "bar";
let concejoActual = null;
let chart = null;

let rankingModo = "municipio";
let rankingMunicipio = null;
let concejosCache = [];  

const AST_KEY = "ASTURIAS / ASTURIES";

function getTooltipEl() {
  return document.querySelector('aside[data-role="info"].tooltip');
}

function mostrarInfo(municipio, valor, ev) {

  const tooltip = getTooltipEl();
  if (!tooltip) return;

  tooltip.querySelector('[data-info="nombre"]').textContent = municipio ?? "";
  tooltip.querySelector('[data-info="indicador"]').textContent = indicadorActual || "";
  tooltip.querySelector('[data-info="valor"]').textContent =
    (typeof valor === "number" && !isNaN(valor)) ? valor.toFixed(3) : "n/d";

  // Posicionar cerca del click
  if (ev && typeof ev.clientX === "number") {
    const margin = 12;

    // Se pone el tooltip en coordenadas de viewport
    tooltip.style.position = "fixed";
    tooltip.style.left = "0px";
    tooltip.style.top = "0px";

    // Primero se hace visible para medir tamaño
    tooltip.classList.add("show");
    const rect = tooltip.getBoundingClientRect();

    let x = ev.clientX + margin;
    let y = ev.clientY + margin;

    // Evitar que se salga por la derecha/abajo
    if (x + rect.width > window.innerWidth - margin) {
      x = ev.clientX - rect.width - margin;
    }
    if (y + rect.height > window.innerHeight - margin) {
      y = ev.clientY - rect.height - margin;
    }

    // Evitar valores negativos
    x = Math.max(margin, x);
    y = Math.max(margin, y);

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  } else {
    // Si no hay evento, se queda donde está 
    tooltip.classList.add("show");
  }

  tooltip.classList.add("show");
}

function cerrarInfo() {
  const tooltip = getTooltipEl();
  if (!tooltip) return;
  tooltip.classList.remove("show");
}


// Cierra tooltip con el botón data-action="cerrar"
document.addEventListener("click", (e) => {
  if (e.target.closest('[data-action="cerrar"]')) {
    cerrarInfo();
  }
});

// 5 colores: verde (bajo) -> amarillo (medio) -> rojo (alto)
const PALETA_5 = ["#1a9850", "#66bd63", "#ffffbf", "#fdae61", "#d73027"];

//  Devuelve Intervalos iguales para la leyenda
function getBreaks5(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return [min, min, min, min, min, min]; 
  }
  const step = (max - min) / 5;
  return [min, min + step, min + 2*step, min + 3*step, min + 4*step, max];
}

function colorPorRango5(valor, breaks) {
  // breaks = [b0,b1,b2,b3,b4,b5]
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

// Pinta los intervalos en la leyenda
function renderLegendRangos({ legend ,indicadorActual, min, max }) {
  if (!legend) legend = getLegendContainer();

  legend.innerHTML = "";

  const title = document.createElement("div");
  title.className = "legend-title";
  title.textContent = `${indicadorActual}`;
  legend.appendChild(title);

  const items = document.createElement("div");
  items.className = "legend-items";   // esto activa CSS flex
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

function renderListaConcejosPosicion() {
  const cont = document.getElementById("rankingConcejos");
  if (!cont) return;

  if (!añoActual || !indicadorActual || !datosJSON?.[añoActual]) {
    cont.innerHTML = "";
    return;
  }

  const datosAño = datosJSON[añoActual];
  const concejos = Object.keys(datosAño).filter(c => c !== AST_KEY);

  cont.innerHTML = "";

  const titulo = document.createElement("div");
  titulo.textContent = `Posición por concejo — ${indicadorActual} (${añoActual}):`;
  titulo.style.margin = "10px 0 6px 0";
  titulo.style.fontWeight = "bold";
  cont.appendChild(titulo);

  const linea = document.createElement("div");
  linea.style.lineHeight = "1.6";

  concejos.forEach((nombre, i) => {
    const arr = datosAño?.[nombre]?.[indicadorActual];
    const pos = arr?.[1];

    const a = document.createElement("a");
    a.textContent = `${nombre}(${pos ?? "n/d"})`;
    a.href = "#ranking";                 // ✅ evita ir a otra página
    a.style.cursor = "pointer";
    a.style.textDecoration = "underline";

    a.addEventListener("click", (ev) => {
      ev.preventDefault();

      // ✅ ir a ranking por municipio
      modoActual = "ranking";
      rankingModo = "municipio";
      concejoActual = nombre;

      // sincronizar selects si existen
      const rankingModoSelect = document.getElementById("rankingModoSelect");
      if (rankingModoSelect) rankingModoSelect.value = "municipio";

      const selectorConcejo = document.getElementById("concejoSelect");
      if (selectorConcejo) selectorConcejo.value = nombre;

      actualizarVista();

      // opcional: scroll al panel ranking si tienes un id
      document.getElementById("rankingPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    linea.appendChild(a);
    if (i < concejos.length - 1) linea.appendChild(document.createTextNode(", "));
  });

  cont.appendChild(linea);
}
function safeName(s) {
  return String(s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^0-9a-zA-Z]/g, "_")
    .replace(/^_+|_+$/g, "");
}

function fmt(x) {
  if (x === null || x === undefined || x === "") return "";
  if (typeof x === "number") return Number.isInteger(x) ? String(x) : x.toFixed(2);
  const n = Number(String(x).replace(",", "."));
  if (!Number.isNaN(n)) return Number.isInteger(n) ? String(n) : n.toFixed(2);
  return String(x);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normKey(s) {
  return String(s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Orden específico (incluyo Valoración Global al principio si existe)
const ORDEN_INDICADORES = [
  "Valoración Global",
  "Resultados",
  "Mortalidad",
  "Años potenciales de vida perdidos (APVP)",
  "Morbilidad",

  "Mala autopercepción de salud (%)",
  "Estado de salud",
  "Enfermedad crónica (%)",
  "Prevalencia de enfermos crónicos (%)",
  "Tratamiento por ansiedad/depresión (%)",
  "Ansiedad/Depresión",

  "Determinantes",
  "Calidad asistencial",
  "Urgencias hospitalarias (%)",
  "Cuidados inadecuados en diabetes (%)",
  "Ausencia de control mamográfico (%)",
  "\"Hospitalizaciones evitables\"(‰)",
  "Hospitalizaciones inadecuadas",
  "Demora quirúrgica",

  "Estilos de vida",
  "Consumo de tabaco (%)",
  "Prevalencia de fumadores/as (%)",
  "Sobrecarga ponderal (infantil) (%)",
  "Prevalencia de sobrecarga ponderal (%)",
  "Sedentarismo (%)",
  "Consumo inadecuado de frutas y verduras (%)",
  "Dieta inadecuada consumo frutas y verduras (%)",
  "Consumo excesivo de alcohol (%)",
  "Consumo de refrescos y comida rápida (%)",
  "Embarazo en adolescentes (‰)",
  "Seguridad vial: vehículos sin ITV (%)",

  "Factores socioeconómicos",
  "Nivel de estudios bajos (%)",
  "Desempleo (%)",
  "Clase social baja autopercibida (%)",
  "Nivel socioeconómico muy vulnerable",
  "Salario social básico (‰)",
  "Personas adultas sin soporte social (%)",
  "Familias monomarentales/parentales (%)",
  "Exclusión social (%)",

  "Calidad ambiental",
  "Reciclaje de residuos",
  "Nivel de contaminación del aire (puntos)",
  "Calidad ambiental residencial mala (%)",
];

// Filas que quieres resaltar como “títulos/secciones”
const TITULOS_RESALTAR = new Set([
  normKey("Valoración Global"),
  normKey("Resultados"),
  normKey("Determinantes"),
  normKey("Morbilidad"),
  normKey("Mortalidad"),
  normKey("Calidad asistencial"),
  normKey("Factores socioeconómicos"),
  normKey("Calidad Ambiental"),
  normKey("Estilos de vida"),
]);

const GRUPO_RESULTADOS = new Set([
  normKey("Mortalidad"),
  normKey("Años potenciales de vida perdidos (APVP)"),
  normKey("Mala autopercepción de salud (%)"),
  normKey("Estado de salud"),
  normKey("Tratamiento por ansiedad/depresión (%)"),
  normKey("Ansiedad/Depresión"),
  normKey("Enfermedad crónica (%)"),
  normKey("Prevalencia de enfermos crónicos (%)"),

]);

let menuIzqGrupo = "determinantes"; // "resultados" | "determinantes"

function getIndicadoresUIParaGrupo(año, grupo) {
  const all = getIndicadoresDisponibles(año);

  // quitamos títulos/secciones
  const base = all.filter(ind => !TITULOS_RESALTAR.has(normKey(ind)));

  if (grupo === "resultados") {
    return base.filter(ind => GRUPO_RESULTADOS.has(normKey(ind)));
  }

  // determinantes = base menos resultados
  return base.filter(ind => !GRUPO_RESULTADOS.has(normKey(ind)));
}

function repintarMenuIzq(grupo) {
  const selectorIndicador = document.getElementById("indicadorSelect");
  if (!selectorIndicador) return;

  const contRes = document.getElementById("lista-resultados");
  const contDet = document.getElementById("lista-determinantes");

  // elegimos contenedor destino
  const contenedor = (grupo === "resultados") ? contRes : contDet;
  if (!contenedor) return;

  const indicadoresUI = getIndicadoresUIParaGrupo(añoActual, grupo);

  contenedor.innerHTML = "";
  indicadoresUI.forEach(ind => {
    const div = document.createElement("div");
    div.textContent = ind;
    div.style.margin = "4px 0";
    div.style.cursor = "pointer";

    div.addEventListener("click", () => {
      indicadorActual = ind;
      selectorIndicador.value = ind;
      actualizarTituloIndicador();
      actualizarVista();
    });

    contenedor.appendChild(div);
  });
}

// IDs esperados en tu HTML:
// - <div id="rankingMunicipioContainer"></div>
// - <div id="rankingIndicadorContainer"></div>
// - <select id="indicadorSelect"></select>
//
// Y un control de modo que ponga rankingModo = "municipio" | "indicador"
// y llame a renderRanking() al cambiar.

function getIndicadoresDisponibles(año) {
  const data = datosJSON?.[año];
  if (!data) return [];

  // 1) sacar TODOS los indicadores reales del JSON (ese año)
  const reales = new Map(); // normKey -> display
  for (const obj of Object.values(data)) {
    if (!obj || typeof obj !== "object") continue;
    for (const k of Object.keys(obj)) {
      const nk = normKey(k);
      if (!reales.has(nk)) reales.set(nk, k);
    }
  }

  // 2) ordenar usando ORDEN_INDICADORES como prioridad (si existen)
  const ordered = [];
  const used = new Set();

  for (const k of ORDEN_INDICADORES) {
    const nk = normKey(k);
    if (reales.has(nk)) {
      ordered.push(reales.get(nk));
      used.add(nk);
    }
  }

  // 3) añadir el resto (solo los reales) al final
  for (const [nk, display] of reales.entries()) {
    if (!used.has(nk)) ordered.push(display);
  }

  return ordered;
}

function ensureIndicadorSelector() {
  const sel = document.getElementById("indicadorSelect");
  if (!sel) return null;

  // si ya está lleno para ese año, no lo repoblamos (simple)
  // si necesitas repoblar cuando cambie año, limpia antes
  if (sel.dataset.year === String(añoActual) && sel.options.length > 0) return sel;

  sel.innerHTML = "";
  const indicadores = getIndicadoresDisponibles(añoActual);
  for (const ind of indicadores) {
    const opt = document.createElement("option");
    opt.value = ind;
    opt.textContent = ind;
    sel.appendChild(opt);
  }
  sel.dataset.year = String(añoActual);

  // si no hay indicador seleccionado, ponemos el primero válido
  if (!window.rankingIndicador || !indicadores.some(i => normKey(i) === normKey(window.rankingIndicador))) {
    window.rankingIndicador = indicadores[0] ?? null;
    if (window.rankingIndicador) sel.value = window.rankingIndicador;
  } else {
    sel.value = window.rankingIndicador;
  }

  // evento change
  sel.onchange = () => {
    window.rankingIndicador = sel.value;
    renderRanking();
  };

  return sel;
}

function renderTablaMunicipio(container, mun, datosMun, datosAst) {
  container.innerHTML = "";

  const h2 = document.createElement("h2");
  h2.textContent = mun;
  container.appendChild(h2);

  const munIndex = new Map(Object.entries(datosMun).map(([k, v]) => [normKey(k), { k, v }]));
  const astIndex = new Map(Object.entries(datosAst).map(([k, v]) => [normKey(k), { k, v }]));

  const table = document.createElement("table");
  table.className = "tabla-ranking";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Indicador</th>
        <th>Valor</th>
        <th>Valor de Asturias</th>
        <th>Posición</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");

  const filas = [];
  const usados = new Set();

  // orden canónico
  for (const key of ORDEN_INDICADORES) {
    const nk = normKey(key);
    const munEntry = munIndex.get(nk);
    const astEntry = astIndex.get(nk);
    if (!munEntry && !astEntry) continue;

    usados.add(nk);

    const arrMun = munEntry?.v;
    const arrAst = astEntry?.v;

    filas.push({
      indicador: munEntry?.k ?? astEntry?.k ?? key,
      valor: Array.isArray(arrMun) ? arrMun[0] : (arrMun?.valor ?? ""),
      posicion: Array.isArray(arrMun) ? arrMun[1] : (arrMun?.posicion ?? ""),
      valorAsturias: Array.isArray(arrAst) ? arrAst[0] : (arrAst?.valor ?? ""),
    });
  }

  // resto
  for (const [indicador, arr] of Object.entries(datosMun)) {
    const nk = normKey(indicador);
    if (usados.has(nk)) continue;

    const astEntry = astIndex.get(nk);
    const arrAst = astEntry?.v;

    filas.push({
      indicador,
      valor: Array.isArray(arr) ? arr[0] : (arr?.valor ?? ""),
      posicion: Array.isArray(arr) ? arr[1] : (arr?.posicion ?? ""),
      valorAsturias: Array.isArray(arrAst) ? arrAst[0] : (arrAst?.valor ?? ""),
    });
  }

  for (const f of filas) {
    const tr = document.createElement("tr");
    const isTitulo = TITULOS_RESALTAR.has(normKey(f.indicador));
    if (isTitulo) tr.classList.add("fila-seccion");

    tr.innerHTML = `
      <td>${escapeHtml(f.indicador)}</td>
      <td>${isTitulo ? "" : escapeHtml(fmt(f.valor))}</td>
      <td>${isTitulo ? "" : escapeHtml(fmt(f.valorAsturias))}</td>
      <td>${escapeHtml(fmt(f.posicion))}</td>
    `;
    tbody.appendChild(tr);
  }

  container.appendChild(table);
}

function renderTablaIndicador(container, indicadorSeleccionado, datosAño) {
  container.innerHTML = "";

  const h2 = document.createElement("h2");
  h2.textContent = `Indicador: ${indicadorSeleccionado}`;
  container.appendChild(h2);

  const table = document.createElement("table");
  table.className = "tabla-ranking";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Concejo</th>
        <th>Valor</th>
        <th>Posición</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");

  const nkSel = normKey(indicadorSeleccionado);

  // Construir filas (mantiene el orden del JSON tal como venga; si tu JSON ya viene en orden Excel, esto respeta ese orden)
  const filas = [];
  for (const [concejo, obj] of Object.entries(datosAño)) {
    if (!obj || typeof obj !== "object") continue;

    // matching exacto o normalizado
    let arr = obj[indicadorSeleccionado];
    if (!arr) {
      const found = Object.entries(obj).find(([k]) => normKey(k) === nkSel);
      if (found) arr = found[1];
    }

    if (!Array.isArray(arr)) continue;

    filas.push({
      concejo,
      valor: arr[0],
      posicion: arr[1],
    });
  }

  for (const f of filas) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(f.concejo)}</td>
      <td>${escapeHtml(fmt(f.valor))}</td>
      <td>${escapeHtml(fmt(f.posicion))}</td>
    `;
    tbody.appendChild(tr);
  }

  container.appendChild(table);
}

function renderRanking() {
  const contMun = document.getElementById("rankingMunicipioContainer");
  const contInd = document.getElementById("rankingIndicadorContainer");

  if (!añoActual || !datosJSON?.[añoActual]) {
    if (contMun) contMun.innerHTML = "";
    if (contInd) contInd.innerHTML = "";
    return;
  }

  const datosAño = datosJSON[añoActual];

  if (rankingModo === "municipio") {
    if (contInd) contInd.innerHTML = "";
    if (!contMun) return;

    const mun = concejoActual || (concejosCache?.[0] ?? null);
    if (!mun) return;

    const datosMun = datosAño?.[mun];
    if (!datosMun) {
      contMun.innerHTML = `<p>No hay datos para ${escapeHtml(mun)} en ${escapeHtml(añoActual)}.</p>`;
      return;
    }

    const AST_KEY = "ASTURIAS / ASTURIES";
    const datosAst = datosAño?.[AST_KEY] || {};

    renderTablaMunicipio(contMun, mun, datosMun, datosAst);
    return;
  }

  if (rankingModo === "indicador") {
    if (contMun) contMun.innerHTML = "";
    if (!contInd) return;

    // ✅ asegura que el selector existe y actualiza window.rankingIndicador
    ensureIndicadorSelector();

    const indicador = window.rankingIndicador || indicadorActual;
    if (!indicador) {
      contInd.innerHTML = "<p>No hay indicador seleccionado.</p>";
      return;
    }

    renderTablaIndicador(contInd, indicador, datosAño);
    return;
  }
}


// Pinta el mapa
function pintarMapa() {
  if (!indicadorActual || !datosJSON || !añoActual) return;

  const datosAño = datosJSON[añoActual];

  // Valores numéricos válidos del indicador 
  const valores = Object.values(datosAño)
    .map(concejoObj => Number(concejoObj?.[indicadorActual]?.[0]))
    .filter(v => Number.isFinite(v));

  if (valores.length === 0) return;

  const min = Math.min(...valores);
  const max = Math.max(...valores);

  // breaks para 5 intervalos y leyenda dinámica
  const breaks = getBreaks5(min, max);
  clearLegend();
  renderLegendRangos({indicadorActual, min, max });

  document.querySelectorAll("svg a").forEach(a => {
    const municipio = a.getAttribute("title");
    const path = a.querySelector("path");

    const valor = datosAño[municipio]
    ? Number(datosAño[municipio]?.[indicadorActual]?.[0])
    : NaN;

    if (!path || !Number.isFinite(valor)) {
      path && (path.style.fill = "transparent");
      return;
    }

    //llena el área con el color que correspona
    path.style.fill = colorPorRango5(valor, breaks);

    //cuando pasas por encima se actualiza
    a.onmouseenter = (ev) => {
      ev.preventDefault();
      mostrarInfo(municipio, valor, ev);
    };
  });

  cerrarInfo();
}

//Actualiza el título de arriba del mapa/gráfico
function actualizarTituloIndicador() {
  const h1 = document.getElementById("tituloIndicador");
  if (!h1) return;

  h1.textContent = indicadorActual
    ? indicadorActual
    : "Determinantes de salud";
}

//En los gráficos se parte el nombre en filas para que se lea entero
function wrapLabel(text, maxChars = 18) {
  const words = String(text).split(" ");
  const lines = [];
  let line = "";

  for (const w of words) {
    const test = (line ? line + " " : "") + w;
    if (test.length > maxChars) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}



function pintarGrafico() {
  cerrarInfo();

  const canvas = document.getElementById("graficoCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  let labels = [];
  let data = [];

  if (!indicadorActual || !datosJSON) return;

  if (tipoGrafico === "line") {
    // Años en el eje X
    labels = Object.keys(datosJSON);

    data = labels.map(año => {
      const arr = datosJSON?.[año]?.[concejoActual]?.[indicadorActual]; // [valor, pos]
      const valor = Number(arr?.[0]);
      return Number.isFinite(valor) ? valor : 0;
    });

  } else if (tipoGrafico === "bar") {
    const datosAño = datosJSON?.[añoActual];
    if (!datosAño) return;

    // Concejos en el eje X (orden original del JSON)
    labels = Object.keys(datosAño);

    data = labels.map(mun => {
      const arr = datosAño?.[mun]?.[indicadorActual]; // [valor, pos]
      const valor = Number(arr?.[0]);
      return Number.isFinite(valor) ? valor : 0;
    });

  } else {
    console.warn("Tipo de gráfico no permitido:", tipoGrafico);
    return;
  }

  if (chart) chart.destroy();

  // Media solo para barras (ignorando NaN)
  let media = null;
  if (tipoGrafico === "bar") {
    const valoresValidos = data.filter(v => Number.isFinite(v));
    media = valoresValidos.length
      ? valoresValidos.reduce((a, b) => a + b, 0) / valoresValidos.length
      : null;
  }

  const tituloY = wrapLabel("Porcentaje de " + indicadorActual, 24);

  chart = new Chart(ctx, {
    type: tipoGrafico,
    data: {
      labels,
      datasets: [{
        label: indicadorActual,
        data,
        backgroundColor: tipoGrafico === "bar"
          ? data.map(v => `rgb(0,${Math.round(100 + 155 * (v / Math.max(...data.filter(x=>x>0), 1)))},0)`)
          : "rgba(0, 150, 200, 0.5)",
        borderColor: tipoGrafico === "line" ? "rgba(0,150,200,1)" : undefined,
        borderWidth: tipoGrafico === "line" ? 2 : 1,
        fill: tipoGrafico === "line" ? false : undefined
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#000", font: { size: 13 } } }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: tipoGrafico === "bar" ? "Municipio" : "Año",
            color: "#000",
            font: { size: 14, weight: "bold" }
          }
        },
        y: {
          title: { display: true, text: tituloY, color: "#000", font: { size: 14, weight: "bold" } },
          beginAtZero: true
        }
      }
    },
    plugins: (tipoGrafico === "bar" && media !== null) ? [{
      id: "mediaLine",
      afterDraw(chart) {
        const { ctx, chartArea: { top, left, right }, scales: { y } } = chart;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(left, y.getPixelForValue(media));
        ctx.lineTo(right, y.getPixelForValue(media));
        ctx.lineWidth = 2;
        ctx.strokeStyle = "red";
        ctx.setLineDash([6, 3]);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = "red";
        ctx.textAlign = "center";
        ctx.fillText(`Media: ${media.toFixed(2)}`, (left + right) / 2, top + 14);
        ctx.restore();
      }
    }] : []
  });
}


//esta funciín se llama cada vez que se cambia un selector (indicador, año, representació...)
function actualizarVista() {
  const leyenda = document.querySelector('[data-role="leyenda"]');
  const rankingInline = document.getElementById("rankingConcejos");
  const rankingPanel = document.getElementById("rankingPanel");

  const modoWrap = document.getElementById("modoSelectWrap");
  const rankingModoWrap = document.getElementById("rankingModoWrap");
  const concejoWrap = document.getElementById("concejoWrap");
  const indicadorWrap = document.getElementById("indicadorWrap");

  const setDisp = (el, val) => { if (el) el.style.display = val; };
  const setDispId = (id, val) => { const el = document.getElementById(id); if (el) el.style.display = val; };

  // ====== RANKING ======
  if (modoActual === "ranking") {
    // ocultar mapa/gráficos
    setDispId("mapaContainer", "none");
    setDispId("graficoContainer", "none");
    if (leyenda) leyenda.style.display = "none";
    if (rankingInline) rankingInline.style.display = "none";

    // mostrar panel ranking
    if (rankingPanel) rankingPanel.style.display = "block";

    // título
    const h1 = document.getElementById("tituloIndicador");
    if (h1) h1.textContent = "Ranking";

    // controles visibles en ranking:
    setDisp(modoWrap, "none");          // no tiene sentido mapa/bar/line
    setDisp(rankingModoWrap, "block");  // sí

    if (rankingModo === "municipio") {
      setDisp(concejoWrap, "block");
      setDisp(indicadorWrap, "none");
    } else {
      setDisp(concejoWrap, "none");
      setDisp(indicadorWrap, "block");
    }

    renderRanking();
    return;
  }

  // ====== MAPA / GRÁFICOS ======
  if (rankingPanel) rankingPanel.style.display = "none";

  // ✅ al salir de ranking, recuperar el título del indicador actual
  actualizarTituloIndicador();

  // controles visibles en vistas normales:
  setDisp(rankingModoWrap, "none"); // no estamos en ranking
  setDisp(indicadorWrap, "none");   // el indicador se elige en menú izq
  setDisp(modoWrap, "block");       // mapa/bar/line

  if (modoActual === "mapa") {
    setDispId("mapaContainer", "block");
    setDispId("graficoContainer", "none");
    setDisp(concejoWrap, "none"); // en mapa no hace falta concejo
    if (leyenda) leyenda.style.display = "flex";
    if (rankingInline) rankingInline.style.display = "block";

    pintarMapa();
    renderListaConcejosPosicion();
  } else {
    setDispId("mapaContainer", "none");
    setDispId("graficoContainer", "block");
    if (leyenda) leyenda.style.display = "none";
    if (rankingInline) rankingInline.style.display = "none";

    tipoGrafico = modoActual;

    if (tipoGrafico === "line") {
      setDisp(concejoWrap, "block"); // evolución sí necesita municipio
    } else {
      setDisp(concejoWrap, "none");  // barras no
    }

    setTimeout(() => pintarGrafico(), 50);
  }
}



function repintarIndicadoresUI() {
  const selectorIndicador = document.getElementById("indicadorSelect");
  if (!selectorIndicador) return;

  const indicadoresAll = getIndicadoresDisponibles(añoActual);
  const indicadoresUI = indicadoresAll.filter(ind => !TITULOS_RESALTAR.has(normKey(ind)));

  // --- selector (global) ---
  selectorIndicador.innerHTML = "";
  indicadoresUI.forEach(ind => {
    const opt = document.createElement("option");
    opt.value = ind;
    opt.textContent = ind;
    selectorIndicador.appendChild(opt);
  });

  // mantener indicadorActual si existe; si no, poner el primero
  const existe = indicadoresUI.some(i => normKey(i) === normKey(indicadorActual));
  indicadorActual = existe ? indicadorActual : (indicadoresUI[0] ?? null);
  selectorIndicador.value = indicadorActual ?? "";

  // --- menú izq (por grupo actual) ---
  repintarMenuIzq("resultados");
  repintarMenuIzq("determinantes");
}

//Cuando se carga el documento
document.addEventListener("DOMContentLoaded", () => {
  const selectorAño = document.getElementById("añoSelect");
  const selectorIndicador = document.getElementById("indicadorSelect");
  const selectorModo = document.getElementById("modoSelect");
  const selectorConcejo = document.getElementById("concejoSelect");

  const btnDet = document.getElementById("btn-determinantes");
  const listaDet = document.getElementById("lista-determinantes");

  const btnRanking = document.getElementById("btn-ranking");
  const rankingModoSelect = document.getElementById("rankingModoSelect");

  const btnRes = document.getElementById("btn-resultados");
  const listaRes = document.getElementById("lista-resultados");


  btnRes.addEventListener("click", () => {
    const abierto = listaRes.style.display === "block";
    listaRes.style.display = abierto ? "none" : "block";
    modoActual = "mapa";
    actualizarVista();
  });

  // Click en Ranking
  btnRanking.addEventListener("click", () => {
    modoActual = "ranking";
    actualizarVista();
  });

  // Cambiar modo ranking
  rankingModoSelect.addEventListener("change", (e) => {
    rankingModo = e.target.value;

    // al cambiar modo, fuerza visibilidad correcta
    actualizarVista();
  });

  // Click en Determinantes (volver a mapa)
  btnDet.addEventListener("click", () => {
    const abierto = listaDet.style.display === "block";
    listaDet.style.display = abierto ? "none" : "block";
    modoActual = "mapa";
    actualizarVista();
  });

  // Cambiar modo mapa/bar/line
  selectorModo.addEventListener("change", e => {
    modoActual = e.target.value;
    actualizarVista();
  });

  selectorConcejo.addEventListener("change", e => {
    concejoActual = e.target.value;

    // solo tiene sentido repintar si estamos en ranking municipio
    if (modoActual === "ranking" && rankingModo === "municipio") {
      renderRanking();   // o actualizarVista(), pero esto es más directo
    }
  });

  // Cargar mapa
  fetch("archivos_de_interes/mapasvg.xml")
    .then(r => r.text())
    .then(svg => {
      const cont = document.querySelector('[data-role="mapa-svg"]');
      cont.innerHTML = svg;

      pintarMapa();

      // ✅ cerrar tooltip al salir del mapa
      cont.addEventListener("mouseleave", () => {
        cerrarInfo();
      });
    });

  // Cargar JSON
  // Cargar JSON
fetch("JSONsGenerados/pruebaAños.json")
  .then(r => r.json())
  .then(datos => {
    datosJSON = datos;

    const selectorAño = document.getElementById("añoSelect");
    const selectorConcejo = document.getElementById("concejoSelect");

    const años = Object.keys(datosJSON);
    if (!años.length) return;

    // Año por defecto (último)
    añoActual = años[años.length - 1];

    // Pintar selector de años
    selectorAño.innerHTML = "";
    años.forEach(a => {
      const opt = document.createElement("option");
      opt.value = a;
      opt.textContent = a;
      selectorAño.appendChild(opt);
    });
    selectorAño.value = añoActual;

    // Concejos del año inicial (sin Asturias)
    const concejos = Object.keys(datosJSON[añoActual] || {}).filter(c => c !== AST_KEY);
    concejosCache = concejos.slice();

    selectorConcejo.innerHTML = "";
    concejos.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      selectorConcejo.appendChild(opt);
    });

    concejoActual = concejos[0] ?? null;
    selectorConcejo.value = concejoActual ?? "";

    // ✅ Repintar indicadores (selector + columna izquierda) desde el JSON de ese año
    repintarIndicadoresUI();

    // Arranque
    actualizarTituloIndicador();
    actualizarVista();

    // ====== Eventos ======
    selectorAño.addEventListener("change", e => {
      añoActual = e.target.value;

      // Repintar concejos del nuevo año
      const concejosNuevo = Object.keys(datosJSON[añoActual] || {}).filter(c => c !== AST_KEY);
      concejosCache = concejosNuevo.slice();

      selectorConcejo.innerHTML = "";
      concejosNuevo.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        selectorConcejo.appendChild(opt);
      });

      concejoActual = concejosNuevo[0] ?? null;
      selectorConcejo.value = concejoActual ?? "";

      // ✅ Repintar indicadores del nuevo año
      repintarIndicadoresUI();

      actualizarTituloIndicador();
      actualizarVista();
    });
  });
});