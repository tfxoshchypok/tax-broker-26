import { describe, it, expect } from 'vitest'
import { shallowMount, mount } from '@vue/test-utils'
import TaxReportStatusBadge from '@/modules/tax/components/TaxReportStatusBadge.vue'

const globalStubs = {
  NTag: { template: '<span><slot /></span>' },
  NIcon: { template: '<i></i>' },
}

describe('TaxReportStatusBadge', () => {
  it.each(['pending', 'contacted', 'submitted'])('renders without errors for status "%s"', (status) => {
    expect(() => shallowMount(TaxReportStatusBadge, { props: { status } })).not.toThrow()
  })

  it('renders "Здано" label for submitted status', () => {
    const wrapper = mount(TaxReportStatusBadge, {
      props: { status: 'submitted' },
      global: { stubs: globalStubs },
    })
    expect(wrapper.text()).toContain('Здано')
  })
})
