// Change these two constants to match your GitHub repository
const GITHUB_OWNER = 'tfxoshchypok'
const GITHUB_REPO = 'tax-broker-26'

function semverGt(a, b) {
  const parse = v => v.replace(/^v/, '').split('.').map(Number)
  const pa = parse(a)
  const pb = parse(b)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true
    if ((pa[i] || 0) < (pb[i] || 0)) return false
  }
  return false
}

function getCurrentVersion() {
  return typeof NL_APPVERSION !== 'undefined' ? NL_APPVERSION : '0.0.0'
}

function getAssetName() {
  const os = typeof NL_OS !== 'undefined' ? NL_OS : 'Linux'
  const arch = typeof NL_ARCH !== 'undefined' ? NL_ARCH : 'x64'
  if (os === 'Linux') return `tax-broker-26-linux_${arch}.zip`
  if (os === 'Windows') return `tax-broker-26-win_x64.zip`
  if (os === 'Darwin') return `tax-broker-26-mac_${arch === 'arm64' ? 'arm64' : 'universal'}.zip`
  return null
}

export async function checkForUpdates() {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`
  const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
  if (!res.ok) {
    if (res.status === 404) throw new Error('Репозиторій не знайдено або немає релізів')
    throw new Error(`Помилка GitHub API: ${res.status}`)
  }
  const release = await res.json()
  const latestVersion = release.tag_name.replace(/^v/, '')
  const currentVersion = getCurrentVersion()
  const assetName = getAssetName()
  const asset = release.assets?.find(a => a.name === assetName)
  const os = typeof NL_OS !== 'undefined' ? NL_OS : 'Linux'

  return {
    hasUpdate: semverGt(latestVersion, currentVersion),
    currentVersion,
    latestVersion,
    releaseNotes: release.body || '',
    releaseUrl: release.html_url,
    downloadUrl: asset?.browser_download_url ?? null,
    assetName,
    canAutoUpdate: !!asset && os !== 'Windows',
  }
}

async function getInstallDir() {
  const os = typeof NL_OS !== 'undefined' ? NL_OS : 'Linux'
  if (os === 'Linux') {
    const { stdOut } = await Neutralino.os.execCommand('dirname "$(readlink -f /proc/self/exe)"')
    return stdOut.trim()
  }
  if (os === 'Darwin') {
    const { stdOut } = await Neutralino.os.execCommand(
      'dirname "$(ps -p $PPID -o comm= 2>/dev/null || echo .)"'
    )
    return stdOut.trim()
  }
  return null
}

export async function downloadAndInstall(downloadUrl, onStatus) {
  const os = typeof NL_OS !== 'undefined' ? NL_OS : 'Linux'
  const tmpZip = '/tmp/tax-broker-26-update.zip'
  const tmpDir = '/tmp/tax-broker-26-update'
  const binaryName = getAssetName()?.replace('.zip', '')

  onStatus('Завантаження оновлення...')
  const { returnCode, stdOut, stdErr } = await Neutralino.os.execCommand(
    `curl -fL "${downloadUrl}" -o "${tmpZip}" 2>&1`
  )
  if (returnCode !== 0) throw new Error(`Помилка завантаження:\n${stdOut || stdErr}`)

  onStatus('Розпакування...')
  await Neutralino.os.execCommand(
    `rm -rf "${tmpDir}" && mkdir -p "${tmpDir}" && unzip -o "${tmpZip}" -d "${tmpDir}"`
  )

  onStatus('Встановлення файлів...')
  const installDir = await getInstallDir()
  if (!installDir) throw new Error('Не вдалося визначити директорію встановлення')

  await Neutralino.os.execCommand(`cp -f "${tmpDir}/resources.neu" "${installDir}/resources.neu"`)
  if (binaryName) {
    await Neutralino.os.execCommand(
      `[ -f "${tmpDir}/${binaryName}" ] ` +
      `&& cp -f "${tmpDir}/${binaryName}" "${installDir}/${binaryName}" ` +
      `&& chmod +x "${installDir}/${binaryName}" || true`
    )
  }

  await Neutralino.os.execCommand(`rm -rf "${tmpZip}" "${tmpDir}"`)

  onStatus('Перезапуск застосунку...')
  await new Promise(r => setTimeout(r, 800))
  await Neutralino.app.restartProcess()
}

export function getCurrentVersionSync() {
  return getCurrentVersion()
}
