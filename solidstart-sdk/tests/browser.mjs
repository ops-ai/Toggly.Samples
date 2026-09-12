import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const server=spawn(process.execPath,['.output/server/index.mjs'],{env:{...process.env,PORT:'5198',HOST:'127.0.0.1',TOGGLY_BACKEND_APP_KEY:'',VITE_TOGGLY_APP_KEY:''},stdio:'inherit'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5198')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5198');
 for(const name of ['Home','Declarative gates','Programmatic API','Identity','Entity context','Filters matrix','SolidStart boundaries','Configuration'])await page.getByRole('heading',{name,exact:true}).waitFor();
 await page.getByText('Missing frontend app key.',{exact:false}).waitFor();await page.getByText('Missing backend app key.',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Run server action'}).click();await page.getByText('Server guard returned 404.',{exact:true}).waitFor();
 await page.getByRole('link',{name:'Non-matching',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#section-3 pre')?.textContent.includes('bob'));
 await page.getByRole('link',{name:'Matching',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#section-3 pre')?.textContent.includes('alice'));
 await page.getByLabel('Order.Vip').uncheck();await page.getByText('Standard checkout',{exact:true}).waitFor();
 assert.equal(await page.locator('#section-5 tbody tr').count(),11);
 await page.getByRole('link',{name:'Leave workshop to dispose provider'}).click();await page.getByRole('heading',{name:'Provider disposed'}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS sample eight sections, missing keys, guard, navigation, entity control, filter matrix and disposal navigation');
}finally{await browser?.close();server.kill('SIGTERM');}
