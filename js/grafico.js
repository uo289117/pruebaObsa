export function pintarGrafico(state, { wrapLabel }) {
  const canvas = document.getElementById("graficoCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  let labels = [];
  let data = [];

  if (!state.indicadorActual || !state.datosJSON) return;

  if (state.tipoGrafico === "line") {
    labels = Object.keys(state.datosJSON);
    data = labels.map(año => {
      const arr = state.datosJSON?.[año]?.[state.concejoActual]?.[state.indicadorActual];
      const valor = Number(arr?.[0]);
      return Number.isFinite(valor) ? valor : 0;
    });
  } else if (state.tipoGrafico === "bar") {
    const datosAño = state.datosJSON?.[state.añoActual];
    if (!datosAño) return;

    labels = Object.keys(datosAño);
    data = labels.map(mun => {
      const arr = datosAño?.[mun]?.[state.indicadorActual];
      const valor = Number(arr?.[0]);
      return Number.isFinite(valor) ? valor : 0;
    });
  } else {
    console.warn("Tipo de gráfico no permitido:", state.tipoGrafico);
    return;
  }

  if (state.chart) state.chart.destroy();

  let media = null;
  if (state.tipoGrafico === "bar") {
    const valoresValidos = data.filter(v => Number.isFinite(v));
    media = valoresValidos.length ? valoresValidos.reduce((a, b) => a + b, 0) / valoresValidos.length : null;
  }

  const tituloY = wrapLabel("Porcentaje de " + state.indicadorActual, 24);

  state.chart = new Chart(ctx, {
    type: state.tipoGrafico,
    data: {
      labels,
      datasets: [{
        label: state.indicadorActual,
        data,
        backgroundColor: state.tipoGrafico === "bar"
          ? data.map(v => `rgb(0,${Math.round(100 + 155 * (v / Math.max(...data.filter(x => x > 0), 1)))},0)`)
          : "rgba(0, 150, 200, 0.5)",
        borderColor: state.tipoGrafico === "line" ? "rgba(0,150,200,1)" : undefined,
        borderWidth: state.tipoGrafico === "line" ? 2 : 1,
        fill: state.tipoGrafico === "line" ? false : undefined
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
            text: state.tipoGrafico === "bar" ? "Municipio" : "Año",
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
    plugins: (state.tipoGrafico === "bar" && media !== null) ? [{
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