import type { Job, PayPeriod } from "@/lib/data/types";

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("es-MX");

export const formatMXN = (n: number) => mxn.format(n);
export const formatNumber = (n: number) => num.format(n);

export const PERIOD_SHORT: Record<PayPeriod, string> = {
  semana: "sem",
  quincena: "qna",
  mes: "mes",
  dia: "día",
};
export const PERIOD_LONG: Record<PayPeriod, string> = {
  semana: "por semana",
  quincena: "por quincena",
  mes: "al mes",
  dia: "por día",
};

/** "$2,600/sem" or "$2,400–2,800/sem" */
export function formatPay(job: Pick<Job, "pay" | "payMax" | "period">, long = false) {
  const base = job.payMax
    ? `${mxn.format(job.pay)}–${num.format(job.payMax)}`
    : mxn.format(job.pay);
  return long ? `${base} ${PERIOD_LONG[job.period]}` : `${base}/${PERIOD_SHORT[job.period]}`;
}

export function formatMinutesAgo(m: number): string {
  if (m < 1) return "Justo ahora";
  if (m < 60) return `Hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "Ayer";
  return `Hace ${d} días`;
}
