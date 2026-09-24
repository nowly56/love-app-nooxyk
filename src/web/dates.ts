export function todayLocal(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00`);
  return (
    !Number.isNaN(d.getTime()) &&
    todayLocal(d) === value &&
    value >= "1900-01-01" &&
    value <= todayLocal()
  );
}
export function daysTogether(start: string, end = todayLocal()): number {
  return Math.max(
    0,
    Math.round(
      (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
        86400000,
    ),
  );
}
export function displayDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
