import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser',timeout:60000,workers:1,reporter:'list',
 use:{baseURL:'http://127.0.0.1:8091',headless:true,permissions:['camera','microphone'],launchOptions:{executablePath:process.env.VWC_CHROMIUM_PATH,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']},trace:'retain-on-failure'},
 webServer:{command:'node tests/dev-server.cjs',url:'http://127.0.0.1:8091',reuseExistingServer:false,timeout:20000},
});
