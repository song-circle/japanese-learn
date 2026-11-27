// PC 듣기 연습 (Electron)
//   트레이에 상주. 단축키(기본 Ctrl+Alt+J)나 트레이 클릭으로 오른쪽 아래에 작은 창을 띄운다.
//   창이 뜨면 원어민 음성이 나오고 보기 4개 중 뜻을 고른다. 기록은 이 PC에만 쌓인다(휴대폰과 별개).

const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, screen, nativeImage } = require('electron')
const path = require('node:path')

const WIDTH = 400
const MARGIN = 16
// 단축키 후보: 앞의 것이 다른 프로그램에 잡혀 있으면 다음 것을 쓴다
const HOTKEYS = ['Control+Alt+J', 'Control+Shift+J', 'Control+Alt+K']

let win = null
let tray = null
let hotkey = ''
let status = ''

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
    { label: '종료', click: () => { app.isQuitting = true; app.quit() } },
  ]))
}

app.whenReady().then(() => {
  createWindow()

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
