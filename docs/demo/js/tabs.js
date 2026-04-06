/**
 * Tab Management for RavenHUD Web Demo
 * Handles tab switching and keyboard navigation
 */

document.addEventListener('DOMContentLoaded', () => {
  const buttons = Array.from(document.querySelectorAll('.tab-button'));
  const sections = Array.from(document.querySelectorAll('.tab-section'));

  // Restore last active tab from localStorage
  const lastTab = localStorage.getItem('lastActiveTab');
  if (lastTab) {
    const savedBtn = buttons.find((b) => b.dataset.tab === lastTab);
    if (savedBtn) {
      savedBtn.click();
    }
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      // Save active tab to localStorage
      localStorage.setItem('lastActiveTab', target);

      // Close settings panel if open
      if (typeof window.closeSettings === 'function') {
        window.closeSettings();
      }

      buttons.forEach((b) => {
        const isActive = b === btn;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      sections.forEach((sec) => {
        const isActive = sec.id === `tab-${target}`;
        sec.classList.toggle('active', isActive);
        sec.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      });
      btn.focus();
    });
  });

  document.addEventListener('keydown', (e) => {
    // Ctrl+F to focus search in active tab
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      const activeSection = document.querySelector('.tab-section.active');
      const searchInput = activeSection?.querySelector(
        'input[type="text"], input[type="search"], .search-input'
      );
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
      return;
    }

    // Escape to close overlays/modals
    if (e.key === 'Escape') {
      // Close settings panel if open
      const settingsOverlay = document.getElementById('settingsOverlay');
      if (settingsOverlay?.classList.contains('visible')) {
        if (typeof window.closeSettings === 'function') {
          window.closeSettings();
        }
        return;
      }
      // Close acquisition modal if open
      const acquisitionModal = document.getElementById('acquisitionModal');
      if (acquisitionModal?.classList.contains('visible')) {
        acquisitionModal.classList.remove('visible');
        return;
      }
    }

    // Skip if user is typing in an input field (for tab navigation)
    if (e.target.matches('input, textarea, select')) return;

    // Number keys 1-3 for direct tab switching (demo only has 3 tabs)
    const numKey = parseInt(e.key, 10);
    if (numKey >= 1 && numKey <= buttons.length) {
      buttons[numKey - 1].click();
      return;
    }

    // Arrow keys for tab navigation
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const activeIndex = buttons.findIndex((b) => b.classList.contains('active'));
    const delta = e.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (activeIndex + delta + buttons.length) % buttons.length;
    buttons[nextIndex].click();
  });
});
