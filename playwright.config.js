import { defineConfig } from '@playwright/test';
import { fakeAudioFile } from './tests/fixtures/fake-audio.mjs';
// A virtual output pulls decoded audio samples without using physical speakers.
// Browser-wide mute can leave audio RTP received but undecoded in headless Chrome.
export default defineConfig({
 testDir:'./tests/browser',timeout:60000,workers:1,reporter:'list',
 use:{baseURL:'http://127.0.0.1:8091',headless:true,permissions:['camera','microphone'],launchOptions:{ignoreDefaultArgs:['--mute-audio'],executablePath:process.env.VWC_CHROMIUM_PATH,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--disable-audio-output','--use-file-for-fake-audio-capture='+fakeAudioFile()]},trace:'retain-on-failure'},
 webServer:{command:'node tests/dev-server.cjs',url:'http://127.0.0.1:8091',reuseExistingServer:false,timeout:20000},
});
