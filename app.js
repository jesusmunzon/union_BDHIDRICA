const AI_CONFIG={endpoint:""};
let RED_DATA=[];
document.addEventListener("DOMContentLoaded",()=>{
  lucide.createIcons();
  const body=document.body,sidebar=document.getElementById("sidebar"),overlay=document.getElementById("overlay");
  const close=()=>{sidebar.classList.remove("open");overlay.classList.remove("open")};
  document.getElementById("openMenu").onclick=()=>{sidebar.classList.add("open");overlay.classList.add("open")};
  document.getElementById("closeMenu").onclick=close;overlay.onclick=close;
  const savedTheme=localStorage.getItem("control-red-theme");if(savedTheme==="dark")body.classList.add("dark");
  const updateThemeIcon=()=>{document.getElementById("themeIcon").setAttribute("data-lucide",body.classList.contains("dark")?"sun":"moon");lucide.createIcons()};updateThemeIcon();
  document.getElementById("themeToggle").onclick=()=>{body.classList.toggle("dark");localStorage.setItem("control-red-theme",body.classList.contains("dark")?"dark":"light");updateThemeIcon()};
  const years=[2014,2015,2016,2017,2018,2019,2020,2021,2022,2023],values=[44,57,51,69,62,76,70,85,79,94],bars=document.getElementById("mainBars");
  years.forEach((year,i)=>{const g=document.createElement("div");g.className="bar-group";g.innerHTML=`<i class="bar a" style="height:${values[i]}%"></i><i class="bar b" style="height:${values[i]*.62}%"></i><i class="bar c" style="height:${values[i]*.35}%"></i><span class="bar-year">${year}</span>`;bars.appendChild(g)});
  const vals=[38,55,48,75,62,81,69,98,78,88,67,92];document.querySelectorAll(".mini-bars").forEach((box,n)=>vals.forEach(v=>{const p=document.createElement("div");p.className="mini-pair";const scale=n===1?1.12:n===2?.95:1;p.innerHTML=`<i style="height:${Math.max(15,(v-13)*scale)}px"></i><i class="current" style="height:${v*scale}px"></i>`;box.appendChild(p)}));
  const refreshSubtitle=()=>{const m=document.getElementById("monthSelect").value.toLowerCase(),y=document.getElementById("yearSelect").value;document.getElementById("chartSubtitle").textContent=`Acumulado enero-${m} · referencia ${y}`};
  document.getElementById("monthSelect").onchange=refreshSubtitle;document.getElementById("yearSelect").onchange=refreshSubtitle;
  const metadata={dashboard:["Estadísticos 1","Evolución histórica de los principales indicadores de captación, distribución e intercambios de agua"],"informe-ia":["Informe IA Ejecutivo","Análisis directivo de los indicadores visibles y recomendaciones prioritarias"],estadisticos2:["Estadísticos 2","Pantalla estadística en preparación"],estadisticos3:["Estadísticos 3","Pantalla estadística en preparación"],estadisticos4:["Estadísticos 4","Pantalla estadística en preparación"]};
  document.querySelectorAll(".nav-item[data-tab]").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".tab-panel").forEach(x=>x.classList.remove("active"));const tab=b.dataset.tab,panel=document.getElementById(`panel-${tab}`);(panel||document.getElementById("panel-placeholder")).classList.add("active");const info=metadata[tab]||["Sección","Pantalla en preparación"];document.getElementById("pageTitle").textContent=info[0];document.getElementById("pageDescription").textContent=info[1];if(!panel)document.getElementById("placeholderTitle").textContent=info[0];close();lucide.createIcons()});
  document.getElementById("printReport").onclick=()=>window.print();
  document.getElementById("generateReport").onclick=generateExecutiveReport;
  loadRedData();
});
async function loadRedData(){
  const status=document.getElementById("aiDataStatus");
  try{
    const response=await fetch("datos-red.json",{cache:"no-store"});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    RED_DATA=await response.json();
    if(!Array.isArray(RED_DATA))throw new Error("Formato de datos no válido");
    status.textContent=`${RED_DATA.length.toLocaleString("es-ES")} registros disponibles`;
  }catch(error){
    console.error("No se pudo cargar datos-red.json",error);
    status.textContent="No se pudo cargar datos-red.json";
  }
}
const norm=s=>(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
const sumRows=rows=>rows.reduce((a,r)=>a+(Number(r.v)||0),0);
const hm3=v=>v/1e6;
const formatHm3=v=>`${new Intl.NumberFormat("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2}).format(v)} hm³`;
function getPeriodRows(year,month){return RED_DATA.filter(r=>{const d=new Date(`${r.d}T00:00:00`);return d.getFullYear()===year && d.getMonth()+1<=month})}
function calculateYear(year,month){
  const rows=getPeriodRows(year,month);
  const captured=sumRows(rows.filter(r=>norm(r.tipo)==="AGUA CAPTADA"&&norm(r.sub)==="AGUA BRUTA"));
  const produced=sumRows(rows.filter(r=>norm(r.sub)==="AGUA PRODUCIDA ETAP"));
  const imported=sumRows(rows.filter(r=>norm(r.sub)==="AGUA TRATADA IMPORTADA"));
  const exported=sumRows(rows.filter(r=>norm(r.sub)==="AGUA TRATADA EXPORTADA"));
  const rawExported=sumRows(rows.filter(r=>norm(r.sub)==="AGUA ADUCIDA BRUTA EXPORTADA"));
  const distributed=produced+imported-exported;
  const sources={};
  rows.filter(r=>norm(r.tipo)==="AGUA CAPTADA"&&norm(r.sub)==="AGUA BRUTA").forEach(r=>{const key=r.p1||r.p2||"Sin clasificar";sources[key]=(sources[key]||0)+(Number(r.v)||0)});
  const topSources=Object.entries(sources).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,value])=>({name,value:hm3(value)}));
  return {year,month,rows:rows.length,captured:hm3(captured),produced:hm3(produced),imported:hm3(imported),exported:hm3(exported),rawExported:hm3(rawExported),distributed:hm3(distributed),balance:hm3(imported-exported),topSources};
}
function pct(current,previous){return previous?((current/previous)-1)*100:null}
function getDashboardData(){
  const monthName=document.getElementById("monthSelect").value;
  const month=document.getElementById("monthSelect").selectedIndex+1;
  const year=Number(document.getElementById("yearSelect").value);
  const current=calculateYear(year,month),previous=calculateYear(year-1,month);
  const capturedChange=pct(current.captured,previous.captured),distributedChange=pct(current.distributed,previous.distributed);
  const availableYears=[...new Set(RED_DATA.map(r=>Number(String(r.d).slice(0,4))).filter(Number.isFinite))].sort((a,b)=>a-b);
  const history=availableYears.filter(y=>y<=year&&y>=year-9).map(y=>calculateYear(y,month));
  return {monthName,month,year,current,previous,history,capturedChange,distributedChange,recordCount:RED_DATA.length};
}
function localExecutiveAnalysis(data,prompt){
  const c=data.current,p=data.previous;
  const capTrend=data.capturedChange===null?"sin comparación":`${data.capturedChange>=0?"+":""}${data.capturedChange.toFixed(1)}%`;
  const distTrend=data.distributedChange===null?"sin comparación":`${data.distributedChange>=0?"+":""}${data.distributedChange.toFixed(1)}%`;
  const source=c.topSources[0];
  const balanceState=c.balance>=0?"importador neto":"exportador neto";
  const historicalAvg=data.history.length?data.history.reduce((a,x)=>a+x.distributed,0)/data.history.length:0;
  const vsAvg=historicalAvg?pct(c.distributed,historicalAvg):null;
  return {
    summary:`Hasta ${data.monthName.toLowerCase()} de ${data.year}, la red acumula ${formatHm3(c.captured)} de agua captada y una distribución estimada de ${formatHm3(c.distributed)}. Frente al mismo período de ${data.year-1}, la captación varía ${capTrend} y la distribución ${distTrend}. Las importaciones tratadas suman ${formatHm3(c.imported)} y las exportaciones ${formatHm3(c.exported)}, con un balance de ${formatHm3(c.balance)} que sitúa al sistema como ${balanceState}. ${source?`La principal procedencia de captación es ${source.name}, con ${formatHm3(source.value)}.`:""}${vsAvg!==null?` La distribución se sitúa ${Math.abs(vsAvg).toFixed(1)}% ${vsAvg>=0?"por encima":"por debajo"} de la media de los últimos ${data.history.length} años analizados.`:""}${prompt?` Enfoque solicitado: ${prompt}`:""}`,
    strengths:[
      `La red registra ${formatHm3(c.captured)} de captación acumulada, con variación interanual de ${capTrend}.`,
      `La producción en ETAP alcanza ${formatHm3(c.produced)} y sostiene una distribución estimada de ${formatHm3(c.distributed)}.`,
      source?`${source.name} lidera las aportaciones con ${formatHm3(source.value)}.`:"Existe información desagregada por origen para profundizar en la captación."
    ],
    risks:[
      `El balance tratado es ${formatHm3(c.balance)}; una variación brusca puede elevar la dependencia de intercambios externos.`,
      `La distribución presenta una variación interanual de ${distTrend}, que debe contrastarse con demanda, reservas y estacionalidad.`,
      `El análisis utiliza ${c.rows.toLocaleString("es-ES")} registros del período y depende de su integridad y actualización.`
    ],
    actions:[
      `Revisar los orígenes que concentran la captación y definir umbrales de dependencia por sistema.`,
      `Comparar semanalmente producción, importación, exportación y distribución para detectar desviaciones de balance.`,
      `Incorporar alertas cuando la variación interanual o frente a la media histórica supere los límites operativos establecidos.`
    ]
  };
}
async function generateExecutiveReport(){const loading=document.getElementById("aiLoading"),button=document.getElementById("generateReport"),data=getDashboardData(),prompt=document.getElementById("aiPrompt").value.trim();loading.hidden=false;button.disabled=true;let result;try{if(AI_CONFIG.endpoint){const r=await fetch(AI_CONFIG.endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data,prompt})});if(!r.ok)throw new Error(`HTTP ${r.status}`);result=await r.json()}else{await new Promise(r=>setTimeout(r,650));result=localExecutiveAnalysis(data,prompt)}}catch(e){console.error(e);result=localExecutiveAnalysis(data,prompt);result.summary+=` No fue posible conectar con el servicio de IA, por lo que se ha utilizado el análisis local.`}finally{loading.hidden=true;button.disabled=false}renderReport(data,result)}
function renderReport(data,result){
  const c=data.current;
  document.getElementById("reportPeriod").textContent=`Período analizado: enero-${data.monthName.toLowerCase()} de ${data.year}`;
  document.getElementById("reportDate").textContent=new Intl.DateTimeFormat("es-ES",{dateStyle:"long"}).format(new Date());
  document.getElementById("reportSummary").textContent=result.summary;
  const metrics=[
    ["Captación acumulada",formatHm3(c.captured)],
    ["Distribución estimada",formatHm3(c.distributed)],
    ["Importación tratada",formatHm3(c.imported)],
    ["Balance intercambios",formatHm3(c.balance)]
  ];
  document.getElementById("reportKpis").innerHTML=metrics.map(x=>`<div><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("");
  document.getElementById("reportStrengths").innerHTML=result.strengths.map(x=>`<li>${x}</li>`).join("");
  document.getElementById("reportRisks").innerHTML=result.risks.map(x=>`<li>${x}</li>`).join("");
  document.getElementById("reportActions").innerHTML=result.actions.map((x,i)=>`<div class="action-item"><b>${i+1}</b><div><strong>${x}</strong><p>Acción propuesta para seguimiento técnico y directivo.</p></div></div>`).join("");
  lucide.createIcons();document.getElementById("executiveReport").scrollIntoView({behavior:"smooth",block:"start"});
}
