// home.js - Home Page Rendering and Slider Control

document.addEventListener('DOMContentLoaded', async () => {
  await loadBanners();
  initHeroSlider();
  await loadHomeProducts();
  setupWAFloatLink();
});

/**
 * Hero Slider Functionality
 */
function initHeroSlider() {
  const slides = document.querySelectorAll('.hero__slide');
  const dots = document.querySelectorAll('.hero__dot');
  const prevBtn = document.querySelector('.hero__control--prev');
  const nextBtn = document.querySelector('.hero__control--next');
  let currentSlide = 0;
  let slideInterval;

  if (slides.length === 0) return;

  function showSlide(index) {
    slides[currentSlide].classList.remove('active');
    dots[currentSlide].classList.remove('active');
    
    currentSlide = (index + slides.length) % slides.length;
    
    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
  }

  function nextSlide() {
    showSlide(currentSlide + 1);
  }

  function startSlideShow() {
    slideInterval = setInterval(nextSlide, 4000); // Rotate every 4 seconds
  }

  function stopSlideShow() {
    clearInterval(slideInterval);
  }

  // Event Listeners
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      stopSlideShow();
      showSlide(currentSlide - 1);
      startSlideShow();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      stopSlideShow();
      showSlide(currentSlide + 1);
      startSlideShow();
    });
  }

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      stopSlideShow();
      showSlide(index);
      startSlideShow();
    });
  });

  // Start rotation
  startSlideShow();
}

/**
 * Load and render dynamic banners
 */
async function loadBanners() {
  const slider = document.getElementById('hero-slider');
  const dotsContainer = document.getElementById('hero-dots');
  if (!slider || !dotsContainer) return;
  
  try {
    const banners = await fetchBanners();
    if (banners.length === 0) return;
    
    let sliderHtml = '';
    let dotsHtml = '';
    
    banners.forEach((banner, index) => {
      const activeClass = index === 0 ? 'active' : '';
      sliderHtml += `
        <div class="hero__slide ${activeClass}" data-banner-id="${banner.BannerID}">
          <img class="hero__slide-bg" src="${sanitize(banner.ImageURL)}" alt="${sanitize(banner.Title)}" ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}>
          <div class="hero__slide-overlay"></div>
          <div class="hero__content">
            ${banner.Subtitle ? `<span class="hero__subtitle">${sanitize(banner.Subtitle)}</span>` : ''}
            ${banner.Title ? `<h2 class="hero__title">${sanitize(banner.Title)}</h2>` : ''}
            ${banner.Description ? `<p class="hero__desc">${sanitize(banner.Description)}</p>` : ''}
            ${banner.ButtonText ? `<a href="${sanitize(banner.ButtonLink || '#')}" class="btn ${index === 0 ? 'btn-secondary' : 'btn-primary'} hero__btn">${sanitize(banner.ButtonText)}</a>` : ''}
          </div>
        </div>
      `;
      dotsHtml += `<span class="hero__dot ${activeClass}" data-index="${index}"></span>`;
    });
    
    slider.innerHTML = sliderHtml;
    dotsContainer.innerHTML = dotsHtml;
  } catch (e) {
    console.error("Failed to load banners", e);
  }
}

/**
 * Load and render home page sections (New Arrivals, Featured, Best Sellers)
 */
