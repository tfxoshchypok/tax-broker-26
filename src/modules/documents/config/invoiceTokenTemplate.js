// Конфіг текстового шаблонизатора рахунків: каталог токенів, конструкції,
// типове тіло та дефолтні шаблони для сидування таблиці documentTemplates.
// Дані тепер у БД (documentTemplates), не в localStorage.

export const DEFAULT_FONT = "'Times New Roman', serif"
export const DEFAULT_ACCENT = '#18a058'

export const FONT_OPTIONS = [
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
  { label: 'Arial',          value: "Arial, 'Helvetica Neue', sans-serif" },
  { label: 'Georgia',        value: 'Georgia, serif' },
]

// Регекс табличного маркера: рендерер вставляє на його місце таблицю позицій.
// Допускає пробіли всередині: {{ table.lines }}.
export const TABLE_TOKEN_RE = /\{\{\s*table\.lines\s*\}\}/

// Конструкції рушія для вставки в шаблон.
export const CONSTRUCT_SNIPPETS = [
  { label: 'Умова', snippet: '{{#if client.ipn}}\nІПН / ЄДРПОУ: {{ client.ipn }}\n{{/if}}' },
  { label: 'Умова / інакше', snippet: '{{#if client.ipn}}\nІПН / ЄДРПОУ: {{ client.ipn }}\n{{else}}\n(код не вказано)\n{{/if}}' },
  { label: 'Цикл позицій', snippet: '{{#each lines}}\n{{ @number }}. {{ this.name }} — {{ this.total | money }}\n{{/each}}' },
]

export const DEFAULT_BODY = `# Рахунок № {{ invoice.number }} від {{ invoice.date | date }}

Період: {{ invoice.period }}

**ВИКОНАВЕЦЬ:** {{ owner.fullName }}
{{#if owner.ipn}}ІПН: {{ owner.ipn }}{{/if}}
{{#if owner.iban}}IBAN: {{ owner.iban }}{{/if}}
{{ owner.bankName }}

**ЗАМОВНИК:** {{ client.name }}
{{#if client.ipn}}ІПН / ЄДРПОУ: {{ client.ipn }}{{/if}}

{{ table.lines }}

**Разом до сплати: {{ invoice.total | money }}**

{{#if invoice.notes}}*{{ invoice.notes }}*{{/if}}`
