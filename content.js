/**
 * QA Bug Hunter & Visual Assistant - Content Script v1.7.0
 * Features:
 * - 🛡️ Strict Deduplication: Guarantees no duplicate/identical bug cards
 * - 🚫 Eliminates Lazy-Loading false positives
 * - 🚫 Ignores href="#" false alarms
 * - 🛡️ Built-in Out-of-Scope (OOS) Shield
 * - 🛒 Cart Math & Financial Auditor
 * - 🖼️ Real broken images & "No image found" detectors
 * - 💥 Real-time JavaScript crash interceptor
 * - 📋 1-Click uTest formatters
 */

(function () {
  if (window.__qaBugHunterLoaded) return;
  window.__qaBugHunterLoaded = true;

  const state = {
    bugs: [],
    isOOS: false,
    oosReason: '',
    settings: {
      checkMath: true,
      checkContent: true,
      checkMedia: true,
      checkLinks: true,
      oosShield: true,
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

  // -------------------------------------------------------------
  // 🛡️ Out-of-Scope (OOS) Shield
  // -------------------------------------------------------------
  const OOS_RULES = [
    { regex: /contact|customer-service-contact|send-message|call-us|email-us/i, label: 'Contact Us / Customer Service (Excluded / OOS)' },
    { regex: /careers|jobs|recruitment|work-with-us/i, label: 'Careers & Recruitment (External / OOS)' },
    { regex: /about-group|corporate|investor|press-release|clarinsgroup/i, label: 'Corporate / Partner Site (External / OOS)' },
    { regex: /terms-of-use|privacy-policy|legal|cookie-policy/i, label: 'Legal & Privacy Policies (Excluded / OOS)' }
  ];

  function evaluateOOS() {
    const url = window.location.href.toLowerCase();
    const path = window.location.pathname.toLowerCase();

    for (const rule of OOS_RULES) {
      if (rule.regex.test(url) || rule.regex.test(path)) {
        state.isOOS = true;
        state.oosReason = rule.label;
        return;
      }
    }
    state.isOOS = false;
    state.oosReason = '';
  }

  evaluateOOS();

  function getPageArea() {
    const path = window.location.pathname.toLowerCase();
    const title = document.title || '';
    if (path.includes('find-bugs') || title.includes('Find Bugs')) return 'Find Bugs Store';
    if (path.includes('cart') || path.includes('bag')) return 'Cart & Checkout';
    if (path.includes('reward')) return 'Rewards Page';
    if (path.includes('spa')) return 'Spa Services';
    if (path.includes('gaming')) return 'Gaming Page';
    if (path.includes('contact')) return 'Contact Us';
    if (path.includes('product') || document.querySelector('.product-detail')) return 'Product Details Page';
    if (path.length <= 1) return 'Homepage';
    return 'Store Page';
  }

  const BASE_URL = window.location.origin;
  const CURRENT_URL = window.location.href;
  const OS_NAME = getDeviceInfo();
  const PAGE_AREA = getPageArea();

  const TRACKING_DOMAINS = [
    'bat.bing.com',
    'bing.com',
    'google-analytics.com',
    'googletagmanager.com',
    'doubleclick.net',
    'facebook.com',
    'facebook.net'
  ];

  function getNearbyName(el) {
    if (!el) return '';
    const card = el.closest('[class*="product"], [class*="card"], [class*="item"], [class*="tile"], article, li, div') || el.parentElement;
    if (card) {
      const titleEl = card.querySelector('h1, h2, h3, h4, [class*="name"], [class*="title"], [class*="heading"]');
      if (titleEl && titleEl.innerText.trim()) {
        return titleEl.innerText.trim().split('\n')[0].substring(0, 40);
      }
      const lines = card.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 2 && !l.includes('$'));
      if (lines.length > 0) return lines[0].substring(0, 40);
    }
    return '';
  }

  // -------------------------------------------------------------
  // 1. Crash Listener
  // -------------------------------------------------------------
  window.addEventListener('error', (event) => {
    const file = event.filename || '';
    if (TRACKING_DOMAINS.some((d) => file.includes(d))) return;

    addBug({
      type: 'Crash',
      area: PAGE_AREA,
      title: 'JavaScript runtime error occurs on page interaction',
      steps: [
        `Open Google Chrome on Windows 11 and navigate to: ${BASE_URL}`,
        `Navigate to: ${CURRENT_URL}`,
        `Interact with page elements or click buttons`,
        `Observe the browser response`
      ],
      expected: 'Page scripts should execute smoothly without unhandled exceptions.',
      actual: `JavaScript runtime exception: "${event.message}" at ${file}:${event.lineno || 0}.`,
      element: null,
      severity: 'Critical'
    });
  });

  // -------------------------------------------------------------
  // 2. Media & Broken Images
  // -------------------------------------------------------------
  function checkMediaBugs() {
    document.querySelectorAll('img').forEach((img) => {
      if (img.closest('#qa-bug-hunter-root')) return;

      const src = (img.currentSrc || img.src || '').toLowerCase();
      const alt = (img.alt || '').toLowerCase();

      if (TRACKING_DOMAINS.some((d) => src.includes(d))) return;

      const hasLazyAttr = img.getAttribute('data-src') || img.getAttribute('data-lazy') || img.classList.contains('lazyload') || img.getAttribute('loading') === 'lazy';
      const isRootUrl = src === BASE_URL.toLowerCase() || src === (BASE_URL + '/').toLowerCase() || src === '';

      if (isRootUrl || (hasLazyAttr && !img.complete)) return;

      const rect = img.getBoundingClientRect();
      const style = window.getComputedStyle(img);
      const isHidden =
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        (img.offsetWidth <= 8 && img.offsetHeight <= 8) ||
        (rect.width <= 8 && rect.height <= 8);

      if (isHidden) return;

      if (src.includes('no-image') || src.includes('noimage') || src.includes('placeholder') || alt.includes('no image')) {
        const name = getNearbyName(img) || 'Product';
        addBug({
          type: 'Visual',
          area: PAGE_AREA,
          title: `'${name}' card displays placeholder 'No image found' instead of product photo`,
          steps: [
            `Open Google Chrome on Windows 11 and navigate to: ${BASE_URL}`,
            `Navigate to: ${CURRENT_URL}`,
            `Locate the item card for '${name}'`,
            `Observe the product image`
          ],
          expected: `The product card for '${name}' should render a legitimate product image.`,
          actual: `The item displays a fallback placeholder graphic showing 'No image found'.`,
          element: img,
          severity: 'Medium'
        });
        return;
      }

      const hasImageExtension = /\.(jpg|jpeg|png|webp|gif|svg|avif)(\?.*)?$/i.test(src);
      const isInViewport = rect.top < (window.innerHeight + 200) && rect.bottom > -200;

      if (hasImageExtension && isInViewport && img.complete && img.naturalWidth === 0 && !src.startsWith('data:')) {
        const name = getNearbyName(img) || 'Banner';
        addBug({
          type: 'Visual',
          area: PAGE_AREA,
          title: `'${name}' image asset failed to load (HTTP 404)`,
          steps: [
            `Open Google Chrome on Windows 11 and navigate to: ${BASE_URL}`,
            `Navigate to: ${CURRENT_URL}`,
            `Locate the section for '${name}'`,
            `Observe the image area`
          ],
          expected: `The image for '${name}' should load and render properly without breaking.`,
          actual: `Image asset failed to load (HTTP 404): ${img.src.substring(0, 80)}...`,
          element: img,
          severity: 'Medium'
        });
      }
    });
  }

  // -------------------------------------------------------------
  // 3. Cart & Math Auditor
  // -------------------------------------------------------------
  function checkCartMath() {
    const fullText = document.body.innerText;
    const subtotalMatch = fullText.match(/(?:subtotal|items total|product total)[^\d$]*\$?\s*([\d,]+\.\d{2})/i);
    const totalMatch = fullText.match(/(?:estimated total|order total|grand total|total)\s*:?[^\d$]*\$?\s*([\d,]+\.\d{2})/i);
    const shippingMatch = fullText.match(/shipping[^\d$]*\$?\s*([\d,]+\.\d{2})/i);
    const discountMatch = fullText.match(/(?:discount|rewards|promo|coupon)[^\d$]*-\$?\s*([\d,]+\.\d{2})/i);

    if (subtotalMatch && totalMatch) {
      const subtotal = parseFloat(subtotalMatch[1].replace(/,/g, ''));
      const total = parseFloat(totalMatch[1].replace(/,/g, ''));
      const shipping = shippingMatch ? parseFloat(shippingMatch[1].replace(/,/g, '')) : 0.0;
      const discount = discountMatch ? parseFloat(discountMatch[1].replace(/,/g, '')) : 0.0;

      const expectedTotal = Number((subtotal - discount + shipping).toFixed(2));
      const diff = Math.abs(expectedTotal - total);

      if (diff > 0.05) {
        addBug({
          type: 'Functional',
          area: 'Cart & Checkout',
          title: `Calculated total does not match item breakdown in cart summary`,
          steps: [
            `Open Google Chrome on Windows 11 and navigate to: ${BASE_URL}`,
            `Add items to cart and navigate to the cart page: ${CURRENT_URL}`,
            `Review the breakdown under order summary (Subtotal: $${subtotal.toFixed(2)}, Discount: -$${discount.toFixed(2)}, Shipping: $${shipping.toFixed(2)})`,
            `Observe the displayed Total`
          ],
          expected: `The Total should equal Subtotal minus Discounts plus Shipping ($${expectedTotal.toFixed(2)}).`,
          actual: `The Total displays $${total.toFixed(2)}, creating an arithmetic discrepancy of $${diff.toFixed(2)}.`,
          element: findElementWithText(totalMatch[1]),
          severity: 'Critical'
        });
      }
    }
  }

  // -------------------------------------------------------------
  // 4. Dead Links Checker
  // -------------------------------------------------------------
  function checkDeadLinks() {
    document.querySelectorAll('a[href]').forEach((a) => {
      if (a.closest('#qa-bug-hunter-root')) return;

      const href = (a.getAttribute('href') || '').trim();
      const text = (a.innerText || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');

      if (href.startsWith('#') || href === 'javascript:void(0);' || href === 'javascript:;') {
        return;
      }

      if (href.includes('undefined') || href.includes('null') || href.includes('[object') || href.includes('localhost') || href.includes('staging.')) {
        addBug({
          type: 'Functional',
          area: PAGE_AREA,
          title: `Interactive link "${text.substring(0, 30)}" points to invalid/test target (${href.substring(0, 40)})`,
          steps: [
            `Open Google Chrome on Windows 11 and navigate to: ${BASE_URL}`,
            `Navigate to: ${CURRENT_URL}`,
            `Locate the link labeled "${text.substring(0, 30)}"`,
            `Observe the destination link URL`
          ],
          expected: 'All links should point to valid, live production endpoints.',
          actual: `Link target contains broken/staging value: href="${href}".`,
          element: a,
          severity: 'High'
        });
        return;
      }

      if (href === '' && text.length > 5) {
        const isCard = a.closest('.card, .product, .tile, .item');
        if (isCard) {
          addBug({
            type: 'Functional',
            area: PAGE_AREA,
            title: `Card "${text.substring(0, 30)}" contains empty href target and fails to navigate`,
            steps: [
              `Open Google Chrome on Windows 11 and navigate to: ${BASE_URL}`,
              `Navigate to: ${CURRENT_URL}`,
              `Locate the card labeled "${text.substring(0, 30)}"`,
              `Click on the card`
            ],
            expected: 'Clicking the card should navigate to the details page.',
            actual: 'The card has an empty href target (href="") and does not navigate when clicked.',
            element: a,
            severity: 'Low'
          });
        }
      }
    });
  }

  // -------------------------------------------------------------
  // Bug Registry (STRICT DEDUPLICATION BY TITLE & TYPE)
  // -------------------------------------------------------------
  function addBug(bug) {
    // Deduplicate by type and title alone: Never allow identical bugs!
    const isDup = state.bugs.some((b) => b.type === bug.type && b.title === bug.title);
    if (isDup) return;

    bug.utestFormattedTitle = `${OS_NAME} - ${bug.area} - ${bug.title}`;
    bug.isOOS = state.isOOS;
    bug.oosWarning = state.oosReason;

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
    let badgeBg = '#10b981';
    let badgeText = `${bugCount} ${bugCount === 1 ? 'Issue' : 'Issues'}`;
    let icon = '🐞';

    if (state.isOOS) {
      badgeBg = '#d97706';
      badgeText = '🛡️ OUT OF SCOPE PAGE';
      icon = '🛡️';
    } else if (bugCount > 0) {
      badgeBg = '#dc2626';
    }

    uiRoot.innerHTML = `
      <div id="qa-badge" style="background: ${badgeBg};">
        <span class="qa-icon">${icon}</span>
        <span class="qa-count">${badgeText}</span>
      </div>

      <div id="qa-drawer" class="qa-hidden">
        <div class="qa-drawer-header">
          <h3>🐞 uTest Bug Formatter (${bugCount})</h3>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button id="qa-deep-scan" style="background: #2563eb; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; cursor: pointer;">⚡ Deep Scan</button>
            <button id="qa-close-drawer">✕</button>
          </div>
        </div>

        ${
          state.isOOS
            ? `
          <div class="qa-oos-alert-banner">
            <strong>🛡️ OUT OF SCOPE WARNING</strong>
            <p>This page matches an excluded area: <em>"${state.oosReason}"</em>. In uTest cycles, reporting bugs from this section will result in rejection!</p>
          </div>
        `
            : ''
        }

        <div class="qa-drawer-body">
          ${
            bugCount === 0
              ? '<p class="qa-empty">No issues found on this page. Continue exploring!</p>'
              : state.bugs
                  .map(
                    (b, i) => `
              <div class="qa-bug-card ${b.isOOS ? 'qa-card-oos-flagged' : ''}">
                ${
                  b.isOOS
                    ? '<div class="qa-card-oos-badge">⚠️ OUT OF SCOPE WARNING: Do NOT report this bug!</div>'
                    : ''
                }
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
    const deepScanBtn = uiRoot.querySelector('#qa-deep-scan');

    badge.onclick = () => drawer.classList.toggle('qa-hidden');
    closeBtn.onclick = () => drawer.classList.add('qa-hidden');

    if (deepScanBtn) {
      deepScanBtn.onclick = () => {
        deepScanBtn.innerText = 'Scanning...';
        triggerScan();
        setTimeout(() => (deepScanBtn.innerText = '⚡ Deep Scan'), 1000);
      };
    }

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

  function triggerScan() {
    evaluateOOS();
    checkMediaBugs();
    checkCartMath();
    checkDeadLinks();
  }

  const observer = new MutationObserver(() => triggerScan());
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('scroll', triggerScan, { passive: true });

  setTimeout(() => {
    triggerScan();
    renderUI();
  }, 1000);
})();
