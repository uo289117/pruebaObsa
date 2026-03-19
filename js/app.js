import { pintarMapa } from "./mapa.js";
import { pintarGrafico } from "./grafico.js";
import { renderRanking, ensureIndicadorSelector } from "./ranking.js";

let datosJSON = {};
let indicadorActual = null;
let añoActual = null;
let modoActual = "mapa";     // "mapa" | "bar" | "line" | "ranking"
let tipoGrafico = "bar";
let concejoActual = null;
let chart = null;

let rankingModo = "municipio"; // "municipio" | "indicador"
let concejosCache = [];

let rankingIndicador = null; // persistente
let ultimoModoNormal = "mapa"; // recuerda mapa/bar/line

const AST_KEY = "ASTURIAS / ASTURIES";  

// ===== helpers =====

//Normaliza claves de texto
function normKey(s) {
  return String(s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

//formato de valores
function fmt(x) {
  if (x === null || x === undefined || x === "") return "";
  if (typeof x === "number") return Number.isInteger(x) ? String(x) : x.toFixed(2);
  const n = Number(String(x).replace(",", "."));
  if (!Number.isNaN(n)) return Number.isInteger(n) ? String(n) : n.toFixed(2);
  return String(x);
}


// Escapa texto para insertarlo como HTML sin riesgo de inyección
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

//Divide labels largos para los ejes y leyendas
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

// ===== config =====
const INDICADOR_GLOBAL = "Valoración Global";

// Lista de indicadores que se consideran del bloque "Resultados".
const ORDEN_RESULTADOS = [
  "Resultados",
  "Mortalidad",
  "Años potenciales de vida perdidos (APVP)",
  "Mortalidad (tasa ponderada)",
  "Morbilidad",
  "Mala autopercepción de salud (%)",
  "Estado de salud (%)",
  "Enfermedad crónica (%)",
  "Prevalencia de enfermos crónicos (%)",
  "Consumo de ansiolíticos y/o antidepresivos (%)",
  "Ansiedad/Depresión (%)",
];

// Lista de indicadores que se consideran del bloque "Determinantes".
const ORDEN_DETERMINANTES = [
  "Determinantes",
  "Calidad asistencial",
  "Urgencias hospitalarias en el último año (%)",
  "Cuidados inadecuados en diabetes (%)",
  "Ausencia de control mamográfico (%)",
  "Hospitalizaciones potencialmente evitables (‰)",
  "Hospitalizaciones inadecuadas (‱)",
  "Demora quirúrgica (días)",

  "Estilos de vida",
  "Consumo de tabaco (%)",
  "Prevalencia de fumadores/as (%)",
  "Sobrecarga ponderal (infantil) (%)",
  "Prevalencia de sobrecarga ponderal (%)",
  "Sedentarismo (%)",
  "Consumo inadecuado de frutas y/o verduras (%)",
  "Dieta inadecuada consumo frutas y verduras (%)",
  "No consumo de alcohol en los últimos 12 meses (%)",
  "Consumo excesivo alcohol (%)",
  "Consumo de refrescos y/o comida rápida (%)",
  "Embarazo en adolescentes (‰)",
  "Seguridad vial: vehículos sin ITV (%)",
  "Seguridad vial inadecuada (%)",
  "Seguridad vial antigüedad (%)",

  "Factores socioeconómicos",
  "Nivel educativo básico (primaria o secundaria) (%)",
  "Desempleo (%)",
  "Clase social baja autopercibida (%)",
  "Nivel socioeconómico muy vulnerable (%)",
  "Salario social básico (%)",
  "Personas adultas sin soporte social (%)",
  "Familias monomarentales/parentales (%)",
  "Exclusión social (%)",

  "Calidad ambiental",
  "Reciclaje de residuos (kg/persona)",
  "Calidad del aire (indicador compuesto)",
  "Calidad ambiental residencial mala (%)",
];

//lista global
const ORDEN_INDICADORES = [
  INDICADOR_GLOBAL,
  ...ORDEN_RESULTADOS,
  ...ORDEN_DETERMINANTES,
];

// conjunto de títulos que se han de ver de forma distinta
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

const TITULOS_OCULTAR_MENU = new Set([
  normKey("Valoración Global"),
  normKey("Resultados"),
  normKey("Determinantes"),
]);

// set de indicadores que pertenecen al bloque "Resultados"
const GRUPO_RESULTADOS = new Set([
  ...ORDEN_RESULTADOS.map(normKey),
]);


// Devuelve la lista de indicadores realmente presentes en el JSON para ese año,
// con el orden preferido:
function getIndicadoresDisponibles(año) {
  const data = datosJSON?.[año];
  if (!data) return [];

  // Recolecta TODOS los nombres de indicadores que existen en el JSON ese año.
  const reales = new Map(); 
  for (const obj of Object.values(data)) {
    if (!obj || typeof obj !== "object") continue;
    for (const k of Object.keys(obj)) {
      const nk = normKey(k);
      if (!reales.has(nk)) reales.set(nk, k);
    }
  }


  const ordered = [];
  const used = new Set();
  const ordenTotal = [INDICADOR_GLOBAL, ...ORDEN_RESULTADOS, ...ORDEN_DETERMINANTES];

  // 1) Añade los que están en el orden ideal y existen realmente en el JSON
  for (const k of ordenTotal) {
    const nk = normKey(k);
    if (reales.has(nk)) {
      ordered.push(reales.get(nk));
      used.add(nk);
    }
  }

  // 2) Añade el resto que no estaban en tu orden ideal
  for (const [nk, display] of reales.entries()) {
    if (!used.has(nk)) ordered.push(display);
  }
  return ordered;
}

// ===== estado único que se pasa a módulos =====
function getState() {
  return {
    datosJSON,
    indicadorActual,
    añoActual,
    modoActual,
    tipoGrafico,
    concejoActual,
    chart,
    rankingModo,
    rankingIndicador,
    concejosCache,
  };
}

function setState(patch) {
  if ("datosJSON" in patch) datosJSON = patch.datosJSON;
  if ("indicadorActual" in patch) indicadorActual = patch.indicadorActual;
  if ("añoActual" in patch) añoActual = patch.añoActual;
  if ("modoActual" in patch) modoActual = patch.modoActual;
  if ("tipoGrafico" in patch) tipoGrafico = patch.tipoGrafico;
  if ("concejoActual" in patch) concejoActual = patch.concejoActual;
  if ("chart" in patch) chart = patch.chart;
  if ("rankingModo" in patch) rankingModo = patch.rankingModo;
  if ("rankingIndicador" in patch) rankingIndicador = patch.rankingIndicador;
  if ("concejosCache" in patch) concejosCache = patch.concejosCache;
}

// Actualiza el H1 superior con el indicador actual
function actualizarTituloIndicador() {
  const h1 = document.getElementById("tituloIndicador");
  if (!h1) return;
  h1.textContent = indicadorActual ? indicadorActual : "Determinantes de salud";
}

// ===== VISTA =====
function actualizarVista() {
  if (modoActual !== "ranking") {
    ultimoModoNormal = modoActual; // recuerda el último modo mapa/barras
  }
  const leyenda = document.querySelector('[data-role="leyenda"]');
  const rankingInline = document.getElementById("rankingConcejos");
  const rankingPanel = document.getElementById("rankingPanel");


  const modoWrap = document.getElementById("modoSelectWrap");
  const rankingModoWrap = document.getElementById("rankingModoWrap");
  const concejoWrap = document.getElementById("concejoWrap");
  const indicadorWrap = document.getElementById("indicadorWrap");

  const setDisp = (el, val) => { if (el) el.style.display = val; };
  const setDispId = (id, val) => { const el = document.getElementById(id); if (el) el.style.display = val; };

  const state = getState();
  const deps = {
    AST_KEY,
    ORDEN_INDICADORES,
    TITULOS_RESALTAR,
    GRUPO_RESULTADOS,
    normKey,
    fmt,
    escapeHtml,
    wrapLabel,
    getIndicadoresDisponibles,
    onStatePatch: setState,
    actualizarVista,
  };

  // ====== RANKING ======
  if (modoActual === "ranking") {
    setDispId("mapaContainer", "none");
    setDispId("graficoContainer", "none");
    if (leyenda) leyenda.style.display = "none";
    if (rankingInline) rankingInline.style.display = "none";
    if (rankingPanel) rankingPanel.style.display = "block";

    const h1 = document.getElementById("tituloIndicador");
    if (h1) h1.textContent = "Ranking";

    setDisp(modoWrap, "none");
    setDisp(rankingModoWrap, "block");

    if (rankingModo === "municipio") {
      setDisp(concejoWrap, "block");
      setDisp(indicadorWrap, "none");
    } else {
      setDisp(concejoWrap, "none");
      setDisp(indicadorWrap, "block");
    }

    //el selector de indicadores del ranking se pinta aquí
    ensureIndicadorSelector(state, deps);
    renderRanking(state, deps);

    return;
  }

  // ====== MAPA / GRÁFICOS ======
  if (rankingPanel) rankingPanel.style.display = "none";
  actualizarTituloIndicador();

  setDisp(rankingModoWrap, "none");
  setDisp(indicadorWrap, "none");
  setDisp(modoWrap, "block");

  if (modoActual === "mapa") {
    setDispId("mapaContainer", "block");
    setDispId("graficoContainer", "none");
    setDisp(concejoWrap, "none");
    if (leyenda) leyenda.style.display = "flex";
    if (rankingInline) rankingInline.style.display = "block";

    pintarMapa(getState(), deps);
  } else {
    setDispId("mapaContainer", "none");
    setDispId("graficoContainer", "block");
    if (leyenda) leyenda.style.display = "none";
    if (rankingInline) rankingInline.style.display = "none";

    tipoGrafico = modoActual;

    if (tipoGrafico === "line") setDisp(concejoWrap, "block");
    else setDisp(concejoWrap, "none");

    setTimeout(() => {
      const st = getState();
      pintarGrafico(st, deps);
      setState({ chart: st.chart });
    }, 50);
  }
}

// repintarMenuIzq(grupo):
// - grupo = "resultados" o "determinantes"
// - construye la lista HTML correspondiente (#lista-resultados o #lista-determinantes)
// - al clickar un indicador: lo selecciona y fuerza modo mapa
function repintarMenuIzq(grupo) {
  const contRes = document.getElementById("lista-resultados");
  const contDet = document.getElementById("lista-determinantes");
  const contenedor = (grupo === "resultados") ? contRes : contDet;
  if (!contenedor) return;

  const all = getIndicadoresDisponibles(añoActual);

  // 1) solo con los del grupo (incluyendo títulos), PERO
  // 2) ocultar en el menú: Valoración Global / Resultados / Determinantes
  const indicadoresUI = all
    .filter(ind => !TITULOS_OCULTAR_MENU.has(normKey(ind)))
    .filter(ind => {
      const nk = normKey(ind);
      if (grupo === "resultados") return GRUPO_RESULTADOS.has(nk);
      return !GRUPO_RESULTADOS.has(nk);
    });

  contenedor.innerHTML = "";

  indicadoresUI.forEach(ind => {
    const nk = normKey(ind);
    const esTitulo = TITULOS_RESALTAR.has(nk);

    const div = document.createElement("div");
    div.textContent = ind;
    div.style.margin = "4px 0";

    if (esTitulo) {
      // Separador: negrita y NO clicable
      div.style.fontWeight = "700";
      div.style.cursor = "default";
      div.style.opacity = "0.9";
      div.style.marginTop = "10px";
      div.style.pointerEvents = "none";
    } else {
      // Indicador clicable (mantiene el modo actual: mapa/bar/line)
      div.style.cursor = "pointer";

      div.addEventListener("click", () => {
        indicadorActual = ind;

        //Si estás en ranking, vuelve al último modo (mapa/bar/line)
        if (modoActual === "ranking") {
          modoActual = ultimoModoNormal || "mapa";
        }

        actualizarTituloIndicador();
        actualizarVista();
      });
    }

    contenedor.appendChild(div);
  });
}
// Repinta ambos listados del menú izquierdo
function repintarIndicadoresUI() {
  repintarMenuIzq("resultados");
  repintarMenuIzq("determinantes");
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  const selectorAño = document.getElementById("añoSelect");
  const selectorModo = document.getElementById("modoSelect");
  const selectorConcejo = document.getElementById("concejoSelect");

  const btnDet = document.getElementById("btn-determinantes");
  const listaDet = document.getElementById("lista-determinantes");

  const btnRanking = document.getElementById("btn-ranking");
  const rankingModoSelect = document.getElementById("rankingModoSelect");

  const btnRes = document.getElementById("btn-resultados");
  const listaRes = document.getElementById("lista-resultados");

  btnRes?.addEventListener("click", () => {
    const abierto = listaRes.style.display === "block";
    listaRes.style.display = abierto ? "none" : "block";
    // modoActual = "mapa";  // <- quitar
    actualizarVista();
  });

  btnDet?.addEventListener("click", () => {
    const abierto = listaDet.style.display === "block";
    listaDet.style.display = abierto ? "none" : "block";
    // modoActual = "mapa";  // <- quitar
    actualizarVista();
  });

  btnRanking?.addEventListener("click", () => {
    modoActual = "ranking";
    actualizarVista();
  });

  rankingModoSelect?.addEventListener("change", (e) => {
    rankingModo = e.target.value;
    actualizarVista();
  });

  selectorModo?.addEventListener("change", e => {
    modoActual = e.target.value;
    actualizarVista();
  });

  selectorConcejo?.addEventListener("change", e => {
    concejoActual = e.target.value;
    if (modoActual === "ranking" && rankingModo === "municipio") {
      actualizarVista();
    }
  });

  // SVG
  fetch("archivos_de_interes/mapasvg.xml")
    .then(r => r.text())
    .then(svg => {
      const cont = document.querySelector('[data-role="mapa-svg"]');
      if (cont) cont.innerHTML = svg;
    });

  // JSON
  fetch("JSONsGenerados/pruebaAños.json")
    .then(r => r.json())
    .then(datos => {
      datosJSON = datos;

      const años = Object.keys(datosJSON);
      if (!años.length) return;

      //toma el ultimo año por defecto y pinta el selector
      añoActual = años[años.length - 1];

      selectorAño.innerHTML = "";
      años.forEach(a => {
        const opt = document.createElement("option");
        opt.value = a;
        opt.textContent = a;
        selectorAño.appendChild(opt);
      });
      selectorAño.value = añoActual;

      //toma el primer concejo por defecto y pinta el selector
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

      // indicador inicial
      const indsInit = getIndicadoresDisponibles(añoActual);
      const ind0 = indsInit.find(x => !TITULOS_RESALTAR.has(normKey(x))) ?? null;
      indicadorActual = ind0;

      repintarIndicadoresUI();
      actualizarTituloIndicador();
      actualizarVista();


      //cuando se cambia de año, se recalculan concejos e indicadores y se repinta todo 
      //lo que depende del año
      selectorAño.addEventListener("change", e => {
        añoActual = e.target.value;

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

        // cambia el indicador si ya no existe para ese año
        const inds = getIndicadoresDisponibles(añoActual);
        if (!inds.some(x => normKey(x) === normKey(indicadorActual))) {
          indicadorActual = inds.find(x => !TITULOS_RESALTAR.has(normKey(x))) ?? null;
        }

        repintarIndicadoresUI();
        actualizarTituloIndicador();
        actualizarVista();
      });
    });
});