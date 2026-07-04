// shop.js - Shop Catalog Logic & Rendering

// Global state for catalog
const state = {
  q: '',
  category: '',
  prices: [], // Array of selected price range codes
  sort: 'featured',
  page: 1,
  itemsPerPage: 12
};

let allProducts = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Parse URL query parameters
  parseUrlParams();
  
  // Set up DOM bindings
  initUiBindings();
  
  // Fetch products and render
  await loadShopProducts();
});

/**
 * Parses parameters from the URL
 */
function parseUrlParams() {
  const params = new URLSearchParams(window.location.search);
  state.q = params.get('q') || '';
  state.category = params.get('category') || '';
  state.sort = params.get('sort') || 'featured';
  state.page = parseInt(params.get('page'), 10) || 1;
}

/**
 * Sync state with the URL query parameters
 */
function updateUrl() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.category) params.set('category', state.category);
  if (state.sort && state.sort !== 'featured') params.set('sort', state.sort);
  if (state.page && state.page !== 1) params.set('page', state.page);
  
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', newUrl);
}

/**
 * Setup Event Listeners and sync state to initial UI components
 */
function initUiBindings() {
  // 1. Search Bar Input
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  
  if (searchInput) {
    searchInput.value = state.q;
    if (state.q) searchClear.style.display = 'flex';

    const handleSearch = debounce((e) => {
      state.q = e.target.value;
      state.page = 1;
      searchClear.style.display = state.q ? 'flex' : 'none';
      updateUrl();
      applyFiltersAndRender();
    }, 300);

    searchInput.addEventListener('input', handleSearch);
  }

  if (searchClear && searchInput) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      state.q = '';
      state.page = 1;
      searchClear.style.display = 'none';
      updateUrl();
      applyFiltersAndRender();
    });
  }

  // 2. Mobile Drawer Actions
  const drawer = document.getElementById('filter-drawer');
  const overlay = document.getElementById('filter-drawer-overlay');
  const trigger = document.getElementById('mobile-filter-trigger');
  const close = document.getElementById('filter-drawer-close');
  const applyMobileBtn = document.getElementById('apply-mobile-filters');
  const clearMobileBtn = document.getElementById('clear-mobile-filters');

  if (trigger && drawer && overlay) {
    trigger.addEventListener('click', () => {
      drawer.classList.add('active');
      overlay.classList.add('active');
    });
  }

  const closeDrawer = () => {
    if (drawer && overlay) {
      drawer.classList.remove('active');
      overlay.classList.remove('active');
    }
  };

  if (close) close.addEventListener('click', closeDrawer);
  if (overlay) overlay.addEventListener('click', closeDrawer);
  if (applyMobileBtn) applyMobileBtn.addEventListener('click', closeDrawer);

  if (clearMobileBtn) {
    clearMobileBtn.addEventListener('click', () => {
      clearAllFilters();
      closeDrawer();
    });
  }

  // 3. Sort Dropdowns (Mobile & Desktop)
  const sortSelects = [
    document.getElementById('sort-select'),
    document.getElementById('sort-select-desktop')
  ].filter(Boolean);

  sortSelects.forEach(select => {
    select.value = state.sort;
    select.addEventListener('change', (e) => {
      state.sort = e.target.value;
      state.page = 1;
      
      // Keep other sort selects in sync
      sortSelects.forEach(s => {
        s.value = state.sort;
      });
      
      updateUrl();
      applyFiltersAndRender();
    });
  });

  // Setup WA Float Link
  const waBtn = document.querySelector('.whatsapp-float');
  if (waBtn) {
    waBtn.href = WhatsApp.getGeneralChatUrl();
    waBtn.target = '_blank';
  }
}

/**
 * Fetch and load all products into local array
 */
async function loadShopProducts() {
  const container = document.getElementById('catalog-grid');
  Skeleton.showIn(container, 6);

  try {
    allProducts = await fetchProducts();
    
    // Setup filter bindings now that we have data
    setupFilterControls();
    
    // Apply filters and render initial set
    applyFiltersAndRender();
  } catch (err) {
    console.error("Error loading products:", err);
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--error);">Error loading catalog. Please check connection.</p>`;
  }
}

