<template>
  <div class="video-container">
    <video
      id="videoRecord"
      class="video-js vjs-default-skin"
      playsinline
    ></video>
  </div>
</template>

<script>
/* eslint-disable */
import Vue from "vue";
import "video.js/dist/video-js.css";
import "videojs-record/dist/css/videojs.record.css";
import videojs from "video.js";

import "webrtc-adapter";
import RecordRTC from "recordrtc";
import Record from "videojs-record/dist/videojs.record.js";

export default {
  name: "VideoRecorder",
  props: {
    recordTrigger: {
      type: Boolean,
      default: false
    },
    playTrigger: {
      type: Boolean,
      default: false
    },
  },
  data() {
    return {
      player: "",
      options: {
        controls: false,
        width: 320,
        height: 240,
        frameWidth: 400,
        frameHeight: 500,
        autoplay: true,
        loop: false,
        bigPlayButton: false,
        controlBar: {
          fullscreenToggle: false,
          volumePanel: false,
          pipToggle: false,
        },
        plugins: {
          record: {
            audio: false,
            pip: false,
            maxLength: 5,
            video: true,
            debug: true,
            videoMimeType: "video/webm;codecs=H264",
            videoRecorderType: "MediaStreamRecorder",
            timeSlice: 1000
          },
        },
      },
      devices: [],
      device: null,
    };
  },
  mounted() {
    /* eslint-disable no-console */
    this.player = videojs('videoRecord', this.options, () => {
      // print version information at startup
      var msg =
        "Using video.js " +
        videojs.VERSION +
        " with videojs-record " +
        videojs.getPluginVersion("record") +
        " and recordrtc " +
        RecordRTC.version;
      videojs.log(msg);
    });

    // device is ready
    this.player.on("deviceReady", () => {
      console.log("device is ready!");
    });

    this.player.record().getDevice();

    this.player.one("deviceReady", () => {
      this.player.record().enumerateDevices();
    });

    this.player.on("enumerateReady", () => {
      this.devices = this.player.record().devices;
      this.devices = this.devices.filter(
        (device) => device.kind === "videoinput"
      );
      this.devices = this.devices.map((device) => {
        return {
          text: device.label,
          value: device.deviceId,
        };
      });
      this.device = this.devices[0].value;
    });

    this.player.on("enumerateError", function() {
      console.warn("enumerate error:", this.player.enumerateErrorCode);
    });

    // user clicked the record button and started recording
    this.player.on("startRecord", () => {
      console.log("started recording!");
    });

    // monitor stream data during recording
    this.player.on('timestamp', () => {
        // timestamps
        // console.log('current timestamp: ', this.player.currentTimestamp);
        // console.log('all timestamps: ', this.player.allTimestamps);

        // stream data
        // console.log('array of blobs: ', this.player.recordedData);

        if (this.player.recordedData.length === 1) {
          this.$emit("onBlob", this.player.recordedData[0]);
          this.$emit("finishedRecord", this.player.recordedData[0]);
        }

        // or construct a single blob:
        // var blob = new Blob(blobs, {
        //     type: 'video/webm'
        // });
    });

    // user completed recording and stream is available
    this.player.on("finishRecord", () => {
      // the blob object contains the recorded data that
      // can be downloaded by the user, stored on server etc.
      console.log("finished recording: ", this.player.recordedData);
      // this.$emit("finishedRecord", this.player.recordedData);
    });

    // error handling
    this.player.on("error", (element, error) => {
      console.warn(error);
    });

    this.player.on("deviceError", () => {
      console.error("device error:", this.player.deviceErrorCode);
    });
  },
  beforeDestroy() {
    if (this.player) {
      this.player.dispose();
    }
  },
  methods: {
    startRecording() {
      this.player.record().start();
    },
    changeVideoInput(deviceId) {
      try {
        this.player.record().setVideoInput(deviceId);
      } catch (err) {
        this.player.record().setVideoInput(this.devices[0].value);
      }
    },
  },
  watch: {
    recordTrigger(value) {
      if (value) this.startRecording();
    },
    playTrigger(value) {
      if (value) {
        this.player.record().reset();
        this.player.record().getDevice();
      }
    },
  },
};
</script>

<style>
.video-container {
  display: flex;
  justify-content: center;
}
</style>
