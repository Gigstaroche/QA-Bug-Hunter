/**
 * QA Bug Hunter & Visual Assistant - Content Script
 * Fully integrated with uTest Bug Reporting Guidelines & Format.
 * Supports: Math audits, Broken images, "No Image Found" Placeholders, Dead links, Runtime Crashes.
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
    if (path.length <= 1 || path === '/en' || path === '/en/') return 'Homepage';
    return 'Catalog Page';
  }

  const BASE_URL = window.location.origin;
  const CURRENT_URL = window.location.href;
  const OS_NAME = getDeviceInfo();
  const PAGE_AREA = getPageArea();

  // -------------------------------------------------------------
  // 1. Crash & Runtime Error Listener
  // -------------------------------------------------------------
  window.addEventListener('error', (event) => {
    addBug({
      type: 'Crash',
      area: PAGE_AREA,
      title: 'JavaScript runtime error triggers in console',
      steps: [
        `Open Google Chrome and navigate to: ${BASE_URL}`,
        `Navigate to: ${CURRENT_URL}`,
        `Interact with page elements or trigger script execution`,
        `Observe the browser response`
      ],
      expected: 'Page scripts should execute smoothly without unhandled runtime exceptions.',
      actual: `An unhandled JavaScript error occurred: "${event.message}" at ${event.filename || 'script'}:${event.lineno || 0}.`,
      element: null,
      severity: 'Critical'
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    addBug({
      type: 'Crash',
      area: PAGE_AREA,
      title: 'Unhandled Promise Rejection occurs on page',
      steps: [
        `Open Google Chrome and navigate to: ${BASE_URL}`,
        `Navigate to: ${CURRENT_URL}`,
        `Perform normal page interactions`,
        `Observe page execution`
      ],
      expected: 'Asynchronous network operations should resolve without unhandled rejections.',
      actual: `An unhandled promise rejection occurred: "${String(event.reason)}"`,
      element: null,
      severity: 'High'
    });
  });

  // -------------------------------------------------------------
  // 2. Math & E-Commerce Auditor (Option A)
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
            `Open Google Chrome and navigate to: ${BASE_URL}`,
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
  // 3. Content & Placeholder Scanner
  // -------------------------------------------------------------
  const LEAK_PATTERNS = [
    { regex: /\bNo image found\b/i, label: 'Product card displays placeholder "No image found"' },
    { regex: /\bNaN\b/, label: 'NaN (Not-a-Number) displayed on page' },
    { regex: /\bundefined\b/, label: 'Raw "undefined" text rendered in page body' },
    { regex: /\[object Object\]/, label: 'Raw JavaScript "[object Object]" rendered on page' },
    { regex: /\{\{[\w.-]+\}\}/, label: 'Unrendered template placeholder {{...}} visible on screen' },
    { regex: /\bLorem ipsum\b/i, label: 'Dummy placeholder text "Lorem Ipsum" visible to end users' }
  ];

  function checkContentBugs() {
    if (!state.settings.checkContent) return;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'textarea'].includes(tag)) return NodeFilter.FILTER_REJECT;
          if (parent.closest('#qa-bug-hunter-root')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let currentNode;
    while ((currentNode = walker.nextNode())) {
      const text = currentNode.nodeValue;
      if (!text || text.trim().length < 3) continue;

      for (const pattern of LEAK_PATTERNS) {
        if (pattern.regex.test(text)) {
          const snippet = text.trim().substring(0, 80);
          addBug({
            type: pattern.label.includes('No image') ? 'Visual' : 'Content',
            area: PAGE_AREA,
            title: pattern.label,
            steps: [
              `Open Google Chrome and navigate to: ${BASE_URL}`,
              `Navigate to: ${CURRENT_URL}`,
              `Scroll down and inspect the catalog grid`,
              `Observe the rendered item on screen`
            ],
            expected: 'All items should display legitimate product photography and valid text.',
            actual: `Placeholder or missing asset displayed on screen: "${snippet}"`,
            element: currentNode.parentElement,
            severity: 'Medium'
          });
          break;
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 4. Media & Placeholder Images (Option B) & Dead Links
  // -------------------------------------------------------------
  function checkMediaAndLinks() {
    if (state.settings.checkMedia) {
      document.querySelectorAll('img').forEach((img) => {
        if (img.closest('#qa-bug-hunter-root')) return;

        const src = (img.src || '').toLowerCase();
        const alt = (img.alt || '').toLowerCase();

        // Check 1: 404 / broken load
        if (img.complete && img.naturalWidth === 0 && img.src && !img.src.startsWith('data:')) {
          addBug({
            type: 'Visual',
            area: PAGE_AREA,
            title: 'Image fails to load and displays as broken icon',
            steps: [
              `Open Google Chrome and navigate to: ${BASE_URL}`,
              `Navigate to: ${CURRENT_URL}`,
              `Scroll down to the image area`,
              `Observe the rendered product/banner image`
            ],
            expected: 'The image should load and render properly without breaking.',
            actual: `Image asset failed to load (HTTP 404 / broken src): ${img.src.substring(0, 80)}...`,
            element: img,
            severity: 'Medium'
          });
        }

        // Check 2: Fallback Placeholder image (Option B)
        if (src.includes('no-image') || src.includes('placeholder') || alt.includes('no image') || alt.includes('placeholder')) {
          const cardTitle = img.closest('.product, [class*="card"], [class*="item"]')?.innerText?.split('\n')[0] || 'Product';
          addBug({
            type: 'Visual',
            area: PAGE_AREA,
            title: `Product card "${cardTitle.substring(0, 30)}" displays fallback 'No image found' placeholder instead of product image`,
            steps: [
              `Open Google Chrome and navigate to: ${BASE_URL}`,
              `Navigate to: ${CURRENT_URL}`,
              `Scroll down to the catalog grid`,
              `Locate product "${cardTitle.substring(0, 30)}"`,
              `Observe the product image`
            ],
            expected: `The product card should display a valid product photograph for ${cardTitle.substring(0, 30)}.`,
            actual: `The product card renders a generic 'No image found' fallback placeholder image.`,
            element: img,
            severity: 'Medium'
          });
        }
      });
    }

    if (state.settings.checkLinks) {
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
                `Open Google Chrome and navigate to: ${BASE_URL}`,
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
              ? '<p class="qa-empty">No issues found on this page. Continue exploring!</p>'
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
                  ${b.element ? `<button class="qa-btn-locate" data-index="${i}">📍 Locate</button>` : ''}
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
          setTimeout(() => b.element.classList.remove('qa-flash-highlight'), 3000);
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
      checkContentBugs();
      checkMediaAndLinks();
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
