const C = {
  blue: "#1677ff",
  cyan: "#19b6c9",
  green: "#2eb67d",
  orange: "#f59e0b",
  navy: "#254b6d",
  gray: "#c7d2de",
};
const months = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
let D = [],
  charts = {};
const norm = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
const hm = (v) => v / 1e6;
const fmt = (v) =>
  new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(v) + " hm³";
const sum = (pred, y, m = 12) =>
  D.filter(
    (r) => +r.d.slice(0, 4) === y && +r.d.slice(5, 7) <= m && pred(r),
  ).reduce((a, r) => a + r.v, 0);
const capPred = (name) => (r) =>
  r.tipo === "AGUA CAPTADA" &&
  r.sub === "AGUA BRUTA" &&
  (name === "Melonares"
    ? norm(r.p2) === "MELONARES"
    : name === "Gergal"
      ? norm(r.p1) === "GERGAL"
      : norm(r.p1) === "MINILLA");
const interPred = (sub) => (r) => norm(r.sub) === norm(sub);
function distributed(y, m, sevillaOnly = false) {
  const produced =
    sum((r) => norm(r.sub) === "AGUA PRODUCIDA ETAP", y, m) +
    sum(interPred("AGUA TRATADA IMPORTADA"), y, m);
  const exports = sum(interPred("AGUA TRATADA EXPORTADA"), y, m);
  const total = produced - exports;
  if (!sevillaOnly) return total;
  return Math.max(
    0,
    produced -
      sum(
        (r) =>
          norm(r.sub) === "AGUA TRATADA IMPORTADA" ||
          norm(r.sub) === "AGUA TRATADA EXPORTADA" ||
          (norm(r.sub) === "AGUA PRODUCIDA ETAP" &&
            norm(r.p1) !== "ETAP CARAMBOLO"),
        y,
        m,
      ),
  );
}
function chart(id, type, data, options = {}) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), {
    type,
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 9, usePointStyle: true, font: { size: 10 } },
        },
        tooltip: {
          callbacks: {
            label: (c) => " " + c.dataset.label + ": " + fmt(c.raw),
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 9 }, color: "#738394" },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#edf1f5" },
          ticks: {
            font: { size: 9 },
            color: "#738394",
            callback: (v) => v.toLocaleString("es-ES"),
          },
        },
        ...(options.scales || {}),
      },
      ...options,
    },
  });
}
function monthly(sub, y) {
  return months.map((_, i) =>
    hm(sum(interPred(sub), y, i + 1) - sum(interPred(sub), y, i)),
  );
}
function update() {
  const y = +year.value,
    m = +month.value,
    prev = y - 1;
  periodText.textContent = `Datos hasta ${months[m - 1].toLowerCase()} de ${y} · comparación histórica`;
  capSub.textContent = `Acumulado enero–${months[m - 1].toLowerCase()} · últimos 10 años`;
  distSub.textContent = `Acumulado enero–${months[m - 1].toLowerCase()} por año`;
  popSub.textContent = `${y} frente a ${prev} · enero–${months[m - 1].toLowerCase()}`;
  const availableYears = [...new Set(D.map((r) => +r.d.slice(0, 4)))]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const ys = availableYears.filter((yy) => yy >= y - 10 && yy <= y);
  const captured = ys.map((yy) =>
    ["Melonares", "Gergal", "Minilla"].reduce(
      (a, n) => a + sum(capPred(n), yy, m),
      0,
    ),
  );
  const dist = ys.map((yy) => distributed(yy, m));
  k1.textContent = fmt(captured.at(-1));
  k2.textContent = fmt(hm(dist.at(-1)));
  const bal =
    sum(interPred("AGUA TRATADA IMPORTADA"), y, m) -
    sum(interPred("AGUA TRATADA EXPORTADA"), y, m);
  k3.textContent = fmt(hm(bal));
  const dp = distributed(prev, m),
    pct = dp ? (distributed(y, m) / dp - 1) * 100 : 0;
  k4.textContent =
    (pct >= 0 ? "+" : "") +
    pct.toLocaleString("es-ES", { maximumFractionDigits: 1 }) +
    " %";
  k4.style.color = pct >= 0 ? C.green : "#d64545";
  chart(
    "captada",
    "bar",
    {
      labels: ys,
      datasets: [
        {
          label: "Melonares",
          data: ys.map((z) => hm(sum(capPred("Melonares"), z, m))),
          backgroundColor: C.blue,
          borderRadius: 3,
        },
        {
          label: "Gergal",
          data: ys.map((z) => hm(sum(capPred("Gergal"), z, m))),
          backgroundColor: C.cyan,
          borderRadius: 3,
        },
        {
          label: "Minilla",
          data: ys.map((z) => hm(sum(capPred("Minilla"), z, m))),
          backgroundColor: C.navy,
          borderRadius: 3,
        },
      ],
    },
    { scales: { x: { stacked: true }, y: { stacked: true } } },
  );
  [
    ["bruta", "AGUA ADUCIDA BRUTA EXPORTADA", C.orange],
    ["importada", "AGUA TRATADA IMPORTADA", C.green],
    ["exportada", "AGUA TRATADA EXPORTADA", C.blue],
  ].forEach(([id, sub, col]) =>
    chart(id, "bar", {
      labels: months,
      datasets: [
        {
          label: String(prev),
          data: monthly(sub, prev),
          backgroundColor: C.gray,
          borderRadius: 3,
        },
        {
          label: String(y),
          data: monthly(sub, y).map((v, i) => (i < m ? v : null)),
          backgroundColor: col,
          borderRadius: 3,
        },
      ],
    }),
  );
  chart("distribuida", "line", {
    labels: ys,
    datasets: [
      {
        label: "Sevilla",
        data: ys.map((z) => hm(distributed(z, m, true))),
        borderColor: C.blue,
        backgroundColor: C.blue,
        tension: 0.3,
        pointRadius: 3,
      },
      {
        label: "Resto de poblaciones",
        data: ys.map((z) => hm(distributed(z, m) - distributed(z, m, true))),
        borderColor: C.green,
        backgroundColor: C.green,
        tension: 0.3,
        pointRadius: 3,
      },
    ],
  });
  const popNames = [
    "Aljarafesa",
    "Huesna",
    "Burguillos",
    "El Garrobo",
    "El Ronquillo",
    "Adufe",
    "Mairena del Alcor",
    "La Galbana",
  ];
  const popVal = (n, yy) => {
    if (["Aljarafesa", "Huesna", "Burguillos"].includes(n))
      return hm(
        sum(
          (r) =>
            norm(r.sub) === "AGUA TRATADA EXPORTADA" &&
            norm(r.p1).includes(norm(n)),
          yy,
          m,
        ),
      );
    return hm(
      sum(
        (r) =>
          (norm(r.sub) === "AGUA PRODUCIDA ETAP" ||
            norm(r.sub) === "AGUA TRATADA IMPORTADA") &&
          (norm(r.p1).includes(norm(n)) || norm(r.p2).includes(norm(n))),
        yy,
        m,
      ),
    );
  };
  chart(
    "poblaciones",
    "bar",
    {
      labels: popNames,
      datasets: [
        {
          label: String(prev),
          data: popNames.map((n) => popVal(n, prev)),
          backgroundColor: C.gray,
          borderRadius: 3,
        },
        {
          label: String(y),
          data: popNames.map((n) => popVal(n, y)),
          backgroundColor: C.blue,
          borderRadius: 3,
        },
      ],
    },
    { indexAxis: "y" },
  );
}

