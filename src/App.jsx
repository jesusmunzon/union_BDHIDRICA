import React, { useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  Database,
  Droplets,
  Filter,
  Gauge,
  LayoutDashboard,
  Menu,
  Moon,
  Sparkles,
  Sun,
  Table2,
  TrendingUp,
  Waves,
  X,
} from "lucide-react";

const navMain = [
  { label: "Estadísticos 1", icon: LayoutDashboard, active: true },
  { label: "Estadísticos 2", icon: BarChart3 },
  { label: "Estadísticos 3", icon: Activity },
  { label: "Estadísticos 4", icon: TrendingUp },
  { label: "Informe IA Ejecutivo", icon: Sparkles, ai: true },
];

const navSystem = [
  { label: "Base de datos", icon: Database },
  { label: "Tablas auxiliares", icon: Table2 },
];

const kpis = [
  { title: "Captada acumulada", value: "482,9 hm³", change: "+14,2%", detail: "Hasta el mes seleccionado", icon: Droplets, color: "indigo", positive: true },
  { title: "Distribuida estimada", value: "371,2 hm³", change: "+8,7%", detail: "Sevilla + resto", icon: Waves, color: "emerald", positive: true },
  { title: "Balance de intercambios", value: "12,8 hm³", change: "+2,1%", detail: "Importada menos exportada", icon: Gauge, color: "cyan", positive: true },
  { title: "Variación interanual", value: "+5,4%", change: "-1,2%", detail: "Agua distribuida", icon: TrendingUp, color: "amber", positive: false },
];

const chartYears = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];
const chartValues = [44, 57, 51, 69, 62, 76, 70, 85, 79, 94];

const colorClasses = {
  indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  cyan: "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
};

