<template>
  <div class="doc" :style="rootStyle">
    <template v-for="(seg, i) in segments" :key="i">
      <!-- Текстовий сегмент: рушій → Markdown → HTML -->
      <div v-if="seg.type === 'text'" class="doc-text" v-html="seg.html"></div>

      <!-- Таблиця позицій на місці {{ table.lines }} -->
      <table v-else class="lines-table">
        <thead>
          <tr>
            <th class="col-num">#</th>
            <th class="col-name">Послуга</th>
            <th class="col-qty">Кіл.</th>
            <th class="col-price">Ціна</th>
            <th class="col-total">Сума</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(line, idx) in lines" :key="idx">
            <td class="col-num">{{ line.number ?? idx + 1 }}</td>
            <td class="col-name">{{ line.name || '—' }}</td>
            <td class="col-qty">{{ line.qty }}</td>
            <td class="col-price">{{ formatMoney(line.unitPrice) }}</td>
            <td class="col-total">{{ formatMoney(line.total) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" class="total-label">Разом:</td>
            <td class="col-total total-value">{{ formatMoney(grandTotal) }}</td>
          </tr>
        </tfoot>
      </table>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { TABLE_TOKEN_RE } from '../config/invoiceTokenTemplate.js'
import { renderTemplate, FILTERS } from '../engine/templateEngine.js'
import { renderMarkdown } from '../engine/markdown.js'

const props = defineProps({
  template: { type: Object, required: true },
  context:  { type: Object, default: () => ({}) },
})

const rootStyle = computed(() => ({
  '--doc-accent': props.template.accentColor,
  fontFamily: props.template.fontFamily,
}))

const lines = computed(() => Array.isArray(props.context.lines) ? props.context.lines : [])

const grandTotal = computed(() =>
  lines.value.reduce((sum, l) => sum + (Number(l.total) || 0), 0)
)

// Розбиваємо тіло на текстові сегменти + місце таблиці; кожен текстовий
// сегмент: рушій шаблонів → Markdown → HTML.
const segments = computed(() => {
  const parts = (props.template.body ?? '').split(TABLE_TOKEN_RE)
  const out = []
  parts.forEach((part, i) => {
    out.push({ type: 'text', html: renderMarkdown(renderTemplate(part, props.context).trim()) })
    if (i < parts.length - 1) out.push({ type: 'table' })
  })
  return out
})

const formatMoney = FILTERS.money
</script>

<style scoped>
.doc {
  font-size: 13px;
  color: #000;
  background: #fff;
}

.doc-text {
  line-height: 1.6;
}

/* Розмітка з v-html (scoped не діє → :deep) */
.doc-text :deep(p) {
  margin: 8px 0;
}

.doc-text :deep(h1),
.doc-text :deep(h2),
.doc-text :deep(h3),
.doc-text :deep(h4) {
  color: var(--doc-accent);
  margin: 14px 0 6px;
  line-height: 1.25;
}

.doc-text :deep(h1) { font-size: 22px; }
.doc-text :deep(h2) { font-size: 18px; }
.doc-text :deep(h3) { font-size: 15px; }
.doc-text :deep(h4) { font-size: 13px; }

.doc-text :deep(ul),
.doc-text :deep(ol) {
  margin: 8px 0;
  padding-left: 22px;
}

.doc-text :deep(li) {
  margin: 2px 0;
}

.doc-text :deep(hr) {
  border: none;
  border-top: 1px solid color-mix(in srgb, var(--doc-accent) 35%, #ccc);
  margin: 14px 0;
}

.doc-text :deep(strong) { font-weight: bold; }
.doc-text :deep(em) { font-style: italic; }

.doc-text :deep(code) {
  font-family: 'Consolas', monospace;
  background: rgba(0, 0, 0, 0.05);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 0.92em;
}

.doc-text :deep(a) {
  color: var(--doc-accent);
  text-decoration: underline;
}

.lines-table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0 16px;
  font-size: 12px;
}

.lines-table th,
.lines-table td {
  border: 1px solid #ccc;
  padding: 5px 8px;
  text-align: left;
}

.lines-table thead th {
  background: color-mix(in srgb, var(--doc-accent) 12%, #fff);
  border-color: color-mix(in srgb, var(--doc-accent) 35%, #ccc);
  font-weight: bold;
}

.col-num   { width: 32px; text-align: center; }
.col-qty   { width: 48px; text-align: center; }
.col-price { width: 100px; text-align: right; }
.col-total { width: 110px; text-align: right; }

.total-label {
  text-align: right;
  font-weight: bold;
  border-right: none;
}

.total-value {
  font-weight: bold;
}
</style>
