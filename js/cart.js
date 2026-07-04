// cart.js - Shopping Cart Page Rendering

// Auto update badge on load
document.addEventListener('DOMContentLoaded', async () => {
  Cart.updateNavbarBadge();
  
  // Set up mobile menu toggle behavior if elements exist
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');
  if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
      const isActive = hamburger.classList.toggle('is-active');
      navMenu.classList.toggle('is-active');
      hamburger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
    });

    // Close menu when navigation links are clicked
    const links = navMenu.querySelectorAll('.nav-menu__link');
    links.forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('is-active');
        navMenu.classList.remove('is-active');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Bind floating WhatsApp button link globally
  const waFloat = document.querySelector('.whatsapp-float');
  if (waFloat && typeof WhatsApp !== 'undefined') {
    waFloat.href = WhatsApp.getGeneralChatUrl();
    waFloat.target = '_blank';
  }

  // Cart page specific rendering
  if (document.getElementById('cart-items-container')) {
    await renderCartPage();
    window.addEventListener('cartUpdated', async () => {
      await renderCartPage();
    });
  }
});

/**
 * Render Cart Page elements dynamically
 */
async function renderCartPage() {
  const container = document.getElementById('cart-items-container');
  const cartLayout = document.getElementById('cart-layout-container');
  const cartEmpty = document.getElementById('cart-empty-container');
  
  const subtotalEl = document.getElementById('cart-subtotal');
  const shippingEl = document.getElementById('cart-shipping');
  const totalEl = document.getElementById('cart-total');

  if (!container) return;

  const cart = Cart.get();
  if (cart.length === 0) {
    if (cartLayout) cartLayout.style.display = 'none';
    if (cartEmpty) cartEmpty.style.display = 'flex';
    return;
  }

  if (cartLayout) cartLayout.style.display = 'grid';
  if (cartEmpty) cartEmpty.style.display = 'none';

  container.innerHTML = `
    <div style="text-align: center; padding: 24px;" class="shimmer-box-wrapper">
      <p style="color: var(--warm-gray);">Updating items...</p>
    </div>
  `;

  try {
    const products = await fetchProducts();
    container.innerHTML = '';
    
    let subtotal = 0;
    const cartDetails = [];

    // Map cart items to full product information
    cart.forEach(cartItem => {
      const product = products.find(p => p.ProductID === cartItem.id);
      if (product) {
        cartDetails.push({
          product: product,
          qty: cartItem.qty
        });
      }
    });

    if (cartDetails.length === 0) {
      Cart.clear();
      if (cartLayout) cartLayout.style.display = 'none';
      if (cartEmpty) cartEmpty.style.display = 'flex';
      return;
    }

    cartDetails.forEach(item => {
      const product = item.product;
      const isOutOfStock = product.StockQuantity <= 0;
      const price = product.DiscountPrice !== null ? product.DiscountPrice : product.Price;
      const itemTotal = price * item.qty;
      subtotal += itemTotal;

      const card = document.createElement('div');
      card.className = 'cart-item';
      
      const pricingHtml = product.DiscountPrice !== null 
        ? `<span class="price-display__current">${CONFIG.CURRENCY}${product.DiscountPrice}</span>
           <span class="price-display__old" style="font-size: 0.75rem;">${CONFIG.CURRENCY}${product.Price}</span>`
        : `<span class="price-display__current">${CONFIG.CURRENCY}${product.Price}</span>`;

      card.innerHTML = `
        <div class="cart-item__img-wrapper">
          <img src="${sanitize(product.ProductImageURL)}" alt="${sanitize(product.ProductName)}" loading="lazy">
        </div>
        <div class="cart-item__info">
          <h3 class="cart-item__name"><a href="product.html?id=${product.ProductID}">${sanitize(product.ProductName)}</a></h3>
          <span class="cart-item__model">Model: ${sanitize(product.ModelNumber)}</span>
          <div class="price-display">${pricingHtml}</div>
        </div>
        <div class="cart-item__actions">
          <div class="stepper">
            <button class="stepper__btn item-qty-minus" data-id="${product.ProductID}" data-qty="${item.qty}">&minus;</button>
            <input type="number" class="stepper__input item-qty-input" data-id="${product.ProductID}" data-stock="${product.StockQuantity}" value="${item.qty}" min="1">
            <button class="stepper__btn item-qty-plus" data-id="${product.ProductID}" data-qty="${item.qty}" data-stock="${product.StockQuantity}">+</button>
          </div>
          <div class="cart-item__total">${CONFIG.CURRENCY}${itemTotal}</div>
          <button class="cart-item__delete" data-id="${product.ProductID}" aria-label="Remove item">
            <svg viewBox="0 0 24 24">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
        </div>
      `;

      container.appendChild(card);
    });

    // Subtotal, Shipping, Total calculations
    const shipping = subtotal >= CONFIG.FREE_SHIPPING_THRESHOLD ? 0 : CONFIG.DEFAULT_SHIPPING;
    const total = subtotal + shipping;

    if (subtotalEl) subtotalEl.textContent = `${CONFIG.CURRENCY}${subtotal}`;
    if (shippingEl) {
      shippingEl.textContent = shipping === 0 ? 'FREE' : `${CONFIG.CURRENCY}${shipping}`;
      if (shipping === 0) {
        shippingEl.style.color = 'var(--success)';
        shippingEl.style.fontWeight = 'bold';
      } else {
        shippingEl.style.color = '';
        shippingEl.style.fontWeight = '';
      }
    }
    if (totalEl) totalEl.textContent = `${CONFIG.CURRENCY}${total}`;

    // Setup action listeners on cart items
    setupCartItemListeners();

  } catch (err) {
    console.error("Failed to render cart items:", err);
    container.innerHTML = `<p style="text-align: center; color: var(--error);">Failed to load cart. Please reload.</p>`;
  }
}

/**
 * Event listeners inside the cart card elements
 */
function setupCartItemListeners() {
  const container = document.getElementById('cart-items-container');
  if (!container) return;

  // Minus Button
  container.querySelectorAll('.item-qty-minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const qty = parseInt(btn.getAttribute('data-qty'), 10);
      Cart.updateQty(id, qty - 1);
    });
  });

  // Plus Button
  container.querySelectorAll('.item-qty-plus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const qty = parseInt(btn.getAttribute('data-qty'), 10);
      const stock = parseInt(btn.getAttribute('data-stock'), 10);
      Cart.updateQty(id, qty + 1, stock);
    });
  });

  // Input Field Direct Edit
  container.querySelectorAll('.item-qty-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = input.getAttribute('data-id');
      const stock = parseInt(input.getAttribute('data-stock'), 10);
      let val = parseInt(e.target.value, 10);
      if (isNaN(val) || val < 1) val = 1;
      if (val > stock) val = stock;
      Cart.updateQty(id, val, stock);
    });
  });

  // Delete / Remove Button
  container.querySelectorAll('.cart-item__delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (confirm("Are you sure you want to remove this item?")) {
        Cart.remove(id);
      }
    });
  });
}
