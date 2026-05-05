import { h } from 'vue'

export function renderTagOption(option) {
  return h('span', [
    h('span', {
      style: {
        display: 'inline-block', width: '10px', height: '10px',
        borderRadius: '50%', background: option.color, marginRight: '6px',
      },
    }),
    option.label,
  ])
}
