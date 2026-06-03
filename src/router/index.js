import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/clients',
  },
  {
    path: '/clients',
    name: 'clients',
    component: () => import('@/views/ClientsView.vue'),
  },
  {
    path: '/clients/new',
    name: 'client-new',
    component: () => import('@/views/ClientFormView.vue'),
  },
  {
    path: '/clients/:id',
    name: 'client-detail',
    component: () => import('@/views/ClientDetailView.vue'),
    props: true,
  },
  {
    path: '/clients/:id/edit',
    name: 'client-edit',
    component: () => import('@/views/ClientFormView.vue'),
    props: true,
  },
  {
    path: '/tags',
    name: 'tags',
    component: () => import('@/views/TagsView.vue'),
  },
  {
    path: '/groups',
    name: 'groups',
    component: () => import('@/views/GroupsView.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
  },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
