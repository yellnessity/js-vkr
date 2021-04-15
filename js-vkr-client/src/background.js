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

function is_one_3bytes(buf, pos)
{
    if ((buf[pos] == 0)
        && (buf[pos + 1] == 0)
        && (buf[pos + 2] == 1))
    {
        return true;
    }

    return false;
}

function is_one_4bytes(buf, pos)
{
    if ((buf[pos] == 0)
        && (buf[pos + 1] == 0)
        && (buf[pos + 2] == 0)
        && (buf[pos + 3] == 1))
    {
        return true;
    }

    return false;
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
    await hbjs
      .run({ input: path, output: "something.h264" });
      // .on("progress", (progress) => {
      //   console.log("Progress: ", progress);
      // });
    // const message = new Buffer.from('My KungFu is Good!');
    const fileStream = fs.createReadStream("something.h264");
    let buf = null;
    fileStream.on("data", (chunk) => {
      if (chunk) {
        if (buf) {
          buf = Buffer.concat([buf, chunk]);
        } else {
          buf = chunk;
        }

        let pos = 0;

        while (!is_one_3bytes(buf, pos) && !is_one_4bytes(buf, pos)) {
          ++pos;
          if (pos >= buf.length) {
            return;
          }
        }

        let start = pos;

        if (!is_one_3bytes(buf, pos)) {
          ++pos;
          if (pos >= buf.length) {
            return;
          }
        }

        if (!is_one_3bytes(buf, pos)) {
          throw new Error("start_code_prefix_one_3bytes");
        }

        pos += 3;
        if (pos >= buf.length) {
          return;
        }

        let header = buf[pos];
        // let obj = {
        //   forbidden_zero_bit: (header & 0x80) >> 7,
        //   nal_ref_idc: (header & 0x60) >> 5,
        //   nal_unit_type: header & 0x1f,
        // };
        // console.log(
        //   "0x" + numPadding(pos, 8, "0", 16),
        //   "0x" + numPadding(header, 2, "0", 16),
        //   obj,
        //   nal_type_to_string(obj.nal_unit_type)
        // );
        ++pos;
        if (pos >= buf.length) {
          return;
        }

        while (
          !is_one_3bytes(buf, pos) &&
          !is_one_4bytes(buf, pos) &&
          pos < buf.length
        ) {
          ++pos;
          if (pos >= buf.length) {
            return;
          }
        }

        let finish = pos;
        let target = Buffer.alloc(finish - start);
        buf.copy(target, 0, start, finish);

        let tmp = Buffer.alloc(buf.length - finish);
        buf.copy(tmp, 0, finish);
        buf = tmp;

        client.send(target, 0, target.length, 41234, "0.0.0.0", function(
          err,
          bytes
        ) {
          if (err) throw err;
          console.log("UDP message sent to " + "0.0.0.0" + ":" + 41234);
          event.reply("on-video-save");
          
        });
      }
    });
  } catch (error) {
    console.log("error", error);
  }
});

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === "win32") {
    process.on("message", (data) => {
      if (data === "graceful-exit") {
        client.close();
        app.quit();
      }
    });
  } else {
    process.on("SIGTERM", () => {
      client.close();
      app.quit();
    });
  }
}
