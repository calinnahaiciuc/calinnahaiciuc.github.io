const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log("Starting Puppeteer for Portfolio PDF...");
  const browser = await puppeteer.launch({ 
    protocolTimeout: 300000,
    args: ['--allow-file-access-from-files']
  });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

  page.setDefaultNavigationTimeout(0);
  page.setDefaultTimeout(0);



  let htmlContent = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf8');
  
  console.log("Base64 encoding images to bypass local file restrictions in setContent...");
  // Find all instances of "imagini/..." (both in src="..." and JSON "src":"...")
  const imgRegex = /(["'])(imagini\/.*?)\1/g;
  htmlContent = htmlContent.replace(imgRegex, (match, quote, p1) => {
    try {
      const imgPath = path.resolve(__dirname, decodeURI(p1));
      if (fs.existsSync(imgPath)) {
        const ext = path.extname(imgPath).toLowerCase().substring(1);
        const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
        const base64Data = fs.readFileSync(imgPath, 'base64');
        return `${quote}data:${mimeType};base64,${base64Data}${quote}`;
      }
    } catch (e) {
      console.log(`Failed to base64 encode image: ${p1}`);
    }
    return match;
  });

  console.log(`Setting HTML content...`);
  await page.setViewport({ width: 1200, height: 800 });
  try {
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch(e) {
    console.log("setContent timed out, proceeding...");
  }

  console.log("Formatting DOM for PDF export...");
  const coverBgBuffer = fs.readFileSync(path.resolve(__dirname, 'imagini/general/background.webp'));
  const coverBgBase64 = `data:image/webp;base64,${coverBgBuffer.toString('base64')}`;

  await page.evaluate((coverBgBase64) => {
    // Extract Bio, Statement, and CV contents before clearing
    let bioText = '';
    const bioMatch = document.documentElement.innerHTML.match(/<!--\s*PDF_3RD_PERSON_BIO_START([\s\S]*?)PDF_3RD_PERSON_BIO_END\s*-->/);
    if (bioMatch && bioMatch[1]) {
      bioText = bioMatch[1].trim();
    } else {
      bioText = document.querySelector('#bio-tab .about-text')?.innerHTML || '';
    }
    const statementList = document.querySelector('.credo-list')?.innerHTML || '';
    const cvText = document.querySelector('.cv-content')?.innerHTML || '';

    // Remove elements that don't belong in printed export (including social/email footers)
    const toRemove = document.querySelectorAll('#intro-cover, .main-header, .bg-stripes, #bg-layer, iframe, .player-wrapper, .video-wrapper, .about-tabs-container, .nm-gallery-controls, .nm-expand-hint, #volume-fader, .page-footer, footer, .footer-links');
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
        // Do not overwrite specific pink-glow / green-glow styled elements
        el.querySelectorAll('h1, h2, h3, h4, p, span, div, li, strong, em').forEach(child => {
          if (!child.classList.contains('pink-glow') && !child.classList.contains('pink-text') && !child.classList.contains('green-glow') && !child.closest('.pink-text')) {
            child.style.setProperty('color', text, 'important');
          }
        });
      }
    });

    // 1. CREATE COVER PAGE (Full-bleed A4 background, non-distorted aspect ratio)
    const coverPage = document.createElement('div');
    coverPage.className = 'pdf-page pdf-cover-page';
    coverPage.innerHTML = `
      <div class="pdf-cover-overlay"></div>
      <div class="pdf-cover-content">
        <h1 class="pdf-cover-name">CĂLIN NAHAICIUC</h1>
        <div class="pdf-cover-tagline">artist new media & producător muzică electronică</div>
        <div class="pdf-cover-divider"></div>
        <div class="pdf-cover-meta">
          <p><strong>Email:</strong> <a href="mailto:calinnahaiciuc@proton.me">calinnahaiciuc@proton.me</a></p>
          <p><strong>Website:</strong> <a href="https://calinnahaiciuc.github.io">calinnahaiciuc.github.io</a></p>
          <p><strong>Bandcamp:</strong> <a href="https://marcusaburelius.bandcamp.com">marcusaburelius.bandcamp.com</a></p>
          <p><strong>Instagram:</strong> <a href="https://instagram.com/aburelius">@aburelius</a></p>
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
          <h3 class="pdf-subheading">Statement</h3>
          <div class="pdf-credo-list">${statementList}</div>
        </div>
      </div>
    `;

    // 3. CREATE CV ARTISTIC PAGE (Flows naturally across pages without cropping)
    let processedCvText = cvText;
    if (processedCvText) {
        processedCvText = processedCvText.replace('CONFERINȚE, BURSE &amp; MENTIUNI', '<div style="page-break-before: always; display: block; height: 1rem;"></div>CONFERINȚE, BURSE &amp; MENTIUNI');
        processedCvText = processedCvText.replace('CONFERINȚE, BURSE & MENTIUNI', '<div style="page-break-before: always; display: block; height: 1rem;"></div>CONFERINȚE, BURSE & MENTIUNI');
    }
    const cvPage = document.createElement('div');
    cvPage.className = 'pdf-page pdf-cv-page';
    cvPage.innerHTML = `
      <h2 class="pdf-section-heading">SCURT CV ARTISTIC</h2>
      <div class="pdf-cv-container">${processedCvText}</div>
    `;

    // Final page removed as per user choice.

    // Prepend coverPage directly to body to avoid portfolio-content padding offsets
    document.body.prepend(coverPage);
    coverPage.after(bioPage);
    bioPage.after(cvPage);
    bioPage.after(cvPage);

    // Expand New Media slices & create splash-screen style image collages on the left
    document.querySelectorAll('.nm-project-slice').forEach(el => {
      el.classList.add('expanded');
      const gallery = el.querySelector('.nm-gallery');
      if (gallery) {
        let mediaList = [];
        try {
          const rawPdfMedia = gallery.getAttribute('data-pdf-media');
          const rawMedia = gallery.getAttribute('data-media');
          if (rawPdfMedia) {
            mediaList = JSON.parse(rawPdfMedia);
          } else if (rawMedia) {
            mediaList = JSON.parse(rawMedia);
          }
        } catch (e) { }

        const imageItems = mediaList.filter(item => item.type === 'img' || (item.src && (item.src.endsWith('.webp') || item.src.endsWith('.jpeg') || item.src.endsWith('.png') || item.src.endsWith('.jpg'))));

        if (imageItems.length > 0) {
          const collageContainer = document.createElement('div');
          collageContainer.className = 'pdf-nm-collage';

          collageContainer.classList.add('collage-dynamic');

          imageItems.forEach((item, i) => {
            const wrapper = document.createElement('div');
            wrapper.className = `pdf-collage-item img-${i}`;
            wrapper.style.position = 'relative';
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.gap = '4px';

            const img = document.createElement('img');
            img.src = item.src;
            img.className = 'pdf-collage-img';
            img.style.flex = '1';
            img.style.minHeight = '0';
            wrapper.appendChild(img);

            if (item.caption || item.pdfCaption) {
               const caption = document.createElement('div');
               caption.className = 'pdf-collage-caption';
               caption.style.fontSize = '0.65rem';
               caption.style.color = '#777777';
               caption.style.lineHeight = '1.2';
               caption.style.marginTop = '2px';
               let text = item.pdfCaption ? item.pdfCaption : item.caption.replace(/^\d+\s*-\s*/, '');
               caption.innerText = text;
               wrapper.appendChild(caption);
            }
            
            collageContainer.appendChild(wrapper);
          });

          // Insert nm-info into the collage container to create a puzzle/masonry effect
          const nmInfo = el.querySelector('.nm-info');
          if (nmInfo) {
            // vary the position dynamically based on project title length or randomly
            let insertPos = el.id === 'project-unicorner' ? 0 : 1; 
            if (collageContainer.children.length > insertPos) {
                collageContainer.insertBefore(nmInfo, collageContainer.children[insertPos]);
            } else {
                collageContainer.appendChild(nmInfo);
            }
          }

          gallery.innerHTML = '';
          gallery.appendChild(collageContainer);
        }
      }
    });

    // Apply Varianta B: Camouflaged URL text for Affinity auto-linking
    document.querySelectorAll('.release-card, .grid-item').forEach(item => {
        const coverLink = item.querySelector('.cover-link');
        const title = item.querySelector('.album-title, .track-title, .project-title');
        
        if (coverLink) {
            // Invisible text over artwork
            const hiddenTextImg = document.createElement('div');
            hiddenTextImg.innerText = coverLink.href;
            hiddenTextImg.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; color: #121212; font-size: 28px; overflow: hidden; line-height: 1; z-index: 10; word-break: break-all; opacity: 0.02; user-select: none; pointer-events: none;';
            coverLink.style.position = 'relative';
            coverLink.appendChild(hiddenTextImg);
        }

        if (coverLink && title) {
            // Invisible text over title
            const hiddenTextTitle = document.createElement('div');
            hiddenTextTitle.innerText = coverLink.href;
            hiddenTextTitle.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; color: #121212; font-size: 14px; overflow: hidden; line-height: 1; z-index: 10; word-break: break-all; opacity: 0.02; user-select: none; pointer-events: none;';
            title.style.position = 'relative';
            title.appendChild(hiddenTextTitle);

            if (!title.querySelector('a')) {
                const a = document.createElement('a');
                a.href = coverLink.href;
                a.target = '_blank';
                a.style.cssText = 'color: inherit; text-decoration: none; position: relative; z-index: 20;';
                a.innerHTML = title.innerHTML;
                title.innerHTML = '';
                title.appendChild(a);
            }
        }
    });

    // Fix first page links for Affinity auto-detection
    document.querySelectorAll('.pdf-cover-meta a').forEach(link => {
        if (!link.innerText.includes('https://') && !link.href.startsWith('mailto:')) {
            const hiddenUrl = document.createElement('span');
            hiddenUrl.innerText = ' ' + link.href;
            hiddenUrl.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; color: #121212; font-size: 16px; overflow: hidden; opacity: 0.02; z-index: 10; pointer-events: none;';
            link.style.position = 'relative';
            link.appendChild(hiddenUrl);
        }
    });

    // Remove Wikipedia highlights and their styling for PDF
    document.querySelectorAll('.wiki-hover-trigger').forEach(trigger => {
        let textContent = '';
        trigger.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                textContent += node.textContent;
            }
        });
        const textNode = document.createTextNode(textContent);
        trigger.parentNode.replaceChild(textNode, trigger);
    });

    // Fix link colors in PDF to prevent default blue
    document.querySelectorAll('.nm-metadata a').forEach(a => {
        a.style.color = '#ffffff';
        a.style.textDecoration = 'underline';
        a.style.textDecorationColor = 'rgba(255, 255, 255, 0.4)';
    });

    // 5. GROUP MARCUS ABURELIUS MAIN ALBUMS (2 PER PAGE, FULL-WIDTH EDGE-TO-EDGE COLOR STRIPS)
    const mainReleasesSection = document.querySelector('#music-section .releases-list:not(.dynamic-section)') || document.querySelector('#music-section .releases-list');
    const mainAlbumCards = Array.from(mainReleasesSection ? mainReleasesSection.querySelectorAll('.release-card') : []);

    for (let i = 0; i < mainAlbumCards.length; i += 2) {
      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'pdf-page pdf-albums-page';
      if (i === 0) {
        const pageTitle = document.createElement('div');
        pageTitle.className = 'pdf-albums-header';
        pageTitle.innerHTML = '<h2 class="pdf-section-heading" style="margin: 0 !important; padding: 1.2rem 2.5rem 0.6rem !important;">ALBUME MUZICALE (MARCUS ABURELIUS)</h2><p style="margin: -0.2rem 0 1rem 0; padding: 0 2.5rem; color: #777777; font-size: 0.85rem; font-style: italic;">*titlurile release-urilor funcționează ca link-uri interactive</p>';
        pageWrapper.appendChild(pageTitle);
      }
      const pair = mainAlbumCards.slice(i, i + 2);
      pair[0].parentNode.insertBefore(pageWrapper, pair[0]);
      pair.forEach(card => pageWrapper.appendChild(card));
    }

    // 6. COMBINE SINGLE-URI & APARIȚII PE COMPILAȚII ON A SINGLE PAGE WITH GREY DIVIDERS
    const singlesSection = document.querySelector('.grid-section.singles');
    const compilationsSection = document.querySelector('.grid-section.compilations');
    if (singlesSection && compilationsSection) {
      const singlesCompPage = document.createElement('div');
      singlesCompPage.className = 'pdf-page pdf-singles-compilations-page';

      // Main Category Title 1: SINGLE-URI (Grey border)
      const singlesTitle = document.createElement('h2');
      singlesTitle.className = 'pdf-section-heading-dark';
      singlesTitle.style.cssText = 'margin: 0 0 0.4rem 0 !important; font-size: 1.35rem !important; border-bottom: 2px solid #aaaaaa !important; padding-bottom: 0.2rem !important; color: #1a1a1a !important; text-transform: uppercase !important; letter-spacing: 1px !important;';
      singlesTitle.innerText = 'SINGLE-URI';
      singlesCompPage.appendChild(singlesTitle);

      const subSections = Array.from(singlesSection.querySelectorAll('.sub-section'));

      // Sub-block 1: Drept Aburelius
      if (subSections[0]) {
        const block1 = document.createElement('div');
        block1.className = 'pdf-singles-compilations-block';
        block1.appendChild(subSections[0]);
        singlesCompPage.appendChild(block1);
      }

      // Sub-block 2: Drept Claburelius
      if (subSections[1]) {
        const block2 = document.createElement('div');
        block2.className = 'pdf-singles-compilations-block';
        block2.appendChild(subSections[1]);
        singlesCompPage.appendChild(block2);
      }

      // Prominent Grey Divider Line between Singles and Compilations
      const dividerLine = document.createElement('div');
      dividerLine.className = 'pdf-comp-divider';
      dividerLine.style.cssText = 'width: 100% !important; height: 2px !important; background: #aaaaaa !important; margin: 0.6rem 0 !important;';
      singlesCompPage.appendChild(dividerLine);

      // Main Category Title 2: APARIȚII PE COMPILAȚII (Grey border)
      const compHeaderTitle = document.createElement('h2');
      compHeaderTitle.className = 'pdf-section-heading-dark';
      compHeaderTitle.style.cssText = 'margin: 0 0 0.4rem 0 !important; font-size: 1.35rem !important; border-bottom: 2px solid #aaaaaa !important; padding-bottom: 0.2rem !important; color: #1a1a1a !important; text-transform: uppercase !important; letter-spacing: 1px !important;';
      compHeaderTitle.innerText = 'APARIȚII PE COMPILAȚII';
      singlesCompPage.appendChild(compHeaderTitle);

      // Sub-block 3: Compilations Grid
      const block3 = document.createElement('div');
      block3.className = 'pdf-singles-compilations-block';
      const compGrid = compilationsSection.querySelector('.grid-container');
      if (compGrid) {
        block3.appendChild(compGrid);
      }
      singlesCompPage.appendChild(block3);

      singlesSection.parentNode.insertBefore(singlesCompPage, singlesSection);
      singlesSection.remove();
      compilationsSection.remove();
    }

    // 7. ALTE LANSĂRI (POLITEHNICA, MUZICON, P1) ON A DEDICATED FULL-WIDTH PAGE
    const otherReleasesSections = Array.from(document.querySelectorAll('#music-section .releases-list.dynamic-section'));
    if (otherReleasesSections.length > 0) {
      const otherReleasesPage = document.createElement('div');
      otherReleasesPage.className = 'pdf-page pdf-other-releases-page';

      const otherHeader = document.createElement('div');
      otherHeader.className = 'pdf-other-header';
      otherHeader.innerHTML = '<h2 class="pdf-section-heading-dark" style="margin: 0 !important; padding: 1.2rem 2.5rem 0.6rem !important; border-bottom: 2px solid #aaaaaa !important;">ALTE LANSĂRI</h2>';
      otherReleasesPage.appendChild(otherHeader);

      otherReleasesSections[0].parentNode.insertBefore(otherReleasesPage, otherReleasesSections[0]);

      otherReleasesSections.forEach(sec => {
        const cards = Array.from(sec.querySelectorAll('.release-card'));
        cards.forEach(card => otherReleasesPage.appendChild(card));
        sec.remove();
      });
    }

    // 8. FINAL NEW MEDIA PAGE
    const finalPage = document.createElement('div');
    finalPage.className = 'pdf-page pdf-final-page';
    finalPage.innerHTML = `
      <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; height: 100vh; padding: 4rem; background-color: #121212; color: #f0f0f0;">
        <p style="font-size: 1.35rem; line-height: 1.8; max-width: 650px; margin-bottom: 2.5rem; font-weight: 300;">
          Pentru o experiență 'new media' a portofoliului — unde puteți asculta discografia integrală, urmări documentația video a proiectelor și testa aplicațiile interactive —, vă invit să accesați platforma web:
        </p>
        <div style="font-size: 1.6rem; color: #f0f0f0; font-weight: 500; font-family: monospace;">
          👉 <a href="https://calinnahaiciuc.github.io" target="_blank" style="color: #f0f0f0; text-decoration: underline;">https://calinnahaiciuc.github.io</a>
        </div>
      </div>
    `;
    document.body.appendChild(finalPage);

    // Inject dedicated PDF print styles
    const style = document.createElement('style');
    style.innerHTML = `
      @page {
        size: A4 portrait;
        margin: 0 !important;
      }
      ::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }
      * {
        transition: none !important;
        animation: none !important;
        box-sizing: border-box !important;
      }
      html, body {
        background-color: #121212 !important;
        color: #f0f0f0 !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100vw !important;
      }
      .portfolio-content, .music-portfolio {
        margin: 0 !important;
        padding: 0 !important;
        max-width: 100% !important;
      }
      p, li, h1, h2, h3, h4, h5, h6, .credo-item {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      /* Base single-page layout */
      .pdf-page {
        width: 100vw !important;
        height: 100vh !important;
        box-sizing: border-box !important;
        position: relative !important;
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        margin: 0 !important;
      }

      /* 1. COVER PAGE - Full bleed, non-distorted aspect ratio, zero top/bottom black bars */
      .pdf-cover-page {
        height: 100vh !important;
        max-height: 100vh !important;
        min-height: 100vh !important;
        width: 100vw !important;
        padding: 0 !important;
        margin: 0 !important;
        background-image: url('${coverBgBase64}') !important;
        background-size: cover !important;
        background-position: center center !important;
        background-repeat: no-repeat !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        overflow: hidden !important;
      }
      .pdf-cover-overlay {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: rgba(0, 0, 0, 0.3) !important;
        z-index: 1 !important;
      }
      .pdf-cover-content {
        position: relative !important;
        z-index: 2 !important;
        max-width: 750px !important;
        text-align: center !important;
        padding: 2rem !important;
      }
      /* Global Links */
      .pdf-page a {
        text-decoration: none !important;
        color: inherit !important;
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

      /* 2. BIO & CV PAGES */
      .pdf-bio-page {
        height: 100vh !important;
        max-height: 100vh !important;
        min-height: 100vh !important;
        padding: 2.5rem 3rem !important;
        background: #121212 !important;
        color: #f0f0f0 !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        overflow: hidden !important;
      }
      .pdf-cv-page {
        height: auto !important;
        min-height: 100vh !important;
        max-height: none !important;
        page-break-inside: auto !important;
        break-inside: auto !important;
        page-break-after: always !important;
        break-after: page !important;
        display: block !important;
        padding: 2.5rem 3rem !important;
        background: #121212 !important;
        color: #f0f0f0 !important;
        overflow: visible !important;
      }
      .pdf-cv-page li {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .pdf-section-heading {
        font-size: 1.6rem !important;
        margin-bottom: 1.2rem !important;
        letter-spacing: 2px !important;
        border-bottom: 1px solid rgba(255,255,255,0.2) !important;
        padding-bottom: 0.5rem !important;
        color: #ffffff !important;
      }
      .pdf-section-heading-dark {
        font-size: 1.35rem !important;
        letter-spacing: 1.5px !important;
        border-bottom: 2px solid #aaaaaa !important;
        color: #1a1a1a !important;
      }
      .pdf-subheading {
        font-size: 1.25rem !important;
        margin-bottom: 0.8rem !important;
        color: #ff9800 !important;
      }
      .pdf-bio-grid {
        display: flex !important;
        flex-direction: row !important;
        gap: 2rem !important;
      }
      .pdf-bio-col, .pdf-statement-col {
        flex: 1 !important;
      }
      .pdf-text p {
        font-size: 0.85rem !important;
        line-height: 1.45 !important;
        margin-bottom: 0.7rem !important;
        color: #e0e0e0 !important;
      }
      .pdf-credo-list .credo-item {
        font-size: 0.82rem !important;
        line-height: 1.38 !important;
        padding: 0.35rem 0 !important;
        border-bottom: 1px solid rgba(255,255,255,0.08) !important;
        color: #e0e0e0 !important;
      }
      .pdf-cv-container {
        font-size: 0.84rem !important;
        line-height: 1.45 !important;
        color: #e0e0e0 !important;
      }

      /* 3. MUSIC PORTFOLIO (2 ALBUMS PER PAGE, FULL-WIDTH EDGE-TO-EDGE COLOR STRIPS) */
      #music-section {
        background: #121212 !important;
        color: #f0f0f0 !important;
        padding: 0 !important;
      }
      .portfolio-header {
        display: none !important;
      }
      .releases-list {
        display: contents !important;
      }

      .pdf-albums-page {
        width: 100vw !important;
        height: 100vh !important;
        max-height: 100vh !important;
        min-height: 100vh !important;
        padding: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: flex-start !important;
        box-sizing: border-box !important;
        background: #121212 !important;
        color: #f0f0f0 !important;
        overflow: hidden !important;
      }
      .pdf-albums-header {
        background: #121212 !important;
        width: 100% !important;
      }

      .pdf-albums-page .release-card {
        width: 100% !important;
        flex: 1 !important;
        height: auto !important;
        margin: 0 !important;
        padding: 1.8rem 2.5rem !important;
        border-radius: 0 !important;
        display: flex !important;
        flex-direction: row !important;
        gap: 2rem !important;
        align-items: center !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
      }
      .pdf-page .nm-logo {
        height: 77vh !important;
      }
      .pdf-page .nm-logo.unicorner-logo {
        width: 90vh !important;
        height: 140vh !important;
      }
      .pdf-page .nm-logo.oracolul-logo {
        height: 110vh !important;
        transform: scale(1.8);
      }
      .pdf-albums-page .release-card.layout-right {
        flex-direction: row-reverse !important;
      }
      .pdf-albums-page .image-container {
        flex: 0 0 280px !important;
        min-width: 280px !important;
        max-width: 280px !important;
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
      }
      .pdf-albums-page .cover-link {
        display: block !important;
        width: 280px !important;
        height: 280px !important;
        position: relative !important;
        z-index: 50 !important;
      }
      .pdf-albums-page .cover-image {
        width: 280px !important;
        height: 280px !important;
        max-width: 280px !important;
        max-height: 280px !important;
        object-fit: cover !important;
        border-radius: 6px !important;
        box-shadow: none !important;
      }
      .pdf-albums-page .content-container {
        flex: 1 !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 0.35rem !important;
        max-height: 100% !important;
        overflow: hidden !important;
      }
      .pdf-albums-page .album-title {
        font-size: 1.4rem !important;
        line-height: 1.2 !important;
        margin-bottom: 0.2rem !important;
      }
      .pdf-albums-page .description p {
        font-size: 0.82rem !important;
        line-height: 1.4 !important;
        margin-bottom: 0.3rem !important;
      }
      .pdf-albums-page .release-date {
        font-size: 0.78rem !important;
        opacity: 0.85 !important;
        margin-top: 0.2rem !important;
        font-weight: 600 !important;
      }

      /* 4. COMBINED SINGLE-URI & APARIȚII PE COMPILAȚII PAGE (50% ENLARGED ARTWORKS & GREY DIVIDERS) */
      .pdf-singles-compilations-page {
        width: 100vw !important;
        height: 100vh !important;
        max-height: 100vh !important;
        min-height: 100vh !important;
        margin: 0 !important;
        padding: 1.4rem 2rem !important;
        background: #f0f0f0 !important;
        color: #1a1a1a !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        align-items: stretch !important;
      }
      .pdf-singles-compilations-block {
        flex: 1 !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .pdf-singles-compilations-block .sub-section {
        margin-bottom: 0 !important;
        height: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
      }
      .pdf-singles-compilations-block .sub-title {
        font-size: 0.95rem !important;
        font-weight: 600 !important;
        margin: 0 0 0.35rem 0 !important;
        color: #ff9800 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
        border: none !important;
        padding: 0 !important;
      }
      .pdf-singles-compilations-block .grid-container.grid-3 {
        display: grid !important;
        grid-template-columns: repeat(3, 1fr) !important;
        gap: 1.2rem !important;
        width: 100% !important;
      }
      .pdf-singles-compilations-block .grid-item {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        text-align: center !important;
      }
      .pdf-singles-compilations-block .grid-item .player-wrapper,
      .pdf-singles-compilations-block .grid-item .video-wrapper,
      .pdf-albums-page .player-wrapper,
      .pdf-albums-page .video-wrapper,
      .pdf-other-releases-page .player-wrapper,
      .pdf-other-releases-page .video-wrapper {
        display: none !important;
        content: none !important;
      }
      .pdf-singles-compilations-block .grid-item .cover-link {
        display: block !important;
        width: 100% !important;
        max-width: 185px !important;
        position: relative !important;
        z-index: 50 !important;
      }
      .pdf-singles-compilations-block .grid-item .cover-image {
        width: 185px !important;
        height: 185px !important;
        max-width: 185px !important;
        max-height: 185px !important;
        object-fit: cover !important;
        border-radius: 6px !important;
        box-shadow: none !important;
      }
      .pdf-singles-compilations-block .track-title {
        font-size: 0.8rem !important;
        margin-top: 0.35rem !important;
        color: #1a1a1a !important;
        font-weight: 500 !important;
      }

      /* 5. ALTE LANSĂRI PAGE (MUZICON PINK TEXT & FILMUL UNEI ZILE PRESERVED) */
      .pdf-other-releases-page {
        width: 100vw !important;
        height: 100vh !important;
        max-height: 100vh !important;
        min-height: 100vh !important;
        padding: 0 !important;
        margin: 0 !important;
        background: #ffffff !important;
        color: #1a1a1a !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
      }
      .pdf-other-header {
        background: #ffffff !important;
        width: 100% !important;
      }
      .pdf-other-releases-page .release-card {
        width: 100% !important;
        flex: 1 !important;
        height: auto !important;
        margin: 0 !important;
        padding: 1.4rem 2.5rem !important;
        border-radius: 0 !important;
        display: flex !important;
        flex-direction: row !important;
        gap: 1.8rem !important;
        align-items: center !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
      }
      .pdf-other-releases-page .release-card.layout-right {
        flex-direction: row-reverse !important;
      }
      .pdf-other-releases-page .image-container {
        flex: 0 0 220px !important;
        min-width: 220px !important;
        max-width: 220px !important;
      }
      .pdf-other-releases-page .cover-link {
        display: block !important;
        width: 220px !important;
        height: 220px !important;
        position: relative !important;
        z-index: 50 !important;
      }
      .pdf-other-releases-page .cover-image {
        width: 220px !important;
        height: 220px !important;
        max-width: 220px !important;
        max-height: 220px !important;
        object-fit: cover !important;
        border-radius: 6px !important;
      }
      .pdf-other-releases-page .content-container {
        flex: 1 !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 0.3rem !important;
      }
      .pdf-other-releases-page .album-title {
        font-size: 1.3rem !important;
        line-height: 1.2 !important;
        margin-bottom: 0.2rem !important;
      }
      .pdf-other-releases-page .description p {
        font-size: 0.8rem !important;
        line-height: 1.38 !important;
        margin-bottom: 0.3rem !important;
      }
      .pdf-other-releases-page .release-date {
        font-size: 0.78rem !important;
        opacity: 0.85 !important;
        margin-top: 0.2rem !important;
      }

      /* Explicit styling for Muzicon Pink Text & Filmul unei zile Green Glow */
      .pink-glow, .pink-glow * {
        color: #ff007f !important;
        text-shadow: 0 0 8px rgba(255, 0, 127, 0.4) !important;
      }
      .pink-text, .pink-text p, .pink-text span, .pink-text div {
        color: #ff007f !important;
      }
      .green-glow {
        color: #d4e0d4 !important;
        text-shadow: 0 0 10px rgba(212,224,212,0.3) !important;
      }

      /* HIDE ALL FOOTERS & SOCIAL BARS */
      .page-footer, footer, .footer-links, .footer-email {
        display: none !important;
      }

      /* 6. NEW MEDIA SECTION - 2.5X LARGER LOGOS FOR ORACOLUL 2000 AND UNICORNER & LEFT ALIGNED TITLES */
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
        width: 100vw !important;
        height: auto !important;
        max-height: none !important;
        min-height: 100vh !important;
        padding: 2.5rem 3rem !important;
        margin: 0 !important;
        background: #121212 !important;
        border-bottom: none !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: flex-start !important;
        box-sizing: border-box !important;
        overflow: visible !important;
        page-break-after: always !important;
        break-after: page !important;
      }
      
      .nm-header {
        height: 155px !important;
        width: 100% !important;
        margin-bottom: 1.2rem !important;
        position: relative !important;
        border-radius: 8px !important;
        overflow: hidden !important;
        display: flex !important;
        align-items: center !important;
        background: #1a1a1a !important;
        flex: 0 0 155px !important;
      }
      .nm-expanded-content {
        flex: 1 !important;
        display: flex !important;
        flex-direction: column !important;
        height: auto !important;
        min-width: 0 !important;
        min-height: 0 !important;
        overflow: visible !important;
      }
      .nm-grid {
        display: flex !important;
        flex-direction: row !important;
        gap: 2rem !important;
        flex: 1 !important;
        height: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        overflow: hidden !important;
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
        gap: 1.5rem !important;
        background: rgba(10,10,12,0.6) !important;
      }
      .nm-header-content > :first-child {
        flex: 0 0 240px !important;
        width: 240px !important;
        min-width: 240px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
      }
      .nm-logo-link {
        display: block !important;
      }
      .nm-logo,
      .nm-logo-link img {
        height: 90px !important;
        max-height: 90px !important;
        width: auto !important;
        max-width: 220px !important;
        object-fit: contain !important;
        border: none !important;
        outline: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      /* BASE SIZING FOR NEW MEDIA LOGOS */
      .unicorner-logo,
      .oracolul-logo,
      .nm-logo.unicorner-logo,
      .nm-logo.oracolul-logo,
      a .oracolul-logo,
      a .unicorner-logo {
        height: 125px !important;
        max-height: 125px !important;
        width: auto !important;
        max-width: 240px !important;
        object-fit: contain !important;
      }

      /* 2.5X LARGER SIZING VIA TRANSFORM TO AVOID LAYOUT DEADLOCKS */
      #new-media-section .nm-logo.unicorner-logo {
        transform: rotate(90deg) scale(2.0) !important;
      }
      #new-media-section .nm-logo.oracolul-logo {
        transform: scale(2.2) translateY(-2%) !important;
      }

      /* HIDE TOOLTIPS IN PDF TO PREVENT LAYOUT LOOPS */
      [data-tooltip]::after,
      [data-tooltip]::before,
      .nm-logo-link::after,
      .nm-logo-link::before {
        display: none !important;
        content: none !important;
      }
      
      .nm-header-text {
        flex: 1 !important;
        text-align: left !important;
      }
      .nm-header-text h2,
      .nm-header-text .album-title {
        font-size: 1.8rem !important;
        letter-spacing: 2px !important;
        margin: 0 !important;
        color: #ffffff !important;
        text-transform: lowercase !important;
      }
      .nm-header-text p,
      .nm-header-text .subtitle {
        font-size: 1rem !important;
        margin-top: 0.2rem !important;
        color: #d0d0d0 !important;
      }
      
      .nm-projects-list::before,
      .nm-projects-list::after,
      .nm-project-slice::before,
      .nm-project-slice::after {
        display: none !important;
        content: none !important;
      }
      
      .nm-expanded-content {
        max-height: none !important;
        opacity: 1 !important;
        visibility: visible !important;
        flex: 1 !important;
        display: block !important;
        overflow: visible !important;
      }
      .nm-grid {
        display: block !important;
        position: relative !important;
        width: 100% !important;
        overflow: visible !important;
      }
      .nm-gallery {
        display: block !important;
        width: 100% !important;
        position: relative !important;
      }
      .pdf-nm-collage {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 2rem 2.5rem !important;
        width: 100% !important;
        height: auto !important;
        align-items: flex-start !important;
        justify-content: center !important;
        box-sizing: border-box !important;
      }
      .pdf-collage-item {
        flex: 1 1 40% !important;
        max-width: 48% !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        position: relative !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .pdf-nm-collage img {
        width: 100% !important;
        height: auto !important;
        max-height: 32vh !important;
        object-fit: contain !important;
        border-radius: 6px !important;
        display: block !important;
        box-shadow: none !important;
      }
      
      .nm-gallery-main {
        display: none !important;
      }
      .nm-gallery-caption {
        font-size: 0.75rem !important;
        color: #bbbbbb !important;
        margin-top: 0.5rem !important;
        text-align: center !important;
      }
      .nm-info {
        flex: 1 1 40% !important;
        max-width: 48% !important;
        min-width: 320px !important;
        position: relative !important;
        margin-top: 0 !important;
        font-size: 0.85rem !important;
        line-height: 1.4 !important;
        background: transparent !important;
        text-shadow: none !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .nm-metadata {
        list-style: none !important;
        padding: 0 !important;
        margin-bottom: 0.8rem !important;
      }
      .nm-metadata li {
        font-size: 0.85rem !important;
        margin-bottom: 0.35rem !important;
        color: #e0e0e0 !important;
      }
      .nm-metadata strong {
        color: #ff9800 !important;
      }
      .nm-info .description p {
        color: #d0d0d0 !important;
        font-size: 0.84rem !important;
        line-height: 1.4 !important;
        margin-bottom: 0.5rem !important;
      }
      .nm-info .description strong {
        color: #ffffff !important;
      }

      .about-wrapper, #about-section, .divider {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }, coverBgBase64);

  console.log("Generating PDF file...");
  await page.emulateMediaType('screen');

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    scale: 1.0,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  const outputPath = require('path').join('D:\\', 'release assets', 'promo', 'portofoliu', 'Portofoliu_Calin_Nahaiciuc_Design_Affinity.pdf');
  fs.writeFileSync(outputPath, pdfBuffer);
  
  await browser.close();
  console.log('PDF generated successfully as ' + outputPath);
})();
