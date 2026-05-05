function evaluateCondition(cond, profile) {
  if (cond.clientType != null && profile.clientType !== cond.clientType) return false
  if (cond.taxSystem != null && profile.taxSystem !== cond.taxSystem) return false
  if (cond.simplifiedGroup != null && !cond.simplifiedGroup.includes(profile.simplifiedGroup)) return false
  if (cond.vatPayer && !profile.vatPayer) return false
  if (cond.hasEmployees && !profile.hasEmployees) return false
  if (cond.exciseTax && !profile.exciseTax) return false
  if (cond.landTax && !profile.landTax) return false
  if (cond.environmentalTax && !profile.environmentalTax) return false
  if (cond.rentTax && !profile.rentTax) return false
  return true
}

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0)
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000)
}

function quarterEnd(year, quarter) {
  return lastDayOfMonth(year, quarter * 3)
}

function overlapsWithMonth(windowStart, windowEnd, year, month) {
  const first = new Date(year, month - 1, 1)
  const last = lastDayOfMonth(year, month)
  return windowStart <= last && windowEnd >= first
}

const ADVANCE_MONTH_TO_QUARTER = { 3: 1, 5: 2, 8: 3, 11: 4 }

export function getExpectedReports(profile, year, month, rules) {
  const results = []

  for (const rule of rules) {
    if (!evaluateCondition(rule.condition, profile)) continue

    if (rule.frequency === 'monthly') {
      const periodMonth = month === 1 ? 12 : month - 1
      const periodYear  = month === 1 ? year - 1 : year
      const period  = `${periodYear}-${String(periodMonth).padStart(2, '0')}`
      const dueDate = new Date(year, month - 1, rule.deadline.day)
      results.push({ rule, period, dueDate: dueDate.getTime() })

    } else if (rule.frequency === 'quarterly') {
      const candidates = [
        { quarter: 1, endYear: year },
        { quarter: 2, endYear: year },
        { quarter: 3, endYear: year },
        { quarter: 4, endYear: year },
        { quarter: 4, endYear: year - 1 },
      ]
      for (const { quarter, endYear } of candidates) {
        const end         = quarterEnd(endYear, quarter)
        const windowStart = addDays(end, 1)
        const due         = addDays(end, rule.deadline.value)

        if (overlapsWithMonth(windowStart, due, year, month)) {
          const periodKey = `${endYear}-Q${quarter}`
          if (!results.some(r => r.rule.id === rule.id && r.period === periodKey)) {
            results.push({ rule, period: periodKey, dueDate: due.getTime() })
          }
        }
      }

    } else if (rule.frequency === 'annual') {
      const dlMonth = rule.deadline.month
      const windowStartMonth = dlMonth <= 1 ? 1 : dlMonth - 1
      const windowStartYear  = dlMonth <= 1 ? year - 1 : year
      const windowStart = new Date(windowStartYear, windowStartMonth - 1, 1)
      const due         = new Date(year, dlMonth - 1, rule.deadline.day)

      if (overlapsWithMonth(windowStart, due, year, month)) {
        results.push({ rule, period: `${year - 1}`, dueDate: due.getTime() })
      }

    } else if (rule.frequency === 'fixed_dates') {
      for (const dateSpec of rule.deadline.dates) {
        const windowStart = new Date(year, dateSpec.month - 1, 1)
        const due         = new Date(year, dateSpec.month - 1, dateSpec.day)

        if (overlapsWithMonth(windowStart, due, year, month)) {
          const quarter = ADVANCE_MONTH_TO_QUARTER[dateSpec.month] ?? Math.ceil(dateSpec.month / 3)
          results.push({ rule, period: `${year}-Q${quarter}`, dueDate: due.getTime() })
          break
        }
      }
    }
  }

  results.sort((a, b) => a.dueDate - b.dueDate)
  return results
}
