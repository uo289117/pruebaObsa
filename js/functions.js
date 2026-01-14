    let datosJSON = {};
    let indicadorActual = null;
    let añoActual = null;
    let modoActual = "mapa";
    let tipoGrafico = "bar";
    let concejoActual = null;
    let chart = null;

    function mostrarInfo(municipio, valor) {
      document.getElementById("nombre").textContent = municipio;
      document.getElementById("indicador").textContent = indicadorActual || "";
      document.getElementById("valor").textContent =
        (typeof valor === "number" && !isNaN(valor))
          ? valor.toFixed(3)
          : "n/d";      
      document.getElementById("infoBox").style.display = "block";
    }
    function cerrarInfo() {
      document.getElementById("infoBox").style.display = "none";
    } 

    //Por cuartiles

    function pintarMapa() {
    if (!indicadorActual || !datosJSON || !añoActual) return;

    const datosAño = datosJSON[añoActual];

    // Obtener valores numéricos válidos
    const valores = Object.values(datosAño)
        .map(concejoObj => Number(concejoObj[indicadorActual]))
        .filter(v => !isNaN(v))
        .sort((a, b) => a - b);

    if (valores.length === 0) return;

    // Calcular cuartiles
    const q1 = valores[Math.floor(valores.length * 0.25)];
    const q2 = valores[Math.floor(valores.length * 0.5)];
    const q3 = valores[Math.floor(valores.length * 0.75)];

    document.querySelectorAll("svg a").forEach(a => {
        const municipio = a.getAttribute("title");
        const path = a.querySelector("path");

        const valor = datosAño[municipio] 
                      ? Number(datosAño[municipio][indicadorActual]) 
                      : undefined;

        if (!path || valor === undefined || isNaN(valor)) {
            path.style.fill = "transparent";
        } else {
            // Determinar cuartil y opacidad
            let alpha = 0.25; // por defecto Q1
            if (valor > q3) alpha = 1;
            else if (valor > q2) alpha = 0.75;
            else if (valor > q1) alpha = 0.5;

            path.style.fill = `rgba(0, 128, 0, ${alpha})`; // verde con alpha por cuartil
            a.onclick = () => mostrarInfo(municipio, valor);
        }
    });

    cerrarInfo();
}


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

  const ctx = document.getElementById("graficoCanvas").getContext("2d");

  let labels = [];
  let data = [];

  if (!indicadorActual || !datosJSON) return;


  if (tipoGrafico === "line") {
    // 🔹 Gráfico de línea: indicadores a lo largo de los años
    labels = Object.keys(datosJSON); // años

    concejos = Object.keys(datosJSON[labels[0]]);

    data = labels.map(año => {
      const valor = datosJSON[año][concejoActual] ? Number(datosJSON[año][concejoActual][indicadorActual]) : 0;
      return isNaN(valor) ? 0 : valor;
    });
  } else if (tipoGrafico === "bar") {
    // 🔹 Gráfico de barras: valores actuales por municipio
    const datosAño = datosJSON[añoActual];
    labels = Object.keys(datosAño);
    data = labels.map(mun => Number(datosAño[mun][indicadorActual]) || 0);
  } else {
    console.warn("Tipo de gráfico no permitido:", tipoGrafico);
    return;
  }

  if (chart) chart.destroy();

  // 📊 Calcular media solo para barras
  let media = null;
  if (tipoGrafico === "bar") {
    const valoresValidos = data.filter(v => !isNaN(v));
    media = valoresValidos.reduce((a, b) => a + b, 0) / valoresValidos.length;
  }

  const tituloY = wrapLabel("Porcentaje de " + indicadorActual, 24);

  chart = new Chart(ctx, {
    type: tipoGrafico,
    data: {
      labels: labels,
      datasets: [{
        label: indicadorActual,
        data: data,
        backgroundColor: tipoGrafico === "bar"
          ? data.map(v => `rgb(0,${Math.round(100 + 155 * (v / Math.max(...data)))},0)`)
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
        legend: {
          labels: { color: "#000", font: { size: 13 } }
        }
      },
      scales: {
        x: { 
          title: { display: true, text: tipoGrafico === "bar" ? "Municipio" : "Año", color: "#000", font: { size: 14, weight: "bold" } } 
        },
        y: { 
          title: { display: true, text: tituloY, color: "#000", font: { size: 14, weight: "bold" } },
          beginAtZero: true 
        }
      }
    },
    plugins: tipoGrafico === "bar" ? [{
      id: "mediaLine",
      afterDraw(chart) {
        if (media === null) return;
        const { ctx, chartArea: { top, bottom, left, right }, scales: { y } } = chart;

        // Línea de la media
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(left, y.getPixelForValue(media));
        ctx.lineTo(right, y.getPixelForValue(media));
        ctx.lineWidth = 2;
        ctx.strokeStyle = "red";
        ctx.setLineDash([6, 3]);
        ctx.stroke();
        ctx.restore();

        // Texto
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

    function actualizarVista() {

        if (modoActual === "mapa") {

            document.getElementById("mapaContainer").style.display = "block";
            document.getElementById("graficoContainer").style.display = "none";
            document.getElementById("concejoSelect").style.display = "none";
            document.getElementById("añoSelect").style.display = "block";


            leyenda.style.display = "flex";   // <- importante
            
            pintarMapa();

        } else {
          document.getElementById("mapaContainer").style.display = "none";
          document.getElementById("graficoContainer").style.display = "block";

          leyenda.style.display = "none";
          tipoGrafico = modoActual;

          if (tipoGrafico === "line") {
            document.getElementById("concejoSelect").style.display = "block";
            document.getElementById("añoSelect").style.display = "none";
          } else {
            // bar (y otros si metes más)
            document.getElementById("concejoSelect").style.display = "none";
            document.getElementById("añoSelect").style.display = "block";
          }

          setTimeout(() => pintarGrafico(), 50);
        }
    }



    document.addEventListener("DOMContentLoaded", () => {
      
      const selectorAño = document.getElementById("añoSelect");
      const selectorIndicador = document.getElementById("indicadorSelect");
      const selectorModo = document.getElementById("modoSelect");
      const selectorConcejo = document.getElementById("concejoSelect");
      
	
        // cambiar modo
      selectorModo.addEventListener("change", e => {
        modoActual = e.target.value;
        actualizarVista();
      });
    
      fetch("archivos_de_interes/mapasvg.xml")
        .then(r => r.text())
        .then(svg => {
            // document.getElementById("mapaContainer").innerHTML = svg;
            document.querySelector('[data-role="mapa-svg"]').innerHTML = svg;

            
            // Cuando ya está insertado, ahora tus funciones funcionan igual:
            pintarMapa();  
        });

	  // cargar JSON
	  fetch("JSONsGenerados/pruebaAños.json")
		.then(r => r.json())
		.then(datos => {
		  datosJSON = datos;  
      
      const años =  Object.keys(datosJSON);
      
		  if (!años.length) return;
	//------------------------------------

	
        const concejos = Object.keys(datosJSON[años[años.length-1]]);

        const indicadores = Object.keys(datosJSON[años[años.length-1]][concejos[0]]);


        const contenedor = document.getElementById("lista-indicadores");

        // Rellenar selector de años
        selectorAño.innerHTML = ""; // limpiar

        años.forEach(a => {
            const opt = document.createElement("option");
            opt.value = a;
            opt.textContent = a;
            selectorAño.appendChild(opt);
        });

        // Seleccionar el primer año por defecto
        añoActual = años[años.length-1];
        selectorAño.value = añoActual;
        indicadorActual = indicadores[0];
        actualizarVista();

        // Cuando el usuario cambie de año
        selectorAño.addEventListener("change", e => {
            añoActual = e.target.value;
            actualizarVista(); // repinta mapa o gráfico
        });

        // Crear indicadores dinámicamente
        indicadores.forEach(ind => {
            const div = document.createElement("div");
            div.textContent = ind;
            div.style.margin = "4px 0";
            div.style.cursor = "pointer";

            // Evento al hacer clic en un indicador
            div.addEventListener("click", () => {
                indicadorActual = ind;
                actualizarVista();
            });

            contenedor.appendChild(div);
        });

        concejos.forEach(c => {
          const option = document.createElement("option");
          option.value = c;
          option.textContent = c;
          selectorConcejo.appendChild(option);
        });

        // por defecto
        concejoActual = concejos[0];
        selectorConcejo.value = concejoActual;

        // listener correcto (UNA SOLA VEZ)
        selectorConcejo.addEventListener("change", (e) => {
          concejoActual = e.target.value;
          actualizarVista();
        });
		});
	});
