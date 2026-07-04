// js/services/CartService.js
// Cart State Management

const CART_KEY = 'hop_cart';

const Cart = {
  get() {
    try {
      const data = localStorage.getItem(CART_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Failed to parse cart data from LocalStorage, resetting cart.", e);
      return [];
    }
  },

  save(cart) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      // Dispatch a custom event to notify other scripts of cart updates
      window.dispatchEvent(new CustomEvent('cartUpdated', { detail: cart }));
      this.updateNavbarBadge();
    } catch (e) {
      console.error("Failed to save cart to LocalStorage.", e);
    }
  },

  add(productId, qty = 1, maxStock = 999) {
    let cart = this.get();
    const existingIndex = cart.findIndex(item => item.id === productId);
    
    if (existingIndex > -1) {
      const newQty = cart[existingIndex].qty + qty;
      if (newQty > maxStock) {
        if (typeof Toast !== 'undefined') Toast.show(`Cannot add more. Only ${maxStock} in stock.`, 'error');
        return false;
      }
      cart[existingIndex].qty = newQty;
    } else {
      if (qty > maxStock) {
        if (typeof Toast !== 'undefined') Toast.show(`Only ${maxStock} in stock.`, 'error');
        return false;
      }
      cart.push({ id: productId, qty: qty });
    }
    
    this.save(cart);
    if (typeof Toast !== 'undefined') Toast.show('Product added to cart!', 'success');
    return true;
  },

  remove(productId) {
    let cart = this.get();
    cart = cart.filter(item => item.id !== productId);
    this.save(cart);
    if (typeof Toast !== 'undefined') Toast.show('Product removed from cart.', 'success');
  },

  updateQty(productId, qty, maxStock = 999) {
    if (qty <= 0) {
      this.remove(productId);
      return;
    }
    
    let cart = this.get();
    const itemIndex = cart.findIndex(item => item.id === productId);
    
    if (itemIndex > -1) {
      if (qty > maxStock) {
        if (typeof Toast !== 'undefined') Toast.show(`Cannot increase. Only ${maxStock} in stock.`, 'error');
        return;
      }
      cart[itemIndex].qty = qty;
      this.save(cart);
    }
  },

  clear() {
    try {
      localStorage.removeItem(CART_KEY);
      window.dispatchEvent(new CustomEvent('cartUpdated', { detail: [] }));
      this.updateNavbarBadge();
    } catch (e) {
      console.error("Failed to clear cart.", e);
    }
  },

  getCount() {
    const cart = this.get();
    return cart.reduce((total, item) => total + item.qty, 0);
  },

  updateNavbarBadge() {
    const badge = document.querySelector('.cart-badge');
    if (badge) {
      const count = this.getCount();
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  }
};
