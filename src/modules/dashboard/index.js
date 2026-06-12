import DashboardView from './views/DashboardView.vue'

export const DashboardPlugin = {
  install(app, { router }) {
    router.addRoute({ path: '/dashboard', name: 'dashboard', component: DashboardView })
  },
}
