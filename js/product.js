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
  document.title = `${currentProduct.ProductName} | House of Prime Collections`;
  
  // Set Breadcrumbs active name
  const breadcrumbProduct = document.getElementById('breadcrumb-product-name');
  if (breadcrumbProduct) breadcrumbProduct.textContent = currentProduct.ProductName;

  // 1. Render Gallery
  const mainImg = document.getElementById('main-gallery-img');
  const mainImgContainer = document.getElementById('main-gallery-container');
  const thumbnailsContainer = document.getElementById('thumbnails-container');

  if (mainImg) mainImg.src = currentProduct.ProductImageURL;
  if (mainImgContainer && mainImg) initImageZoom(mainImg, mainImgContainer);

  if (thumbnailsContainer) {
    thumbnailsContainer.innerHTML = '';
    const images = [
      currentProduct.ProductImageURL,
      currentProduct.AdditionalImage1,
      currentProduct.AdditionalImage2,
      currentProduct.AdditionalImage3
    ].filter(url => url && url.trim() !== '');

    if (images.length > 1) {
      images.forEach((imgUrl, idx) => {
        const thumb = document.createElement('div');
        thumb.className = `gallery__thumbnail ${idx === 0 ? 'active' : ''}`;
        thumb.innerHTML = `<img src="${imgUrl}" alt="Thumbnail view ${idx + 1}" loading="lazy">`;
        thumb.addEventListener('click', () => {
          // Switch active class
          thumbnailsContainer.querySelectorAll('.gallery__thumbnail').forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');
          // Update main image source
          if (mainImg) mainImg.src = imgUrl;
        });
        thumbnailsContainer.appendChild(thumb);
      });
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

  if (titleEl) titleEl.textContent = currentProduct.ProductName;
  if (modelEl) modelEl.textContent = `Model: ${currentProduct.ModelNumber}`;
  
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
  if (descEl) descEl.textContent = currentProduct.Description;
  if (materialEl) materialEl.textContent = currentProduct.Material || 'Standard Alloy';
  if (colorEl) colorEl.textContent = currentProduct.Color || 'Assorted Colors';
  if (weightEl) weightEl.textContent = currentProduct.Weight || 'N/A';

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
    });
  }

  // Buy Now (Adds to cart and goes to checkout page)
  if (buyNowBtn) {
    buyNowBtn.addEventListener('click', () => {
      const added = Cart.add(currentProduct.ProductID, selectedQty, currentProduct.StockQuantity);
      if (added) {
        window.location.href = 'checkout.html';
      }
    });
  }

  // WhatsApp Quick Order for Single Item
  if (waQuickBtn) {
    waQuickBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
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
 * Fetch and load related items from same category
 */
async function loadRelatedProducts() {
  const container = document.getElementById('related-row');
  if (!container) return;

  try {
    const products = await fetchProducts();
    
    // Filter by same category, exclude current product
    const related = products
      .filter(p => p.Category === currentProduct.Category && p.ProductID !== currentProduct.ProductID)
      .slice(0, 4);

    if (related.length === 0) {
      // If no items in same category, show any featured items
      const featured = products
        .filter(p => p.ProductID !== currentProduct.ProductID)
        .slice(0, 4);
      renderRelatedGrid(container, featured);
    } else {
      renderRelatedGrid(container, related);
    }
  } catch (err) {
    console.error("Failed to load related products:", err);
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--warm-gray);">Could not load recommendations.</p>`;
  }
}

function renderRelatedGrid(container, productList) {
  container.innerHTML = '';
  
  productList.forEach(product => {
    const isOutOfStock = product.StockQuantity <= 0;
    const hasDiscount = product.DiscountPrice !== null && product.DiscountPrice > 0;
    
    let badgesHtml = '';
    if (isOutOfStock) {
      badgesHtml += `<span class="badge badge-soldout">Out of Stock</span>`;
    } else {
      if (product.NewArrival) badgesHtml += `<span class="badge badge-new">New</span>`;
      if (hasDiscount) badgesHtml += `<span class="badge badge-sale">Sale</span>`;
    }

    const pricingHtml = hasDiscount 
      ? `<span class="price-display__current">${CONFIG.CURRENCY}${product.DiscountPrice}</span>
         <span class="price-display__old">${CONFIG.CURRENCY}${product.Price}</span>`
      : `<span class="price-display__current">${CONFIG.CURRENCY}${product.Price}</span>`;

    const actionBtnHtml = isOutOfStock
      ? `<button class="btn btn-primary btn-disabled" disabled>Sold Out</button>`
      : `<button class="btn btn-primary add-to-cart-btn" data-id="${product.ProductID}" data-stock="${product.StockQuantity}" aria-label="Add to cart">
          Add
         </button>`;

    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-card__img-container">
        <div class="product-card__badges">${badgesHtml}</div>
        <a href="product.html?id=${product.ProductID}">
          <img class="product-card__img" src="${product.ProductImageURL}" alt="${product.ProductName}" loading="lazy">
        </a>
      </div>
      <div class="product-card__content">
        <div class="product-card__category">${product.Category}</div>
        <h3 class="product-card__title">
          <a href="product.html?id=${product.ProductID}">${product.ProductName}</a>
        </h3>
        <div class="product-card__model">Model: ${product.ModelNumber}</div>
        <div class="product-card__footer">
          <div class="price-display">${pricingHtml}</div>
          ${actionBtnHtml}
        </div>
      </div>
    `;

    container.appendChild(card);
  });

  // Bind Add to Cart listeners
  container.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.getAttribute('data-id');
      const stock = parseInt(btn.getAttribute('data-stock'), 10);
      Cart.add(id, 1, stock);
    });
  });
}
