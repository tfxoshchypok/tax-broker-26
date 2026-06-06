// Абстракція над файловою системою: Neutralino (prod) ↔ браузер (dev).
// Той самий guard, що в main.js/UpdaterService — дозволяє працювати і без
// нативного рантайму (Vite dev у браузері).
const AUTO_BACKUP_DIRNAME = 'MiniBuh/backups'

function hasNeutralino() {
  return typeof Neutralino !== 'undefined' && typeof window !== 'undefined' && !!window.NL_PORT
}

async function backupDir() {
  const base = await Neutralino.os.getPath('documents')
  return `${base}/${AUTO_BACKUP_DIRNAME}`
}

// Видаляє найстаріші авто-бекапи, лишаючи останні `keep` штук.
async function rotate(dir, keep) {
  const entries = await Neutralino.filesystem.readDirectory(dir).catch(() => [])
  const files = entries
    .filter(e => e.type === 'FILE' && /^backup-\d{4}-\d{2}-\d{2}\.json$/.test(e.entry))
    .map(e => e.entry)
    .sort() // ISO-дати сортуються лексикографічно = хронологічно
  const excess = files.slice(0, Math.max(0, files.length - keep))
  for (const f of excess) {
    await Neutralino.filesystem.remove(`${dir}/${f}`).catch(() => {})
  }
}

export const FileService = {
  hasNeutralino,

  // Зберігає JSON-рядок у файл, обраний користувачем.
  // Повертає шлях (Neutralino) або null (браузер — просто завантаження).
  async saveJson(suggestedName, jsonString) {
    if (hasNeutralino()) {
      const path = await Neutralino.os.showSaveDialog('Зберегти бекап', {
        defaultPath: suggestedName,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (!path) return null // користувач скасував
      const finalPath = path.endsWith('.json') ? path : `${path}.json`
      await Neutralino.filesystem.writeFile(finalPath, jsonString)
      return finalPath
    }
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = suggestedName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return null
  },

  // Відкриває файл, обраний користувачем, і повертає його вміст (рядок)
  // або null, якщо діалог скасовано.
  async openJson() {
    if (hasNeutralino()) {
      const paths = await Neutralino.os.showOpenDialog('Вибрати файл бекапу', {
        filters: [{ name: 'JSON', extensions: ['json'] }],
        multiSelections: false,
      })
      if (!paths || !paths.length) return null
      return Neutralino.filesystem.readFile(paths[0])
    }
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'application/json,.json'
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file) return resolve(null)
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsText(file)
      }
      input.click()
    })
  },

  // Тихо пише авто-бекап у теку Документи/MiniBuh/backups з ротацією.
  // No-op у браузері. Повертає шлях файлу або null.
  async autoBackup(jsonString, keep = 10) {
    if (!hasNeutralino()) return null
    const dir = await backupDir()
    await Neutralino.filesystem.createDirectory(dir).catch(() => {})
    const stamp = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const file = `${dir}/backup-${stamp}.json`
    await Neutralino.filesystem.writeFile(file, jsonString)
    await rotate(dir, keep)
    return file
  },

  // Відкриває теку з авто-бекапами у файловому менеджері ОС.
  async openBackupFolder() {
    if (!hasNeutralino()) return false
    const dir = await backupDir()
    await Neutralino.filesystem.createDirectory(dir).catch(() => {})
    await Neutralino.os.open(dir)
    return true
  },
}
