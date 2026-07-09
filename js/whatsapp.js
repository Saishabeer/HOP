// whatsapp.js - WhatsApp Link Generator

const WhatsApp = {
  /**
   * Generates order message string and returns the URL.
   * Legacy method used by product.html quick-buy flow.
   */
  generateOrderUrl(customer, cartItems, total) {
    const number = CONFIG.WHATSAPP_NUMBER;

    let message = `Hello House of Prime Collections,\n\n`;
    message += `I would like to place the following order:\n\n`;

    cartItems.forEach(item => {
      const price = item.product.DiscountPrice !== null ? item.product.DiscountPrice : item.product.Price;
      message += `Product: ${item.product.ProductName}\n`;
      message += `Model: ${item.product.ModelNumber}\n`;
      message += `Quantity: ${item.qty}\n`;
      message += `Price: Rs.${price}\n`;
      message += `---\n`;
    });

    message += `Customer Name: ${customer.name}\n`;
    message += `Phone: ${customer.phone}\n`;
    message += `Address: ${customer.addressLine1}, ${customer.area}, ${customer.city}, ${customer.state} - ${customer.pincode}\n`;
    if (customer.notes && customer.notes.trim() !== '') {
      message += `Notes: ${customer.notes.trim()}\n`;
    }
    message += `\n`;
    message += `Order Total: Rs.${total}\n\n`;
    message += `Please confirm availability and delivery timeline.`;

    const encodedText = encodeURIComponent(message);
    return `https://wa.me/${number}?text=${encodedText}`;
  },

  /**
   * Checkout page order URL — called by checkout.js with structured order object.
   * @param {Object} order - { customer: {name,phone,email,address,city,state,pincode}, items:[{name,model,qty,price}], subtotal, shipping, total }
   */
  getCheckoutUrl(order) {
    const number = CONFIG.WHATSAPP_NUMBER;
    const { customer, items, subtotal, shipping, total } = order;

    let message = `🛍️ *New Order — House of Prime Collections*\n\n`;
    message += `*Customer Details*\n`;
    message += `Name: ${customer.name}\n`;
    message += `Phone: +91 ${customer.phone}\n`;
    if (customer.email) message += `Email: ${customer.email}\n`;
    message += `Address: ${customer.address}, ${customer.city}, ${customer.state} - ${customer.pincode}\n\n`;

    message += `*Order Items*\n`;
    items.forEach((item, idx) => {
      message += `${idx + 1}. ${item.name} (${item.model}) × ${item.qty} = Rs.${item.price * item.qty}\n`;
    });

    message += `\n*Order Summary*\n`;
    message += `Subtotal: Rs.${subtotal}\n`;
    message += `Shipping: ${shipping === 0 ? 'FREE' : 'Rs.' + shipping}\n`;
    message += `*Grand Total: Rs.${total}*\n\n`;
    message += `Please confirm stock availability and share UPI/GPay payment details. Thank you! 🙏`;

    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  },

  /**
   * General greeting URL for floating WhatsApp button & contact page.
   */
  getGeneralChatUrl() {
    const number = CONFIG.WHATSAPP_NUMBER;
    const message = "Hi! I would like to know more about your jewelry and accessories.";
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }
};

// Auto-wire the floating WhatsApp button (and homepage CTA, if present) on every
// page that includes this script — previously duplicated per-page and missing
// on several pages, leaving the floating button as a dead "#" link there.
document.addEventListener('DOMContentLoaded', () => {
  const url = WhatsApp.getGeneralChatUrl();
  const waFloat = document.querySelector('.whatsapp-float');
  const waCta = document.getElementById('wa-cta-btn');
  if (waFloat) waFloat.href = url;
  if (waCta) waCta.href = url;
});
