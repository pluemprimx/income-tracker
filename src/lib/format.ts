const bahtFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

export function formatBaht(satang: number): string {
  return bahtFormatter.format(satang / 100);
}

export function formatDateTime(epochMs: number): string {
  return dateFormatter.format(new Date(epochMs));
}
