import TaxDashboardView from './views/TaxDashboardView.vue'

export const TaxPlugin = {
  install(app, { router }) {
    router.addRoute({
      path: '/tax',
      name: 'tax-dashboard',
      component: TaxDashboardView,
    })
  },
}
