// product.js - Product Detail Page Rendering & Actions

let currentProduct = null;
let selectedQty = 1;

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  if (!productId) {
    showProductNotFound();
    return;
  }

  // Load product data
  currentProduct = await fetchProductById(productId);
  if (!currentProduct) {
    showProductNotFound();
    return;
  }

  // Record a view click (1 point)
  trackLocalInterest(productId, 1);

  // Render product details
  renderProductDetails();
  
  // Load related products
  await loadRelatedProducts();

  // Setup WA Float Link
  const waBtn = document.querySelector('.whatsapp-float');
  if (waBtn) {
    waBtn.href = WhatsApp.getGeneralChatUrl();
    waBtn.target = '_blank';
  }
});

/**
 * Handle non-existing product ID
 */
function showProductNotFound() {
  const container = document.getElementById('product-detail-container');
  if (container) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <svg class="empty-state__icon" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
        <h3 class="empty-state__title">Product Not Found</h3>
        <p class="empty-state__desc">The item you are looking for does not exist or has been removed from our catalog.</p>
        <a href="shop.html" class="btn btn-primary">Back to Shop</a>
      </div>
    `;
  }
}

/**
 * Render details, photos, and attach listeners
 */
function renderProductDetails() {
  // Update browser document title
  document.title = `${sanitize(currentProduct.ProductName)} | House of Prime Collections`;
  
  // Set Breadcrumbs active name
  const breadcrumbProduct = document.getElementById('breadcrumb-product-name');
  if (breadcrumbProduct) breadcrumbProduct.textContent = sanitize(currentProduct.ProductName);

  // 1. Render Gallery
  const mainImg = document.getElementById('main-gallery-img');
  const mainImgContainer = document.getElementById('main-gallery-container');
  const thumbnailsContainer = document.getElementById('thumbnails-container');

  if (thumbnailsContainer) {
    thumbnailsContainer.innerHTML = '';
    
    // 1. Build an array of valid image URLs
    const rawImages = [
      currentProduct.ProductImageURL,
      currentProduct.AdditionalImage1,
      currentProduct.AdditionalImage2,
      currentProduct.AdditionalImage3
    ];

    const images = rawImages.filter(url => {
      if (!url) return false;
      const cleanUrl = url.toString().trim().toLowerCase();
      if (cleanUrl === '') return false;
      // Filter out common invalid placeholders
      if (['null', 'undefined', 'none', 'n/a', '#', '-', '0', '(can be blank)'].includes(cleanUrl)) return false;
      // Basic check: must have some length and not just be a space
      if (cleanUrl.length < 2) return false;
      return true;
    });

    // 2. Render Main Carousel Images
    const counterEl = document.getElementById('gallery-counter');
    const prevBtn = document.getElementById('gallery-prev-btn');
    const nextBtn = document.getElementById('gallery-next-btn');

    function scrollToIndex(idx) {
      if (!mainImgContainer) return;
      const width = mainImgContainer.clientWidth;
      mainImgContainer.scrollTo({ left: width * idx, behavior: 'smooth' });
    }

    if (mainImgContainer) {
      mainImgContainer.innerHTML = '';

      if (images.length === 0) {
        const fallbackImg = document.createElement('img');
        fallbackImg.src = 'https://placehold.co/400x400/eeeeee/999999?text=No+Image';
        fallbackImg.className = 'gallery__main-img';
        mainImgContainer.appendChild(fallbackImg);
        if (counterEl) counterEl.style.display = 'none';
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
      } else {
        images.forEach((imgUrl, idx) => {
          // Wrapper for individual zoom context
          const itemWrap = document.createElement('div');
          itemWrap.style.cssText = 'flex: 0 0 100%; position: relative; scroll-snap-align: center; height: 100%;';

          const imgEl = document.createElement('img');
          // 1200px keeps the 2x hover-zoom (see zoom.js) looking sharp while still
          // being a fraction of the multi-MB raw uploads admins add products with.
          imgEl.src = typeof ImageService !== 'undefined' ? ImageService.getOptimizedUrl(imgUrl, 1200) : imgUrl;
          imgEl.className = 'gallery__main-img';
          imgEl.alt = `Product view ${idx + 1}`;
          
          itemWrap.appendChild(imgEl);
          mainImgContainer.appendChild(itemWrap);
          
          // Attach zoom to the individual wrapper
          initImageZoom(imgEl, itemWrap);
        });

        // Initialize Counter + prev/next arrows
        if (counterEl) {
          if (images.length > 1) {
            counterEl.style.display = 'block';
            counterEl.textContent = `1 / ${images.length}`;
            if (prevBtn) prevBtn.style.display = 'flex';
            if (nextBtn) nextBtn.style.display = 'flex';

            // Scroll spy for counter and active thumbnail
            mainImgContainer.addEventListener('scroll', debounce(() => {
              const scrollLeft = mainImgContainer.scrollLeft;
              const width = mainImgContainer.clientWidth;
              const activeIndex = Math.round(scrollLeft / width);
              counterEl.textContent = `${activeIndex + 1} / ${images.length}`;

              // Sync thumbnail active state
              const thumbs = thumbnailsContainer.querySelectorAll('.gallery__thumbnail');
              thumbs.forEach((t, i) => {
                t.classList.toggle('active', i === activeIndex);
              });
            }, 50));

            if (prevBtn) {
              prevBtn.onclick = () => {
                const width = mainImgContainer.clientWidth;
                const current = Math.round(mainImgContainer.scrollLeft / width);
                scrollToIndex((current - 1 + images.length) % images.length);
              };
            }
            if (nextBtn) {
              nextBtn.onclick = () => {
                const width = mainImgContainer.clientWidth;
                const current = Math.round(mainImgContainer.scrollLeft / width);
                scrollToIndex((current + 1) % images.length);
              };
            }
          } else {
            counterEl.style.display = 'none';
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
          }
        }
      }
    }

    // 3. Render thumbnails only if there is MORE THAN ONE valid image
    if (images.length > 1) {
      images.forEach((imgUrl, idx) => {
        const thumb = document.createElement('div');
        thumb.className = `gallery__thumbnail ${idx === 0 ? 'active' : ''}`;
        const thumbUrl = typeof ImageService !== 'undefined' ? ImageService.getOptimizedUrl(imgUrl, 150) : imgUrl;
        thumb.innerHTML = `<img src="${thumbUrl}" alt="Thumbnail view ${idx + 1}" loading="lazy">`;
        thumb.addEventListener('click', () => scrollToIndex(idx));
        thumbnailsContainer.appendChild(thumb);
      });
      thumbnailsContainer.style.display = 'flex';
    } else {
      thumbnailsContainer.style.display = 'none'; // Only 1 image, hide thumbnails
    }
  }

  // 2. Render Product Information
  const titleEl = document.getElementById('product-title');
  const modelEl = document.getElementById('product-model');
  const stockDot = document.getElementById('stock-indicator-dot');
  const stockText = document.getElementById('stock-indicator-text');
  const priceContainer = document.getElementById('price-container');
  const descEl = document.getElementById('product-desc');
  
  const materialEl = document.getElementById('spec-material');
  const colorEl = document.getElementById('spec-color');
  const weightEl = document.getElementById('spec-weight');

  if (titleEl) titleEl.textContent = sanitize(currentProduct.ProductName);
  if (modelEl) modelEl.textContent = `Model: ${sanitize(currentProduct.ModelNumber)}`;
  
  // Stock display
  const isOutOfStock = currentProduct.StockQuantity <= 0;
  if (stockDot && stockText) {
    if (isOutOfStock) {
      stockDot.className = 'stock-dot stock-dot--outofstock';
      stockText.className = 'stock-text--outofstock';
      stockText.textContent = 'Out of Stock';
    } else {
      stockDot.className = 'stock-dot stock-dot--instock';
      stockText.className = 'stock-text--instock';
      stockText.textContent = `In Stock (${currentProduct.StockQuantity} units available)`;
    }
  }

  // Price display
  if (priceContainer) {
    const hasDiscount = currentProduct.DiscountPrice !== null && currentProduct.DiscountPrice > 0;
    if (hasDiscount) {
      priceContainer.innerHTML = `
        <span class="price-display__current" style="font-size: 1.5rem;">${CONFIG.CURRENCY}${currentProduct.DiscountPrice}</span>
        <span class="price-display__old" style="font-size: 1.1rem;">${CONFIG.CURRENCY}${currentProduct.Price}</span>
      `;
    } else {
      priceContainer.innerHTML = `
        <span class="price-display__current" style="font-size: 1.5rem;">${CONFIG.CURRENCY}${currentProduct.Price}</span>
      `;
    }
  }

  // Specs & Description
  if (descEl) descEl.textContent = sanitize(currentProduct.Description);
  if (materialEl) materialEl.textContent = sanitize(currentProduct.Material) || 'Standard Alloy';
  if (colorEl) colorEl.textContent = sanitize(currentProduct.Color) || 'Assorted Colors';
  if (weightEl) weightEl.textContent = sanitize(currentProduct.Weight) || 'N/A';

  // 3. Setup Quantity Stepper & Add/Buy Buttons
  setupQuantityStepper();
  setupActionButtons();
}

/**
 * Quantity stepper increment/decrement
 */
function setupQuantityStepper() {
  const minusBtn = document.getElementById('qty-minus');
  const plusBtn = document.getElementById('qty-plus');
  const qtyInput = document.getElementById('qty-input');
  
  if (!qtyInput) return;
  
  const maxStock = currentProduct.StockQuantity;
  const isOutOfStock = maxStock <= 0;

  if (isOutOfStock) {
    qtyInput.value = 0;
    qtyInput.disabled = true;
    if (minusBtn) minusBtn.style.pointerEvents = 'none';
    if (plusBtn) plusBtn.style.pointerEvents = 'none';
    return;
  }

  const validateAndSet = (val) => {
    let num = parseInt(val, 10);
    if (isNaN(num) || num < 1) num = 1;
    if (num > maxStock) num = maxStock;
    
    selectedQty = num;
    qtyInput.value = num;
  };

  if (minusBtn) {
    minusBtn.addEventListener('click', () => {
      validateAndSet(selectedQty - 1);
    });
  }

  if (plusBtn) {
    plusBtn.addEventListener('click', () => {
      validateAndSet(selectedQty + 1);
    });
  }

  qtyInput.addEventListener('change', (e) => {
    validateAndSet(e.target.value);
  });
}

/**
 * Configure buttons and actions
 */
function setupActionButtons() {
  const addToCartBtn = document.getElementById('btn-add-to-cart');
  const buyNowBtn = document.getElementById('btn-buy-now');
  const waQuickBtn = document.getElementById('btn-wa-quick');

  const isOutOfStock = currentProduct.StockQuantity <= 0;

  if (isOutOfStock) {
    [addToCartBtn, buyNowBtn, waQuickBtn].forEach(btn => {
      if (btn) {
        btn.classList.add('btn-disabled');
        btn.disabled = true;
        btn.textContent = 'Sold Out';
      }
    });
    return;
  }

  // Add to Cart
  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', () => {
      Cart.add(currentProduct.ProductID, selectedQty, currentProduct.StockQuantity);
      trackLocalInterest(currentProduct.ProductID, 3); // 3 points for adding to cart
    });
  }

  // Buy Now (Adds to cart and goes to checkout page)
  if (buyNowBtn) {
    buyNowBtn.addEventListener('click', () => {
      const added = Cart.add(currentProduct.ProductID, selectedQty, currentProduct.StockQuantity);
      if (added) {
        trackLocalInterest(currentProduct.ProductID, 3); // 3 points for adding to cart
        window.location.href = 'checkout.html';
      }
    });
  }

  // WhatsApp Quick Order for Single Item
  if (waQuickBtn) {
    waQuickBtn.addEventListener('click', (e) => {
      e.preventDefault();
      trackLocalInterest(currentProduct.ProductID, 5); // 5 points for quick order click
      
      const price = currentProduct.DiscountPrice !== null ? currentProduct.DiscountPrice : currentProduct.Price;
      const total = price * selectedQty;
      
      let message = `Hello House of Prime Collections,\n\n`;
      message += `I want to order this item directly:\n\n`;
      message += `Product: ${currentProduct.ProductName}\n`;
      message += `Model: ${currentProduct.ModelNumber}\n`;
      message += `Quantity: ${selectedQty}\n`;
      message += `Price: Rs.${price}\n`;
      message += `---\n`;
      message += `Total Price: Rs.${total}\n\n`;
      message += `Please confirm availability and sharing address requirements.`;

      const number = CONFIG.WHATSAPP_NUMBER;
      const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
      
      window.open(url, '_blank');
    });
  }
}

/**
 * Fetch and load all 4 recommendation sections
 */
async function loadRelatedProducts() {
  try {
    const products = await fetchProducts();
    const usedIds = new Set();
    usedIds.add(currentProduct.ProductID); // Always exclude current product
    
    // 1. You May Also Like
    const related = getRelatedProducts(products, usedIds);
    renderRecommendationCarousel('section-related', 'related-row', related);

    // 2. Newly Arrived
    const newlyArrived = getNewArrivals(products, usedIds);
    renderRecommendationCarousel('section-new', 'new-row', newlyArrived);

    // 3. Most Selling
    const bestSellers = getBestSellingProducts(products, usedIds);
    renderRecommendationCarousel('section-best', 'best-row', bestSellers);

    // 4. Trending Now
    const trending = getTrendingProducts(products, usedIds);
    renderRecommendationCarousel('section-trending', 'trending-row', trending);

  } catch (err) {
    console.error("Failed to load recommendations:", err);
  }
}

// Data Fetchers
function getRelatedProducts(products, usedIds) {
  let related = products.filter(p => 
    p.Category === currentProduct.Category && 
    !usedIds.has(p.ProductID) &&
    p.StockQuantity > 0
  );
  related = related.slice(0, 8);
  related.forEach(p => usedIds.add(p.ProductID));
  return related;
}

function getNewArrivals(products, usedIds) {
  let newArrivals = products
    .filter(p => !usedIds.has(p.ProductID) && p.StockQuantity > 0)
    .sort((a, b) => {
      // Prioritize NewArrival flag, then fallback to descending IDs as proxy for date
      if (a.NewArrival && !b.NewArrival) return -1;
      if (!a.NewArrival && b.NewArrival) return 1;
      return b.ProductID.localeCompare(a.ProductID);
    })
    .slice(0, 8);
  newArrivals.forEach(p => usedIds.add(p.ProductID));
  return newArrivals;
}

function getBestSellingProducts(products, usedIds) {
  let bestSellers = products
    .filter(p => !usedIds.has(p.ProductID) && p.StockQuantity > 0)
    .sort((a, b) => getPopularityScore(b) - getPopularityScore(a))
    .slice(0, 8);
  bestSellers.forEach(p => usedIds.add(p.ProductID));
  return bestSellers;
}

function getTrendingProducts(products, usedIds) {
  let trending = products
    .filter(p => !usedIds.has(p.ProductID) && p.StockQuantity > 0);
    
  // Mix of featured and popular
  trending.sort((a, b) => {
    if (a.FeaturedProduct && !b.FeaturedProduct) return -1;
    if (!a.FeaturedProduct && b.FeaturedProduct) return 1;
    // randomish shuffle for variety
    return 0.5 - Math.random();
  });
  
  trending = trending.slice(0, 8);
  trending.forEach(p => usedIds.add(p.ProductID));
  return trending;
}

// UI Renderers
function createCompactProductCard(product) {
  const isOutOfStock = product.StockQuantity <= 0;
  const hasDiscount = product.DiscountPrice !== null && product.DiscountPrice > 0;
  const price = hasDiscount ? product.DiscountPrice : product.Price;
  const oldPriceHtml = hasDiscount ? `<span class="compact-rec-card__old-price">${CONFIG.CURRENCY}${product.Price}</span>` : '';
  
  let discountPercent = '';
  if (hasDiscount && product.Price > 0) {
    discountPercent = Math.round(((product.Price - product.DiscountPrice) / product.Price) * 100);
  }
  const discountHtml = discountPercent ? `<span class="compact-rec-card__discount">${discountPercent}% OFF</span>` : '';
  
  let badgeHtml = '';
  if (product.NewArrival) badgeHtml = `<span class="compact-rec-card__badge" style="background:#8b1a4a;">NEW</span>`;
  else if (hasDiscount) badgeHtml = `<span class="compact-rec-card__badge" style="background:#f59e0b;">SALE</span>`;
  
  const optimizedImg = typeof ImageService !== 'undefined' 
    ? ImageService.getOptimizedUrl(product.ProductImageURL, 300)
    : product.ProductImageURL;

  const card = document.createElement('a');
  card.href = `product.html?id=${product.ProductID}`;
  card.className = 'compact-rec-card';
  card.innerHTML = `
    <div class="compact-rec-card__img-wrap">
      ${badgeHtml}
      <div class="compact-rec-card__wishlist">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
      </div>
      <img class="compact-rec-card__img" src="${sanitize(optimizedImg)}" alt="${sanitize(product.ProductName)}" loading="lazy">
    </div>
    <div class="compact-rec-card__info">
      <h4 class="compact-rec-card__title">${sanitize(product.ProductName)}</h4>
      <div class="compact-rec-card__price-row">
        <span class="compact-rec-card__price">${CONFIG.CURRENCY}${price}</span>
        ${oldPriceHtml}
        ${discountHtml}
      </div>
      ${isOutOfStock
        ? `<button class="btn btn-primary btn-disabled compact-rec-card__add" disabled>Sold Out</button>`
        : `<button class="btn btn-primary compact-rec-card__add" data-id="${product.ProductID}" data-stock="${product.StockQuantity}" aria-label="Add to cart">
             <svg style="width: 14px; height: 14px; fill: currentColor;" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
             <span>Add</span>
           </button>`}
    </div>
  `;

  card.addEventListener('click', () => {
    if (typeof trackLocalInterest === 'function') {
      trackLocalInterest(product.ProductID, 1);
    }
  });

  const addBtn = card.querySelector('.compact-rec-card__add:not(.btn-disabled)');
  if (addBtn) {
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const id = addBtn.getAttribute('data-id');
      const stock = parseInt(addBtn.getAttribute('data-stock'), 10);
      Cart.add(id, 1, stock);
      if (typeof trackLocalInterest === 'function') {
        trackLocalInterest(id, 3);
      }
    });
  }

  return card;
}

function renderRecommendationCarousel(sectionId, rowId, productList) {
  const section = document.getElementById(sectionId);
  const container = document.getElementById(rowId);
  
  if (!section || !container) return;

  if (productList.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  container.innerHTML = '';
  
  const fragment = document.createDocumentFragment();
  productList.forEach(product => {
    fragment.appendChild(createCompactProductCard(product));
  });
  container.appendChild(fragment);

  // Extract base prefix, e.g. "related" from "related-row"
  const prefix = rowId.split('-')[0];
  initCarousel(prefix, container);
}

function initCarousel(prefix, container) {
  const prevBtn = document.getElementById(`${prefix}-prev`);
  const nextBtn = document.getElementById(`${prefix}-next`);
  const dotsContainer = document.getElementById(`${prefix}-dots`);
  const wrapper = container.parentElement;

  // Render dots
  if (dotsContainer) {
    const createDots = () => {
      dotsContainer.innerHTML = '';
      const totalPages = Math.ceil(container.scrollWidth / container.clientWidth) || 1;
      // If content doesn't overflow, hide dots
      if (totalPages <= 1) return;
      
      for (let i = 0; i < totalPages; i++) {
        const dot = document.createElement('span');
        if (i === 0) dot.className = 'active';
        dot.addEventListener('click', () => {
          container.scrollTo({ left: i * container.clientWidth, behavior: 'smooth' });
        });
        dotsContainer.appendChild(dot);
      }
    };
    
    setTimeout(createDots, 100);
    window.addEventListener('resize', () => {
      clearTimeout(window[`${prefix}ResizeTimer`]);
      window[`${prefix}ResizeTimer`] = setTimeout(createDots, 200);
    });
    
    container.addEventListener('scroll', () => {
      if (!dotsContainer.children.length) return;
      const page = Math.round(container.scrollLeft / container.clientWidth);
      Array.from(dotsContainer.children).forEach((d, idx) => {
        d.classList.toggle('active', idx === page);
      });
    }, { passive: true });
  }

  // Arrows
  if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => {
      container.scrollBy({ left: -container.clientWidth * 0.8, behavior: 'smooth' });
    });
    nextBtn.addEventListener('click', () => {
      if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 10) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: container.clientWidth * 0.8, behavior: 'smooth' });
      }
    });
  }

  // Auto-scroll loop
  let autoScrollTimer;
  const startAutoScroll = () => {
    clearInterval(autoScrollTimer);
    autoScrollTimer = setInterval(() => {
      if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 10) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: container.clientWidth * 0.5, behavior: 'smooth' });
      }
    }, 4000 + Math.random() * 2000); // Slightly stagger intervals across multiple carousels
  };
  
  const stopAutoScroll = () => clearInterval(autoScrollTimer);

  if (wrapper) {
    wrapper.addEventListener('mouseenter', stopAutoScroll);
    wrapper.addEventListener('mouseleave', startAutoScroll);
    wrapper.addEventListener('touchstart', stopAutoScroll, { passive: true });
    wrapper.addEventListener('touchend', startAutoScroll, { passive: true });
  }
  
  startAutoScroll();
}
