// Повноцінний текстовий рушій шаблонів (mini-Handlebars).
// Підтримує:
//   {{ path }}                     — підстановка значення за шляхом (з крапками)
//   {{ path | filter }}            — фільтри: money, number, date, upper, lower, default:"…"
//   {{ path | f1 | f2:arg }}       — ланцюжок фільтрів
//   {{#if path}} … {{else}} … {{/if}}
//   {{#each path}} … {{/each}}     — у циклі доступні: this, this.field, @index, @number, @first, @last
//
// Рушій працює суто над текстом (без HTML), результат рендериться як текст.

export const FILTERS = {
  money: (v) => Number(v ?? 0).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' грн',
  number: (v) => Number(v ?? 0).toLocaleString('uk-UA'),
  date: (v) => {
    if (v == null || v === '') return ''
    const d = new Date(v)
    return Number.isNaN(d.getTime())
      ? String(v)
      : d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
  },
  upper: (v) => String(v ?? '').toUpperCase(),
  lower: (v) => String(v ?? '').toLowerCase(),
  default: (v, arg) => (v === undefined || v === null || v === '') ? (arg ?? '') : v,
}

// ── Лексер ────────────────────────────────────────────────
function tokenize(input) {
  const tokens = []
  const re = /\{\{([^{}]*)\}\}/g
  let last = 0
  let m
  while ((m = re.exec(input))) {
    if (m.index > last) tokens.push({ t: 'text', v: input.slice(last, m.index) })
    tokens.push({ t: 'tag', v: m[1].trim() })
    last = re.lastIndex
  }
  if (last < input.length) tokens.push({ t: 'text', v: input.slice(last) })
  return tokens
}

// ── Парсер у AST ──────────────────────────────────────────
function parse(tokens) {
  const root = { type: 'root', children: [] }
  const stack = [root]
  const childrenOf = (f) => (f.type === 'if' ? (f.current === 'else' ? f.else : f.then) : f.children)

  for (const tk of tokens) {
    const top = stack[stack.length - 1]

    if (tk.t === 'text') {
      childrenOf(top).push({ type: 'text', value: tk.v })
      continue
    }

    const tag = tk.v

    if (tag === 'else') {
      if (top.type === 'if') top.current = 'else'
      continue
    }
    if (tag === '/if' || tag === '/each') {
      if (stack.length > 1) stack.pop()
      continue
    }
    if (tag.startsWith('#if')) {
      const node = { type: 'if', cond: tag.slice(3).trim(), then: [], else: [], current: 'then' }
      childrenOf(top).push(node)
      stack.push(node)
      continue
    }
    if (tag.startsWith('#each')) {
      const node = { type: 'each', path: tag.slice(5).trim(), children: [] }
      childrenOf(top).push(node)
      stack.push(node)
      continue
    }

    childrenOf(top).push({ type: 'var', expr: tag })
  }

  return root
}

// ── Резолвери ─────────────────────────────────────────────
function resolvePath(obj, path) {
  if (obj == null) return undefined
  if (Object.prototype.hasOwnProperty.call(obj, path)) return obj[path] // '@index', 'name', …
  let val = obj
  for (const p of path.split('.')) {
    if (val == null) return undefined
    val = val[p]
  }
  return val
}

function stripQuotes(s) {
  const t = s.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1)
  }
  return t
}

function renderVar(expr, scope) {
  const segs = expr.split('|')
  let val = resolvePath(scope, segs[0].trim())
  for (let i = 1; i < segs.length; i++) {
    const f = segs[i].trim()
    const ci = f.indexOf(':')
    const name = ci < 0 ? f : f.slice(0, ci).trim()
    const arg = ci < 0 ? undefined : stripQuotes(f.slice(ci + 1))
    const fn = FILTERS[name]
    if (fn) val = fn(val, arg)
    // Невідомий фільтр лишає значення без змін; у dev попереджаємо про опечатку.
    else if (import.meta.env?.DEV && import.meta.env?.MODE !== 'test') {
      console.warn(`[templateEngine] невідомий фільтр: «${name}»`)
    }
  }
  return val == null ? '' : String(val)
}

function isTruthy(v) {
  if (Array.isArray(v)) return v.length > 0
  return !(v === undefined || v === null || v === false || v === '' || v === 0)
}

// ── Рендер ────────────────────────────────────────────────
function renderNodes(nodes, scope) {
  let out = ''
  for (const n of nodes) {
    if (n.type === 'text') {
      out += n.value
    } else if (n.type === 'var') {
      out += renderVar(n.expr, scope)
    } else if (n.type === 'if') {
      out += isTruthy(resolvePath(scope, n.cond))
        ? renderNodes(n.then, scope)
        : renderNodes(n.else, scope)
    } else if (n.type === 'each') {
      const arr = resolvePath(scope, n.path)
      if (Array.isArray(arr)) {
        arr.forEach((item, i) => {
          const itemFields = item && typeof item === 'object' ? item : {}
          const childScope = {
            ...scope,
            ...itemFields,
            this: item,
            '@index': i,
            '@number': i + 1,
            '@first': i === 0,
            '@last': i === arr.length - 1,
          }
          out += renderNodes(n.children, childScope)
        })
      }
    }
  }
  return out
}

export function renderTemplate(text, context) {
  if (typeof text !== 'string') return ''
  return renderNodes(parse(tokenize(text)).children, context ?? {})
}
