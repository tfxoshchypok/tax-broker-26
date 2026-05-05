import { ref } from 'vue'
import { checkForUpdates, downloadAndInstall } from '@/services/UpdaterService.js'

export function useUpdater() {
  const checking = ref(false)
  const installing = ref(false)
  const updateInfo = ref(null)
  const error = ref(null)
  const status = ref('')

  async function check() {
    checking.value = true
    error.value = null
    updateInfo.value = null
    try {
      updateInfo.value = await checkForUpdates()
    } catch (e) {
      error.value = e.message
    } finally {
      checking.value = false
    }
  }

  async function install() {
    if (!updateInfo.value?.downloadUrl) return
    installing.value = true
    error.value = null
    status.value = ''
    try {
      await downloadAndInstall(updateInfo.value.downloadUrl, msg => { status.value = msg })
    } catch (e) {
      error.value = e.message
      installing.value = false
    }
  }

  return { checking, installing, updateInfo, error, status, check, install }
}
