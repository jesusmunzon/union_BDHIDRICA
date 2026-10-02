const populationValueLabels = {
  id: "populationValueLabels",

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

        const valueM3 = Math.round(valueHm3 * 1e6);
        const label = valueM3.toLocaleString("es-ES", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          useGrouping: true,
        });

        /*
         * La etiqueta se dibuja siempre fuera de la barra.
         * El margen adicional se reserva en la escala X del gráfico.
         */
        const x = bar.x + 6;
        ctx.fillStyle = "#475569";
        ctx.fillText(label, x, bar.y);
      });
    });

    ctx.restore();
  },
};

Chart.register(populationValueLabels);
