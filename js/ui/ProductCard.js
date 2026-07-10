// js/ui/ProductCard.js
// Standardized component builder for product cards used across Home, Shop, and Product pages.

const ProductCard = (() => {
  /**
   * Creates a DOM element for a product card.
   *
   * @param {Object} product - The product data object from the API
   * @param {Object} options - Configuration options
   * @param {boolean} options.isLink - Whether clicking the card navigates to product.html (default: true)
   * @param {boolean} options.showAddToCart - Whether to show the Add to Cart button (default: true)
   * @returns {HTMLElement} - The fully constructed product card element
   */
  function create(product, options = {}) {
    const { isLink = true, showAddToCart = true } = options;

    const isOutOfStock = product.StockQuantity <= 0;
    const hasDiscount = product.DiscountPrice !== null && product.DiscountPrice > 0;
    
    // Generate Badges HTML
    let badgesHtml = '';
    if (isOutOfStock) {
      badgesHtml += `<span class="badge badge-soldout">Out of Stock</span>`;
    } else {
      if (product.NewArrival) badgesHtml += `<span class="badge badge-new">New</span>`;
      if (hasDiscount) badgesHtml += `<span class="badge badge-sale">Sale</span>`;
    }

    // Pricing display. The old price intentionally omits the currency prefix
    // (just "70" not "Rs.70") -- it's understood from context next to the
    // current price, and dropping it is the difference between a discounted
    // price fitting on one line in the tightest card layouts or not.
    const pricingHtml = hasDiscount
      ? `<span class="price-display__current">${CONFIG.CURRENCY}${product.DiscountPrice}</span>
         <span class="price-display__old">${product.Price}</span>`
      : `<span class="price-display__current">${CONFIG.CURRENCY}${product.Price}</span>`;

    // Action button
    let actionBtnHtml = '';
    if (showAddToCart) {
      actionBtnHtml = isOutOfStock
        ? `<button class="btn btn-primary btn-disabled" disabled>Sold Out</button>`
        : `<button class="btn btn-primary add-to-cart-btn" data-id="${product.ProductID}" data-stock="${product.StockQuantity}" aria-label="Add to cart">
            <svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            <span class="btn-text">Add</span>
           </button>`;
    }

    // Image URL with Cloudinary Optimization
    const optimizedImageUrl = typeof ImageService !== 'undefined' 
      ? ImageService.getOptimizedUrl(product.ProductImageURL, 400)
      : product.ProductImageURL;

    // Build the container
    const card = document.createElement('div');
    card.className = 'product-card';
    card.setAttribute('data-id', product.ProductID);
    
    if (isLink) {
      card.style.cursor = 'pointer';
      card.setAttribute('role', 'link');
      card.setAttribute('aria-label', `View ${sanitize(product.ProductName)}`);
    }

    card.innerHTML = `
      <div class="product-card__img-container">
        <div class="product-card__badges">${badgesHtml}</div>
        ${isLink ? `<a href="product.html?id=${product.ProductID}" style="display: block; width: 100%; height: 100%;">` : ''}
          <img class="product-card__img" src="${sanitize(optimizedImageUrl)}" alt="${sanitize(product.ProductName)}" loading="lazy" width="400" height="400">
        ${isLink ? `</a>` : ''}
      </div>
      <div class="product-card__content">
        <div class="product-card__category">${sanitize(product.Category)}</div>
        <h3 class="product-card__title">
          ${isLink ? `<a href="product.html?id=${product.ProductID}">${sanitize(product.ProductName)}</a>` : sanitize(product.ProductName)}
        </h3>
        <div class="product-card__model">Model: ${sanitize(product.ModelNumber)}</div>
        <div class="product-card__footer">
          <div class="price-display">${pricingHtml}</div>
          ${actionBtnHtml}
        </div>
      </div>
    `;

    // Click event for the whole card (if configured as link)
    if (isLink) {
      card.addEventListener('click', (e) => {
        // Prevent navigating if clicking the Add to Cart button or its children
        if (e.target.closest('.add-to-cart-btn')) return;
        
        if (typeof trackLocalInterest === 'function') {
          trackLocalInterest(product.ProductID, 1);
        }
        window.location.href = `product.html?id=${product.ProductID}`;
      });
    }

    // Add to Cart listener
    if (showAddToCart) {
      const addBtn = card.querySelector('.add-to-cart-btn');
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
    }

    return card;
  }

  return { create };
})();
