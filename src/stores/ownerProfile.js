import { defineStore } from 'pinia'
import { ref } from 'vue'
import { OwnerProfileService } from '@/services/OwnerProfileService.js'

export const useOwnerProfileStore = defineStore('ownerProfile', () => {
  const profile = ref(null)
  const loaded = ref(false)

  async function load() {
    if (loaded.value) return
    profile.value = await OwnerProfileService.get()
    loaded.value = true
  }

  async function save(data) {
    await OwnerProfileService.save(data)
    profile.value = { ...data }
  }

  return { profile, loaded, load, save }
})
