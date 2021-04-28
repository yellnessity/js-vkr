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
    <button @click="recordTrigger = true">Записать</button>
    <p v-if="face">Лицо обнаружено.</p>
  </div>
</template>

<script>
import Vue from 'vue';
import VideoRecorder from "./components/VideoRecorder.vue";
import VueNativeSock from 'vue-native-websocket';

Vue.use(VueNativeSock, 'ws://localhost:5050');

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
      if (event.data === 'got face') {
        this.face = true;
        this.$refs['video-recorder'].player.record().stop();
      }
      else this.session = event.data;
    };
  },
  beforeDestroy() {
    this.$disconnect();
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
    },
    reload() {
      this.$socket.send('start');
      this.recordTrigger = false;
      this.playTrigger = true;
      this.face = false;
      this.$refs['video-recorder'].player.record().reset();
      this.$refs['video-recorder'].player.record().getDevice();
      ipcRenderer.send("reload-app");
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
</style>