async function loadHomeProducts() {
  const newArrivalsRow = document.getElementById('new-arrivals-row');
  const featuredRow = document.getElementById('featured-row');
  const bestSellersRow = document.getElementById('best-sellers-row');
  const categoriesGrid = document.getElementById('categories-grid');

  // Show Loading Skeletons
  Skeleton.showIn(newArrivalsRow, 4);
  Skeleton.showIn(featuredRow, 3);
  Skeleton.showIn(bestSellersRow, 4);
  Skeleton.showIn(categoriesGrid, 3);

  try {
    const products = await fetchProducts();
    
    // 1. Filter New Arrivals (Max 8) - sorted by date/ID descending (newest first)
    const newArrivals = products
      .filter(p => p.NewArrival)
      .sort((a, b) => {
        const dateA = new Date(a.CreatedDate || 0);
        const dateB = new Date(b.CreatedDate || 0);
        if (dateB - dateA !== 0) return dateB - dateA;
        
        // Fallback: If one is a locally generated ID (P_TIMESTAMP), it's newer
        if (b.ProductID.startsWith('P_') && !a.ProductID.startsWith('P_')) return -1;
        if (a.ProductID.startsWith('P_') && !b.ProductID.startsWith('P_')) return 1;
        
        return b.ProductID.localeCompare(a.ProductID);
      })
      .slice(0, 8);
    renderProductGrid(newArrivalsRow, newArrivals);

    // 2. Filter Featured (Max 6) - sorted by DisplayOrder ascending (lowest first)
    const featured = products
      .filter(p => p.FeaturedProduct)
      .sort((a, b) => a.DisplayOrder - b.DisplayOrder)
      .slice(0, 6);
    renderProductGrid(featuredRow, featured);

    // 3. Filter Best Sellers (Max 8) - sorted by popularity (real sales weighted above clicks) descending
    const bestSellers = products
      .filter(p => p.BestSeller)
      .sort((a, b) => {
        const scoreDiff = getPopularityScore(b) - getPopularityScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        return b.DisplayOrder - a.DisplayOrder;
      })
      .slice(0, 8);
    renderProductGrid(bestSellersRow, bestSellers);

    // Dynamically render the category grid
    renderCategoryCards(products);

  } catch (error) {
    console.error("Failed to load home page products:", error);
    [newArrivalsRow, featuredRow, bestSellersRow, categoriesGrid].forEach(row => {
      if (row) row.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--warm-gray);">Failed to load products. Please refresh.</p>`;
    });
  }
}

/**
 * Show animated loading skeleton placeholders
 */
function showSkeletons(container, count) {
  if (!container) return;
  let skeletonsHtml = '';
  for (let i = 0; i < count; i++) {
    skeletonsHtml += `
      <div class="shimmer-card">
        <div class="shimmer-box shimmer-card__img"></div>
        <div class="shimmer-box shimmer-card__title"></div>
        <div class="shimmer-box shimmer-card__price"></div>
      </div>
    `;
  }
  container.innerHTML = skeletonsHtml;
}

/**
 * Renders an array of products into a target container
 */
function renderProductGrid(container, productList) {
  if (!container) return;
  
  if (productList.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--warm-gray);">No products found in this section.</p>`;
    return;
  }

  container.innerHTML = ''; // Clear skeletons
  
  productList.forEach(product => {
    const card = ProductCard.create(product, { isLink: true, showAddToCart: true });
    container.appendChild(card);
  });
}

/**
 * Configure floating WA button href link
 */
function setupWAFloatLink() {
  const waBtn = document.querySelector('.whatsapp-float');
  if (waBtn) {
    waBtn.href = WhatsApp.getGeneralChatUrl();
    waBtn.target = '_blank';
  }
}

/**
 * Load and render category cards dynamically based on active sheet categories
 */
