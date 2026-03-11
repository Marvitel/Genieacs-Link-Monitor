const BRT_OPTIONS: Intl.DateTimeFormatOptions = { timeZone: "America/Sao_Paulo" };

export function formatBRT(date: string | Date | null | undefined, style: "full" | "date" | "time" = "full"): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  if (style === "date") return d.toLocaleDateString("pt-BR", BRT_OPTIONS);
  if (style === "time") return d.toLocaleTimeString("pt-BR", BRT_OPTIONS);
  return d.toLocaleString("pt-BR", BRT_OPTIONS);
}
