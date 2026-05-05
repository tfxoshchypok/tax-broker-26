<template>
  <div class="view-container">
    <n-page-header title="Налаштування" />

    <n-tabs v-model:value="activeTab" type="line" style="margin-top: 20px;">

      <!-- ── Реквізити ── -->
      <n-tab-pane name="requisites" tab="Реквізити">
        <n-form ref="ownerFormRef" :model="ownerForm" label-placement="left" label-width="200" style="margin-top: 12px;">
          <n-form-item label="ПІБ" path="fullName">
            <n-input v-model:value="ownerForm.fullName" placeholder="Прізвище Ім'я По батькові" />
          </n-form-item>
          <n-form-item label="ІПН / РНОКПП" path="ipn">
            <n-input v-model:value="ownerForm.ipn" placeholder="1234567890" />
          </n-form-item>
          <n-form-item label="IBAN" path="iban">
            <n-input v-model:value="ownerForm.iban" placeholder="UA..." />
          </n-form-item>
          <n-form-item label="Найменування банку" path="bankName">
            <n-input v-model:value="ownerForm.bankName" placeholder="АТ «Назва банку»" />
          </n-form-item>
          <n-form-item label="Адреса" path="address">
            <n-input v-model:value="ownerForm.address" placeholder="м. Місто, вул. ..." />
          </n-form-item>
          <n-form-item label="Телефон" path="phone">
            <n-input v-model:value="ownerForm.phone" placeholder="+380..." />
          </n-form-item>
          <n-form-item label="Email" path="email">
            <n-input v-model:value="ownerForm.email" placeholder="example@mail.com" />
          </n-form-item>
          <n-form-item>
            <n-button type="primary" :loading="ownerSaving" @click="saveOwner">Зберегти</n-button>
          </n-form-item>
        </n-form>
      </n-tab-pane>

      <!-- ── Прайс ── -->
      <n-tab-pane name="rates" tab="Прайс">
        <div style="margin-top: 12px;">
          <ServiceRatesPanel />
        </div>
      </n-tab-pane>

      <!-- ── Звіти ── -->
      <n-tab-pane name="reports" tab="Звіти">
        <div style="margin-top: 12px;">
          <ReportRulesPanel />
        </div>
      </n-tab-pane>

      <!-- ── Оновлення ── -->
      <n-tab-pane name="update" tab="Оновлення">
        <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 16px; max-width: 520px;">
          <n-card>
            <n-descriptions :column="1" label-placement="left" :label-style="{ width: '180px' }">
              <n-descriptions-item label="Поточна версія">
                <n-tag type="info">{{ currentVersion }}</n-tag>
              </n-descriptions-item>
              <n-descriptions-item v-if="updateInfo && !updateInfo.hasUpdate" label="Статус">
                <n-tag type="success">Остання версія встановлена</n-tag>
              </n-descriptions-item>
              <n-descriptions-item v-if="updateInfo?.hasUpdate" label="Нова версія">
                <n-tag type="warning">{{ updateInfo.latestVersion }}</n-tag>
              </n-descriptions-item>
            </n-descriptions>

            <div style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
              <n-button :loading="checking" :disabled="installing" @click="check">
                Перевірити оновлення
              </n-button>
              <template v-if="updateInfo?.hasUpdate">
                <n-button
                  v-if="updateInfo.canAutoUpdate"
                  type="primary"
                  :loading="installing"
                  :disabled="checking"
                  @click="install"
                >
                  Встановити оновлення
                </n-button>
                <n-button v-else @click="openRelease">
                  Завантажити оновлення
                </n-button>
              </template>
            </div>

            <n-alert v-if="status" type="info" style="margin-top: 12px;">{{ status }}</n-alert>
            <n-alert v-if="updateError" type="error" style="margin-top: 12px;">{{ updateError }}</n-alert>

            <template v-if="updateInfo?.hasUpdate && updateInfo.releaseNotes">
              <n-divider />
              <p style="font-weight: 500; margin-bottom: 8px;">Що нового:</p>
              <n-scrollbar style="max-height: 200px;">
                <pre style="white-space: pre-wrap; font-size: 13px; margin: 0;">{{ updateInfo.releaseNotes }}</pre>
              </n-scrollbar>
            </template>
          </n-card>
        </div>
      </n-tab-pane>

      <!-- ── Все решта ── -->
      <n-tab-pane name="other" tab="Все решта">
        <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 16px;">
          <n-card title="Зовнішній вигляд">
            <n-form label-placement="left" label-width="200">
              <n-form-item label="Тема">
                <n-radio-group v-model:value="ui.theme">
                  <n-radio-button value="light">Світла</n-radio-button>
                  <n-radio-button value="dark">Темна</n-radio-button>
                </n-radio-group>
              </n-form-item>
            </n-form>
          </n-card>

          <n-card title="Список клієнтів">
            <n-form label-placement="left" label-width="200">
              <n-form-item label="Клієнтів на сторінці">
                <n-radio-group v-model:value="ui.defaultPageSize">
                  <n-radio-button :value="10">10</n-radio-button>
                  <n-radio-button :value="20">20</n-radio-button>
                  <n-radio-button :value="50">50</n-radio-button>
                </n-radio-group>
              </n-form-item>
            </n-form>
          </n-card>

          <n-card title="Гарячі клавіші">
            <n-table :bordered="false" :single-line="false" size="small">
              <tbody>
                <tr v-for="s in SHORTCUTS" :key="s.combo">
                  <td style="width: 160px;">
                    <n-space size="small">
                      <n-tag v-for="k in s.combo.split('+')" :key="k" size="small" round>{{ k }}</n-tag>
                    </n-space>
                  </td>
                  <td style="opacity: 0.75;">{{ s.desc }}</td>
                </tr>
              </tbody>
            </n-table>
          </n-card>
        </div>
      </n-tab-pane>

    </n-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import {
  NPageHeader, NTabs, NTabPane, NCard, NForm, NFormItem,
  NRadioGroup, NRadioButton, NTable, NTag, NSpace, NInput, NButton,
  NDescriptions, NDescriptionsItem, NAlert, NDivider, NScrollbar,
  useMessage,
} from 'naive-ui'
import { useUiStore } from '@/stores/ui.js'
import { useOwnerProfileStore } from '@/stores/ownerProfile.js'
import ServiceRatesPanel from '@/modules/billing/components/ServiceRatesPanel.vue'
import ReportRulesPanel from '@/modules/tax/components/ReportRulesPanel.vue'
import { useUpdater } from '@/composables/useUpdater.js'
import { getCurrentVersionSync } from '@/services/UpdaterService.js'

