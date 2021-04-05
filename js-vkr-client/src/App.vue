<template>
  <div id="app">
    <img src="./assets/white.png" width="200" style="padding: 1.5rem" />
    <VideoRecorder
      :playTrigger="playTrigger"
      :recordTrigger="recordTrigger"
      @finishedRecord="onFinishedRecord"
      id="video"
    />
    <button @click="playTrigger = true">Перезапуск</button>
    <button @click="recordTrigger = true">Записать</button>
    <button @click="saveVideo">Отправить</button>
  </div>
</template>

<script>
import VideoRecorder from "./components/VideoRecorder.vue";

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
    };
  },
  mounted() {},
  methods: {
    sendVideo() {
      console.log("video");
    },
    onFinishedRecord(video) {
      this.file = video;
      console.log("video recorded", video);
    },
    saveVideo() {
      let reader = new FileReader();
      reader.onload = function() {
        if (reader.readyState == 2) {
          var buffer = new Buffer.from(reader.result);
          ipcRenderer.send("save-video", 'video.mp4', buffer);
        }
      };
      ipcRenderer.on("on-video-save", () => {
        console.log('video have been saved')
      });
      reader.readAsArrayBuffer(this.file);
    },
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
