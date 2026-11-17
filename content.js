/**
 * QA Bug Hunter & Visual Assistant - Content Script v1.1.0
 * Features:
 * - Automatically captures nearby product names (e.g. "Exfoliating Body Brush")
 * - Smart placeholder detector ("No image found")
 * - Purges all 3rd party tracking beacons (Bing, Google, Facebook)
 * - Complete uTest format with numbered steps starting from homepage
 */

(function () {
  if (window.__qaBugHunterLoaded) return;
  window.__qaBugHunterLoaded = true;

  const state = {
    bugs: [],
    settings: {
      checkMath: true,
      checkContent: true,
      checkMedia: true,
      checkLinks: true,
      highContrast: true
    }
  };

  function getDeviceInfo() {
    const ua = navigator.userAgent;
    let os = 'Windows 11 Pro';
    if (ua.includes('Macintosh')) os = 'macOS';
    if (ua.includes('Android')) os = 'Android';
    if (ua.includes('iPhone')) os = 'iOS';
    return os;
  }

  function getPageArea() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('cart') || path.includes('bag')) return 'Order Summary';
    if (path.includes('reward')) return 'Rewards Page';
    if (path.includes('checkout')) return 'Checkout';
    if (path.includes('account') || path.includes('login') || path.includes('profile')) return 'Account';
    if (path.includes('search')) return 'Search Results Page';
    if (path.includes('contact') || path.includes('customer-service')) return 'Customer Service';
    if (path.length <= 1 || path === '/en' || path === '/en/') return 'Homepage';
    return 'Catalog Page';
  }

  const BASE_URL = window.location.origin;
  const CURRENT_URL = window.location.href;
  const OS_NAME = getDeviceInfo();
  const PAGE_AREA = getPageArea();

  // Strict list of analytics/tracking services to completely ignore
  const TRACKING_DOMAINS = [
    'bat.bing.com',
    'bing.com',
    'google-analytics.com',
    'googletagmanager.com',
    'doubleclick.net',
    'facebook.com',
    'facebook.net',
    'criteo',
    'clarity.ms',
    'hotjar',
    'analytics',
    'pixel'
  ];

  // Helper to extract the exact name of the product or card next to the defect
  function getNearbyProductName(el) {
    if (!el) return '';
    // 1. Check parent container (card, tile, product row)
    const card = el.closest('[class*="product"], [class*="card"], [class*="tile"], [class*="item"], article, li, div') || el.parentElement;
    if (card) {
      // Look for title/heading tags first
      const titleEl = card.querySelector('h1, h2, h3, h4, h5, [class*="name"], [class*="title"], [class*="label"]');
      if (titleEl && titleEl.innerText.trim()) {
        return titleEl.innerText.trim().split('\n')[0].replace(/\s+/g, ' ');
      }
      // Scan text lines inside the card
      const textLines = card.innerText
        .split('\n')
        .map((t) => t.trim())
        .filter((t) => t.length > 2 && !t.includes('points') && !t.includes('Select') && !t.includes('DETAILS') && !t.includes('No image'));
      if (textLines.length > 0) {
        return textLines[0].substring(0, 45);
      }
    }
    // 2. Check next sibling text
    if (el.nextElementSibling) {
      const sibText = el.nextElementSibling.innerText?.trim();
      if (sibText) return sibText.split('\n')[0].substring(0, 45);
    }
    return '';
  }

  // -------------------------------------------------------------
  // 1. Crash & Runtime Error Listener
  // -------------------------------------------------------------
  window.addEventListener('error', (event) => {
    const file = event.filename || '';
    if (TRACKING_DOMAINS.some((d) => file.includes(d))) return;

    addBug({
      type: 'Crash',
      area: PAGE_AREA,
      title: 'JavaScript runtime error triggers in console',
      steps: [
        `Open Google Chrome on Windows 11 and navigate to: ${BASE_URL}`,
        `Navigate to: ${CURRENT_URL}`,
        `Interact with page elements or trigger script execution`,
        `Observe the browser response`
      ],
      expected: 'Page scripts should execute smoothly without unhandled runtime exceptions.',
      actual: `An unhandled JavaScript error occurred: "${event.message}" at ${file || 'script'}:${event.lineno || 0}.`,
      element: null,
      severity: 'Critical'
    });
  });

  // -------------------------------------------------------------
  // 2. Math & E-Commerce Auditor
  // -------------------------------------------------------------
  function checkCartMath() {
    if (!state.settings.checkMath) return;

    const fullText = document.body.innerText;
    const subtotalMatch = fullText.match(/(?:subtotal|items total|product total)[^\d$]*\$?\s*([\d,]+\.\d{2})/i);
    const totalMatch = fullText.match(/(?:estimated total|order total|grand total|total)\s*:?[^\d$]*\$?\s*([\d,]+\.\d{2})/i);
    const shippingMatch = fullText.match(/shipping[^\d$]*\$?\s*([\d,]+\.\d{2})/i);
    const discountMatch = fullText.match(/(?:discount|rewards|promo|coupon)[^\d$]*-\$?\s*([\d,]+\.\d{2})/i);
    const taxMatch = fullText.match(/(?:tax|estimated tax)[^\d$]*\$?\s*([\d,]+\.\d{2})/i);

    if (subtotalMatch && totalMatch) {
      const subtotal = parseFloat(subtotalMatch[1].replace(/,/g, ''));
      const total = parseFloat(totalMatch[1].replace(/,/g, ''));
      const shipping = shippingMatch ? parseFloat(shippingMatch[1].replace(/,/g, '')) : 0.0;
      const discount = discountMatch ? parseFloat(discountMatch[1].replace(/,/g, '')) : 0.0;
      const tax = taxMatch ? parseFloat(taxMatch[1].replace(/,/g, '')) : 0.0;

      const expectedTotal = Number((subtotal - discount + shipping + tax).toFixed(2));
      const diff = Math.abs(expectedTotal - total);

      if (diff > 0.05) {
        addBug({
          type: 'Functional',
          area: 'Order Summary',
          title: `Applied discount or shipping is not calculated correctly in Order Summary`,
          steps: [
            `Open Google Chrome on Windows 11 and navigate to: ${BASE_URL}`,
            `Add items to cart and navigate to the cart page: ${CURRENT_URL}`,
            `Review the breakdown under Order summary (Subtotal: $${subtotal}, Discount: -$${discount}, Shipping: $${shipping})`,
            `Observe the calculated Estimated Total`
          ],
          expected: `The Estimated Total should equal Subtotal minus Discounts plus Shipping ($${expectedTotal.toFixed(2)}).`,
          actual: `The Estimated Total displays $${total.toFixed(2)}, ignoring discount/shipping rules (discrepancy of $${diff.toFixed(2)}).`,
          element: findElementWithText(totalMatch[1]),
          severity: 'Critical'
        });
      }
    }
  }

  // -------------------------------------------------------------
  // 3. Media, Missing Images & "No Image Found" Detectors
  // -------------------------------------------------------------
  function checkMediaAndPlaceholders() {
    if (!state.settings.checkMedia) return;

    // Check all image tags
    document.querySelectorAll('img').forEach((img) => {
      if (img.closest('#qa-bug-hunter-root')) return;

      const src = (img.src || '').toLowerCase();
      const alt = (img.alt || '').toLowerCase();

      // Skip tracking beacons completely
      if (TRACKING_DOMAINS.some((d) => src.includes(d))) return;

      // Skip invisible / hidden elements
      const rect = img.getBoundingClientRect();
      const style = window.getComputedStyle(img);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        (img.offsetWidth <= 8 && img.offsetHeight <= 8) ||
        (rect.width <= 8 && rect.height <= 8)
      ) {
        return;
      }

      // Check A: "No image found" / placeholder graphic
      const isPlaceholder =
        src.includes('no-image') ||
        src.includes('noimage') ||
        src.includes('placeholder') ||
        alt.includes('no image') ||
        alt.includes('placeholder');

      if (isPlaceholder) {
        const prodName = getNearbyProductName(img) || 'Product';
        addBug({
          type: 'Visual',
          area: PAGE_AREA,
          title: `'${prodName}' card displays 'No image found' placeholder instead of product image`,
          steps: [
            `Open Google Chrome on Windows 11 and navigate to: ${BASE_URL}`,
            `Navigate to: ${CURRENT_URL}`,
            `Scroll down to the catalog grid`,
            `Locate the product card for '${prodName}'`,
            `Observe the product image displayed in the card`
          ],
          expected: `The product card for '${prodName}' should display a high-quality product image.`,
          actual: `The product card for '${prodName}' displays a fallback placeholder graphic showing 'No image found'.`,
          element: img,
          severity: 'Medium'
        });
        return;
      }

      // Check B: Real visible image that failed to load (HTTP 404)
      if (img.complete && img.naturalWidth === 0 && img.src && !img.src.startsWith('data:')) {
        const prodName = getNearbyProductName(img) || 'Banner';
        addBug({
          type: 'Visual',
          area: PAGE_AREA,
          title: `'${prodName}' image asset failed to load (broken 404)`,
          steps: [
            `Open Google Chrome on Windows 11 and navigate to: ${BASE_URL}`,
            `Navigate to: ${CURRENT_URL}`,
            `Scroll down to the section for '${prodName}'`,
            `Observe the image area`
          ],
          expected: `The image for '${prodName}' should load and render properly without breaking.`,
          actual: `Image asset failed to load (HTTP 404): ${img.src.substring(0, 80)}...`,
          element: img,
          severity: 'Medium'
        });
      }
    });

    // Also check text nodes for literal "No image found"
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement && !node.parentElement.closest('#qa-bug-hunter-root')) {
        if (/No image found/i.test(node.nodeValue)) {
          const prodName = getNearbyProductName(node.parentElement) || 'Product';
          addBug({
            type: 'Visual',
            area: PAGE_AREA,
            title: `'${prodName}' card displays 'No image found' placeholder instead of product image`,
            steps: [
              `Open Google Chrome on Windows 11 and navigate to: ${BASE_URL}`,
              `Navigate to: ${CURRENT_URL}`,
              `Scroll down to the catalog grid`,
              `Locate the product card for '${prodName}'`,
              `Observe the product image`
            ],
            expected: `The product card for '${prodName}' should display a valid product photograph.`,
            actual: `The product card displays a placeholder graphic showing 'No image found'.`,
            element: node.parentElement,
            severity: 'Medium'
          });
          break;
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 4. Dead Anchor Links Check
  // -------------------------------------------------------------
  function checkDeadLinks() {
    if (!state.settings.checkLinks) return;

    document.querySelectorAll('a[href]').forEach((a) => {
      if (a.closest('#qa-bug-hunter-root')) return;
      const href = a.getAttribute('href');
      const linkText = (a.innerText || a.getAttribute('aria-label') || 'Card / Button').trim().replace(/\s+/g, ' ');

      if (href === '' || href === '#' || href === 'javascript:void(0)') {
        if (!a.onclick && !a.getAttribute('role')) {
          addBug({
            type: 'Functional',
            area: PAGE_AREA,
            title: `Interactive link "${linkText.substring(0, 30)}" contains empty href and fails to navigate`,
            steps: [
              `Open Google Chrome on Windows 11 and navigate to: ${BASE_URL}`,
              `Navigate to: ${CURRENT_URL}`,
              `Locate the link / card labeled "${linkText.substring(0, 40)}"`,
              `Click on the link / card`,
              `Observe the browser behavior and destination URL`
            ],
            expected: `Clicking the link should navigate the user to the corresponding destination page.`,
            actual: `The link has an empty href target (href="${href}") and does not navigate or perform any action when clicked.`,
            element: a,
            severity: 'Low'
          });
        }
      }
    });
  }

  // -------------------------------------------------------------
  // 5. Visual Eye-Aid Mode
  // -------------------------------------------------------------
  function applyHighContrast() {
    if (!state.settings.highContrast) return;
    document.querySelectorAll('a, button, input, select').forEach((el) => {
      if (el.closest('#qa-bug-hunter-root')) return;
      if (!el.dataset.qaA11yStyled) {
        el.dataset.qaA11yStyled = 'true';
        el.classList.add('qa-assistive-focus');
      }
    });
  }

  // -------------------------------------------------------------
  // Bug Registry
  // -------------------------------------------------------------
  function addBug(bug) {
    const isDup = state.bugs.some((b) => b.title === bug.title && b.actual === bug.actual);
    if (isDup) return;

    bug.utestFormattedTitle = `${OS_NAME} - ${bug.area} - ${bug.title}`;
    state.bugs.push(bug);

    if (bug.element && bug.element.style) {
      bug.element.classList.add('qa-bug-highlight');
    }

    renderUI();
  }

  function findElementWithText(text) {
    const xpath = `//*[contains(text(), '${text}')]`;
    const res = document.evaluate(xpath, document.body, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return res.singleNodeValue;
  }

  // -------------------------------------------------------------
  // UI & Drawer
  // -------------------------------------------------------------
  let uiRoot = null;

  function renderUI() {
    if (!uiRoot) {
      uiRoot = document.createElement('div');
      uiRoot.id = 'qa-bug-hunter-root';
      document.body.appendChild(uiRoot);
    }

    const bugCount = state.bugs.length;
    const badgeBg = bugCount > 0 ? '#dc2626' : '#10b981';

    uiRoot.innerHTML = `
      <div id="qa-badge" style="background: ${badgeBg};">
        <span class="qa-icon">🐞</span>
        <span class="qa-count">${bugCount} ${bugCount === 1 ? 'Issue' : 'Issues'}</span>
      </div>

      <div id="qa-drawer" class="qa-hidden">
        <div class="qa-drawer-header">
          <h3>🐞 uTest Bug Formatter (${bugCount})</h3>
          <button id="qa-close-drawer">✕</button>
        </div>
        <div class="qa-drawer-body">
          ${
            bugCount === 0
              ? '<p class="qa-empty">No user-visible bugs found on this page. Continue exploring!</p>'
              : state.bugs
                  .map(
                    (b, i) => `
              <div class="qa-bug-card">
                <div class="qa-card-top">
                  <span class="qa-tag qa-tag-${b.type.toLowerCase()}">${b.type}</span>
                  <span class="qa-severity qa-sev-${b.severity.toLowerCase()}">${b.severity}</span>
                </div>
                
                <div class="qa-utest-section">
                  <div class="qa-utest-label">uTest Title:</div>
                  <div class="qa-card-title">${escapeHtml(b.utestFormattedTitle)}</div>
                </div>

                <div class="qa-utest-section">
                  <div class="qa-utest-label">Action Performed (Steps):</div>
                  <div class="qa-card-steps">${b.steps.map((s, idx) => `<div>${idx + 1}. ${escapeHtml(s)}</div>`).join('')}</div>
                </div>

                <div class="qa-utest-section">
                  <div class="qa-utest-label">Expected Result:</div>
                  <div class="qa-card-desc">${escapeHtml(b.expected)}</div>
                </div>

                <div class="qa-utest-section">
                  <div class="qa-utest-label">Actual Result:</div>
                  <div class="qa-card-desc" style="color: #b91c1c;">${escapeHtml(b.actual)}</div>
                </div>

                <div class="qa-card-actions">
                  ${b.element ? `<button class="qa-btn-locate" data-index="${i}">🎯 Locate on Screen</button>` : ''}
                  <button class="qa-btn-copy-title" data-index="${i}">Copy Title</button>
                  <button class="qa-btn-copy-steps" data-index="${i}">Copy Steps</button>
                  <button class="qa-btn-copy-all" data-index="${i}" style="background: #2563eb; color: #fff;">📋 Copy Full Report</button>
                </div>
              </div>
            `
                  )
                  .join('')
          }
        </div>
      </div>
    `;

    const badge = uiRoot.querySelector('#qa-badge');
    const drawer = uiRoot.querySelector('#qa-drawer');
    const closeBtn = uiRoot.querySelector('#qa-close-drawer');

    badge.onclick = () => drawer.classList.toggle('qa-hidden');
    closeBtn.onclick = () => drawer.classList.add('qa-hidden');

    uiRoot.querySelectorAll('.qa-btn-locate').forEach((btn) => {
      btn.onclick = () => {
        const b = state.bugs[parseInt(btn.dataset.index, 10)];
        if (b && b.element) {
          b.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          b.element.classList.add('qa-flash-highlight');
          setTimeout(() => b.element.classList.remove('qa-flash-highlight'), 3500);
        }
      };
    });

    uiRoot.querySelectorAll('.qa-btn-copy-title').forEach((btn) => {
      btn.onclick = () => {
        const b = state.bugs[parseInt(btn.dataset.index, 10)];
        navigator.clipboard.writeText(b.utestFormattedTitle);
        btn.innerText = 'Copied!';
        setTimeout(() => (btn.innerText = 'Copy Title'), 2000);
      };
    });

    uiRoot.querySelectorAll('.qa-btn-copy-steps').forEach((btn) => {
      btn.onclick = () => {
        const b = state.bugs[parseInt(btn.dataset.index, 10)];
        const stepsText = b.steps.map((s, idx) => `${idx + 1}. ${s}`).join('\n');
        navigator.clipboard.writeText(stepsText);
        btn.innerText = 'Copied!';
        setTimeout(() => (btn.innerText = 'Copy Steps'), 2000);
      };
    });

    uiRoot.querySelectorAll('.qa-btn-copy-all').forEach((btn) => {
      btn.onclick = () => {
        const b = state.bugs[parseInt(btn.dataset.index, 10)];
        const fullReport =
          `Title:\n${b.utestFormattedTitle}\n\n` +
          `Type: ${b.type}\n` +
          `Frequency: Every Time\n` +
          `Priority: ${b.severity}\n\n` +
          `Action Performed:\n${b.steps.map((s, idx) => `${idx + 1}. ${s}`).join('\n')}\n\n` +
          `Expected Result:\n${b.expected}\n\n` +
          `Actual Result:\n${b.actual}`;
        navigator.clipboard.writeText(fullReport);
        btn.innerText = '✅ Report Copied!';
        setTimeout(() => (btn.innerText = '📋 Copy Full Report'), 2000);
      };
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text || '';
    return div.innerHTML;
  }

  let scanTimeout = null;
  function triggerScan() {
    clearTimeout(scanTimeout);
    scanTimeout = setTimeout(() => {
      checkCartMath();
      checkMediaAndPlaceholders();
      checkDeadLinks();
      applyHighContrast();
    }, 600);
  }

  const observer = new MutationObserver(() => triggerScan());
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('scroll', triggerScan, { passive: true });

  setTimeout(() => {
    triggerScan();
    renderUI();
  }, 1000);
})();
