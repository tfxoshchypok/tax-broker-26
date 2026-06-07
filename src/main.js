import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { router } from '@/router/index.js'
import App from './App.vue'
import './assets/main.css'
import '@/modules/tax/db.js'
import '@/modules/billing/db.js'
import '@/modules/payments/db.js'
import '@/modules/documents/db.js'
import { TaxPlugin }       from '@/modules/tax/index.js'
import { BillingPlugin }   from '@/modules/billing/index.js'
import { PaymentsPlugin }  from '@/modules/payments/index.js'
import { DocumentsPlugin } from '@/modules/documents/index.js'

if (typeof Neutralino !== 'undefined' && window.NL_PORT) {
  Neutralino.init()
}

const app = createApp(App)

app.use(createPinia())

// Реєструємо роути модулів ДО app.use(router): Vue Router виконує початкову
// навігацію вже під час встановлення роутера, тож роути (зокрема /tax,
// куди редіректить '/') мають існувати на цей момент.
app.use(TaxPlugin,      { router })
app.use(BillingPlugin,  { router })
app.use(PaymentsPlugin, { router })
app.use(DocumentsPlugin, { router })

app.use(router)

app.mount('#app')
