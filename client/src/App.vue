<template>
  <div id="app">
    <img src="./assets/white.png" width="200" style="padding: 1.5rem" />
    <VideoRecorder
      ref="video-recorder"
      :playTrigger="playTrigger"
      :recordTrigger="recordTrigger"
      @finishedRecord="onFinishedRecord"
      @onBlob="processBlob"
      id="video"
    />
    <button @click="reload">Перезапуск</button>
    <button v-if="!face" :disabled="!session" @click="recordTrigger = true">Записать</button>
    <p v-if="face">Лицо обнаружено.</p>
  </div>
</template>

<script>
import Vue from 'vue';
import VideoRecorder from "./components/VideoRecorder.vue";
import VueNativeSock from 'vue-native-websocket';

Vue.use(VueNativeSock, 'ws://localhost:5050', {
  reconnection: true, // (Boolean) whether to reconnect automatically (false)
});

let { ipcRenderer } = window.require("electron");

export default {
  name: "App",
  components: {
    VideoRecorder,
  },
  data() {
    return {
      playTrigger: false,
      recordTrigger: false,
      file: null,
      face: false,
      session: null
    };
  },
  mounted() {
    this.$socket.onopen = () => this.$socket.send('start');
    this.$socket.onmessage = (event) => {
      if (event.data === 'got face' && !this.face) {
        this.face = true;
        this.session = null;
        this.$refs['video-recorder'].player.record().stop();
      }
      else {
        this.session = event.data;
        ipcRenderer.send("on-session", this.session);
      }
    };
  },
  methods: {
    sendVideo() {
      console.log("video");
    },
    startRecord() {
      if (this.session) {
        this.$refs['video-recorder'].player.record().start();
      }
    },
    onFinishedRecord(video) {
      this.file = video;
      console.log("video recorded", video);
      ipcRenderer.send("on-finish-record");
      ipcRenderer.send("save-video", "video.mp4", this.file);
    },
    reload() {
      this.$socket.send('start');
      console.log(this.$socket);
      ipcRenderer.send("reload-app");
      this.recordTrigger = false;
      this.playTrigger = true;
      this.face = false;
      this.$refs['video-recorder'].player.record().reset();
      this.$refs['video-recorder'].player.record().getDevice();
    },
    processBlob(blob) {
      if (blob && !this.face) {
        console.log("blob: ", blob.length);
        let reader = new FileReader();
        reader.onload = function() {
          if (reader.readyState == 2) {
            var buffer = new Buffer.from(reader.result);
            ipcRenderer.send("process-blob", buffer);
          }
        };
        reader.readAsArrayBuffer(blob);
      }
    }
  },
};
</script>

<style>
body {
  margin: 0;
  padding: 0;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: white;
  background-color: #222;
  min-height: 100vh;
}

button {
  padding: .5rem 1rem;
  margin: 1rem .5rem;
  background-color: #01c39e;
  border: none;
  border-radius: .2rem;
  color: white;
}

button:disabled {
  background: gray;
}
</style>
