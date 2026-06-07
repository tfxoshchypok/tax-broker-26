import TokenTemplateEditorView from './views/TokenTemplateEditorView.vue'

export const DocumentsPlugin = {
  install(app, { router }) {
    router.addRoute({ path: '/documents/templates/:id', name: 'documents-template-edit', component: TokenTemplateEditorView, props: true })
  },
}
