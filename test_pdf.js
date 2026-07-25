const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  try {
    console.log("Launching Puppeteer...");
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

    const filePath = `file:///${path.resolve(__dirname, 'index.html').replace(/\\/g, '/')}`;
    console.log(`Loading ${filePath}...`);
    await page.goto(filePath, { waitUntil: 'domcontentloaded' });

    console.log("Modifying DOM...");
    await page.evaluate(() => {
      const toRemove = document.querySelectorAll('#intro-cover, .main-header, .bg-stripes, #bg-layer, iframe, .player-wrapper, .video-wrapper, .about-tabs-container, .nm-gallery-controls, .nm-expand-hint, #volume-fader');
      toRemove.forEach(el => el.remove());

      const mainSections = document.querySelectorAll('#music-section, #new-media-section, .view-section');
      mainSections.forEach(el => {
        if (el) {
          el.style.display = 'block';
          el.style.opacity = '1';
        }
      });
    });

    console.log("Generating PDF...");
    const buffer = await page.pdf({ format: 'A4', printBackground: true });
    console.log("PDF buffer generated! Size:", buffer.length);
    fs.writeFileSync('Portofoliu_Calin_Nahaiciuc_Design_Affinity.pdf', buffer);
    console.log("File written cleanly!");

    await browser.close();
  } catch (err) {
    console.error("TEST FAILED:", err);
  }
})();
