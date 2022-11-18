import { app, BrowserWindow, ipcMain, Menu, Tray } from 'electron';
import * as path from 'path';
import { DtoSystemInfo } from '../ipc-dtos/dtosysteminfo';
import * as os from 'os';
import * as activeWindows from 'active-win';

const assetsDirectory = path.join(__dirname, 'assets')

let win: BrowserWindow | null = null;

let tray: any

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Algumas APIs podem ser usadas somente depois que este evento ocorre.
app.whenReady().then(() => {
  createWindow()

  tray = new Tray(path.join(assetsDirectory, 'favicon.png'))

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Item1', type: 'radio' },
    { label: 'Item2', type: 'radio' },
    { label: 'Item3', type: 'radio', checked: true },
    { label: 'Item4', type: 'radio' }
  ])
  
  tray.setToolTip('Station Agent')
  tray.setContextMenu(contextMenu)

})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // Disabled Node integration
      nodeIntegration: false,
      // protect against prototype pollution
      contextIsolation: true,
      // Preload script
      preload: path.join(app.getAppPath(), 'dist/preload', 'preload.js')
    }
  });

  // https://stackoverflow.com/a/58548866/600559
  Menu.setApplicationMenu(null);

  win.loadFile(path.join(app.getAppPath(), 'dist/renderer', 'index.html'));

  win.on('closed', () => {
    win = null;
  });

  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

ipcMain.on('dev-tools', () => {
  if (win) {
    win.webContents.toggleDevTools();
  }
});

ipcMain.on('request-systeminfo', () => {
  const systemInfo = new DtoSystemInfo();
  systemInfo.Arch = os.arch();
  systemInfo.Hostname = os.hostname();
  systemInfo.Platform = os.platform();
  systemInfo.Release = os.release();
  const serializedString = systemInfo.serialize();
  if (win) {
    win.webContents.send('systeminfo', serializedString);
  }
});


// tests if the active window has changed since last test
const windowChanged = async(window: any, lastWindow: any) => {
  try {
    return !lastWindow || lastWindow.title !== window.title || lastWindow.owner.name !== window.owner.name
  } catch (error) {
    return true
  }
}


let activateListenActiveWindow = false

// sets an interval to read the active window changes
const listenActiveWindow = async() => {
  let lastWindow: any
  setInterval(() => {
    if (!activateListenActiveWindow) return;

    activeWindows().then((activeWindow: any) => {
      windowChanged(activeWindow, lastWindow).then(result => {
          if (result && activeWindow) {
              console.log(activeWindow)
              win.webContents.send('active-window-changed', activeWindow)
          }
          lastWindow = activeWindow
      })
    })
  }, 1000);
}

ipcMain.handle('start-listening-active-window', async () => {
  activateListenActiveWindow = true
})

ipcMain.handle('stop-listening-active-window', async () => {
  activateListenActiveWindow = false
})

listenActiveWindow()
