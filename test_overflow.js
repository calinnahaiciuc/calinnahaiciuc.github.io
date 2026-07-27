const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('file:///' + path.resolve('index.html').replace(/\\/g, '/'), {waitUntil: 'domcontentloaded'});
  
  const js = fs.readFileSync('generate_affinity_pdf.js', 'utf8');
  const startMatch = 'await page.evaluate(() => {';
  const endMatch = '});\n\n  console.log("Generating PDF file...");';
  
  const startIdx = js.indexOf(startMatch) + startMatch.length;
  const endIdx = js.indexOf(endMatch);
  const evalBody = js.substring(startIdx, endIdx);
  
  await page.evaluate(new Function(evalBody));
  
  const bounds = await page.evaluate(() => {
    let badNodes = [];
    document.querySelectorAll('*').forEach(n => {
      const b = n.getBoundingClientRect();
      if(b.width > 795) { // 210mm ~ 794px
        badNodes.push({ tag: n.tagName, class: n.className, id: n.id, w: b.width });
      }
    });
    return { docW: document.body.scrollWidth, docH: document.body.scrollHeight, badNodes };
  });
  
  console.log(JSON.stringify(bounds, null, 2));
  await browser.close();
})();
