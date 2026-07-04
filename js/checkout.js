// checkout.js - Checkout Process & Order Submission

let checkoutCart = [];
let checkoutProducts = [];
let calculatedSubtotal = 0;
let calculatedShipping = 0;
let calculatedTotal = 0;

document.addEventListener('DOMContentLoaded', async () => {
  // Check if cart is empty, redirect if so
  const cart = Cart.get();
  if (cart.length === 0) {
    if (typeof Toast !== 'undefined') Toast.show("Your cart is empty. Add products before checkout.", "error");
    setTimeout(() => { window.location.href = 'shop.html'; }, 1500);
    return;
  }

  // Load and render checkout content
  await loadCheckoutData(cart);

  // Restore cached form data
  restoreFormData();

  // Setup form submission
  setupCheckoutForm();

  // Setup WA Float Link
  const waBtn = document.querySelector('.whatsapp-float');
  if (waBtn) {
    waBtn.href = WhatsApp.getGeneralChatUrl();
    waBtn.target = '_blank';
  }
});

/**
 * Fetch catalog products to build order summary details
 */
async function loadCheckoutData(cart) {
  const container = document.getElementById('checkout-items-container');
  const subtotalEl = document.getElementById('checkout-subtotal');
  const shippingEl = document.getElementById('checkout-shipping');
  const totalEl = document.getElementById('checkout-total');

  if (!container) return;

  try {
    checkoutProducts = await fetchProducts();
    container.innerHTML = '';

    calculatedSubtotal = 0;
    checkoutCart = [];

    cart.forEach(cartItem => {
      const product = checkoutProducts.find(p => p.ProductID === cartItem.id);
      if (product) {
        checkoutCart.push({
          product: product,
          qty: cartItem.qty
        });

        const price = product.DiscountPrice !== null ? product.DiscountPrice : product.Price;
        const lineTotal = price * cartItem.qty;
        calculatedSubtotal += lineTotal;

        const itemRow = document.createElement('div');
        itemRow.className = 'checkout-item';
        itemRow.innerHTML = `
          <span class="checkout-item__name">
            ${sanitize(product.ProductName)}
            <span class="checkout-item__qty">x${cartItem.qty}</span>
          </span>
          <span class="checkout-item__total">${CONFIG.CURRENCY}${lineTotal}</span>
        `;
        container.appendChild(itemRow);
      }
    });

    if (checkoutCart.length === 0) {
      window.location.href = 'cart.html';
      return;
    }

    // Shipping calculations
    calculatedShipping = calculatedSubtotal >= CONFIG.FREE_SHIPPING_THRESHOLD ? 0 : CONFIG.DEFAULT_SHIPPING;
    calculatedTotal = calculatedSubtotal + calculatedShipping;

    if (subtotalEl) subtotalEl.textContent = `${CONFIG.CURRENCY}${calculatedSubtotal}`;
    if (shippingEl) {
      shippingEl.textContent = calculatedShipping === 0 ? 'FREE' : `${CONFIG.CURRENCY}${calculatedShipping}`;
      if (calculatedShipping === 0) {
        shippingEl.style.color = 'var(--success)';
        shippingEl.style.fontWeight = 'bold';
      }
    }
    if (totalEl) totalEl.textContent = `${CONFIG.CURRENCY}${calculatedTotal}`;

  } catch (err) {
    console.error("Failed to load checkout summary:", err);
    container.innerHTML = `<p style="color: var(--error);">Error loading summary. Please reload.</p>`;
  }
}

/**
 * Cache shipping values in LocalStorage for user convenience
 */
function restoreFormData() {
  const fields = ['name', 'phone', 'email', 'address', 'city', 'state', 'pincode'];
  fields.forEach(field => {
    const val = localStorage.getItem(`hop_shipping_${field}`);
    const input = document.getElementById(`shipping-${field}`);
    if (val && input) {
      input.value = val;
    }
  });
}

function saveFormData() {
  const fields = ['name', 'phone', 'email', 'address', 'city', 'state', 'pincode'];
  fields.forEach(field => {
    const input = document.getElementById(`shipping-${field}`);
    if (input) {
      localStorage.setItem(`hop_shipping_${field}`, input.value.trim());
    }
  });
}

/**
 * Handle validation and order confirmation submission
 */
