// House of Prime Collections - Configuration
const CONFIG = {
  // Replace with your Google Sheets ID when ready
  SHEET_ID: 'https://docs.google.com/spreadsheets/d/11sGw12KPBNX-xfp5UznocHBnUzszCQHigowddjb9w8M/edit?usp=sharing',

  // Your WhatsApp Business number — country code + number, no +, spaces, or dashes
  // Example: India +91 95144 87662 → "919514487662"
  _waEncoded: '919514487662',

  get WHATSAPP_NUMBER() {
    // Returns the number directly. To obfuscate, replace _waEncoded with btoa('919514487662')
    // and change the return below to: return atob(this._waEncoded);
    return this._waEncoded;
  },

  // Pricing & Delivery
  DEFAULT_SHIPPING: 50,
  FREE_SHIPPING_THRESHOLD: 500,
  CURRENCY: 'Rs.',

  // --- SITE-WIDE CONTACT & SOCIAL INFO ---
  // Single source of truth for footer/contact/policy pages (see js/site-info.js).
  // Edit these here instead of hunting through every HTML page.
  CONTACT_EMAIL: 'hoprimecol@gmail.com',
  CONTACT_PHONE_PRIMARY: '+91 95144 87662',   // WhatsApp-enabled, same as WHATSAPP_NUMBER above
  CONTACT_PHONE_SECONDARY: '+91 75488 81745', // Call only
  INSTAGRAM_URL: 'https://www.instagram.com/houseofprime.jewels?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==',

  // API settings
  CACHE_EXPIRY_MS: 5 * 60 * 1000, // 5 minutes cache

  // --- ADMIN PANEL API SETTINGS ---
  
  // Cloudinary settings for direct image uploads
  CLOUDINARY_CLOUD_NAME: 'dgivkatwl',
  CLOUDINARY_UPLOAD_PRESET: 'hop_products',
  
  // URL of the Google Apps Script Web App (Database Write)
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwvLLqIDYgWnTiZDK2eXslZzm4tOx2IxE2F7CfgJyCXSSN5F4ZpweVWxBVZJJekmYlt/exec',
  
  // Local/Netlify Function for Authentication (relative path)
  AUTH_FUNCTION_URL: '/.netlify/functions/auth'
};