const ui = useUiStore()
const ownerStore = useOwnerProfileStore()
const message = useMessage()

const activeTab    = ref('requisites')
const ownerFormRef = ref(null)
const ownerSaving  = ref(false)

const { checking, installing, updateInfo, error: updateError, status, check, install } = useUpdater()
const currentVersion = getCurrentVersionSync()

async function openRelease() {
  if (updateInfo.value?.releaseUrl) {
    await Neutralino.os.open(updateInfo.value.releaseUrl)
  }
}

const ownerForm = reactive({
  fullName: '',
  ipn:      '',
  iban:     '',
  bankName: '',
  address:  '',
  phone:    '',
  email:    '',
})

async function saveOwner() {
  ownerSaving.value = true
  try {
    await ownerStore.save({ ...ownerForm })
    message.success('Реквізити збережено')
  } finally {
    ownerSaving.value = false
  }
}

onMounted(async () => {
  await ownerStore.load()
  if (ownerStore.profile) Object.assign(ownerForm, ownerStore.profile)
})

const SHORTCUTS = [
  { combo: 'Ctrl+N', desc: 'Новий клієнт' },
  { combo: 'Ctrl+F', desc: 'Фокус на пошук' },
  { combo: 'Escape', desc: 'Назад / закрити' },
]
</script>

<style scoped>
.view-container {
  padding: 24px;
  max-width: 800px;
}
</style>
