import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',timeout:30000,use:{baseURL:'http://127.0.0.1:5173',viewport:{width:1440,height:900},launchOptions:{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}}});