const month = document.getElementById("month");
const year = document.getElementById("year");
const refresh = document.getElementById("refresh");
const periodText = document.getElementById("periodText");
const capSub = document.getElementById("capSub");
const distSub = document.getElementById("distSub");
const popSub = document.getElementById("popSub");
const k1 = document.getElementById("k1");
const k2 = document.getElementById("k2");
const k3 = document.getElementById("k3");
const k4 = document.getElementById("k4");
const loading = document.getElementById("loading");

function initializeInterface() {
  lucide.createIcons();

  const body = document.body;
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const closeMenu = () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("open");
  };

  document.getElementById("openMenu").addEventListener("click", () => {
    sidebar.classList.add("open");
    overlay.classList.add("open");
  });
  document.getElementById("closeMenu").addEventListener("click", closeMenu);
  overlay.addEventListener("click", closeMenu);

  if (localStorage.getItem("control-red-theme") === "dark") {
    body.classList.add("dark");
  }

  const refreshThemeIcon = () => {
    document
      .getElementById("themeIcon")
      .setAttribute(
        "data-lucide",
        body.classList.contains("dark") ? "sun" : "moon",
      );
    lucide.createIcons();
  };

  refreshThemeIcon();
  document.getElementById("themeToggle").addEventListener("click", () => {
    body.classList.toggle("dark");
    localStorage.setItem(
      "control-red-theme",
      body.classList.contains("dark") ? "dark" : "light",
    );
    refreshThemeIcon();
  });

  const titles = {
    estadisticos2: ["Estadísticos 2", "Pantalla estadística en preparación"],
    estadisticos3: ["Estadísticos 3", "Pantalla estadística en preparación"],
    estadisticos4: ["Estadísticos 4", "Pantalla estadística en preparación"],
    "base-datos": ["Base de datos", "Gestión de datos hidráulicos"],
    "tablas-auxiliares": [
      "Tablas auxiliares",
      "Configuración de tablas auxiliares",
    ],
  };

  document.querySelectorAll(".nav-item[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      if (tab === "dashboard") return;
      document.getElementById("pageTitle").textContent = titles[tab][0];
      document.getElementById("pageDescription").textContent = titles[tab][1];
      closeMenu();
    });
  });
}

initializeInterface();

fetch("datos-red.json")
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    D = data;
    const years = [...new Set(D.map((row) => +row.d.slice(0, 4)))].sort(
      (a, b) => a - b,
    );

    month.innerHTML = months
      .map(
        (name, index) =>
          `<option value="${index + 1}" ${index === 7 ? "selected" : ""}>${name}</option>`,
      )
      .join("");

    year.innerHTML = years
      .map(
        (value) =>
          `<option ${value === 2023 ? "selected" : ""}>${value}</option>`,
      )
      .join("");

    month.addEventListener("change", update);
    year.addEventListener("change", update);

    update();
    loading.style.display = "none";
  })
  .catch((error) => {
    loading.textContent =
      "No se pudieron cargar los datos. Abre la aplicación mediante GitHub Pages o un servidor web.";
    console.error(error);
  });
