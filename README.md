# 🐞 QA Bug Hunter & Visual Assistant (Chrome & Edge Extension)

A lightweight, real-time testing companion and accessibility assistant designed for manual testers and QA professionals. It runs passively in your browser, helping your eyes spot bugs, layout issues, leaked code, and arithmetic errors.

---

## 🎯 What It Catches Automatically

| Category | Detects |
| :--- | :--- |
| **Functional (High Payout)** | Cart math mismatches (`Subtotal - Discount + Shipping != Total`), dead links (`href="#"`), leaked staging/localhost URLs |
| **Content** | `NaN`, `undefined`, `null`, `[object Object]`, unrendered template strings (`{{...}}`, `${...}`), `Lorem Ipsum`, developer `TODO` notes |
| **Visual** | Broken images (404 / failed loads with `naturalWidth === 0`), layout overflow |
| **Crash** | Silent unhandled JavaScript runtime exceptions and unhandled promise rejections |
| **Visual Aid (Eye Strain)** | High-contrast outlines on interactive elements and buttons so you don't have to squint |

---

## 🚀 How to Install in Chrome or Microsoft Edge (Takes 15 Seconds)

1. Open **Google Chrome** (or Edge).
2. Type `chrome://extensions` in the address bar (or `edge://extensions` for Edge) and hit Enter.
3. Turn **ON** the switch for **Developer mode** in the top-right corner.
4. Click the button that says **Load unpacked** in the top-left corner.
5. Select this folder:
   `c:\Users\Admin\Downloads\FelixMutaiResumes\qa-bug-finder-extension`
6. Done! The extension is now active on every tab you visit.

---

## 🔍 How to Use It

1. Open any website you want to test (e.g. `https://www.clarinsusa.com/`).
2. As you browse, look at the **bottom-right corner** of your screen.
3. You will see a small floating pill: **`🐞 X Issues`**.
4. Click it to open your **QA Drawer**:
   - Click **📍 Locate** to smoothly scroll directly to the bug and flash-highlight it.
   - Click **📋 Copy Report** to copy a pre-written bug report (Title, Steps, Expected, and Actual Results) directly to your clipboard!
