const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log("Testing Full Portfolio Export with navigation timeout disabled & embed request blocking...");
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.setDefaultNavigationTimeout(0);
  page.setDefaultTimeout(0);

  await page.setRequestInterception(true);
  page.on('request', req => {
    const url = req.url().toLowerCase();
    if (url.includes('bandcamp.com') || url.includes('soundcloud.com') || url.includes('youtube.com') || url.includes('sndcdn.com')) {
      req.abort();
    } else {
      req.continue();
    }
  });

  const filePath = `file:///${path.resolve(__dirname, 'index.html').replace(/\\/g, '/')}`;
  await page.goto(filePath, { waitUntil: 'domcontentloaded' });

  await page.evaluate(() => {
    // Extract Bio, Statement, and CV contents before clearing
    const bioText = document.querySelector('#bio-tab .about-text')?.innerHTML || '';
    const statementList = document.querySelector('.credo-list')?.innerHTML || '';
    const cvText = document.querySelector('.cv-content')?.innerHTML || '';

    // Remove elements that don't belong in printed export
    const toRemove = document.querySelectorAll('#intro-cover, .main-header, .bg-stripes, #bg-layer, iframe, .player-wrapper, .video-wrapper, .about-tabs-container, .nm-gallery-controls, .nm-expand-hint, #volume-fader');
    toRemove.forEach(el => el.remove());

    // Force show all main sections
    const mainSections = document.querySelectorAll('#music-section, #new-media-section, .view-section');
    mainSections.forEach(el => {
      if (el) {
        el.style.display = 'block';
        el.style.opacity = '1';
      }
    });

    // Preserve exact background & text colors from website for music release cards
    document.querySelectorAll('.release-card').forEach(el => {
      const bg = el.getAttribute('data-bg') || el.closest('.dynamic-section')?.getAttribute('data-bg');
      const text = el.getAttribute('data-text') || el.closest('.dynamic-section')?.getAttribute('data-text');
      if (bg) el.style.setProperty('background-color', bg, 'important');
      if (text) {
        el.style.setProperty('color', text, 'important');
        el.querySelectorAll('h1, h2, h3, h4, p, span, div, li, strong, em').forEach(child => {
          child.style.setProperty('color', text, 'important');
        });
      }
    });

    // 1. CREATE COVER PAGE
    const coverPage = document.createElement('div');
    coverPage.className = 'pdf-page pdf-cover-page';
    coverPage.innerHTML = `
      <div class="pdf-cover-overlay"></div>
      <div class="pdf-cover-content">
        <h1 class="pdf-cover-name">CĂLIN NAHAICIUC</h1>
        <div class="pdf-cover-tagline">artist new media & producător muzică electronică</div>
        <div class="pdf-cover-divider"></div>
        <div class="pdf-cover-meta">
          <p><strong>Email:</strong> calinnahaiciuc@proton.me</p>
          <p><strong>Website:</strong> calinnahaiciuc.github.io</p>
          <p><strong>Bandcamp:</strong> marcusaburelius.bandcamp.com</p>
          <p><strong>Instagram:</strong> @aburelius</p>
          <p><strong>Locație:</strong> Cluj-Napoca, România</p>
        </div>
      </div>
    `;

    // 2. CREATE BIO & STATEMENT PAGE
    const bioPage = document.createElement('div');
    bioPage.className = 'pdf-page pdf-bio-page';
    bioPage.innerHTML = `
      <h2 class="pdf-section-heading">BIOGRAFIE & STATEMENT ARTISTIC</h2>
      <div class="pdf-bio-grid">
        <div class="pdf-bio-col">
          <h3 class="pdf-subheading">Bio</h3>
          <div class="pdf-text">${bioText}</div>
        </div>
        <div class="pdf-statement-col">
          <h3 class="pdf-subheading">Statement & Credo</h3>
          <div class="pdf-credo-list">${statementList}</div>
        </div>
      </div>
    `;

    // 3. CREATE CV ARTISTIC PAGE
    const cvPage = document.createElement('div');
    cvPage.className = 'pdf-page pdf-cv-page';
    cvPage.innerHTML = `
      <h2 class="pdf-section-heading">CV ARTISTIC (PARCURS & PROIECTE RELEVANTE)</h2>
      <div class="pdf-cv-container">${cvText}</div>
    `;

    // 4. CREATE FINAL PAGE
    const finalPage = document.createElement('div');
    finalPage.className = 'pdf-page pdf-final-page';
    finalPage.innerHTML = `
      <div class="pdf-final-content">
        <h2>PORTOFOLIU ARTISTIC CĂLIN NAHAICIUC</h2>
        <p>Versiunea interactivă web & lucrările complete: <br><strong style="font-size:1.4rem; color:#ff9800;">calinnahaiciuc.github.io</strong></p>
        <p style="margin-top: 2rem;">Contact direct pentru rezidențe & proiecte: <br><strong>calinnahaiciuc@proton.me</strong></p>
      </div>
    `;

    // Re-arrange body content cleanly
    const container = document.querySelector('.portfolio-content') || document.body;
    container.prepend(coverPage);
    coverPage.after(bioPage);
    bioPage.after(cvPage);
    container.appendChild(finalPage);

    // Expand New Media slices
    document.querySelectorAll('.nm-project-slice').forEach(el => {
        el.classList.add('expanded');
    });

    // Inject dedicated PDF print styles
    const style = document.createElement('style');
    style.innerHTML = `
      * {
        transition: none !important;
        animation: none !important;
        box-sizing: border-box !important;
      }
      p, li, h1, h2, h3, h4, h5, h6, .credo-item {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      body {
        background-color: #ffffff !important;
        color: #121212 !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      .pdf-page {
        page-break-after: always !important;
        min-height: 100vh !important;
        padding: 2.5rem 3rem !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        box-sizing: border-box !important;
        background: #121212 !important;
        color: #f0f0f0 !important;
        position: relative !important;
      }

      .pdf-cover-page {
        background-image: url('imagini/general/background.webp') !important;
        background-size: cover !important;
        background-position: center !important;
        align-items: center !important;
        text-align: center !important;
        justify-content: center !important;
        position: relative !important;
        overflow: hidden !important;
        padding: 2rem !important;
      }
      .pdf-cover-overlay {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: rgba(0, 0, 0, 0.2) !important;
        z-index: 1 !important;
      }
      .pdf-cover-content {
        position: relative !important;
        z-index: 2 !important;
        max-width: 800px !important;
      }
      .pdf-cover-name {
        font-size: 3.5rem !important;
        letter-spacing: 4px !important;
        margin-bottom: 1rem !important;
        color: #ffffff !important;
      }
      .pdf-cover-tagline {
        font-size: 1.5rem !important;
        opacity: 0.95 !important;
        text-transform: lowercase !important;
        margin-bottom: 2rem !important;
        color: #f0f0f0 !important;
      }
      .pdf-cover-divider {
        width: 120px !important;
        height: 3px !important;
        background: #ff9800 !important;
        margin: 2rem auto !important;
      }
      .pdf-cover-meta p {
        font-size: 1.1rem !important;
        margin: 0.5rem 0 !important;
        line-height: 1.5 !important;
        color: #ffffff !important;
      }

      .pdf-section-heading {
        font-size: 1.8rem !important;
        margin-bottom: 1.5rem !important;
        letter-spacing: 2px !important;
        border-bottom: 1px solid rgba(255,255,255,0.2) !important;
        padding-bottom: 0.6rem !important;
        color: #ffffff !important;
      }
      .pdf-subheading {
        font-size: 1.3rem !important;
        margin-bottom: 0.8rem !important;
        color: #ff9800 !important;
      }
      .pdf-bio-grid {
        display: flex !important;
        flex-direction: row !important;
        gap: 2.5rem !important;
      }
      .pdf-bio-col, .pdf-statement-col {
        flex: 1 !important;
      }
      .pdf-text p {
        font-size: 0.88rem !important;
        line-height: 1.5 !important;
        margin-bottom: 0.8rem !important;
        color: #e0e0e0 !important;
      }
      .pdf-credo-list .credo-item {
        font-size: 0.85rem !important;
        line-height: 1.4 !important;
        padding: 0.4rem 0 !important;
        border-bottom: 1px solid rgba(255,255,255,0.08) !important;
        color: #e0e0e0 !important;
      }
      .pdf-cv-container {
        font-size: 0.85rem !important;
        line-height: 1.45 !important;
        color: #e0e0e0 !important;
      }

      #music-section {
        background: #121212 !important;
        color: #f0f0f0 !important;
        padding: 0 !important;
      }
      .music-portfolio {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 2rem 2.5rem !important;
      }
      .portfolio-header {
        text-align: center !important;
        margin-bottom: 1.5rem !important;
        padding-top: 0.5rem !important;
      }
      .portfolio-header h1 {
        font-size: 2.2rem !important;
        margin-bottom: 0.4rem !important;
        color: #ffffff !important;
      }
      .portfolio-header .subtitle {
        font-size: 1.1rem !important;
        color: #aaaaaa !important;
      }
      .releases-list {
        display: flex !important;
        flex-direction: column !important;
        gap: 1.2rem !important;
        margin-top: 0 !important;
      }
      .release-card {
        margin-bottom: 1rem !important;
        padding: 1.2rem 1.5rem !important;
        border-radius: 8px !important;
        display: flex !important;
        flex-direction: row !important;
        gap: 1.8rem !important;
        align-items: center !important;
      }
      .release-card.layout-right {
        flex-direction: row-reverse !important;
      }
      .image-container {
        flex: 0 0 150px !important;
        min-width: 150px !important;
        max-width: 150px !important;
      }
      .cover-image {
        width: 150px !important;
        height: 150px !important;
        object-fit: contain !important;
        border-radius: 6px !important;
      }
      .content-container {
        flex: 1 !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 0.4rem !important;
      }
      .album-title {
        font-size: 1.4rem !important;
        line-height: 1.2 !important;
        margin-bottom: 0.2rem !important;
      }
      .description p {
        font-size: 0.85rem !important;
        line-height: 1.4 !important;
        margin-bottom: 0.3rem !important;
      }
      .release-date {
        font-size: 0.78rem !important;
        opacity: 0.85 !important;
        margin-top: 0.2rem !important;
      }
      .divider {
        height: 1px !important;
        margin: 1.5rem 0 !important;
        background: rgba(255,255,255,0.15) !important;
      }
      .section-title {
        font-size: 1.6rem !important;
        margin-bottom: 1.2rem !important;
        color: #ffffff !important;
      }
      .sub-section {
        margin-bottom: 1.5rem !important;
      }
      .sub-title {
        font-size: 1rem !important;
        margin-bottom: 1rem !important;
      }
      .grid-container {
        gap: 1.2rem !important;
      }
      .grid-item {
        gap: 0.5rem !important;
      }
      .track-title {
        font-size: 0.82rem !important;
      }
      .page-footer {
        padding: 2rem 0 1rem !important;
        margin-top: 1rem !important;
      }

      #new-media-section {
        background: #121212 !important;
        color: #f0f0f0 !important;
        padding: 0 !important;
      }
      .nm-projects-list {
        display: block !important;
        width: 100% !important;
        margin: 0 !important;
      }
      .nm-project-slice {
        page-break-after: always !important;
        min-height: 100vh !important;
        width: 100% !important;
        padding: 1.5rem 2rem !important;
        margin: 0 !important;
        background: #121212 !important;
        border-bottom: none !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: flex-start !important;
        box-sizing: border-box !important;
      }
      
      .nm-header {
        height: 160px !important;
        width: 100% !important;
        margin-bottom: 1.2rem !important;
        position: relative !important;
        border-radius: 8px !important;
        overflow: hidden !important;
        display: flex !important;
        align-items: center !important;
        background: #1a1a1a !important;
      }
      .slideshow-bg {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        z-index: 1 !important;
      }
      .slideshow-bg img, .slideshow-bg video {
        display: none !important;
      }
      .slideshow-bg img.active, .slideshow-bg video.active {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        opacity: 0.5 !important;
      }
      .nm-header-content {
        position: relative !important;
        z-index: 10 !important;
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        width: 100% !important;
        height: 100% !important;
        padding: 0 2rem !important;
        gap: 2rem !important;
        background: rgba(10,10,12,0.6) !important;
      }
      .nm-header-content > :first-child {
        flex: 0 0 auto !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      .nm-logo {
        height: 75px !important;
        width: auto !important;
        max-width: 180px !important;
        object-fit: contain !important;
      }
      .nm-logo.unicorner-logo,
      .nm-logo.oracolul-logo,
      .nm-logo.resorunes-logo {
        height: 75px !important;
        width: auto !important;
        max-width: 180px !important;
      }
      
      .nm-header-text {
        flex: 1 !important;
      }
      .nm-header-text h2,
      .nm-header-text .album-title {
        font-size: 2rem !important;
        letter-spacing: 2px !important;
        margin: 0 !important;
        color: #ffffff !important;
        text-transform: lowercase !important;
      }
      .nm-header-text p,
      .nm-header-text .subtitle {
        font-size: 1.05rem !important;
        margin-top: 0.3rem !important;
        color: #d0d0d0 !important;
      }
      
      .nm-expanded-content {
        max-height: none !important;
        opacity: 1 !important;
        visibility: visible !important;
        flex: 1 !important;
        display: flex !important;
        flex-direction: column !important;
      }
      .nm-grid {
        display: flex !important;
        flex-direction: row !important;
        gap: 2rem !important;
        flex: 1 !important;
      }
      .nm-gallery {
        flex: 1.1 !important;
      }
      .nm-gallery-main img, .nm-gallery-main video {
        display: none !important;
      }
      .nm-gallery-main img.active, .nm-gallery-main video.active {
        display: block !important;
        max-height: 330px !important;
        max-width: 100% !important;
        object-fit: contain !important;
        border-radius: 6px !important;
      }
      .nm-gallery-caption {
        font-size: 0.82rem !important;
        color: #bbbbbb !important;
        margin-top: 0.5rem !important;
      }
      .nm-info {
        flex: 1 !important;
        font-size: 0.88rem !important;
        line-height: 1.45 !important;
      }
      .nm-metadata {
        list-style: none !important;
        padding: 0 !important;
        margin-bottom: 1rem !important;
      }
      .nm-metadata li {
        font-size: 0.88rem !important;
        margin-bottom: 0.4rem !important;
        color: #e0e0e0 !important;
      }
      .nm-metadata strong {
        color: #ff9800 !important;
      }
      .nm-info .description p {
        color: #d0d0d0 !important;
        font-size: 0.86rem !important;
        line-height: 1.45 !important;
        margin-bottom: 0.6rem !important;
      }
      .nm-info .description strong {
        color: #ffffff !important;
      }

      .pdf-final-page {
        text-align: center !important;
        align-items: center !important;
        background: #0a0a0c !important;
      }
      .pdf-final-content h2 {
        font-size: 2.2rem !important;
        letter-spacing: 3px !important;
        margin-bottom: 1.5rem !important;
        color: #ffffff !important;
      }
      .pdf-final-content p {
        font-size: 1.1rem !important;
        line-height: 1.6 !important;
        color: #e0e0e0 !important;
      }
      .about-wrapper, #about-section {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  });

  try {
    console.log("Generating Full PDF with scale 0.9...");
    const pdf = await page.pdf({ format: 'A4', printBackground: true, scale: 0.9 });
    console.log("FULL TEST SUCCESS! Total PDF size:", pdf.length);
    fs.writeFileSync('Portofoliu_Calin_Nahaiciuc_Design_Affinity.pdf', pdf);
    console.log("PDF File saved successfully!");
  } catch (e) {
    console.error("FULL TEST FAILED:", e.message);
  }

  await browser.close();
})();
