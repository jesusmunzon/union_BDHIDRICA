const populationValueLabels = {
  id: "populationValueLabels",

  afterDatasetsDraw(chartInstance) {
    /*
     * Solo actúa sobre el gráfico
     * Distribución por población.
     */
    if (
      chartInstance.canvas.id !==
      "poblaciones"
    ) {
      return;
    }

    const {
      ctx,
      data,
      chartArea,
    } = chartInstance;

    ctx.save();

    ctx.fillStyle = "#475569";
    ctx.font =
      "600 10px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    data.datasets.forEach(
      (dataset, datasetIndex) => {
        const metadata =
          chartInstance.getDatasetMeta(
            datasetIndex,
          );

        if (metadata.hidden) {
          return;
        }

        metadata.data.forEach(
          (bar, dataIndex) => {
            const value =
              dataset.data[dataIndex];

            if (
              value == null ||
              !Number.isFinite(Number(value))
            ) {
              return;
            }

            const formattedValue =
              Number(value).toLocaleString(
                "es-ES",
                {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                  useGrouping: true,
                },
              );

            /*
             * Posición del texto junto al extremo
             * derecho de la barra horizontal.
             */
            let x = bar.x + 6;

            /*
             * Si el texto pudiera salir del gráfico,
             * se coloca dentro de la barra.
             */
            const textWidth =
              ctx.measureText(
                formattedValue,
              ).width;

            if (
              x + textWidth >
              chartArea.right - 2
            ) {
              x =
                bar.x -
                textWidth -
                6;
            }

            ctx.fillText(
              formattedValue,
              x,
              bar.y,
            );
          },
        );
      },
    );

    ctx.restore();
  },
};
Chart.register(
  populationValueLabels,
);
