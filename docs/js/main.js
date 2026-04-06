/**
 * RavenHUD Website - Main JavaScript
 * Fetches release info from GitHub API and updates download links
 */

const GITHUB_REPO = 'Pix-Elated/ravenhud';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

/**
 * Throttle function to limit execution rate
 */
function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Fetch latest release info from GitHub
 */
async function fetchLatestRelease() {
  try {
    const response = await fetch(GITHUB_API);
    
    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }
    
    const release = await response.json();
    return release;
  } catch (error) {
    console.error('Failed to fetch release info:', error);
    return null;
  }
}

/**
 * Format file size in human readable format
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Format date in relative time
 */
function formatRelativeDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Update UI with release information
 */
function updateUI(release) {
  const versionInfo = document.getElementById('version-info');
  const versionInfoDownload = document.getElementById('version-info-download');

  // Installer elements
  const installerBtn = document.getElementById('installer-btn');
  const installerFilename = document.getElementById('installer-filename');
  const installerSize = document.getElementById('installer-size');

  // Portable elements
  const portableBtn = document.getElementById('portable-btn');
  const portableFilename = document.getElementById('portable-filename');
  const portableSize = document.getElementById('portable-size');

  // Installer ZIP button (links to portable ZIP from installer card)
  const installerZipBtn = document.getElementById('installer-zip-btn');

  if (!release) {
    // No release found - use placeholder
    const placeholderText = 'First release coming soon!';
    if (versionInfo) versionInfo.textContent = placeholderText;
    if (versionInfoDownload) versionInfoDownload.textContent = placeholderText;
    return;
  }

  // Find assets (guard against empty assets array)
  const assets = release.assets || [];

  // Find installer (.exe Setup file)
  const installerAsset = assets.find(asset =>
    asset.name.endsWith('.exe') && asset.name.includes('Setup')
  ) || null;

  // Find installer ZIP (Setup in ZIP form)
  const installerZipAsset = assets.find(asset =>
    asset.name.endsWith('.zip') && asset.name.includes('Setup')
  ) || null;

  // Find portable (.zip file)
  const portableAsset = assets.find(asset =>
    asset.name.endsWith('.zip') && asset.name.includes('portable')
  ) || null;

  // Update version info (hero and download section)
  const relativeDate = formatRelativeDate(release.published_at);
  const versionText = `${release.tag_name} • Released ${relativeDate}`;
  if (versionInfo) versionInfo.textContent = versionText;
  if (versionInfoDownload) versionInfoDownload.textContent = versionText;

  // Update installer download
  if (installerAsset) {
    if (installerBtn) installerBtn.href = installerAsset.browser_download_url;
    if (installerFilename) installerFilename.textContent = installerAsset.name;
    if (installerSize) installerSize.textContent = formatFileSize(installerAsset.size);
  } else if (installerBtn) {
    installerBtn.href = release.html_url;
  }

  // Update installer ZIP button
  if (installerZipAsset) {
    if (installerZipBtn) installerZipBtn.href = installerZipAsset.browser_download_url;
  } else if (installerZipBtn) {
    installerZipBtn.href = release.html_url;
  }

  // Update portable download
  if (portableAsset) {
    if (portableBtn) portableBtn.href = portableAsset.browser_download_url;
    if (portableFilename) portableFilename.textContent = portableAsset.name;
    if (portableSize) portableSize.textContent = formatFileSize(portableAsset.size);
  } else if (portableBtn) {
    portableBtn.href = release.html_url;
  }
}

/**
 * Add smooth scroll behavior for anchor links
 */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      // Skip if href is just "#" or empty
      if (!href || href === '#') return;

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

/**
 * Add parallax effect to hero section
 */
function initParallax() {
  const heroPreview = document.querySelector('.hero-preview');
  if (!heroPreview) return;

  const handleScroll = throttle(() => {
    const scrolled = window.scrollY;
    const rate = scrolled * 0.3;
    heroPreview.style.transform = `translateY(${rate}px)`;
  }, 16); // ~60fps

  window.addEventListener('scroll', handleScroll, { passive: true });
}

/**
 * Lazy load GIF images for better performance
 */
function initLazyLoading() {
  const images = document.querySelectorAll('img[loading="lazy"]');
  
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.classList.add('loaded');
          observer.unobserve(img);
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.01
    });
    
    images.forEach(img => imageObserver.observe(img));
  }
}

/**
 * Add header background on scroll
 */
function initHeaderScroll() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const handleScroll = throttle(() => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, 100);

  window.addEventListener('scroll', handleScroll, { passive: true });
}

