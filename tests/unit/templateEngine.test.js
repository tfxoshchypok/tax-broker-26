import { describe, it, expect } from 'vitest'
import { renderTemplate, FILTERS } from '@/modules/documents/engine/templateEngine.js'

describe('renderTemplate — змінні', () => {
  it('підставляє значення за крапковим шляхом', () => {
    expect(renderTemplate('Привіт, {{ user.name }}!', { user: { name: 'Олег' } }))
      .toBe('Привіт, Олег!')
  })

  it('порожній рядок для відсутніх значень', () => {
    expect(renderTemplate('[{{ missing.path }}]', {})).toBe('[]')
  })

  it('не чіпає звичайний текст', () => {
    expect(renderTemplate('без токенів', {})).toBe('без токенів')
  })
})

describe('renderTemplate — фільтри', () => {
  it('money форматує число у гривні', () => {
    expect(renderTemplate('{{ x | money }}', { x: 1200 })).toBe(FILTERS.money(1200))
    expect(FILTERS.money(1200)).toContain('1')
    expect(FILTERS.money(1200)).toContain('грн')
  })

  it('upper / lower', () => {
    expect(renderTemplate('{{ s | upper }}', { s: 'abc' })).toBe('ABC')
    expect(renderTemplate('{{ s | lower }}', { s: 'ABC' })).toBe('abc')
  })

  it('default підставляє запасне значення', () => {
    expect(renderTemplate('{{ x | default:"—" }}', { x: '' })).toBe('—')
    expect(renderTemplate('{{ x | default:"—" }}', { x: 'val' })).toBe('val')
  })

  it('ланцюжок фільтрів', () => {
    expect(renderTemplate('{{ x | default:"none" | upper }}', { x: '' })).toBe('NONE')
  })
})

describe('renderTemplate — #if', () => {
  it('рендерить гілку then коли істина', () => {
    expect(renderTemplate('{{#if v}}так{{/if}}', { v: true })).toBe('так')
  })

  it('пропускає коли хибність (порожній рядок, 0, null)', () => {
    expect(renderTemplate('{{#if v}}так{{/if}}', { v: '' })).toBe('')
    expect(renderTemplate('{{#if v}}так{{/if}}', { v: 0 })).toBe('')
    expect(renderTemplate('{{#if v}}так{{/if}}', {})).toBe('')
  })

  it('гілка else', () => {
    expect(renderTemplate('{{#if v}}A{{else}}B{{/if}}', { v: false })).toBe('B')
    expect(renderTemplate('{{#if v}}A{{else}}B{{/if}}', { v: true })).toBe('A')
  })

  it('порожній масив — хибність', () => {
    expect(renderTemplate('{{#if items}}є{{else}}нема{{/if}}', { items: [] })).toBe('нема')
  })
})

describe('renderTemplate — #each', () => {
  it('ітерує масив із this та @number', () => {
    const tpl = '{{#each lines}}{{ @number }}.{{ this.name }} {{/each}}'
    const ctx = { lines: [{ name: 'A' }, { name: 'B' }] }
    expect(renderTemplate(tpl, ctx)).toBe('1.A 2.B ')
  })

  it('поля елемента доступні напряму', () => {
    expect(renderTemplate('{{#each lines}}[{{ name }}]{{/each}}', { lines: [{ name: 'X' }] }))
      .toBe('[X]')
  })

  it('@first / @last', () => {
    const tpl = '{{#each xs}}{{#if @first}}<{{/if}}{{ this }}{{#if @last}}>{{/if}}{{/each}}'
    expect(renderTemplate(tpl, { xs: ['a', 'b', 'c'] })).toBe('<abc>')
  })

  it('фільтри всередині циклу', () => {
    expect(renderTemplate('{{#each lines}}{{ total | money }};{{/each}}', { lines: [{ total: 100 }] }))
      .toBe(FILTERS.money(100) + ';')
  })

  it('порожній масив дає порожній результат', () => {
    expect(renderTemplate('{{#each lines}}x{{/each}}', { lines: [] })).toBe('')
  })
})

describe('renderTemplate — стійкість', () => {
  it('не падає на не-рядку', () => {
    expect(renderTemplate(null, {})).toBe('')
    expect(renderTemplate(undefined, {})).toBe('')
  })

  it('зберігає переноси рядків', () => {
    expect(renderTemplate('a\n{{ v }}\nb', { v: 'X' })).toBe('a\nX\nb')
  })
})
