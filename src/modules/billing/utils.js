// Перетворює timestamp на період рахунка у форматі "YYYY-MM".
export function periodFromTs(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
