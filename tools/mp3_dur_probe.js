const { webkit } = require('playwright');
(async () => {
  const b = await webkit.launch();
  const p = await b.newPage();
  await p.goto('https://onsen-mura-monogatari.pages.dev/index.html');
  const fs = require('fs');
  const buf = fs.readFileSync('C:/温泉村物語/assets/se_ally_down.mp3');
  const dur = await p.evaluate(async (b64) => {
    const bin = atob(b64); const arr = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
    const blob = new Blob([arr], {type:'audio/mpeg'});
    const a = new Audio(URL.createObjectURL(blob));
    await new Promise((res,rej)=>{ a.onloadedmetadata=res; a.onerror=rej; setTimeout(rej,5000); });
    return a.duration;
  }, buf.toString('base64'));
  console.log('duration:', dur);
  await b.close();
})().catch(e=>{console.error(e);process.exit(1);});
