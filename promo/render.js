// usage: node render.js <a|b> <out.mp4|preview> [audio.wav]
// preview mode: node render.js a preview 1.5,5,8   -> PNG frames at given seconds
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

(async () => {
  const [v, out, third] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  await page.goto('file://' + path.resolve(__dirname, 'promo.html') + '?v=' + v);
  await page.evaluate(() => window.ready);
  const dur = await page.evaluate(() => window.DUR);

  if (out === 'preview') {
    fs.mkdirSync('prev', { recursive: true });
    for (const s of third.split(',')) {
      await page.evaluate(t => window.render(t), parseFloat(s));
      await page.screenshot({ path: `prev/${v}_${s}.png` });
    }
    await browser.close();
    return;
  }

  const fps = 30, n = dur * fps;
  const args = ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-'];
  if (third) args.push('-i', third);
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium');
  if (third) args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  args.push('-movflags', '+faststart', out);
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < n; i++) {
    await page.evaluate(t => window.render(t), i / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
})();
