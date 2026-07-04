// js/services/ImageService.js
// Centralizes Cloudinary URL transformations to ensure all images
// are optimized for delivery (auto format, auto quality, resized).

const ImageService = (() => {
  /**
   * Applies Cloudinary optimizations to a raw Cloudinary URL.
   * If the URL is not from Cloudinary, it is returned unchanged.
   *
   * @param {string} rawUrl - The original image URL
   * @param {number} width - The target width in pixels (default 400 for product cards)
   * @returns {string} - The optimized URL
   */
  function getOptimizedUrl(rawUrl, width = 400) {
    if (!rawUrl) return '';
    
    // Check if it's a Cloudinary URL
    if (rawUrl.includes('res.cloudinary.com')) {
      // If it already has transformations (e.g., /upload/w_...), skip or replace?
      // For safety, only inject if it's a standard /upload/ path without transforms.
      // Easiest robust way for this project: inject /w_WIDTH,q_auto,f_auto/ after /upload/
      if (rawUrl.includes('/upload/') && !rawUrl.includes('q_auto')) {
        return rawUrl.replace('/upload/', `/upload/w_${width},q_auto,f_auto/`);
      }
    }
    return rawUrl;
  }

  return {
    getOptimizedUrl
  };
})();
