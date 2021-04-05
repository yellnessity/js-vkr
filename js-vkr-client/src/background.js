"use strict";

import { app, protocol, BrowserWindow, ipcMain } from "electron";
import { createProtocol } from "vue-cli-plugin-electron-builder/lib";
import installExtension, { VUEJS_DEVTOOLS } from "electron-devtools-installer";
const fs = require("fs");
const fse = require("fs-extra");
var dgram = require("dgram");
const { pipeline } = require("stream");
const hbjs = require("handbrake-js");

const isDevelopment = process.env.NODE_ENV !== "production";

var client = dgram.createSocket("udp4");

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { secure: true, standard: true } },
]);

async function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 1500,
    height: 700,
    title: "VKR-client",
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
    },
  });

  win.maximize();

  win.setTitle("VKR-client");

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL);
  } else {
    createProtocol("app");
    // Load the index.html when not in development
    win.loadURL("app://./index.html");
  }
}

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", async () => {
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    try {
      await installExtension(VUEJS_DEVTOOLS);
    } catch (e) {
      console.error("Vue Devtools failed to install:", e.toString());
    }
  }
  createWindow();
});

ipcMain.on("save-video", async (event, path, buffer) => {
  try {
    await fse.outputFile(path, buffer);
    console.log("video saved");
    event.reply("on-video-save");
    hbjs
      .spawn({ input: path, output: "something.h264" })
      .on("error", (err) => {
        console.log('err', err)
      })
      .on("progress", (progress) => {
        console.log(
          "Percent complete: %s, ETA: %s",
          progress.percentComplete,
          progress.eta
        );
      });
    // const message = new Buffer.from('My KungFu is Good!');
    // const fileStream = fs.createReadStream(path);
    // pipeline(
    //   fileStream,
    // )
    // client.send(message, 0, message.length, 41234, '0.0.0.0', function(err, bytes) {
    //   if (err) throw err;
    //   console.log('UDP message sent to ' + '0.0.0.0' +':'+ 41234);
    //   client.close();
    // });
  } catch (error) {
    console.log("error", error);
  }
});

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === "win32") {
    process.on("message", (data) => {
      if (data === "graceful-exit") {
        app.quit();
      }
    });
  } else {
    process.on("SIGTERM", () => {
      app.quit();
    });
  }
}