/**
 * Feature Lightbox functionality
 */
function initFeatureLightbox() {
  const lightbox = document.getElementById('featureLightbox');
  if (!lightbox) return;

  const backdrop = lightbox.querySelector('.lightbox-backdrop');
  const closeBtn = lightbox.querySelector('.lightbox-close');
  const prevBtn = lightbox.querySelector('.lightbox-prev');
  const nextBtn = lightbox.querySelector('.lightbox-next');
  const iconEl = lightbox.querySelector('.lightbox-icon');
  const titleEl = lightbox.querySelector('.lightbox-title');
  const imageEl = lightbox.querySelector('.lightbox-image');
  const descEl = lightbox.querySelector('.lightbox-description');
  const detailsEl = lightbox.querySelector('.lightbox-details');
  const navEl = lightbox.querySelector('.lightbox-nav');
  const counterEl = lightbox.querySelector('.lightbox-counter');

  // Get all feature cards
  const featureCards = Array.from(document.querySelectorAll('.feature-card[data-feature]'));
  let currentIndex = 0;
  let previouslyFocused = null;

  function openLightbox(card) {
    previouslyFocused = document.activeElement;

    const data = {
      icon: card.dataset.icon,
      title: card.dataset.title,
      image: card.dataset.image,
      description: card.dataset.description,
      details: card.dataset.details
    };

    iconEl.textContent = data.icon;
    titleEl.textContent = data.title;
    imageEl.src = data.image;
    imageEl.alt = `${data.title} demonstration`;
    descEl.textContent = data.description;
    detailsEl.textContent = data.details;

    currentIndex = featureCards.indexOf(card);
    updateNav();

    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';

    // Focus close button for accessibility
    closeBtn.focus();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = '';

    // Return focus to previously focused element
    if (previouslyFocused) {
      previouslyFocused.focus();
    }
  }

  function showFeature(index) {
    if (index < 0 || index >= featureCards.length) return;
    currentIndex = index;
    openLightbox(featureCards[currentIndex]);
  }

  function updateNav() {
    if (featureCards.length <= 1) {
      navEl.hidden = true;
      return;
    }
    navEl.hidden = false;
    counterEl.textContent = `${currentIndex + 1} of ${featureCards.length}`;
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === featureCards.length - 1;
  }

  // Event listeners for feature cards
  featureCards.forEach(card => {
    const previewBtn = card.querySelector('.preview-link');
    if (previewBtn) {
      previewBtn.addEventListener('click', () => openLightbox(card));
    }
  });

  // Close handlers
  closeBtn.addEventListener('click', closeLightbox);
  backdrop.addEventListener('click', closeLightbox);

  // Navigation handlers
  prevBtn.addEventListener('click', () => showFeature(currentIndex - 1));
  nextBtn.addEventListener('click', () => showFeature(currentIndex + 1));

  // Keyboard navigation
  lightbox.addEventListener('keydown', (e) => {
    if (lightbox.hidden) return;

    switch (e.key) {
      case 'Escape':
        closeLightbox();
        break;
      case 'ArrowLeft':
        if (currentIndex > 0) showFeature(currentIndex - 1);
        break;
      case 'ArrowRight':
        if (currentIndex < featureCards.length - 1) showFeature(currentIndex + 1);
        break;
    }
  });

  // Trap focus within lightbox
  lightbox.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || lightbox.hidden) return;

    const focusable = lightbox.querySelectorAll('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === firstFocusable) {
      e.preventDefault();
      lastFocusable.focus();
    } else if (!e.shiftKey && document.activeElement === lastFocusable) {
      e.preventDefault();
      firstFocusable.focus();
    }
  });
}


/**
 * Mobile menu toggle functionality
 */
function initMobileMenu() {
  const menuBtn = document.querySelector('.mobile-menu-btn');
  const navLinks = document.getElementById('nav-links');
  if (!menuBtn || !navLinks) return;

  menuBtn.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', isOpen);
    menuBtn.textContent = isOpen ? 'Close' : 'Menu';
  });

  // Close menu when clicking a link
  navLinks.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.textContent = 'Menu';
    });
  });

  // Close menu on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navLinks.classList.contains('open')) {
      navLinks.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.textContent = 'Menu';
      menuBtn.focus();
    }
  });
}

/**
 * Initialize the page
 */
async function init() {
  // Initialize UI enhancements
  initSmoothScroll();
  initParallax();
  initLazyLoading();
  initHeaderScroll();
  initFeatureLightbox();
  initMobileMenu();

  // Fetch and display release info
  const release = await fetchLatestRelease();
  updateUI(release);

}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
