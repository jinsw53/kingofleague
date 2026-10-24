const { chromium } = require('playwright'); const path=require('path');
(async()=>{const b=await chromium.launch();const pg=await b.newPage();
await pg.goto('file://'+path.resolve(__dirname,'promo.html')+'?v='+process.argv[2]);
console.log(JSON.stringify(await pg.evaluate(()=>window.EV)));await b.close()})();
