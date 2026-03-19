

export function ensureIndicadorSelector(state, deps) {
  // Localiza el selector de indicadores del ranking
  const sel = document.getElementById("indicadorSelect");
  if (!sel) return null;

  // repinta si cambia año
  if (sel.dataset.year === String(state.añoActual) && sel.options.length > 0) return sel;

  sel.innerHTML = "";

  // 1) construye los indicadores reales del JSON
  const indicadoresReales = new Map(); 
  const data = state.datosJSON?.[state.añoActual];
  if (data) {
    // Recorre todos los “objetos concejo” del año:
    for (const obj of Object.values(data)) {
      if (!obj || typeof obj !== "object") continue;

      // Cada key de obj es un indicador ("Mortalidad", "Sedentarismo"...
      for (const k of Object.keys(obj)) {
        const nk = deps.normKey(k);
        if (!indicadoresReales.has(nk)) indicadoresReales.set(nk, k);
      }
    }
  }

  // 2) lista final respetando ORDEN_INDICADORES e incluyendo títulos
  const listaFinal = [];
  const usados = new Set();

  for (const k of deps.ORDEN_INDICADORES) {
    const nk = deps.normKey(k);
    const esTitulo = deps.TITULOS_RESALTAR.has(nk);

    if (esTitulo) {
      // incluye TITULOS SELECCIONABLES
      // - Para los tres principales se ponen en MAYÚSCULAS
      // - Para el resto se dibujan como “— Título —”
      const enMayus =
        nk === deps.normKey("Valoración Global") ||
        nk === deps.normKey("Resultados") ||
        nk === deps.normKey("Determinantes");

      listaFinal.push({
        label: enMayus ? k.toUpperCase() : `— ${k} —`,
        value: k,
        isTitle: true,
      });
      usados.add(nk);
      continue;
    }

    // Si NO es título (Val. GLobal, Resultados...): solo lo añadimos si realmente 
    // existe en el JSON
    if (indicadoresReales.has(nk)) {
      const real = indicadoresReales.get(nk);
      listaFinal.push({ label: real, value: real, isTitle: false });
      usados.add(nk);
    }
  }

  // 3) resto de indicadores reales, esto evita que no aparezcan indicadores 
  // nuevos / no listados en ORDEN_INDICADORES. Si se percibe esto hay que incluirlos
  // en las listas de app.js 

  for (const [nk, display] of indicadoresReales.entries()) {
    if (usados.has(nk)) continue;
    listaFinal.push({ label: display, value: display, isTitle: false });
  }

  // 4) pintar options
  for (const item of listaFinal) {
    const opt = document.createElement("option");
    opt.textContent = item.label;
    opt.value = item.value;
    opt.dataset.title = item.isTitle ? "1" : "0";
    sel.appendChild(opt);
  }


  sel.dataset.year = String(state.añoActual);

  // 5) seleccionar algo válido (si no hay nada, el primero)
  if (!state.rankingIndicador) {
    deps.onStatePatch?.({ rankingIndicador: sel.value || null });
  } else {
    const ok = Array.from(sel.options).some(o => deps.normKey(o.value) === deps.normKey(state.rankingIndicador));
    if (!ok) deps.onStatePatch?.({ rankingIndicador: sel.value || null });
  }

  sel.value = (state.rankingIndicador ?? sel.value ?? "");

  // 6) onchange => actualizar state y rerender
  sel.onchange = () => {
    deps.onStatePatch?.({
      rankingIndicador: sel.value,
      rankingModo: "indicador",
      modoActual: "ranking",
    });

    deps.actualizarVista?.();
  };

  return sel;
}


// Devuelve true si el indicador seleccionado es título/cabecera
function esTituloIndicador(ind, deps) {
  return deps.TITULOS_RESALTAR.has(deps.normKey(ind));
}


// =======================================================
// TABLA: Ranking por indicador (solo posición)
// =======================================================
// Caso especial para cuando escoges un  “título” (cabecera):
// - Construye una tabla Concejo -> Posición
// - NO muestra el valor (porque no hay un valor único de V.global, Resultados...)
function renderTablaIndicadorPosOnly(container, indicadorSeleccionado, datosAño, deps) {
  container.innerHTML = "";

  const h2 = document.createElement("h2");
  h2.textContent = indicadorSeleccionado.toUpperCase();
  container.appendChild(h2);

  const table = document.createElement("table");
  table.className = "tabla-ranking";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Concejo</th>
        <th>Posición</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");

  const nkSel = deps.normKey(indicadorSeleccionado);

  for (const [concejo, obj] of Object.entries(datosAño)) {
    if (!obj || typeof obj !== "object") continue;

    // buscar el indicador exacto o por normalización
    let arr = obj[indicadorSeleccionado];
    if (!arr) {
      const found = Object.entries(obj).find(([k]) => deps.normKey(k) === nkSel);
      if (found) arr = found[1];
    }

    // si no existe, saltar
    if (!Array.isArray(arr)) continue;

    const pos = arr[1];
    if (pos == null) continue;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${deps.escapeHtml(concejo)}</td>
      <td>${deps.escapeHtml(deps.fmt(pos))}</td>
    `;
    tbody.appendChild(tr);
  }

  container.appendChild(table);
}


// =======================================================
// TABLA: Ranking por indicador (valor + posición)
// =======================================================
// Caso normal (indicador real):
// - Concejo -> Valor + Posición
function renderTablaIndicador(container, indicadorSeleccionado, datosAño, deps) {
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

  const nkSel = deps.normKey(indicadorSeleccionado);

  //Busca el indicador por clave exacta o normalizada
  for (const [concejo, obj] of Object.entries(datosAño)) {
    if (!obj || typeof obj !== "object") continue;

    let arr = obj[indicadorSeleccionado];
    if (!arr) {
      const found = Object.entries(obj).find(([k]) => deps.normKey(k) === nkSel);
      if (found) arr = found[1];
    }
    if (!Array.isArray(arr)) continue;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${deps.escapeHtml(concejo)}</td>
      <td>${deps.escapeHtml(deps.fmt(arr[0]))}</td>
      <td>${deps.escapeHtml(deps.fmt(arr[1]))}</td>
    `;
    tbody.appendChild(tr);
  }

  container.appendChild(table);
}

