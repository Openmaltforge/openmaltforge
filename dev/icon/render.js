const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:300,height:300}});
await p.setContent('<body style="margin:0;background:transparent"><div id=e style="font:240px/300px \'Noto Color Emoji\';text-align:center;width:300px;height:300px">🍺</div>');
await p.waitForTimeout(500);await p.screenshot({path:'raw.png',omitBackground:true});await b.close()})()
