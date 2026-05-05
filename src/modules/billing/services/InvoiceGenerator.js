export const InvoiceGenerator = {
  generateDraftLines(expectedReports, rates, instances) {
    const ratesMap = {}
    for (const r of rates) {
      if (r.active && r.autoInclude && r.ruleId) ratesMap[r.ruleId] = r
    }

    const lines = []
    for (let i = 0; i < expectedReports.length; i++) {
      const { rule, period } = expectedReports[i]
      const rate = ratesMap[rule.id]
      if (!rate) continue

      const instance = instances.find(
        inst => inst.ruleId === rule.id && inst.period === period
      ) ?? null

      lines.push({
        type: 'auto',
        ruleId: rule.id,
        instanceId: instance?.id ?? null,
        name: rate.name,
        qty: 1,
        unitPrice: rate.price,
        finalPrice: null,
        included: true,
        notes: '',
        sortOrder: i,
      })
    }
    return lines
  },
}
