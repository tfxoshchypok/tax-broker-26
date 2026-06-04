import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/db/index.js'
import { TagService } from '@/services/TagService.js'
import { TaxReportService } from '../services/TaxReportService.js'

// Static tax-managed tag names (never from specialTaxTypes)
export const STATIC_TAX_TAG_NAMES = [
  'єдиний податок',
  'Група 1', 'Група 2', 'Група 3 (5%)', 'Група 3 (ПДВ)', 'Група 4',
  // Legacy names kept for cleanup on re-save
  'ЄП гр.1', 'ЄП гр.2', 'ЄП гр.3', 'ЄП гр.3 (ПДВ)', 'ЄП гр.4',
  'Загальна', 'ПДВ', 'Наймані', 'Акциз', 'Земля', 'Еко', 'Рента',
]

const GROUP_COLOR = '#7c3aed'

const STATIC_TAG_COLORS = {
  'єдиний податок':  '#2080f0',
  'Група 1':         GROUP_COLOR,
  'Група 2':         GROUP_COLOR,
  'Група 3 (5%)':    GROUP_COLOR,
  'Група 3 (ПДВ)':   GROUP_COLOR,
  'Група 4':         GROUP_COLOR,
  'Загальна':        '#8b5cf6',
  'ПДВ':             '#f0a020',
  'Наймані':         '#18a058',
}

function getApplicableTagNames(profile, specialTaxKeyToName) {
  const names = []
  if (profile.taxSystem === 'simplified') {
    names.push('єдиний податок')
    const groupMap = { 1: 'Група 1', 2: 'Група 2', 3: 'Група 3 (5%)', '3vat': 'Група 3 (ПДВ)', 4: 'Група 4' }
    if (groupMap[profile.simplifiedGroup]) names.push(groupMap[profile.simplifiedGroup])
  } else if (profile.taxSystem === 'general') {
    names.push('Загальна')
  }
  if (profile.vatPayer)     names.push('ПДВ')
  if (profile.hasEmployees) names.push('Наймані')
  for (const key of (profile.specialTaxes ?? [])) {
    const name = specialTaxKeyToName[key]
    if (name) names.push(name)
  }
  return names
}

async function applyTaxTags(clientId, profile) {
  const id = Number(clientId)

  // Load all special tax types to build dynamic name map and managed-tag list
  const allSpecialTypes = await db.specialTaxTypes.toArray()
  const specialTaxKeyToName = Object.fromEntries(allSpecialTypes.map(t => [t.key, t.name]))
  const allSpecialTaxTagNames = allSpecialTypes.map(t => t.name)
  const allTaxTagNames = [...STATIC_TAX_TAG_NAMES, ...allSpecialTaxTagNames]

  // 1. Find or create the tags that should apply
  const applicableNames = getApplicableTagNames(profile, specialTaxKeyToName)
  const existingTags = applicableNames.length > 0
    ? await db.tags.where('name').anyOf(applicableNames).toArray()
    : []
  const existingByName = Object.fromEntries(existingTags.map(t => [t.name, t.id]))
  const newTagIds = []
  for (const name of applicableNames) {
    if (existingByName[name] !== undefined) {
      newTagIds.push(existingByName[name])
    } else {
      const newId = await db.tags.add({ name, color: STATIC_TAG_COLORS[name] ?? '#6b7280' })
      newTagIds.push(newId)
    }
  }

  // 2. Collect IDs of all tax-managed tags that exist in DB
  const taxTagIds = new Set(
    (await db.tags.where('name').anyOf(allTaxTagNames).toArray()).map(t => t.id)
  )

  // 3. Keep only non-tax tags the client already has
  const currentLinks = await db.clientTags.where('clientId').equals(id).toArray()
  const keptTagIds = currentLinks.map(l => l.tagId).filter(tid => !taxTagIds.has(tid))

  // 4. Apply: preserved tags + new tax tags
  await TagService.setClientTags(id, [...keptTagIds, ...newTagIds])
}

export const useTaxProfilesStore = defineStore('taxProfiles', () => {
  const profiles = ref({})

  async function load(clientId) {
    const id = Number(clientId)
    profiles.value[id] = (await TaxReportService.getProfileByClientId(id)) ?? null
  }

  async function save(clientId, data) {
    const id = Number(clientId)
    await TaxReportService.saveProfile(id, data)
    await applyTaxTags(id, data)
    await load(id)
  }

  function getProfile(clientId) {
    return profiles.value[Number(clientId)] ?? null
  }

  return { profiles, load, save, getProfile }
})