// =======================================================
// TABLA: Ranking por municipio (comparando indicadores)
// =======================================================
// Muestra para un municipio (mun):
// - Indicador
// - Valor (municipio)
// - Valor de Asturias (si existe)
// - Posición del municipio
function renderTablaMunicipio(container, mun, datosMun, datosAst, deps) {
  container.innerHTML = "";

  const h2 = document.createElement("h2");
  h2.textContent = mun;
  container.appendChild(h2);

  const munIndex = new Map(Object.entries(datosMun).map(([k, v]) => [deps.normKey(k), { k, v }]));
  const astIndex = new Map(Object.entries(datosAst).map(([k, v]) => [deps.normKey(k), { k, v }]));

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

  //Primero coge los indicadores que están incluidos en ORDEN_INDICADORES
  for (const key of deps.ORDEN_INDICADORES) {
    const nk = deps.normKey(key);
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

  //Después incluye otros indicadores que no están en ORDEN_INDICADORES pero se deben
  //incluir
  for (const [indicador, arr] of Object.entries(datosMun)) {
    const nk = deps.normKey(indicador);
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

  //Pinta filas en la tabla
  for (const f of filas) {
    const tr = document.createElement("tr");
    const isTitulo = deps.TITULOS_RESALTAR.has(deps.normKey(f.indicador));
    if (isTitulo) tr.classList.add("fila-seccion");

    tr.innerHTML = `
      <td>${deps.escapeHtml(f.indicador)}</td>
      <td>${isTitulo ? "" : deps.escapeHtml(deps.fmt(f.valor))}</td>
      <td>${isTitulo ? "" : deps.escapeHtml(deps.fmt(f.valorAsturias))}</td>
      <td>${deps.escapeHtml(deps.fmt(f.posicion))}</td>
    `;
    tbody.appendChild(tr);
  }

  container.appendChild(table);
}


// =======================================================
// renderRanking(state, deps)
// =======================================================
// Punto de entrada para pintar el ranking.
// Decide qué renderizar según state.rankingModo:
// - "municipio": tabla de indicadores de un concejo
// - "indicador": tabla de concejos para un indicador
export function renderRanking(state, deps) {
  const contMun = document.getElementById("rankingMunicipioContainer");
  const contInd = document.getElementById("rankingIndicadorContainer");

  if (!state.añoActual || !state.datosJSON?.[state.añoActual]) {
    if (contMun) contMun.innerHTML = "";
    if (contInd) contInd.innerHTML = "";
    return;
  }

  const datosAño = state.datosJSON[state.añoActual];

  // -------------------------------------------------------
  // MODO: ranking por municipio
  // -------------------------------------------------------
  if (state.rankingModo === "municipio") {
    if (contInd) contInd.innerHTML = "";
    if (!contMun) return;

    const mun = state.concejoActual || (state.concejosCache?.[0] ?? null);
    if (!mun) return;

    const datosMun = datosAño?.[mun];
    if (!datosMun) {
      contMun.innerHTML = `<p>No hay datos para ${deps.escapeHtml(mun)} en ${deps.escapeHtml(state.añoActual)}.</p>`;
      return;
    }

    const datosAst = datosAño?.[deps.AST_KEY] || {};
    renderTablaMunicipio(contMun, mun, datosMun, datosAst, deps);
    return;
  }

  // -------------------------------------------------------
  // MODO: ranking por indicador
  // -------------------------------------------------------
  if (state.rankingModo === "indicador") {
    if (contMun) contMun.innerHTML = "";
    if (!contInd) return;

    const indicador = state.rankingIndicador || state.indicadorActual;
    if (!indicador) {
      contInd.innerHTML = "<p>No hay indicador seleccionado.</p>";
      return;
    }

    if (esTituloIndicador(indicador, deps)) {
      renderTablaIndicadorPosOnly(contInd, indicador, datosAño, deps);
    } else {
      renderTablaIndicador(contInd, indicador, datosAño, deps);
    }
  }
}