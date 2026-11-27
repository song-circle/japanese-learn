// PC 듣기 연습 (Electron)
//   트레이에 상주. 단축키(기본 Ctrl+Alt+J)나 트레이 클릭으로 오른쪽 아래에 작은 창을 띄운다.
//   창이 뜨면 원어민 음성이 나오고 보기 4개 중 뜻을 고른다. 기록은 이 PC에만 쌓인다(휴대폰과 별개).

//   업데이트: 트레이 메뉴 '업데이트 확인'. 켤 때도 조용히 확인해서 받아 두고, 종료할 때 설치한다.
//   새 버전은 GitHub 릴리스 desktop-latest(고정 주소)에서 받는다.

const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, screen, nativeImage, dialog } = require('electron')
const path = require('node:path')
const { autoUpdater } = require('electron-updater')

const WIDTH = 400
const MARGIN = 16
// 단축키 후보: 앞의 것이 다른 프로그램에 잡혀 있으면 다음 것을 쓴다
const HOTKEYS = ['Control+Alt+J', 'Control+Shift+J', 'Control+Alt+K']

let win = null
let tray = null
let hotkey = ''
let status = ''
let update = ''        // 트레이 메뉴에 보여 줄 업데이트 상태
let manualCheck = false // 사용자가 직접 '업데이트 확인'을 눌렀는지(결과를 창으로 알려 줌)

if (!app.requestSingleInstanceLock()) app.quit()

function place(height) {
  const { workArea } = screen.getPrimaryDisplay()
  win.setBounds({
    x: workArea.x + workArea.width - WIDTH - MARGIN,
    y: workArea.y + workArea.height - height - MARGIN,
    width: WIDTH,
    height,
  })
}

function createWindow() {
  win = new BrowserWindow({
    width: WIDTH,
    height: 300,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      backgroundThrottling: false,
    },
  })
  win.setAlwaysOnTop(true, 'floating')
  win.loadFile(path.join(__dirname, 'build', 'index.html'))
  // 다른 곳을 클릭해도 닫지 않는다(답을 보는 중일 수 있음). 닫기는 Esc나 ✕
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      win.hide()
    }
  })
}

// 단축키·트레이: 창이 숨어 있으면 새 문제, 떠 있으면 renderer가 알아서(풀기 전이면 다시 듣기)
function ask() {
  if (!win) return
  win.webContents.send('ask')
  if (!win.isVisible()) {
    win.show()
  }
  win.focus()
}

function updateTray() {
  if (!tray) return
  tray.setToolTip(`日本語 듣기${hotkey ? ` (${hotkey.replace('Control', 'Ctrl')})` : ''}${status ? `\n${status}` : ''}`)
  const login = app.getLoginItemSettings().openAtLogin
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `문제 풀기${hotkey ? `  (${hotkey.replace('Control', 'Ctrl')})` : ''}`, click: ask },
    { label: status || '오늘 진도 불러오는 중', enabled: false },
    { type: 'separator' },
    {
      label: 'Windows 시작할 때 자동 실행',
      type: 'checkbox',
      checked: login,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked })
        updateTray()
      },
    },
    { type: 'separator' },
    { label: update || `업데이트 확인 (지금 v${app.getVersion()})`, enabled: !update || update.startsWith('최신'), click: checkUpdate },
    { type: 'separator' },
    { label: '종료', click: () => { app.isQuitting = true; app.quit() } },
  ]))
}

// ---------- 업데이트 ----------
function setUpdate(text) {
  update = text
  updateTray()
}

function checkUpdate() {
  if (!app.isPackaged) {
    dialog.showMessageBox({ message: '개발 중 실행에서는 업데이트를 확인하지 않아요.' })
    return
  }
  manualCheck = true
  setUpdate('업데이트 확인 중…')
  autoUpdater.checkForUpdates().catch((e) => {
    setUpdate('')
    dialog.showMessageBox({ type: 'error', message: '업데이트를 확인하지 못했어요.', detail: String(e?.message ?? e).slice(0, 300) })
  })
}

function setupUpdater() {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('update-available', (info) => setUpdate(`새 버전 v${info.version} 받는 중…`))
  autoUpdater.on('download-progress', (p) => setUpdate(`새 버전 받는 중… ${Math.round(p.percent)}%`))
  autoUpdater.on('update-not-available', () => {
    setUpdate(`최신 버전이에요 (v${app.getVersion()}) · 다시 확인`)
    if (manualCheck) dialog.showMessageBox({ message: `지금이 최신 버전이에요 (v${app.getVersion()}).` })
    manualCheck = false
  })
  autoUpdater.on('update-downloaded', async (info) => {
    setUpdate(`v${info.version} 받음 · 종료할 때 설치돼요`)
    const { response } = await dialog.showMessageBox({
      type: 'info',
      buttons: ['지금 설치하고 다시 시작', '나중에(종료할 때 설치)'],
      defaultId: 0,
      cancelId: 1,
      message: `새 버전 v${info.version}을(를) 받았어요.`,
      detail: '학습 기록은 그대로 남아요.',
    })
    manualCheck = false
    if (response === 0) {
      app.isQuitting = true
      autoUpdater.quitAndInstall(true, true)
    }
  })
  autoUpdater.on('error', (e) => {
    setUpdate('')
    if (manualCheck) dialog.showMessageBox({ type: 'error', message: '업데이트 중 문제가 생겼어요.', detail: String(e?.message ?? e).slice(0, 300) })
    manualCheck = false
  })
  // 켤 때 조용히 한 번 확인(인터넷이 없으면 그냥 넘어감)
  if (app.isPackaged) autoUpdater.checkForUpdates().catch(() => {})
}

app.whenReady().then(() => {
  createWindow()
  setupUpdater()

  const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.on('click', ask)

  hotkey = HOTKEYS.find((k) => globalShortcut.register(k, ask)) ?? ''
  updateTray()

  ipcMain.on('hide', () => win.hide())
  ipcMain.on('resize', (_e, h) => place(Math.min(Math.max(Math.round(h), 120), 700)))
  ipcMain.on('status', (_e, s) => {
    status = s
    updateTray()
  })
  ipcMain.handle('hotkey', () => hotkey.replace('Control', 'Ctrl'))

  ipcMain.on('show', () => win.show())
  // 처음 실행이면 renderer가 사용법을 보여 달라고 'show'를 보낸다
  win.webContents.once('did-finish-load', () => win.webContents.send('welcome'))
})

app.on('second-instance', ask)
app.on('will-quit', () => globalShortcut.unregisterAll())
// 창을 숨겨도 트레이에 남는다
app.on('window-all-closed', () => {})
