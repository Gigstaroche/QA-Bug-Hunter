// QA Bug Hunter - Popup script
document.addEventListener('DOMContentLoaded', () => {
  const toggles = {
    checkMath: document.getElementById('toggleMath'),
    checkContent: document.getElementById('toggleContent'),
    checkMedia: document.getElementById('toggleMedia'),
    highContrast: document.getElementById('toggleContrast')
  };

  // Load saved settings
  if (chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['checkMath', 'checkContent', 'checkMedia', 'highContrast'], (res) => {
      if (res.checkMath !== undefined) toggles.checkMath.checked = res.checkMath;
      if (res.checkContent !== undefined) toggles.checkContent.checked = res.checkContent;
      if (res.checkMedia !== undefined) toggles.checkMedia.checked = res.checkMedia;
      if (res.highContrast !== undefined) toggles.highContrast.checked = res.highContrast;
    });

    // Save changes
    Object.keys(toggles).forEach((key) => {
      toggles[key].addEventListener('change', () => {
        chrome.storage.sync.set({ [key]: toggles[key].checked });
      });
    });
  }
});