function setupCheckoutForm() {
  const form = document.getElementById('checkout-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // 1. Fetch form input values
    const name = document.getElementById('shipping-name').value.trim();
    const phone = document.getElementById('shipping-phone').value.trim();
    const email = document.getElementById('shipping-email').value.trim();
    const address = document.getElementById('shipping-address').value.trim();
    const city = document.getElementById('shipping-city').value.trim();
    const stateVal = document.getElementById('shipping-state').value.trim();
    const pincode = document.getElementById('shipping-pincode').value.trim();

    // 2. Perform validations
    if (!name) {
      if (typeof Toast !== 'undefined') Toast.show("Please enter your Full Name", "error");
      document.getElementById('shipping-name').focus();
      return;
    }

    if (!Validator.isIndianPhone(phone)) {
      if (typeof Toast !== 'undefined') Toast.show("Please enter a valid 10-digit Indian phone number", "error");
      document.getElementById('shipping-phone').focus();
      return;
    }

    if (email && !Validator.isEmail(email)) {
      if (typeof Toast !== 'undefined') Toast.show("Please enter a valid email address", "error");
      document.getElementById('shipping-email').focus();
      return;
    }

    if (!Validator.isValidAddress(address)) {
      if (typeof Toast !== 'undefined') Toast.show("Please enter a detailed delivery address", "error");
      document.getElementById('shipping-address').focus();
      return;
    }

    if (!city) {
      if (typeof Toast !== 'undefined') Toast.show("Please enter your City", "error");
      document.getElementById('shipping-city').focus();
      return;
    }

    if (!stateVal) {
      if (typeof Toast !== 'undefined') Toast.show("Please enter your State", "error");
      document.getElementById('shipping-state').focus();
      return;
    }

    if (!Validator.isIndianPincode(pincode)) {
      if (typeof Toast !== 'undefined') Toast.show("Please enter a valid 6-digit Indian PIN code", "error");
      document.getElementById('shipping-pincode').focus();
      return;
    }

    // 3. Save details for next checkout
    saveFormData();

    // 4. Construct Order Metadata Object
    const orderMetadata = {
      customer: {
        name,
        phone,
        email,
        address,
        city,
        state: stateVal,
        pincode
      },
      items: checkoutCart.map(item => ({
        name: item.product.ProductName,
        model: item.product.ModelNumber,
        qty: item.qty,
        price: item.product.DiscountPrice !== null ? item.product.DiscountPrice : item.product.Price
      })),
      subtotal: calculatedSubtotal,
      shipping: calculatedShipping,
      total: calculatedTotal
    };

    // 5. Generate WhatsApp Order Message & Open Link
    const waUrl = WhatsApp.getCheckoutUrl(orderMetadata);
    
    // Increment orders globally in Google Sheets (Option 2)
    const productIdsToIncrement = checkoutCart.map(item => item.product.ProductID);
    sendOrderIncrementToSheets(productIdsToIncrement);

    // Clear shopping cart
    Cart.clear();

    // 6. Transition current page to order success view
    showOrderSuccessPage(orderMetadata, waUrl);
    
    // Attempt to open WhatsApp in a new tab
    window.open(waUrl, '_blank');
  });
}

/**
 * Renders a clean success view directly on the page, handling browser popup blocking gracefully.
 */
