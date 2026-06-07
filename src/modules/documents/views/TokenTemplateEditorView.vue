<template>
  <div class="view-container">
    <n-page-header title="Редагування шаблону" @back="goBack">
      <template #extra>
        <n-space>
          <n-button quaternary @click="revert">
            <template #icon><n-icon><RefreshOutline /></n-icon></template>
            Відмінити зміни
          </n-button>
          <n-button type="primary" @click="save">
            <template #icon><n-icon><SaveOutline /></n-icon></template>
            Зберегти
          </n-button>
        </n-space>
      </template>
    </n-page-header>

    <div class="name-row">
      <div class="field">
        <span class="field-label">Назва шаблону</span>
        <n-input v-model:value="draft.name" placeholder="Назва шаблону" style="width: 320px;" />
      </div>
      <div class="field">
        <span class="field-label">Сутність (джерело даних)</span>
        <n-select v-model:value="draft.type" :options="ENTITY_OPTIONS" style="width: 220px;" />
      </div>
    </div>

    <!-- Палітра токенів і конструкцій -->
    <n-card size="small" class="token-bar-card">
      <div class="token-bar">
        <div v-for="group in entity.tokenGroups" :key="group.label" class="token-select">
          <n-select
            :value="null"
            :placeholder="group.label"
            :options="group.tokens.map(t => ({ label: t.label, value: t.token }))"
            size="small"
            @update:value="insertText"
          />
        </div>

        <div class="token-select">
          <n-select
            :value="null"
            placeholder="Конструкції"
            :options="CONSTRUCT_SNIPPETS.map(s => ({ label: s.label, value: s.snippet }))"
            size="small"
            @update:value="insertText"
          />
        </div>

        <div class="token-bar-spacer"></div>

        <div class="field">
          <span class="field-label">Шрифт</span>
          <n-select v-model:value="draft.fontFamily" :options="FONT_OPTIONS" size="small" style="width: 170px;" />
        </div>
        <div class="field">
          <span class="field-label">Колір</span>
          <n-color-picker v-model:value="draft.accentColor" :show-alpha="false" :modes="['hex']" size="small" style="width: 110px;" />
        </div>
      </div>
    </n-card>

    <!-- Шаблон і перегляд — поруч -->
    <div class="editor">
      <n-card title="Шаблон" size="small">
        <template #header-extra>
          <n-text depth="3" style="font-size: 12px;">
            Markdown: # заголовок · **жирний** · *курсив* · - список · ---
          </n-text>
        </template>
        <textarea
          ref="textareaRef"
          v-model="draft.body"
          class="template-textarea"
          spellcheck="false"
        ></textarea>
      </n-card>

      <n-card title="Перегляд" size="small" class="preview-card">
        <div class="preview-sheet">
          <DocumentRenderer :template="draft" :context="previewContext" />
        </div>
      </n-card>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import {
  NPageHeader, NSpace, NButton, NIcon, NCard, NInput,
  NSelect, NColorPicker, NText, useMessage,
} from 'naive-ui'
import { RefreshOutline, SaveOutline } from '@vicons/ionicons5'
import { useOwnerProfileStore } from '@/stores/ownerProfile.js'
import { useDocumentTemplatesStore } from '../stores/documentTemplates.js'
import DocumentRenderer from '../components/DocumentRenderer.vue'
import { FONT_OPTIONS, CONSTRUCT_SNIPPETS, DEFAULT_ACCENT, DEFAULT_FONT } from '../config/invoiceTokenTemplate.js'
import { ENTITY_OPTIONS, getEntity } from '../config/entities.js'

const props = defineProps({ id: { type: [String, Number], required: true } })

const router = useRouter()
const message = useMessage()
const ownerStore = useOwnerProfileStore()
const store = useDocumentTemplatesStore()

const textareaRef = ref(null)
const draft = reactive({ name: '', type: 'invoices', body: '', accentColor: DEFAULT_ACCENT, fontFamily: DEFAULT_FONT })

const templateId = computed(() => Number(props.id))

const entity = computed(() => getEntity(draft.type))

// Реальний профіль виконавця заміщує демо-дані у прев'ю (для сутностей із owner).
const previewContext = computed(() =>
  entity.value.buildContext(ownerStore.profile ? { ownerProfile: ownerStore.profile } : {})
)

function loadDraft() {
  const t = store.list.find(x => x.id === templateId.value)
  if (!t) return
  draft.name = t.name
  draft.type = t.type ?? 'invoices'
  draft.body = t.body
  draft.accentColor = t.accentColor ?? DEFAULT_ACCENT
  draft.fontFamily = t.fontFamily ?? DEFAULT_FONT
}

function goBack() {
  router.push({ name: 'settings', query: { tab: 'templates' } })
}

// Вставляє текст (токен або конструкцію) у позицію курсора textarea.
function insertText(text) {
  if (!text) return
  const el = textareaRef.value
  if (!el) { draft.body += text; return }
  const start = el.selectionStart ?? draft.body.length
  const end = el.selectionEnd ?? draft.body.length
  draft.body = draft.body.slice(0, start) + text + draft.body.slice(end)
  nextTick(() => {
    el.focus()
    const pos = start + text.length
    el.setSelectionRange(pos, pos)
  })
}

async function save() {
  await store.update(templateId.value, {
    name: draft.name,
    type: draft.type,
    body: draft.body,
    accentColor: draft.accentColor,
    fontFamily: draft.fontFamily,
  })
  message.success('Шаблон збережено')
}

function revert() {
  loadDraft()
  message.info('Зміни відмінено')
}

onMounted(async () => {
  if (store.list.length === 0) await store.fetchAll()
  await ownerStore.load()
  loadDraft()
})
</script>

<style scoped>
.view-container {
  padding: 24px;
  max-width: 1280px;
}

.name-row {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  margin: 12px 0 16px;
}

/* Блок токенів над редактором */
.token-bar-card {
  margin-bottom: 16px;
}

.token-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
}

.token-select {
  width: 180px;
}

.token-bar-spacer {
  flex: 1 1 auto;
}

/* Шаблон і перегляд — поруч */
.editor {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  align-items: start;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.6;
}

.template-textarea {
  width: 100%;
  min-height: 420px;
  resize: vertical;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 6px;
  padding: 10px 12px;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  background: transparent;
  color: inherit;
  box-sizing: border-box;
}

.template-textarea:focus {
  outline: none;
  border-color: #18a058;
}

.preview-sheet {
  background: #fff;
  padding: 32px 40px;
  border-radius: 6px;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.12);
  min-height: 400px;
  overflow: auto;
}
</style>
