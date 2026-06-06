import { ref } from 'vue'
import { defineStore } from 'pinia'
import { BackupService } from '../services/BackupService.js'
import { FileService } from '../services/FileService.js'
import { countRecords } from '../engine/serializer.js'

const LS_LAST_AUTO = 'mb_lastAutoBackup'
const LS_AUTO_ENABLED = 'mb_autoBackupEnabled'
const DAY = 24 * 60 * 60 * 1000

export const useBackupStore = defineStore('backup', () => {
  const isExporting = ref(false)
  const isImporting = ref(false)
  const lastAutoBackupAt = ref(Number(localStorage.getItem(LS_LAST_AUTO)) || null)
  const autoBackupEnabled = ref(localStorage.getItem(LS_AUTO_ENABLED) !== 'false') // дефолт — увімкнено

  const isNative = FileService.hasNeutralino()

  function setAutoBackupEnabled(v) {
    autoBackupEnabled.value = v
    localStorage.setItem(LS_AUTO_ENABLED, String(v))
  }

  // Повертає { path, count }: path === null у браузері (просто завантаження файлу),
  // або null цілком, якщо діалог збереження скасовано.
  async function exportToFile() {
    isExporting.value = true
    try {
      const envelope = await BackupService.exportAll()
      const json = JSON.stringify(envelope, null, 2)
      const name = `mini-buh-backup-${new Date().toISOString().slice(0, 10)}.json`
      const count = countRecords(envelope)
      const path = await FileService.saveJson(name, json)
      return { path, count }
    } finally {
      isExporting.value = false
    }
  }

  // mode: 'replace' | 'merge'. Повертає { dropped } або null, якщо вибір файлу скасовано.
  async function importFromFile(mode) {
    isImporting.value = true
    try {
      const content = await FileService.openJson()
      if (content == null) return null
      let envelope
      try {
        envelope = JSON.parse(content)
      } catch {
        throw new Error('Файл не є коректним JSON')
      }
      return mode === 'merge'
        ? await BackupService.importMerge(envelope)
        : await BackupService.importReplace(envelope)
    } finally {
      isImporting.value = false
    }
  }

  // Авто-бекап при старті: не частіше разу на добу, лише в нативному рантаймі.
  async function maybeAutoBackup() {
    if (!autoBackupEnabled.value || !isNative) return
    if (Date.now() - (lastAutoBackupAt.value ?? 0) < DAY) return
    try {
      const envelope = await BackupService.exportAll()
      await FileService.autoBackup(JSON.stringify(envelope))
      lastAutoBackupAt.value = Date.now()
      localStorage.setItem(LS_LAST_AUTO, String(lastAutoBackupAt.value))
    } catch (e) {
      console.warn('Авто-бекап не виконано:', e)
    }
  }

  function openBackupFolder() {
    return FileService.openBackupFolder()
  }

  return {
    isExporting, isImporting, lastAutoBackupAt, autoBackupEnabled, isNative,
    setAutoBackupEnabled, exportToFile, importFromFile, maybeAutoBackup, openBackupFolder,
  }
})
