<template>
  <div style="display: flex; flex-direction: column; gap: 16px; max-width: 560px;">
    <!-- ── Бекап ── -->
    <n-card title="Резервна копія">
      <p style="font-size: 13px; opacity: 0.65; margin: 0 0 12px;">
        Зберігає всі дані (клієнти, звіти, рахунки, платежі, довідники) в один файл.
        Тримайте копію поза цим комп'ютером.
      </p>
      <n-button type="primary" :loading="store.isExporting" @click="doExport">
        <template #icon><n-icon><DownloadOutline /></n-icon></template>
        Зберегти бекап
      </n-button>
    </n-card>

    <!-- ── Відновлення ── -->
    <n-card title="Відновлення з файлу">
      <p style="font-size: 13px; opacity: 0.65; margin: 0 0 12px;">
        Заміна повністю перезапише поточні дані. Злиття оновить наявні записи
        та додасть нові. Дія незворотна — спершу збережіть бекап.
      </p>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <n-button type="error" ghost :loading="store.isImporting" @click="askImport('replace')">
          <template #icon><n-icon><CloudUploadOutline /></n-icon></template>
          Відновити (заміна)
        </n-button>
        <n-button :loading="store.isImporting" @click="askImport('merge')">
          <template #icon><n-icon><GitMergeOutline /></n-icon></template>
          Відновити (злиття)
        </n-button>
      </div>
    </n-card>

    <!-- ── Авто-бекап ── -->
    <n-card title="Автоматичний бекап">
      <template v-if="store.isNative">
        <n-form label-placement="left" label-width="200">
          <n-form-item label="Бекап при запуску (раз на добу)">
            <n-switch :value="store.autoBackupEnabled" @update:value="store.setAutoBackupEnabled" />
          </n-form-item>
        </n-form>
        <p style="font-size: 13px; opacity: 0.65; margin: 4px 0 12px;">
          Зберігається у теку <code>Документи/MiniBuh/backups</code> (останні 10 копій).
          Останній: {{ lastAutoLabel }}.
        </p>
        <n-button size="small" @click="store.openBackupFolder()">
          <template #icon><n-icon><FolderOpenOutline /></n-icon></template>
          Відкрити теку бекапів
        </n-button>
      </template>
      <n-alert v-else type="info">
        Авто-бекап доступний лише у десктоп-версії застосунку.
      </n-alert>
    </n-card>

    <!-- ── Підтвердження відновлення ── -->
    <n-modal
      v-model:show="showConfirm"
      preset="card"
      :title="pendingMode === 'merge' ? 'Відновити злиттям?' : 'Замінити всі дані?'"
      style="width: 420px;"
      :mask-closable="false"
    >
      <div style="display: flex; align-items: center; gap: 12px;">
        <n-icon size="40" :color="pendingMode === 'merge' ? '#2080f0' : '#d03050'">
          <WarningOutline />
        </n-icon>
        <p style="font-size: 13px; opacity: 0.75; margin: 0;">
          <template v-if="pendingMode === 'merge'">
            Записи з файлу оновлять наявні за збігом ID та додадуть нові. Поточні
            записи, яких немає у файлі, залишаться.
          </template>
          <template v-else>
            Усі поточні дані буде видалено й замінено вмістом файлу. Переконайтесь,
            що маєте свіжий бекап.
          </template>
        </p>
      </div>
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <n-button @click="showConfirm = false">Скасувати</n-button>
          <n-button
            :type="pendingMode === 'merge' ? 'primary' : 'error'"
            :loading="store.isImporting"
            @click="doImport"
          >
            Вибрати файл
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { NCard, NButton, NIcon, NForm, NFormItem, NSwitch, NModal, NAlert, useMessage } from 'naive-ui'
import {
  DownloadOutline, CloudUploadOutline, GitMergeOutline, FolderOpenOutline, WarningOutline,
} from '@vicons/ionicons5'
import { useBackupStore } from '../stores/backupStore.js'

const store = useBackupStore()
const message = useMessage()

const showConfirm = ref(false)
const pendingMode = ref('replace')

const lastAutoLabel = computed(() =>
  store.lastAutoBackupAt
    ? new Date(store.lastAutoBackupAt).toLocaleString('uk-UA')
    : 'ще не виконувався'
)

async function doExport() {
  try {
    const res = await store.exportToFile()
    if (res === null) return // скасовано
    message.success(
      res.path
        ? `Збережено ${res.count} записів: ${res.path}`
        : `Завантажено бекап (${res.count} записів)`
    )
  } catch (e) {
    message.error(`Не вдалося зберегти бекап: ${e.message}`)
  }
}

function askImport(mode) {
  pendingMode.value = mode
  showConfirm.value = true
}

async function doImport() {
  const mode = pendingMode.value
  showConfirm.value = false
  try {
    const res = await store.importFromFile(mode)
    if (res === null) return // вибір файлу скасовано
    let msg = mode === 'merge' ? 'Дані злито з бекапу' : 'Дані відновлено з бекапу'
    if (res.dropped?.length) msg += ` (пропущено застарілі таблиці: ${res.dropped.join(', ')})`
    message.success(msg)
  } catch (e) {
    message.error(`Не вдалося відновити: ${e.message}`)
  }
}
</script>