function Sidebar({ open, setOpen, dark, setDark }) {
  return (
    <>
      {open && <button aria-label="Cerrar menú" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-sm lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[278px] flex-col border-r border-slate-200 bg-white transition-transform duration-300 dark:border-slate-800 dark:bg-slate-950 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[78px] items-center justify-between border-b border-slate-100 px-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-500/25"><Waves size={23} /></div>
            <div><div className="text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">Control de Red</div><div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">Analítica hidráulica</div></div>
          </div>
          <button onClick={() => setOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"><X size={20} /></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-6">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Menú principal</p>
          <div className="space-y-1">{navMain.map(({ label, icon: Icon, active, ai }) => <button key={label} className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[13px] font-semibold transition ${active ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"}`}><Icon size={20} className={ai ? "text-amber-500" : active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 group-hover:text-indigo-500"} /><span>{label}</span>{ai && <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-extrabold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">COPILOT</span>}</button>)}</div>
          <p className="mb-2 mt-7 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Ajustes y sistema</p>
          <div className="space-y-1">{navSystem.map(({ label, icon: Icon }) => <button key={label} className="group flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"><Icon size={20} className="text-slate-400 group-hover:text-indigo-500" /><span>{label}</span></button>)}</div>
        </nav>
        <div className="m-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm dark:bg-slate-800"><Activity size={17} /><i className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-800" /></span>
          <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-slate-800 dark:text-slate-200">Sistema operativo</p><p className="mt-0.5 text-[10px] text-slate-400">Datos cargados</p></div>
          <button onClick={() => setDark(!dark)} title="Cambiar tema" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
        </div>
      </aside>
    </>
  );
}

function KpiCard({ item }) {
  const Icon = item.icon;
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{item.title}</p><div className={`grid h-10 w-10 place-items-center rounded-xl ${colorClasses[item.color]}`}><Icon size={20} /></div></div><p className="mt-2 text-[24px] font-extrabold tracking-tight text-slate-950 dark:text-white">{item.value}</p><div className="mt-3 flex items-center justify-between gap-2"><span className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-extrabold ${item.positive ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"}`}>{item.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{item.change}</span><span className="truncate text-[9px] text-slate-400">{item.detail}</span></div></article>;
}

function MainChart() {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Agua Captada Diaria</h2><p className="mt-1 text-[10px] text-slate-400">Acumulado enero-agosto · últimos 10 años</p></div><div className="flex gap-3 text-[9px] font-semibold text-slate-500"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-indigo-600" />Melonares</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-cyan-500" />Gergal</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-slate-500" />Minilla</span></div></div><div className="relative mt-7 h-[260px] border-b border-slate-200 dark:border-slate-700">{[0,1,2,3].map(n => <i key={n} className="absolute left-0 right-0 border-t border-dashed border-slate-100 dark:border-slate-800" style={{top:`${n*25}%`}} />)}<div className="absolute inset-0 flex items-end justify-around gap-2 px-3">{chartValues.map((v,i) => <div key={chartYears[i]} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="flex w-full max-w-12 items-end justify-center gap-[2px]" style={{height:`${v}%`}}><span className="h-full w-1/3 rounded-t-sm bg-indigo-600" /><span className="h-[62%] w-1/3 rounded-t-sm bg-cyan-500" /><span className="h-[35%] w-1/3 rounded-t-sm bg-slate-400 dark:bg-slate-600" /></div><span className="text-[9px] text-slate-400">{chartYears[i]}</span></div>)}</div></div></article>;
}

function MiniChart({ title, color, values }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h3 className="text-[13px] font-extrabold text-slate-900 dark:text-white">{title}</h3><p className="mt-1 text-[9px] text-slate-400">Comparativa mensual</p><div className="mt-6 flex h-36 items-end gap-2 border-b border-slate-200 px-1 dark:border-slate-700">{values.map((v,i) => <div key={i} className="flex flex-1 items-end gap-[2px]"><span className="w-1/2 rounded-t-sm bg-slate-200 dark:bg-slate-700" style={{height:`${Math.max(12,v-13)}px`}} /><span className={`w-1/2 rounded-t-sm ${color}`} style={{height:`${v}px`}} /></div>)}</div><div className="mt-2 flex justify-between text-[8px] text-slate-400"><span>Ene</span><span>Mar</span><span>May</span><span>Jul</span><span>Sep</span><span>Dic</span></div></article>;
}

export default function App() {
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState("Agosto");
  const [year, setYear] = useState("2023");

  return <div className={dark ? "dark" : ""}><div className="min-h-screen bg-slate-50 font-sans text-slate-800 transition-colors dark:bg-slate-950 dark:text-slate-100"><Sidebar open={open} setOpen={setOpen} dark={dark} setDark={setDark} /><div className="lg:ml-[278px]">
    <header className="sticky top-0 z-20 flex min-h-[78px] items-center border-b border-slate-200 bg-white/90 px-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 sm:px-4 lg:px-5"><div className="flex min-w-0 items-center gap-3"><button onClick={() => setOpen(true)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800" aria-label="Abrir menú"><Menu size={21} /></button><div className="min-w-0"><h1 className="truncate text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">Estadísticos 1</h1><p className="mt-0.5 truncate text-[11px] font-medium text-slate-400 dark:text-slate-500">Evolución histórica de los principales indicadores de captación, distribución e intercambios de agua</p></div></div></header>
    <main className="w-full p-3 sm:p-4 lg:p-5">
      <section className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex h-[38px] shrink-0 items-center gap-2 px-1 text-xs font-extrabold uppercase tracking-wide text-slate-400"><Filter size={17} className="text-indigo-500" /><span>Filtros:</span></div><label className="flex min-w-[180px] flex-1 items-center gap-2 sm:flex-none"><span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-slate-400">Mes</span><select value={month} onChange={e => setMonth(e.target.value)} className="h-[38px] min-w-[125px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 outline-none transition hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">{["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map(m => <option key={m}>{m}</option>)}</select></label><label className="flex min-w-[150px] flex-1 items-center gap-2 sm:flex-none"><span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-slate-400">Año</span><select value={year} onChange={e => setYear(e.target.value)} className="h-[38px] min-w-[100px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 outline-none transition hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">{[2020,2021,2022,2023,2024,2025,2026].map(y => <option key={y}>{y}</option>)}</select></label></section>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map(item => <KpiCard key={item.title} item={item} />)}</section><section className="mt-4"><MainChart /></section><section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3"><MiniChart title="Agua bruta exportada" color="bg-amber-500" values={[38,55,48,75,62,81,69,98,78,88,67,92]} /><MiniChart title="Agua tratada importada" color="bg-emerald-500" values={[55,68,61,80,74,91,79,102,90,111,96,118]} /><MiniChart title="Agua tratada exportada" color="bg-indigo-600" values={[42,53,46,69,58,75,66,88,73,95,82,104]} /></section>
    </main></div></div></div>;
}
