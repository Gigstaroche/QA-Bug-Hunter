/**
 * QA Bug Hunter & Visual Assistant - Content Script v1.3.0
 * Smart Filters:
 * - Automatically filters out JS toggles (country selectors, modals, dropdowns) using href="#"
 * - Groups multiple empty links into ONE consolidated report to prevent uTest "Bug Splitting"
 * - Prioritizes high-value bugs (Math, Broken Assets, Crashes)
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
    const title = document.title || '';
    if (path.includes('find-bugs') || title.includes('Find Bugs')) return 'Find Bugs Store';
    if (path.includes('cart') || path.includes('bag')) return 'Cart & Checkout';
    if (path.includes('reward')) return 'Rewards Page';
    if (path.includes('gaming')) return 'Gaming Page';
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
  // 1. Crash & Interaction Listener
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
        `Perform normal button click or dropdown action`,
        `Observe the browser response`
      ],
      expected: 'Interactive elements should execute properly without JavaScript console exceptions.',
      actual: `JavaScript runtime exception: "${event.message}" at ${file}:${event.lineno || 0}.`,
      element: null,
      severity: 'Critical'
    });
  });

  document.addEventListener('click', (e) => {
    const target = e.target.closest('button, a, input[type="submit"], [role="button"]');
    if (!target || target.closest('#qa-bug-hunter-root')) return;

    const btnText = (target.innerText || target.getAttribute('aria-label') || target.title || 'Button').trim();
    const href = target.getAttribute('href') || '';
    if (href.includes('twitter.com/share') || href.includes('facebook.com/sharer') || href.includes('pinterest.com/pin')) {
      if (href.includes('example.com') || href === '#' || href.includes('null') || href.includes('undefined')) {
        addBug({
          type: 'Functional',
          area: PAGE_AREA,
          title: `Social share button "${btnText}" points to invalid or placeholder URL`,
          steps: [
            `Open Google Chrome on Windows 11 and navigate to: ${BASE_URL}`,
            `Navigate to: ${CURRENT_URL}`,
            `Locate the social share button "${btnText}"`,
            `Click the share button`
          ],
          expected: 'Clicking the share button should open a valid social sharing dialog with the product URL.',
          actual: `The share link points to broken or placeholder target: href="${href}".`,
          element: target,
          severity: 'High'
        });
      }
    }
  }, true);

  // -------------------------------------------------------------
  // 2. Broken Pricing & Currency Syntax Scanner
  // -------------------------------------------------------------
  function checkPricingBugs() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.nodeValue;
      if (!text || text.length < 2) continue;
      if (node.parentElement?.closest('#qa-bug-hunter-root')) continue;

      if (/\$\s*\$[\d,]+/.test(text)) {
        const prodName = getNearbyName(node.parentElement) || 'Product';
        addBug({
          type: 'Content',
          area: PAGE_AREA,
          title: `'${prodName}' displays duplicated currency symbol ($$) in price`,
          steps: [
            `Open Google Chrome on Windows 11 and navigate to: ${BASE_URL}`,
            `Navigate to: ${CURRENT_URL}`,
            `Locate the price display for '${prodName}'`,
            `Observe the currency formatting`
          ],
          expected: 'Product prices should display exactly one currency symbol (e.g., $25.00).',
          actual: `Price is rendered with duplicated currency symbols: "${text.trim()}".`,
          element: node.parentElement,
          severity: 'Medium'
        });
      }
    }
  }

  // -------------------------------------------------------------
  // 3. Media, Broken Images & Video Scanner
  // -------------------------------------------------------------
  function checkMediaBugs() {
    document.querySelectorAll('img').forEach((img) => {
      if (img.closest('#qa-bug-hunter-root')) return;
      const src = (img.src || '').toLowerCase();
      const alt = (img.alt || '').toLowerCase();

      if (TRACKING_DOMAINS.some((d) => src.includes(d))) return;

      const rect = img.getBoundingClientRect();
      const style = window.getComputedStyle(img);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        (img.offsetWidth <= 8 && img.offsetHeight <= 8) ||
        (rect.width <= 8 && rect.height <= 8)
      ) return;

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

      if (img.complete && img.naturalWidth === 0 && img.src && !img.src.startsWith('data:')) {
        const name = getNearbyName(img) || 'Product';
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

    document.querySelectorAll('video').forEach((vid) => {
      if (vid.closest('#qa-bug-hunter-root')) return;
      const src = vid.src || vid.querySelector('source')?.src || '';
      if (!src || src.includes('example.com') || (src.endsWith('.mp4') === false && src.length < 5)) {
        addBug({
          type: 'Functional',
          area: PAGE_AREA,
          title: 'Embedded video player has missing or broken video source',
          steps: [
            `Open Google Chrome on Windows 11 and navigate to: ${BASE_URL}`,
            `Navigate to: ${CURRENT_URL}`,
            `Scroll down to the video player component`,
            `Attempt to play the media or inspect the source`
          ],
          expected: 'The embedded video player should have a valid media source URL and play smoothly.',
          actual: `Video element has an empty or invalid source (src="${src || 'empty'}").`,
          element: vid,
          severity: 'High'
        });
      }
    });
  }

  // -------------------------------------------------------------
  // 4. Cart & Math Auditor
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
            `Review the breakdown under order summary (Subtotal: $${subtotal}, Discount: -$${discount}, Shipping: $${shipping})`,
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
  // 5. Smart Links Checker (Ignores JS Modals & Groups Dead Links)
  // -------------------------------------------------------------
  function checkDeadLinks() {
    const brokenLinks = [];

    document.querySelectorAll('a[href]').forEach((a) => {
      if (a.closest('#qa-bug-hunter-root')) return;

      const href = (a.getAttribute('href') || '').trim();
      const text = (a.innerText || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
      const classes = (a.className || '').toLowerCase();

      // Ignore standard JS UI toggles (Country selector, modals, dropdowns, accordions)
      const isUiToggle =
        a.getAttribute('data-toggle') ||
        a.getAttribute('data-target') ||
        a.getAttribute('aria-haspopup') ||
        a.getAttribute('aria-expanded') ||
        a.getAttribute('role') === 'button' ||
        classes.includes('modal') ||
        classes.includes('popup') ||
        classes.includes('dropdown') ||
        classes.includes('toggle') ||
        classes.includes('accordion') ||
        classes.includes('country') ||
        classes.includes('lang') ||
        a.onclick !== null;

      if (isUiToggle) return;

      // Check for empty or broken targets
      if (href === '' || href === '#' || href === 'javascript:void(0)') {
        if (text.length > 1) {
          brokenLinks.push({ el: a, text });
        }
      } else if (href.includes('localhost') || href.includes('staging.')) {
        addBug({
          type: 'Functional',
          area: PAGE_AREA,
          title: `Link "${text.substring(0, 30)}" points to internal test domain (${href})`,
          steps: [
            `Open Google Chrome on Windows 11 and navigate to: ${BASE_URL}`,
            `Navigate to: ${CURRENT_URL}`,
            `Locate the link labeled "${text.substring(0, 30)}"`,
            `Observe destination target`
          ],
          expected: 'All links on production should point to live production domains.',
          actual: `Link points to internal/staging URL: ${href}`,
          element: a,
          severity: 'High'
        });
      }
    });

    // Group multiple empty links into ONE consolidated report to prevent "Bug Splitting"
    if (brokenLinks.length === 1) {
      const item = brokenLinks[0];
      addBug({
        type: 'Functional',
        area: PAGE_AREA,
        title: `Interactive link "${item.text.substring(0, 30)}" contains empty href and fails to navigate`,
        steps: [
          `Open Google Chrome on Windows 11 and navigate to: ${BASE_URL}`,
          `Navigate to: ${CURRENT_URL}`,
          `Locate the link labeled "${item.text.substring(0, 35)}"`,
          `Click on the link`,
          `Observe browser navigation`
        ],
        expected: `Clicking the link should navigate the user to the corresponding destination page.`,
        actual: `The link has an empty href target (href="#") and does not navigate when clicked.`,
        element: item.el,
        severity: 'Low'
      });
    } else if (brokenLinks.length > 1) {
      const sampleNames = brokenLinks.slice(0, 3).map(b => `"${b.text.substring(0, 20)}"`).join(', ');
      addBug({
        type: 'Functional',
        area: PAGE_AREA,
        title: `Multiple navigation links (${sampleNames}) contain empty href="#" placeholder targets`,
        steps: [
          `Open Google Chrome on Windows 11 and navigate to: ${BASE_URL}`,
          `Navigate to: ${CURRENT_URL}`,
          `Locate the links on the page: ${sampleNames}`,
          `Click on the links`,
          `Observe that none of them navigate`
        ],
        expected: `All interactive links should lead to valid destination pages.`,
        actual: `Multiple links on the page contain placeholder targets (href="#") and fail to navigate when clicked.`,
        element: brokenLinks[0].el,
        severity: 'Low'
      });
    }
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
          <div style="display: flex; gap: 8px; align-items: center;">
            <button id="qa-deep-scan" style="background: #2563eb; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; cursor: pointer;">⚡ Deep Scan</button>
            <button id="qa-close-drawer">✕</button>
          </div>
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
    checkPricingBugs();
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