/**
 * Dynamically binds state changes to filters (Category pills & price checkboxes)
 */
function setupFilterControls() {
  // Bind category pills (both desktop and mobile drawers)
  const categoryContainer = document.getElementById('category-pills');
  const categoryContainerMobile = document.getElementById('category-pills-mobile');
  
  const uniqueCategories = [...new Set(allProducts.map(p => p.Category))].filter(Boolean);

  const renderCategoryControls = (el, isMobile) => {
    if (!el) return;
    el.innerHTML = '';
    
    // "All" Pill
    const allPill = document.createElement('div');
    allPill.className = `filter-pill ${state.category === '' ? 'active' : ''}`;
    allPill.textContent = 'All Categories';
    allPill.addEventListener('click', () => {
      selectCategory('', isMobile);
    });
    el.appendChild(allPill);

    // Dynamic Category Pills
    uniqueCategories.forEach(cat => {
      const count = allProducts.filter(p => p.Category === cat).length;
      const pill = document.createElement('div');
      pill.className = `filter-pill ${state.category === cat ? 'active' : ''}`;
      pill.innerHTML = `<span>${sanitize(cat)}</span><span style="font-size: 0.75rem; opacity: 0.6;">(${count})</span>`;
      pill.addEventListener('click', () => {
        selectCategory(cat, isMobile);
      });
      el.appendChild(pill);
    });
  };

  renderCategoryControls(categoryContainer, false);
  renderCategoryControls(categoryContainerMobile, true);

  // Bind Price Checkboxes (both desktop and mobile drawers)
  setupPriceCheckboxes('price-filters');
  setupPriceCheckboxes('price-filters-mobile');
}

function selectCategory(categoryName, isMobile) {
  state.category = categoryName;
  state.page = 1;
  updateUrl();
  
  // Re-sync category pills active state visually
  setupFilterControls();
  applyFiltersAndRender();
}

function setupPriceCheckboxes(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(chk => {
    // Sync UI with state
    const code = chk.value;
    chk.checked = state.prices.includes(code);

    // Event listener
    chk.addEventListener('change', (e) => {
      if (e.target.checked) {
        if (!state.prices.includes(code)) state.prices.push(code);
      } else {
        state.prices = state.prices.filter(c => c !== code);
      }
      state.page = 1;
      // Sync other corresponding checkboxes (desktop <-> mobile)
      syncPriceCheckboxesState();
      applyFiltersAndRender();
    });
  });
}

function syncPriceCheckboxesState() {
  ['price-filters', 'price-filters-mobile'].forEach(containerId => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(chk => {
      chk.checked = state.prices.includes(chk.value);
    });
  });
}

function clearAllFilters() {
  state.q = '';
  state.category = '';
  state.prices = [];
  state.page = 1;
  
  // Reset input UI elements
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  const searchClear = document.getElementById('search-clear');
  if (searchClear) searchClear.style.display = 'none';

  updateUrl();
  setupFilterControls();
  applyFiltersAndRender();
}

/**
 * Filter and Sort logic
 */
