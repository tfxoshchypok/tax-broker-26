// Невеликий Markdown→HTML рендерер (підмножина для документів).
// Підтримує: заголовки (#..######), **жирний**/__, *курсив*/_, `код`,
// списки (- / * та 1.), горизонтальну лінію (---), посилання [текст](url).
// Спершу екранує HTML — тож дані з токенів і текст шаблону безпечні (без XSS).

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function inline(s) {
  let out = s
  // `код` — першим, щоб захистити вміст
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
  // посилання [текст](url) — лише безпечні схеми
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, url) => {
    const safe = /^(https?:|mailto:)/i.test(url) ? url : '#'
    return `<a href="${safe}">${txt}</a>`
  })
  // **жирний** / __жирний__
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  // *курсив* / _курсив_
  out = out.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
  out = out.replace(/(^|[^_])_([^_\s][^_]*)_/g, '$1<em>$2</em>')
  return out
}

export function renderMarkdown(src) {
  const lines = escapeHtml(src ?? '').split('\n')
  const html = []
  let listType = null   // 'ul' | 'ol'
  let para = []

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${para.map(inline).join('<br>')}</p>`)
      para = []
    }
  }
  const closeList = () => {
    if (listType) { html.push(`</${listType}>`); listType = null }
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    const trimmed = line.trim()

    if (trimmed === '') { flushPara(); closeList(); continue }

    if (/^---+$/.test(trimmed)) { flushPara(); closeList(); html.push('<hr>'); continue }

    const h = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (h) { flushPara(); closeList(); const lvl = h[1].length; html.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); continue }

    const ul = trimmed.match(/^[-*]\s+(.*)$/)
    if (ul) {
      flushPara()
      if (listType !== 'ul') { closeList(); html.push('<ul>'); listType = 'ul' }
      html.push(`<li>${inline(ul[1])}</li>`)
      continue
    }

    const ol = trimmed.match(/^\d+\.\s+(.*)$/)
    if (ol) {
      flushPara()
      if (listType !== 'ol') { closeList(); html.push('<ol>'); listType = 'ol' }
      html.push(`<li>${inline(ol[1])}</li>`)
      continue
    }

    if (listType) closeList()
    para.push(trimmed)
  }

  flushPara()
  closeList()
  return html.join('\n')
}
