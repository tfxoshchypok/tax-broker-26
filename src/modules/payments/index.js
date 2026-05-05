import PaymentsDashboardView from './views/PaymentsDashboardView.vue'
import PaymentDetailView     from './views/PaymentDetailView.vue'

export const PaymentsPlugin = {
  install(app, { router }) {
    router.addRoute({ path: '/payments',     name: 'payments-dashboard', component: PaymentsDashboardView })
    router.addRoute({ path: '/payments/:id', name: 'payment-detail',     component: PaymentDetailView, props: true })
  },
}