function renderCategoryCards(products) {
  const container = document.getElementById('categories-grid');
  if (!container) return;

  // Fallback cover images and icons for default categories
  const defaultCategoryImages = {
    'Korean Earrings': 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&auto=format&fit=crop&q=80',
    'Stud Earrings': 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&auto=format&fit=crop&q=80',
    'Fancy Earrings': 'https://images.unsplash.com/photo-1635767798638-3e25273a8236?w=600&auto=format&fit=crop&q=80',
    'Necklaces': 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=600&auto=format&fit=crop&q=80',
    'Rings': 'https://images.unsplash.com/photo-1605100804763-247f66129598?w=600&auto=format&fit=crop&q=80',
    'Bracelets': 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600&auto=format&fit=crop&q=80'
  };

  const categoryIcons = {
    'Earrings': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    'Necklaces': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3v4a6 6 0 0 0 12 0V3m-6 10v8m-2 0h4"/></svg>',
    'Rings': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="6"/><path d="M6 12a6 6 0 0 0 12 0"/></svg>',
    'Bracelets': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12h18M5 9h14M7 15h10"/></svg>',
    'Studs': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>',
    'default': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
  };

  // Get all unique categories present in the active products and their counts
  const catMap = new Map();
  products.forEach(p => {
    if (p.Category) {
      catMap.set(p.Category, (catMap.get(p.Category) || 0) + 1);
    }
  });
  
  const uniqueCategories = Array.from(catMap.keys());

  if (uniqueCategories.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--warm-gray);">No categories to show yet.</p>`;
    return;
  }

  container.innerHTML = '';

  uniqueCategories.forEach(category => {
    // Determine cover image
    let coverImage = defaultCategoryImages[category];
    if (!coverImage) {
      const firstProd = products.find(p => p.Category === category && p.ProductImageURL);
      coverImage = firstProd ? firstProd.ProductImageURL : 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&auto=format&fit=crop&q=80';
    }

    // Determine icon
    let icon = categoryIcons.default;
    for (const [key, svg] of Object.entries(categoryIcons)) {
      if (category.toLowerCase().includes(key.toLowerCase())) {
        icon = svg;
        break;
      }
    }
    
    // Count string
    const count = catMap.get(category);
    const countStr = count > 10 ? `${Math.floor(count/10)*10}+ Designs` : `${count} Designs`;

    const card = document.createElement('a');
    card.href = `shop.html?category=${encodeURIComponent(category)}`;
    card.className = 'cat-card';
    card.setAttribute('aria-label', `View all ${category}`);

    card.innerHTML = `
      <img class="cat-card__img" src="${sanitize(coverImage)}" alt="${sanitize(category)}" loading="lazy">
      <div class="cat-card__overlay"></div>
      <div class="cat-card__content">
        <div class="cat-card__icon">${icon}</div>
        <div class="cat-card__text">
          <h3 class="cat-card__title">${sanitize(category)}</h3>
          <span class="cat-card__count">${countStr}</span>
        </div>
        <div class="cat-card__arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
  
  initCategoryCarousel();
}

/**
 * Category Carousel Interaction & Auto-scroll logic
 */
function initCategoryCarousel() {
  const container = document.getElementById('categories-grid');
  const prevBtn = document.getElementById('cat-prev');
  const nextBtn = document.getElementById('cat-next');
  const dotsContainer = document.getElementById('cat-dots');
  const wrapper = document.querySelector('.categories-carousel-wrapper');
  
  if (!container) return;

  // Render dots based on number of cards (roughly)
  const cards = container.querySelectorAll('.cat-card');
  if (dotsContainer && cards.length > 0) {
    dotsContainer.innerHTML = '';
    // Determine how many pages we have (desktop shows 6 cards, mobile 2)
    // We'll just create a few dots based on scroll width vs client width
    const createDots = () => {
      dotsContainer.innerHTML = '';
      const totalPages = Math.ceil(container.scrollWidth / container.clientWidth) || 1;
      for (let i = 0; i < totalPages; i++) {
        const dot = document.createElement('span');
        dot.className = i === 0 ? 'cat-dot active' : 'cat-dot';
        dot.addEventListener('click', () => {
          container.scrollTo({ left: i * container.clientWidth, behavior: 'smooth' });
        });
        dotsContainer.appendChild(dot);
      }
    };
    
    // Initial dot creation
    setTimeout(createDots, 100); // Wait for layout
    window.addEventListener('resize', () => {
      clearTimeout(window.catResizeTimer);
      window.catResizeTimer = setTimeout(createDots, 200);
    });
    
    // Sync dots on scroll
    container.addEventListener('scroll', () => {
      const page = Math.round(container.scrollLeft / container.clientWidth);
      const dots = dotsContainer.querySelectorAll('.cat-dot');
      dots.forEach((d, idx) => {
        d.classList.toggle('active', idx === page);
      });
    }, { passive: true });
  }

  // Navigation Arrows
  if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => {
      const scrollAmt = container.clientWidth * 0.8;
      container.scrollBy({ left: -scrollAmt, behavior: 'smooth' });
    });
    nextBtn.addEventListener('click', () => {
      const scrollAmt = container.clientWidth * 0.8;
      
      // If at end, loop back to start
      if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 10) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: scrollAmt, behavior: 'smooth' });
      }
    });
  }

  // Auto-scroll loop
  let autoScrollTimer;
  const startAutoScroll = () => {
    stopAutoScroll(); // Clear existing
    autoScrollTimer = setInterval(() => {
      if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 10) {
        // Loop back to start smoothly
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: container.clientWidth * 0.5, behavior: 'smooth' });
      }
    }, 4000);
  };
  
  const stopAutoScroll = () => {
    clearInterval(autoScrollTimer);
  };

  if (wrapper) {
    wrapper.addEventListener('mouseenter', stopAutoScroll);
    wrapper.addEventListener('mouseleave', startAutoScroll);
    wrapper.addEventListener('touchstart', stopAutoScroll, { passive: true });
    wrapper.addEventListener('touchend', startAutoScroll, { passive: true });
  }
  
  // Start the auto scroll
  startAutoScroll();
}
