// Чисті функції розрахунку KPI для дашборду. Без звернень до БД та стану —
// усі дані приходять аргументами від DashboardService/стора.

const UA_SHORT_MONTHS = ['січ','лют','бер','кві','тра','чер','лип','сер','вер','жов','лис','гру']

// Статус інстансу звіту — тотожно computeStatus() у taxDashboard.js.
export function reportStatus(instance) {
  if (!instance) return 'pending'
  if (instance.ignoredAt) return 'ignored'
  if (instance.submittedAt) return 'submitted'
  if (instance.contactedAt) return 'contacted'
  return 'pending'
}

function isInMonth(ts, year, month) {
  const d = new Date(ts)
  return d.getFullYear() === year && d.getMonth() + 1 === month
}

// Сума отриманих платежів за конкретний місяць.
export function revenueForPeriod(payments, year, month) {
  return payments.reduce(
    (sum, p) => (isInMonth(p.date, year, month) ? sum + p.amount : sum),
    0,
  )
}

// Сума отриманих платежів за рік.
export function revenueForYear(payments, year) {
  return payments.reduce(
    (sum, p) => (new Date(p.date).getFullYear() === year ? sum + p.amount : sum),
    0,
  )
}

// Серія доходу по місяцях для графіка: останні monthsBack місяців включно з anchor.
// anchor — { year, month } (1-12), зазвичай вибраний місяць на дашборді.
export function monthlyRevenueSeries(payments, anchor, monthsBack = 12) {
  const series = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(anchor.year, anchor.month - 1 - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    series.push({
      year: y,
      month: m,
      label: `${UA_SHORT_MONTHS[m - 1]} ${String(y).slice(2)}`,
      total: revenueForPeriod(payments, y, m),
    })
  }
  return series
}

// Борг по клієнтах: виставлено (confirmed+paid рахунки) − отримано (усі платежі клієнта).
// invoiceTotals — Map invoiceId → сума рахунку.
// Платежі беруться всі (а не лише привʼязані до billable-рахунків): це дає чистий
// баланс по клієнту. Відʼємний/нульовий результат означає переплату або відсутність
// боргу — такі клієнти відкидаються (поріг 0.005 гасить float-похибку).
// Повертає масив { clientId, billed, paid, debt } лише з debt > 0, відсортований за debt desc.
export function debtByClient(invoices, invoiceTotals, payments) {
  const billed = new Map()
  for (const inv of invoices) {
    if (inv.status !== 'confirmed' && inv.status !== 'paid') continue
    const amount = invoiceTotals.get(inv.id) ?? 0
    billed.set(inv.clientId, (billed.get(inv.clientId) ?? 0) + amount)
  }

  const paid = new Map()
  for (const p of payments) {
    paid.set(p.clientId, (paid.get(p.clientId) ?? 0) + p.amount)
  }

  const result = []
  for (const [clientId, billedSum] of billed) {
    const paidSum = paid.get(clientId) ?? 0
    const debt = billedSum - paidSum
    if (debt > 0.005) {
      result.push({ clientId, billed: billedSum, paid: paidSum, debt })
    }
  }
  result.sort((a, b) => b.debt - a.debt)
  return result
}

// Прострочені звіти: статус ∉ {submitted, ignored} і дедлайн раніше за сьогодні.
// dueDate зберігається як початок дня (00:00), тож звіт зі здачею сьогодні
// прострочується лише з настанням наступного дня.
export function overdueReports(instances, now = Date.now()) {
  const startOfToday = new Date(now).setHours(0, 0, 0, 0)
  return instances.filter(i => {
    const status = reportStatus(i)
    return status !== 'submitted' && status !== 'ignored' && i.dueDate < startOfToday
  })
}
