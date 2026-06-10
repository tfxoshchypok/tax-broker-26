// Computes occurrences of individual (manually-scheduled) reports that fall into
// a given month, returning the same shape as TaxReportEngine.getExpectedReports:
//   { rule, period, dueDate, submissionStart }
// so the dashboard can treat them uniformly with rule-based reports.

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0)
}

// Add whole months to a date, clamping the day to the target month's length
// (e.g. Jan 31 + 1 month → Feb 28/29, not Mar 3).
function addMonths(date, months) {
  const total = date.getMonth() + months
  const year = date.getFullYear() + Math.floor(total / 12)
  const month = ((total % 12) + 12) % 12
  const result = new Date(year, month, date.getDate())
  if (result.getMonth() !== month) result.setDate(0)
  return result
}

function overlapsWithMonth(windowStart, windowEnd, year, month) {
  const first = new Date(year, month - 1, 1)
  const last = lastDayOfMonth(year, month)
  return windowStart <= last && windowEnd >= first
}

export function getIndividualReports(assignments, typesById, year, month) {
  const results = []

  for (const assignment of assignments) {
    const type = typesById[assignment.typeId]
    if (!type || !type.active) continue

    const leadDays = assignment.leadDays ?? 0
    const anchor = new Date(assignment.dueDate)
    const rule = {
      id: type.key,
      ruleId: type.key,
      name: type.name,
      shortName: type.shortName,
      category: type.category,
    }

    const pushIfOverlaps = (due) => {
      const windowStart = new Date(due.getTime() - leadDays * 86400000)
      if (!overlapsWithMonth(windowStart, due, year, month)) return
      const period = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}`
      results.push({ rule, period, dueDate: due.getTime(), submissionStart: windowStart.getTime() })
    }

    if (type.mode === 'periodic' && type.intervalMonths > 0) {
      const interval = type.intervalMonths
      // Occurrences are anchor + k·interval (k ≥ 0). Estimate the occurrence index
      // nearest the viewed month, then probe a neighbourhood wide enough to cover a
      // long lead window that straddles several months.
      const monthsFromAnchor = (year - anchor.getFullYear()) * 12 + (month - 1 - anchor.getMonth())
      const kCenter = Math.round(monthsFromAnchor / interval)
      const radius = 2 + Math.ceil(Math.ceil(leadDays / 28) / interval)
      for (let k = kCenter - radius; k <= kCenter + radius; k++) {
        if (k < 0) continue
        pushIfOverlaps(addMonths(anchor, k * interval))
      }
    } else {
      pushIfOverlaps(anchor)
    }
  }

  results.sort((a, b) => a.dueDate - b.dueDate)
  return results
}
