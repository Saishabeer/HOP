// js/site-info.js
// Populates footer/contact/policy pages with values from CONFIG at runtime,
// so contact info, social links, shipping terms, the copyright year, and the
// footer category list only ever need to be edited in one place (config.js) —
// or, for categories, they follow whatever's actually in the Sheet.

document.addEventListener('DOMContentLoaded', () => {
  // Instagram links (hero CTA + footer social icon), matched by href so no
  // markup changes are needed on pages that already link to Instagram.
  document.querySelectorAll('a[href*="instagram.com"]').forEach(a => {
    a.setAttribute('href', CONFIG.INSTAGRAM_URL);
  });

  const phonePrimary = document.getElementById('footer-phone-primary');
  if (phonePrimary && typeof WhatsApp !== 'undefined') {
    phonePrimary.textContent = CONFIG.CONTACT_PHONE_PRIMARY;
    phonePrimary.href = WhatsApp.getGeneralChatUrl();
    phonePrimary.target = '_blank';
  }

  const phoneSecondary = document.getElementById('footer-phone-secondary');
  if (phoneSecondary) {
    phoneSecondary.textContent = CONFIG.CONTACT_PHONE_SECONDARY;
    phoneSecondary.href = 'tel:' + CONFIG.CONTACT_PHONE_SECONDARY.replace(/[^\d+]/g, '');
  }

  const emailLink = document.getElementById('footer-email');
  if (emailLink) {
    emailLink.textContent = CONFIG.CONTACT_EMAIL;
    emailLink.href = 'mailto:' + CONFIG.CONTACT_EMAIL;
  }

  // Contact page's dedicated "Get In Touch" cards (plain text, not links)
  const contactPhoneBlock = document.getElementById('contact-phone-block');
  if (contactPhoneBlock) {
    contactPhoneBlock.textContent = `${CONFIG.CONTACT_PHONE_PRIMARY} / ${CONFIG.CONTACT_PHONE_SECONDARY}`;
  }
  const contactEmailBlock = document.getElementById('contact-email-block');
  if (contactEmailBlock) {
    contactEmailBlock.textContent = CONFIG.CONTACT_EMAIL;
  }

  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Shipping figures quoted in cart/faq/policy pages
  const shippingFeeEl = document.getElementById('shipping-fee-amt');
  if (shippingFeeEl) shippingFeeEl.textContent = CONFIG.DEFAULT_SHIPPING;
  const freeShippingEl = document.getElementById('free-shipping-amt');
  if (freeShippingEl) freeShippingEl.textContent = CONFIG.FREE_SHIPPING_THRESHOLD;

  populateFooterCategories();
});

/**
 * Rebuilds the footer's "Categories" links from real product data instead of
 * a hardcoded list, mirroring the category derivation already used in shop.js.
 */
async function populateFooterCategories() {
  const container = document.getElementById('footer-categories-list');
  if (!container || typeof fetchProducts !== 'function') return;

  try {
    const products = await fetchProducts();
    const categories = [...new Set(products.map(p => p.Category))].filter(Boolean).sort();
    if (categories.length === 0) return;

    container.innerHTML = categories.slice(0, 6).map(cat =>
      `<a href="shop.html?category=${encodeURIComponent(cat)}" class="footer__link">${sanitize(cat)}</a>`
    ).join('');
  } catch (e) {
    // Leave the existing fallback link in place rather than showing an empty column.
  }
}
