// home.js - Home Page Rendering and Slider Control

document.addEventListener('DOMContentLoaded', async () => {
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
 * Load and render home page sections (New Arrivals, Featured, Best Sellers)
 */
async function loadHomeProducts() {
  const newArrivalsRow = document.getElementById('new-arrivals-row');
  const featuredRow = document.getElementById('featured-row');
  const bestSellersRow = document.getElementById('best-sellers-row');
  
  // Show Loading Skeletons
  showSkeletons(newArrivalsRow, 4);
  showSkeletons(featuredRow, 3);
  showSkeletons(bestSellersRow, 4);

  try {
    const products = await fetchProducts();
    
    // 1. Filter New Arrivals (Max 8)
    const newArrivals = products.filter(p => p.NewArrival).slice(0, 8);
    renderProductGrid(newArrivalsRow, newArrivals);

    // 2. Filter Featured (Max 6)
    const featured = products.filter(p => p.FeaturedProduct).slice(0, 6);
    renderProductGrid(featuredRow, featured);

    // 3. Filter Best Sellers (Max 8)
    const bestSellers = products.filter(p => p.BestSeller).slice(0, 8);
    renderProductGrid(bestSellersRow, bestSellers);

  } catch (error) {
    console.error("Failed to load home page products:", error);
    [newArrivalsRow, featuredRow, bestSellersRow].forEach(row => {
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
    const isOutOfStock = product.StockQuantity <= 0;
    const hasDiscount = product.DiscountPrice !== null && product.DiscountPrice > 0;
    const finalPrice = hasDiscount ? product.DiscountPrice : product.Price;
    
    // Generate Badges HTML
    let badgesHtml = '';
    if (isOutOfStock) {
      badgesHtml += `<span class="badge badge-soldout">Out of Stock</span>`;
    } else {
      if (product.NewArrival) {
        badgesHtml += `<span class="badge badge-new">New</span>`;
      }
      if (hasDiscount) {
        badgesHtml += `<span class="badge badge-sale">Sale</span>`;
      }
    }

    // Pricing display
    const pricingHtml = hasDiscount 
      ? `<span class="price-display__current">${CONFIG.CURRENCY}${product.DiscountPrice}</span>
         <span class="price-display__old">${CONFIG.CURRENCY}${product.Price}</span>`
      : `<span class="price-display__current">${CONFIG.CURRENCY}${product.Price}</span>`;

    // Action button
    const actionBtnHtml = isOutOfStock
      ? `<button class="btn btn-primary btn-disabled" disabled>Sold Out</button>`
      : `<button class="btn btn-primary add-to-cart-btn" data-id="${product.ProductID}" data-stock="${product.StockQuantity}" aria-label="Add to cart">
          <svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          Add
         </button>`;

    const card = document.createElement('div');
    card.className = 'product-card';
    card.style.cursor = 'pointer';
    card.setAttribute('role', 'link');
    card.setAttribute('aria-label', `View ${product.ProductName}`);
    card.innerHTML = `
      <div class="product-card__img-container">
        <div class="product-card__badges">${badgesHtml}</div>
        <img class="product-card__img" src="${product.ProductImageURL}" alt="${product.ProductName}" loading="lazy">
      </div>
      <div class="product-card__content">
        <div class="product-card__category">${product.Category}</div>
        <h3 class="product-card__title">${product.ProductName}</h3>
        <div class="product-card__model">Model: ${product.ModelNumber}</div>
        <div class="product-card__footer">
          <div class="price-display">${pricingHtml}</div>
          ${actionBtnHtml}
        </div>
      </div>
    `;

    // Clicking anywhere on the card navigates to product page
    card.addEventListener('click', () => {
      window.location.href = `product.html?id=${product.ProductID}`;
    });

    container.appendChild(card);
  });

  // Attach event listeners to Add to Cart buttons — stop propagation so card click doesn't fire too
  container.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent card navigation
      const id = btn.getAttribute('data-id');
      const stock = parseInt(btn.getAttribute('data-stock'), 10);
      Cart.add(id, 1, stock);
    });
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
