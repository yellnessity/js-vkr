"use strict";

import { app, protocol, BrowserWindow, ipcMain } from "electron";
import { createProtocol } from "vue-cli-plugin-electron-builder/lib";
import installExtension, { VUEJS_DEVTOOLS } from "electron-devtools-installer";
const fs = require("fs");
const fse = require("fs-extra");
var dgram = require("dgram");
const { Readable } = require("stream");
const hbjs = require("handbrake-js");
const WebSocket = require("ws");

const isDevelopment = process.env.NODE_ENV !== "production";

let face = false;
let fileStream = null;
let session = null;
var client;

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { secure: true, standard: true } },
]);

async function createWindow()
{
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

  if (process.env.WEBPACK_DEV_SERVER_URL)
  {
    // Load the url of the dev server if in development mode
    await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL);
  } else
  {
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

function numPadding(num, paddingSize, value = ' ', radix = 10)
{
    let s = num.toString(radix);

    while (s.length < paddingSize)
    {
        s = value + s;
    }

    return s;
}

function start_code_prefix_one_3bytes(buf, pos)
{
    if (!is_one_3bytes(buf, pos))
    {
        throw new Error('start_code_prefix_one_3bytes');
    }

    return pos + 3;
}

function nal_unit(buf, pos)
{
    let header = buf[pos];
    let obj = {
        forbidden_zero_bit: (header & 0x80) >> 7,
        nal_ref_idc: (header & 0x60) >> 5,
        nal_unit_type: (header & 0x1F)
    };
    if (obj.nal_unit_type === 7 || obj.nal_unit_type === 8) console.log(
        '0x' + numPadding(pos, 8, '0', 16),
        '0x' + numPadding(header, 2, '0', 16),
        obj,
    );
    ++pos;

    return pos;
}

function byte_stream_nal_unit(buf, pos)
{
    if (pos >= buf.length)
    {
        return pos;
    }

    while (!is_one_3bytes(buf, pos)
        && !is_one_4bytes(buf, pos))
    {
        ++pos;
        if (pos >= buf.length) return pos;
    }

    let start = pos;

    if (!is_one_3bytes(buf, pos))
    {
        ++pos;
    }

    pos = start_code_prefix_one_3bytes(buf, pos);
    pos = nal_unit(buf, pos);

    while (!is_one_3bytes(buf, pos)
        && !is_one_4bytes(buf, pos)
        && pos < buf.length)
    {
        ++pos;
    }

    let finish = pos;
    let target = Buffer.alloc(finish - start + 8);
    target.writeInt32BE(counter, 0);
    target.write(session, 4, 4, 'hex');
    buf.copy(target, 8, start, finish);

    // ?????????????? target ?????????????????? ???????????? ?????????????? ????????????
    client.send(target, 0, target.length, 41234, "0.0.0.0", function(
        err,
        bytes
    )
    {
        if (err) throw err;
    });

    return pos;
}

// Quit when all windows are closed.
app.on("window-all-closed", () =>
{
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin")
  {
    app.quit();
  }
});

app.on("activate", () =>
{
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", async () =>
{
  if (isDevelopment && !process.env.IS_TEST)
  {
    // Install Vue Devtools
    try
    {
      await installExtension(VUEJS_DEVTOOLS);
    } catch (e)
    {
      console.error("Vue Devtools failed to install:", e.toString());
    }
  }
  createWindow();
  client = dgram.createSocket("udp4");
});

let counter = 0;

ipcMain.on("reload-app", (event, payload) => {
  counter = 0;
  face = false;
  client = dgram.createSocket("udp4");
})

ipcMain.on("on-session", (event, payload) => {
  session = payload;
})

ipcMain.on("process-blob", (event, buffer) =>
{
  try
  {
    console.log(buffer.length);
    let buf = null;
    fileStream = new Readable();
    fileStream._read = () => { };
    fileStream.push(buffer);
    fileStream.push(null);
    fileStream.on("data", function(chunk) {
      let pos = 0;
      while (pos < chunk.length) {
          if (!session)
          {
              fileStream.destroy();
              return;
          }

          pos = byte_stream_nal_unit(chunk, pos);

          counter++;
      }
    });
  } catch (error)
  {
    console.log(error);
  }
});

ipcMain.on("on-finish-record", (event) =>
{
  counter = 0;
});

ipcMain.on("save-video", async (event, path, buffer) =>
{
  console.log('saving video');
  try
  {
    await fse.outputFile(path, buffer);
    console.log("video saved, buffer length: ", buffer.length);
    // hbjs.spawn({ input: path, output: 'something.h264' })
    // .on('error', err => {
    //   console.log(err);
    // })
    // .on('progress', progress => {
    //   console.log(
    //     'Percent complete: %s, ETA: %s',
    //     progress.percentComplete,
    //     progress.eta
    //   )
    // });
    counter = 0;
  } catch (error)
  {
    console.log("error", error);
  }
});

// Exit cleanly on request from parent process in development mode.
if (isDevelopment)
{
  if (process.platform === "win32")
  {
    process.on("message", (data) =>
    {
      if (data === "graceful-exit")
      {
        client.close();
        app.quit();
      }
    });
  } else
  {
    process.on("SIGTERM", () =>
    {
      client.close();
      app.quit();
    });
  }
}