function showOrderSuccessPage(order, waUrl) {
  const container = document.getElementById('checkout-layout-container');
  if (!container) return;

  container.className = 'container';
  container.style.maxWidth = '600px';
  container.style.padding = '48px 16px';
  container.style.marginTop = '24px';
  container.style.marginBottom = '64px';
  
  let itemsHtml = '';
  order.items.forEach(item => {
    itemsHtml += `
      <div style="display: flex; justify-content: space-between; font-size: 0.9rem; padding: 6px 0; border-bottom: 1px dashed var(--velvet-cream);">
        <span>${item.name} <strong style="color: var(--warm-gray);">x${item.qty}</strong></span>
        <strong>Rs.${item.price * item.qty}</strong>
      </div>
    `;
  });

  container.innerHTML = `
    <div style="text-align: center; background-color: var(--ivory-white); border: 1px solid var(--velvet-cream); border-radius: var(--radius-card); padding: 32px; box-shadow: var(--shadow-md);">
      <div style="width: 72px; height: 72px; background-color: #e8f5e9; border-radius: var(--radius-round); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; color: var(--success);">
        <svg style="width: 40px; height: 40px; fill: currentColor;" viewBox="0 0 24 24">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      </div>
      
      <h2 style="font-family: var(--font-heading); color: var(--primary-rose); font-size: 1.6rem; margin-bottom: 12px;">Order Placed on WhatsApp!</h2>
      <p style="font-size: 0.95rem; line-height: 1.5; color: var(--deep-charcoal); margin-bottom: 24px;">
        Thank you, <strong>${order.customer.name}</strong>! We have opened a WhatsApp chat with your order details. 
        Please click the button below to submit the message and finalize your payment.
      </p>

      <a href="${waUrl}" target="_blank" class="btn btn-wa-order btn-block" style="background-color: var(--wa-green); display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 24px; font-weight: 700; height: 48px;">
        <svg style="width: 20px; height: 20px; fill: currentColor;" viewBox="0 0 24 24">
          <path d="M12.012 2.163c-5.419 0-9.829 4.41-9.829 9.829 0 1.732.451 3.42 1.309 4.912L2.163 22.16l5.309-1.393c1.444.787 3.073 1.203 4.54 1.203h.001c5.421 0 9.83-4.411 9.83-9.83 0-2.628-1.023-5.097-2.88-6.956-1.857-1.858-4.325-2.88-6.951-2.88zm4.992 13.916c-.274.773-1.353 1.411-1.854 1.503-.496.091-.989.176-3.177-.729-2.796-1.156-4.597-4.004-4.737-4.188-.139-.186-1.134-1.509-1.134-2.879 0-1.37.718-2.043.973-2.317.254-.274.556-.342.742-.342h.53c.159 0 .373-.06.583.456.219.539.752 1.839.818 1.975.066.136.109.294.018.474-.09.18-.136.294-.273.456-.136.162-.284.359-.406.49-.136.147-.278.307-.119.581.159.273.707 1.166 1.517 1.888 1.044.93 1.92 1.218 2.193 1.354.273.136.43.113.59-.071.16-.184.685-.798.868-1.071.182-.273.364-.227.614-.136.251.091 1.597.752 1.87 1.026.273.273.455.41.523.525.068.115.068.66-.206 1.433z"/>
        </svg>
        Send WhatsApp Order Message
      </a>

      <!-- Summary breakdown -->
      <div style="background-color: var(--velvet-cream); border-radius: var(--radius-card); padding: 20px; text-align: left; margin-bottom: 24px;">
        <h4 style="font-family: var(--font-ui); text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.5px; border-bottom: 1px solid rgba(139, 26, 74, 0.1); padding-bottom: 8px; margin-bottom: 12px; color: var(--primary-rose);">Order Summary</h4>
        
        <div style="margin-bottom: 12px;">
          ${itemsHtml}
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-top: 6px;">
          <span>Subtotal:</span>
          <span>Rs.${order.subtotal}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-top: 6px;">
          <span>Shipping:</span>
          <span>${order.shipping === 0 ? 'FREE' : 'Rs.' + order.shipping}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-family: var(--font-ui); font-weight: 700; font-size: 1.15rem; color: var(--primary-rose); border-top: 1px solid rgba(139, 26, 74, 0.1); padding-top: 10px; margin-top: 10px;">
          <span>Grand Total:</span>
          <span>Rs.${order.total}</span>
        </div>
      </div>

      <!-- Shipping Destination -->
      <div style="background-color: var(--velvet-cream); border-radius: var(--radius-card); padding: 20px; text-align: left;">
        <h4 style="font-family: var(--font-ui); text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.5px; border-bottom: 1px solid rgba(139, 26, 74, 0.1); padding-bottom: 8px; margin-bottom: 12px; color: var(--primary-rose);">Delivery Details</h4>
        <p style="font-size: 0.9rem; line-height: 1.4; margin-bottom: 0;">
          <strong>Name:</strong> ${sanitize(order.customer.name)}<br>
          <strong>Phone:</strong> +91 ${sanitize(order.customer.phone)}<br>
          <strong>Address:</strong> ${sanitize(order.customer.address)}, ${sanitize(order.customer.city)}, ${sanitize(order.customer.state)} - ${sanitize(order.customer.pincode)}
        </p>
      </div>

      <div style="margin-top: 32px;">
        <a href="shop.html" class="btn btn-outline" style="height: 40px; display: inline-flex; align-items: center; justify-content: center; width: auto; padding: 0 24px;">Continue Shopping</a>
      </div>
    </div>
  `;
}
