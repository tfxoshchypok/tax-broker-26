import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '@/modules/documents/engine/markdown.js'

describe('renderMarkdown — блоки', () => {
  it('заголовки за рівнем #', () => {
    expect(renderMarkdown('# Заголовок')).toBe('<h1>Заголовок</h1>')
    expect(renderMarkdown('### Менший')).toBe('<h3>Менший</h3>')
  })

  it('абзац із кількох рядків зʼєднується <br>', () => {
    expect(renderMarkdown('рядок 1\nрядок 2')).toBe('<p>рядок 1<br>рядок 2</p>')
  })

  it('порожній рядок розділяє абзаци', () => {
    expect(renderMarkdown('a\n\nb')).toBe('<p>a</p>\n<p>b</p>')
  })

  it('маркований список', () => {
    expect(renderMarkdown('- один\n- два')).toBe('<ul>\n<li>один</li>\n<li>два</li>\n</ul>')
  })

  it('нумерований список', () => {
    expect(renderMarkdown('1. один\n2. два')).toBe('<ol>\n<li>один</li>\n<li>два</li>\n</ol>')
  })

  it('горизонтальна лінія', () => {
    expect(renderMarkdown('---')).toBe('<hr>')
  })
})

describe('renderMarkdown — інлайн', () => {
  it('жирний і курсив', () => {
    expect(renderMarkdown('**жирний**')).toBe('<p><strong>жирний</strong></p>')
    expect(renderMarkdown('*курсив*')).toBe('<p><em>курсив</em></p>')
  })

  it('код', () => {
    expect(renderMarkdown('`код`')).toBe('<p><code>код</code></p>')
  })

  it('безпечне посилання', () => {
    expect(renderMarkdown('[сайт](https://example.com)'))
      .toBe('<p><a href="https://example.com">сайт</a></p>')
  })

  it('небезпечну схему посилання знешкоджено', () => {
    expect(renderMarkdown('[x](javascript:alert)'))
      .toBe('<p><a href="#">x</a></p>')
  })
})

describe('renderMarkdown — безпека', () => {
  it('екранує HTML із даних', () => {
    expect(renderMarkdown('<script>alert(1)</script>'))
      .toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
  })

  it('порожній вхід', () => {
    expect(renderMarkdown('')).toBe('')
    expect(renderMarkdown(null)).toBe('')
  })
})
