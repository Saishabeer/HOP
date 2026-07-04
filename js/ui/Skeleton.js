// js/ui/Skeleton.js
// Standardized component builder for skeleton loaders

const Skeleton = (() => {
  /**
   * Creates a string of HTML representing skeleton cards.
   *
   * @param {number} count - The number of skeletons to generate
   * @returns {string} - The HTML string for the skeletons
   */
  function generateHtml(count = 4) {
    let skeletonsHtml = '';
    for (let i = 0; i < count; i++) {
      skeletonsHtml += `
        <div class="shimmer-card">
          <div class="shimmer-box shimmer-card__img"></div>
          <div class="shimmer-box shimmer-card__title"></div>
          <div class="shimmer-box shimmer-card__price"></div>
        </div>
      `;
    }
    return skeletonsHtml;
  }

  /**
   * Injects skeleton HTML into a container element.
   *
   * @param {HTMLElement} container - The container to append the skeletons into
   * @param {number} count - The number of skeletons to generate
   */
  function showIn(container, count = 4) {
    if (!container) return;
    container.innerHTML = generateHtml(count);
  }

  return { generateHtml, showIn };
})();