function applyFiltersAndRender() {
  let filtered = [...allProducts];

  // 1. Search filter
  if (state.q) {
    const query = state.q.toLowerCase().trim();
    filtered = filtered.filter(p => 
      p.ProductName.toLowerCase().includes(query) ||
      p.ModelNumber.toLowerCase().includes(query) ||
      p.Color.toLowerCase().includes(query) ||
      p.Material.toLowerCase().includes(query) ||
      p.Description.toLowerCase().includes(query)
    );
  }

  // 2. Category filter
  if (state.category) {
    filtered = filtered.filter(p => p.Category === state.category);
  }

  // 3. Price filter
  if (state.prices.length > 0) {
    filtered = filtered.filter(p => {
      const price = p.DiscountPrice !== null ? p.DiscountPrice : p.Price;
      
      return state.prices.some(range => {
        if (range === 'under-75') return price < 75;
        if (range === '75-90') return price >= 75 && price <= 90;
        if (range === 'above-90') return price > 90;
        return false;
      });
    });
  }

  // Update active count badge on mobile trigger
  let activeFilterCount = 0;
  if (state.category) activeFilterCount++;
  activeFilterCount += state.prices.length;
  
  const badge = document.getElementById('filter-badge-mobile');
  if (badge) {
    badge.textContent = activeFilterCount;
    badge.style.display = activeFilterCount > 0 ? 'inline-flex' : 'none';
  }

  // 4. Sort
  filtered.sort((a, b) => {
    const pA = a.DiscountPrice !== null ? a.DiscountPrice : a.Price;
    const pB = b.DiscountPrice !== null ? b.DiscountPrice : b.Price;

    if (state.sort === 'price-low') return pA - pB;
    if (state.sort === 'price-high') return pB - pA;
    if (state.sort === 'newest') {
      const dateA = new Date(a.CreatedDate || 0);
      const dateB = new Date(b.CreatedDate || 0);
      if (dateB - dateA !== 0) return dateB - dateA;
      return b.ProductID.localeCompare(a.ProductID);
    }
    if (state.sort === 'best') {
      const bestSellerDiff = (b.BestSeller ? 1 : 0) - (a.BestSeller ? 1 : 0);
      if (bestSellerDiff !== 0) return bestSellerDiff;
      const scoreA = (a.OrderCount || 0) + getLocalInterest(a.ProductID);
      const scoreB = (b.OrderCount || 0) + getLocalInterest(b.ProductID);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.DisplayOrder - a.DisplayOrder;
    }
    
    // Featured / default is DisplayOrder (ascending, lowest first)
    return a.DisplayOrder - b.DisplayOrder;
  });

  renderCatalog(filtered);
}

/**
 * Render catalog list & pagination UI
 */
function renderCatalog(productList) {
  const container = document.getElementById('catalog-grid');
  const countDisplay = document.getElementById('catalog-count');
  
  if (productList.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <svg class="empty-state__icon" viewBox="0 0 24 24">
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <h3 class="empty-state__title">No Matches Found</h3>
        <p class="empty-state__desc">Try checking your spelling, resetting filters, or searching for other items.</p>
        <button class="btn btn-primary" onclick="clearAllFilters()">Clear All Filters</button>
      </div>
    `;
    if (countDisplay) countDisplay.textContent = 'Showing 0 products';
    renderPagination(0);
    return;
  }

  // Calculate pagination indices
  const totalItems = productList.length;
  const totalPages = Math.ceil(totalItems / state.itemsPerPage);
  
  // Guard page range
  if (state.page > totalPages) state.page = totalPages;
  if (state.page < 1) state.page = 1;

  const startIdx = (state.page - 1) * state.itemsPerPage;
  const endIdx = Math.min(startIdx + state.itemsPerPage, totalItems);
  
  if (countDisplay) {
    countDisplay.textContent = `Showing ${startIdx + 1}-${endIdx} of ${totalItems} products`;
  }

  const paginatedProducts = productList.slice(startIdx, endIdx);

  container.innerHTML = '';
  paginatedProducts.forEach(product => {
    const card = ProductCard.create(product, { isLink: true, showAddToCart: true });
    container.appendChild(card);
  });

  renderPagination(totalPages);
}

/**
 * Draw page numbering controls
 */
function renderPagination(totalPages) {
  const container = document.getElementById('pagination');
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';

  // Prev button
  html += `<button class="pagination__btn pagination__btn--text" ${state.page === 1 ? 'disabled' : ''} onclick="changePage(${state.page - 1})">&larr; Prev</button>`;

  // Page Numbers
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="pagination__btn ${state.page === i ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
  }

  // Next button
  html += `<button class="pagination__btn pagination__btn--text" ${state.page === totalPages ? 'disabled' : ''} onclick="changePage(${state.page + 1})">Next &rarr;</button>`;

  container.innerHTML = html;
}

window.changePage = function(pageNumber) {
  state.page = pageNumber;
  updateUrl();
  applyFiltersAndRender();
  // Scroll to top of catalog
  document.getElementById('catalog-header').scrollIntoView({ behavior: 'smooth' });
};


