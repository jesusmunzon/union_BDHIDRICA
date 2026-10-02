const populationValueLabels = {
  id: "populationValueLabels",

  beforeInit(chartInstance) {
    if (chartInstance.canvas.id !== "poblaciones") return;

    chartInstance.options.layout = chartInstance.options.layout || {};
    const currentPadding = chartInstance.options.layout.padding || {};

    chartInstance.options.layout.padding = {
      ...currentPadding,
      right: Math.max(Number(currentPadding.right) || 0, 70),
    };
  },

  afterDatasetsDraw(chartInstance) {
    if (chartInstance.canvas.id !== "poblaciones") return;

    const { ctx, data, chartArea } = chartInstance;

    ctx.save();
    ctx.fillStyle = "#475569";
    ctx.font = "600 10px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    data.datasets.forEach((dataset, datasetIndex) => {
      const metadata = chartInstance.getDatasetMeta(datasetIndex);
      if (metadata.hidden) return;

      metadata.data.forEach((bar, dataIndex) => {
        const valueHm3 = Number(dataset.data[dataIndex]);
        if (!Number.isFinite(valueHm3)) return;

        /* Las barras están expresadas en hm³; la etiqueta se muestra en m³. */
        const valueM3 = Math.round(valueHm3 * 1e6);
        const formattedValue = valueM3.toLocaleString("es-ES", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          useGrouping: true,
        });

        const textWidth = ctx.measureText(formattedValue).width;
        let x = bar.x + 6;

        if (x + textWidth > chartArea.right + 66) {
          x = chartArea.right + 66 - textWidth;
        }

        ctx.fillText(formattedValue, x, bar.y);
      });
    });

    ctx.restore();
  },
};

Chart.register(populationValueLabels);
