import BillingDashboardView from './views/BillingDashboardView.vue'
import InvoiceFormView      from './views/InvoiceFormView.vue'
import InvoiceDetailView    from './views/InvoiceDetailView.vue'
import ServiceRatesView     from './views/ServiceRatesView.vue'
import PrintInvoiceView     from './views/PrintInvoiceView.vue'

export const BillingPlugin = {
  install(app, { router }) {
    router.addRoute({ path: '/billing',                       name: 'billing-dashboard', component: BillingDashboardView })
    router.addRoute({ path: '/billing/new',                   name: 'billing-new',       component: InvoiceFormView })
    router.addRoute({ path: '/billing/invoices/:id',          name: 'billing-invoice',   component: InvoiceDetailView, props: true })
    router.addRoute({ path: '/billing/invoices/:id/print',    name: 'billing-print',     component: PrintInvoiceView,  props: true })
    router.addRoute({ path: '/billing/rates',                 name: 'billing-rates',     component: ServiceRatesView })
  },
}
