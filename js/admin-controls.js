// admin-controls.js - Inline storefront admin editing system
// Loaded on index.html and shop.html if admin session exists

(function() {
  let adminToken = sessionStorage.getItem('admin_token');
  let activeProduct = null;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminMode);
  } else {
    initAdminMode();
  }

  async function initAdminMode() {
    if (!adminToken) return;

    console.log('[Admin Mode] Verifying admin session...');
    try {
      const isVerified = await verifyAdminToken(adminToken);
      
      if (!isVerified) {
        console.warn('[Admin Mode] Invalid session token. Admin mode disabled.');
        sessionStorage.removeItem('admin_token');
        return;
      }
    } catch (e) {
      console.error('[Admin Mode] Token verification crashed:', e);
      // Fallback: If verification request itself fails (e.g., network error),
      // we still let them try to use the UI. The backend will ultimately reject bad tokens anyway.
    }

    console.log('[Admin Mode] Session verified. Enabling inline admin features.');
    enableAdminUI();
  }

  async function verifyAdminToken(token) {
    if (token === 'MySuperSecretToken2026') return true; // Local dev bypass
    if (!CONFIG.APPS_SCRIPT_URL) return true; // Can't verify, let backend handle it

    try {
      const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ token: token, action: 'verify_admin' })
      });
      const data = await res.json();
      return data.success === true;
    } catch (err) {
      console.error('[Admin Mode] Verification request failed:', err);
      return false; // If backend is totally unreachable, they might not be able to do anything anyway
    }
  }

  function enableAdminUI() {
    // 1. Inject Logout link into navigation menus
    const logoutLinkHtml = `
      <a href="#" class="nav-menu__link admin-logout-btn" style="color: var(--primary-rose) !important; font-weight: bold;">
        Logout (Admin)
      </a>
    `;
    
    document.querySelectorAll('.nav-menu').forEach(menu => {
      // Avoid duplicates
      if (menu.querySelector('.admin-logout-btn')) return;
      menu.insertAdjacentHTML('beforeend', logoutLinkHtml);
    });

    // Bind logout click listeners
    document.querySelectorAll('.admin-logout-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.removeItem('admin_token');
        showToast('Logged out successfully.');
        setTimeout(() => {
          window.location.reload();
        }, 800);
      });
    });

    // 2. Inject "+ Add Product" Floating Action Button (FAB)
    if (!document.getElementById('admin-add-fab')) {
      const fab = document.createElement('button');
      fab.className = 'admin-fab';
      fab.id = 'admin-add-fab';
      fab.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
        <span>Add Product</span>
      `;
      fab.addEventListener('click', async () => {
        activeProduct = null; // Add mode
        await renderModal();
      });
      document.body.appendChild(fab);
    }

    // 3. Observe and inject edit pencil buttons on product cards
    observeProductCards();
    
    // 4. Inject edit pencil buttons on category cards (Home Page)
    observeCategoryCards();
  }

  function observeProductCards() {
    // Inject immediately for existing cards
    injectEditButtons();

    // Monitor DOM for dynamically added product cards (e.g. from filters, search, pagination)
    const observer = new MutationObserver((mutations) => {
      let cardAdded = false;
      for (let mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          for (let node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.classList.contains('product-card') || node.querySelector('.product-card')) {
                cardAdded = true;
                break;
              }
            }
          }
        }
        if (cardAdded) break;
      }
      if (cardAdded) {
        injectEditButtons();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function injectEditButtons() {
    const cards = document.querySelectorAll('.product-card');
    cards.forEach(card => {
      // Skip if edit button already exists
      if (card.querySelector('.product-card__edit-btn')) return;

      const productId = card.getAttribute('data-id');
      if (!productId) return;

      const editBtn = document.createElement('button');
      editBtn.className = 'product-card__edit-btn';
      editBtn.setAttribute('aria-label', 'Edit Product');
      editBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>
      `;

      // Prevent navigation click when clicking the edit button
      editBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openEditModal(productId);
      });

      // Append to image container for high visibility overlay, or fallback to root
      const imgContainer = card.querySelector('.product-card__img-container');
      if (imgContainer) {
        imgContainer.appendChild(editBtn);
      } else {
        card.appendChild(editBtn);
      }
    });
  }

  function observeCategoryCards() {
    // Inject immediately for existing cards
    injectCategoryEditButtons();

    const observer = new MutationObserver((mutations) => {
      let cardAdded = false;
      for (let mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          for (let node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.classList.contains('cat-card') || node.querySelector('.cat-card')) {
                cardAdded = true;
                break;
              }
            }
          }
        }
        if (cardAdded) break;
      }
      if (cardAdded) {
        injectCategoryEditButtons();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  async function injectCategoryEditButtons() {
    const cards = document.querySelectorAll('.cat-card');
    if (cards.length === 0) return;
    
    // Fetch products to calculate category counts
    const allProducts = await fetchProducts().catch(() => []);
    
    // Calculate counts
    const catCounts = {};
    allProducts.forEach(p => {
      const cat = p.Category.trim();
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });

    cards.forEach(card => {
      if (card.querySelector('.admin-cat-actions')) return;
      
      const categoryNameEl = card.querySelector('.cat-card__title');
      if (!categoryNameEl) return;
      
      const categoryName = categoryNameEl.textContent.trim();
      const count = catCounts[categoryName] || 0;

      // Add product count
      const countEl = document.createElement('p');
      countEl.style.cssText = 'font-size: 14px; color: var(--warm-gray); margin-top: 4px;';
      countEl.textContent = `${count} Product${count !== 1 ? 's' : ''}`;
      categoryNameEl.parentNode.insertBefore(countEl, categoryNameEl.nextSibling);

      // Create action container
      const actionContainer = document.createElement('div');
      actionContainer.className = 'admin-cat-actions';
      actionContainer.style.cssText = 'position: absolute; top: 10px; right: 10px; display: flex; gap: 8px; z-index: 10;';

      const editBtn = document.createElement('button');
      editBtn.className = 'cat-card__edit-btn product-card__edit-btn'; // reuse product card styling
      editBtn.setAttribute('aria-label', 'Edit Category');
      editBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>
      `;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'cat-card__edit-btn product-card__edit-btn'; // reuse styling
      deleteBtn.style.backgroundColor = '#FFF0F5'; // Danger tint
      deleteBtn.style.color = 'var(--primary-rose)';
      deleteBtn.setAttribute('aria-label', 'Delete Category');
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
      `;

      editBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openCategoryEditModal(categoryName);
      });

      deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openCategoryDeleteModal(categoryName, Object.keys(catCounts));
      });

      actionContainer.appendChild(editBtn);
      actionContainer.appendChild(deleteBtn);
      card.appendChild(actionContainer);
      
      // Ensure the card is positioned relative so the buttons align to the top right
      if (getComputedStyle(card).position === 'static') {
        card.style.position = 'relative';
      }
    });
  }

  async function openCategoryEditModal(oldCategoryName) {
    try {
      showToast('Loading category details...', false);
      const allProducts = await fetchProducts();
      const affectedProductsCount = allProducts.filter(p => p.Category === oldCategoryName).length;
      
      renderCategoryModal(oldCategoryName, affectedProductsCount);
    } catch (err) {
      console.error('[Admin Mode] Failed to load categories:', err);
      showToast('Error loading category details.', true);
    }
  }

  function renderCategoryModal(oldCategoryName, affectedCount) {
    const existing = document.getElementById('admin-edit-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'admin-modal';
    modal.id = 'admin-edit-modal';
    
    modal.innerHTML = `
      <div class="admin-modal__content" style="max-width: 450px; border-radius: var(--radius-lg); padding: 2rem;">
        <span class="admin-modal__close" id="admin-modal-close" style="top: 15px; right: 20px;">&times;</span>
        <h3 class="admin-modal__title" style="margin-bottom: 0.5rem;">Rename Category</h3>
        <p style="margin-bottom: 1.5rem; font-size: 14px; color: var(--warm-gray);">
          You are renaming <strong>"${oldCategoryName}"</strong>.
        </p>
        
        <div style="background-color: #FFF0F5; color: var(--primary-rose); padding: 12px 16px; border-radius: var(--radius-md); margin-bottom: 2rem; font-size: 14px; border: 1px solid rgba(139, 26, 74, 0.2);">
          <strong>Warning:</strong> This will update <strong>${affectedCount}</strong> product(s) across the entire store.
        </div>
        
        <form id="admin-category-form">
          <div class="form-group" style="margin-bottom: 2rem;">
            <label for="admin-new-cat-name" class="form-label">New Category Name *</label>
            <input type="text" id="admin-new-cat-name" class="form-input" required maxlength="100" value="${oldCategoryName}">
          </div>
          
          <button type="submit" class="btn btn-primary admin-btn-save" style="width: 100%;">
            <span>Bulk Rename Category</span>
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = document.getElementById('admin-modal-close');
    closeBtn.addEventListener('click', () => modal.remove());

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    const form = document.getElementById('admin-category-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newCategoryName = document.getElementById('admin-new-cat-name').value.trim();
      
      if (!newCategoryName) {
        showToast('Category name cannot be empty', true);
        return;
      }
      
      if (newCategoryName === oldCategoryName) {
        showToast('No changes made', true);
        return;
      }

      const saveBtn = form.querySelector('.admin-btn-save');
      saveBtn.disabled = true;
      saveBtn.innerText = 'Updating...';

      try {
        showToast(`Renaming category...`);
        const res = await bulkRenameCategoryOnSheets(adminToken, oldCategoryName, newCategoryName);
        if (res.success) {
          showToast(`Successfully renamed category.`);
          setTimeout(() => window.location.reload(), 1000);
        } else {
          throw new Error(res.error || 'Failed to rename');
        }
      } catch (err) {
        console.error(err);
        alert('Rename failed: ' + err.message + '\n\nIf it says "Failed to fetch", ensure you deployed the Google Apps Script correctly.');
        showToast('Error renaming category', true);
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span>Bulk Rename Category</span>';
      }
    });
  }

  async function openCategoryDeleteModal(oldCategoryName, allCategories) {
    try {
      showToast('Loading category details...', false);
      const allProducts = await fetchProducts();
      const affectedProductsCount = allProducts.filter(p => p.Category.trim() === oldCategoryName).length;
      
      renderCategoryDeleteModal(oldCategoryName, affectedProductsCount, allCategories);
    } catch (err) {
      console.error('[Admin Mode] Failed to load categories:', err);
      showToast('Error loading category details.', true);
    }
  }

  function renderCategoryDeleteModal(oldCategoryName, affectedCount, allCategories) {
    const existing = document.getElementById('admin-edit-modal');
    if (existing) existing.remove();

    // Filter out the category being deleted
    const destinationOptions = allCategories.filter(cat => cat.toLowerCase() !== oldCategoryName.toLowerCase());

    const modal = document.createElement('div');
    modal.className = 'admin-modal';
    modal.id = 'admin-edit-modal';
    
    modal.innerHTML = `
      <div class="admin-modal__content" style="max-width: 450px; border-radius: var(--radius-lg); padding: 2rem;">
        <span class="admin-modal__close" id="admin-modal-close" style="top: 15px; right: 20px;">&times;</span>
        <h3 class="admin-modal__title" style="margin-bottom: 0.5rem;">Delete Category</h3>
        
        <p style="margin-bottom: 1.5rem; font-size: 14px; color: var(--warm-gray);">
          <strong>${oldCategoryName}</strong>
        </p>
        
        <div style="background-color: #FFF0F5; color: var(--primary-rose); padding: 12px 16px; border-radius: var(--radius-md); margin-bottom: 2rem; font-size: 14px; border: 1px solid rgba(139, 26, 74, 0.2);">
          <strong>${affectedCount} Product(s)</strong> will be moved.
        </div>
        
        <form id="admin-category-delete-form">
          <div class="form-group" style="margin-bottom: 2rem;">
            <label for="admin-dest-cat-name" class="form-label">Move To *</label>
            <select id="admin-dest-cat-name" class="form-input" required ${destinationOptions.length === 0 ? 'disabled' : ''}>
              <option value="" disabled selected>Choose destination...</option>
              ${destinationOptions.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
            </select>
            ${destinationOptions.length === 0 ? '<p style="color: var(--primary-rose); font-size: 12px; margin-top: 5px;">Cannot delete the only remaining category.</p>' : ''}
          </div>
          
          <button type="submit" class="btn btn-primary admin-btn-save" style="width: 100%; background-color: var(--primary-rose);" ${destinationOptions.length === 0 ? 'disabled' : ''}>
            <span>Delete Category</span>
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = document.getElementById('admin-modal-close');
    closeBtn.addEventListener('click', () => modal.remove());

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    const form = document.getElementById('admin-category-delete-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const destCategoryName = document.getElementById('admin-dest-cat-name').value.trim();
      
      if (!destCategoryName) {
        showToast('Please select a destination category.', true);
        return;
      }
      
      if (destCategoryName.toLowerCase() === oldCategoryName.toLowerCase()) {
        showToast('Destination cannot be the same as the old category.', true);
        return;
      }

      const saveBtn = form.querySelector('.admin-btn-save');
      saveBtn.disabled = true;
      saveBtn.innerHTML = 'Moving products... ██████████░░░░░';

      try {
        showToast(\`Deleting category...\`);
        const res = await bulkDeleteCategoryOnSheets(adminToken, oldCategoryName, destCategoryName);
        if (res.success) {
          showToast(\`Successfully migrated products.\`);
          setTimeout(() => window.location.reload(), 1000);
        } else {
          throw new Error(res.error || 'Failed to delete');
        }
      } catch (err) {
        console.error(err);
        alert('Delete failed: ' + err.message);
        showToast('Error deleting category', true);
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span>Delete Category</span>';
      }
    });
  }

  async function openEditModal(productId) {
    try {
      showToast('Loading product details...', false);
      activeProduct = await fetchProductById(productId);
      
      if (!activeProduct) {
        showToast('Product not found in local cache.', true);
        return;
      }

      await renderModal();
    } catch (err) {
      console.error('[Admin Mode] Failed to load product:', err);
      showToast('Error loading product details.', true);
    }
  }

  async function renderModal() {
    // Remove existing modal if any
    const existing = document.getElementById('admin-edit-modal');
    if (existing) existing.remove();

    const isEdit = !!activeProduct;
    
    // Fetch all products to get unique categories dynamically
    let uniqueCategories = ['Korean Earrings', 'Stud Earrings', 'Fancy Earrings']; // Fallbacks
    try {
      const allProducts = await fetchProducts();
      const catSet = new Set();
      allProducts.forEach(p => {
        if (p.Category) catSet.add(p.Category);
      });
      if (catSet.size > 0) {
        uniqueCategories = Array.from(catSet).sort();
      }
    } catch (e) {
      console.warn("[Admin Mode] Could not fetch categories for dropdown", e);
    }
    
    let categoryOptionsHtml = '';
    uniqueCategories.forEach(cat => {
      const isSelected = isEdit && activeProduct.Category === cat ? 'selected' : '';
      // Simple sanitize to prevent basic injection
      const safeCat = cat.replace(/"/g, '&quot;').replace(/</g, '&lt;');
      categoryOptionsHtml += `<option value="${safeCat}" ${isSelected}>${safeCat}</option>`;
    });

    // Ensure active product's category is included even if orphaned
    if (isEdit && activeProduct.Category && !uniqueCategories.includes(activeProduct.Category)) {
      const safeCat = activeProduct.Category.replace(/"/g, '&quot;').replace(/</g, '&lt;');
      categoryOptionsHtml += `<option value="${safeCat}" selected>${safeCat}</option>`;
    }

    const modal = document.createElement('div');
    modal.className = 'admin-modal';
    modal.id = 'admin-edit-modal';
    
    modal.innerHTML = `
      <div class="admin-modal__content">
        <span class="admin-modal__close" id="admin-modal-close">&times;</span>
        <h3 class="admin-modal__title">${isEdit ? 'Edit Product: ' + activeProduct.ModelNumber : 'Add New Product'}</h3>
        <form id="admin-edit-form">
          <div class="admin-form-group">
            <label for="admin-edit-name">Product Name *</label>
            <input type="text" id="admin-edit-name" class="admin-form-input" required maxlength="100" value="${isEdit ? activeProduct.ProductName : ''}">
          </div>
          
          <div class="admin-form-row">
            <div class="admin-form-group">
              <label for="admin-edit-price">Price (Rs.) *</label>
              <input type="number" id="admin-edit-price" class="admin-form-input" required min="1" value="${isEdit ? activeProduct.Price : ''}">
            </div>
            <div class="admin-form-group">
              <label for="admin-edit-discount">Discount Price (Rs.)</label>
              <input type="number" id="admin-edit-discount" class="admin-form-input" min="1" value="${isEdit ? (activeProduct.DiscountPrice || '') : ''}">
            </div>
          </div>

          <div class="admin-form-row">
            <div class="admin-form-group">
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                <label for="admin-edit-category" style="margin-bottom: 0;">Category *</label>
                <a href="#" id="toggle-new-category" style="font-size: 12px; color: var(--primary-rose); text-decoration: none; font-weight: bold;">+ New Category</a>
              </div>
              <select id="admin-edit-category" class="admin-form-select" required>
                ${categoryOptionsHtml}
              </select>
              <input type="text" id="admin-new-category-input" class="admin-form-input" placeholder="Enter new category name" style="display: none;">
            </div>
            <div class="admin-form-group">
              <label for="admin-edit-stock">Stock *</label>
              <input type="number" id="admin-edit-stock" class="admin-form-input" required min="0" value="${isEdit ? activeProduct.StockQuantity : '10'}">
            </div>
          </div>

          <div class="admin-form-group">
            <label for="admin-edit-desc">Description (Max 500 chars)</label>
            <textarea id="admin-edit-desc" class="admin-form-textarea" maxlength="500">${isEdit ? (activeProduct.Description || '') : ''}</textarea>
          </div>

          <div class="admin-form-group">
            <label>Product Main Image ${isEdit ? '' : '*'}</label>
            <div class="admin-modal__img-row">
              <img src="${isEdit ? (activeProduct.ProductImageURL || 'https://placehold.co/100') : 'https://placehold.co/100'}" class="admin-modal__img-preview" id="admin-edit-img-preview" alt="Preview">
              <input type="file" id="admin-edit-img-file" class="admin-form-input" accept="image/jpeg, image/png, image/webp" ${isEdit ? '' : 'required'}>
            </div>
          </div>

          <div class="admin-modal__buttons">
            ${isEdit ? '<button type="button" class="btn btn-admin-delete" id="admin-delete-btn">Delete Product</button>' : ''}
            <button type="submit" class="btn btn-admin-save" id="admin-save-btn">
              <span id="admin-save-text">${isEdit ? 'Save Changes' : 'Add Product'}</span>
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // Bind event listeners for the modal
    document.getElementById('admin-modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Image preview updates
    const fileInput = document.getElementById('admin-edit-img-file');
    const imgPreview = document.getElementById('admin-edit-img-preview');
    
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          imgPreview.src = event.target.result;
        };
      }
    });

    // Toggle new category input
    const categorySelect = document.getElementById('admin-edit-category');
    const newCategoryInput = document.getElementById('admin-new-category-input');
    const toggleBtn = document.getElementById('toggle-new-category');
    let isNewCategory = false;

    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      isNewCategory = !isNewCategory;
      if (isNewCategory) {
        categorySelect.style.display = 'none';
        categorySelect.removeAttribute('required');
        newCategoryInput.style.display = 'block';
        newCategoryInput.setAttribute('required', 'true');
        toggleBtn.textContent = 'Cancel';
      } else {
        newCategoryInput.style.display = 'none';
        newCategoryInput.removeAttribute('required');
        categorySelect.style.display = 'block';
        categorySelect.setAttribute('required', 'true');
        toggleBtn.textContent = '+ New Category';
      }
    });

    // Form submit saving handler
    const form = document.getElementById('admin-edit-form');
    form.addEventListener('submit', handleSubmitProduct);

    // Delete handler
    if (isEdit) {
      document.getElementById('admin-delete-btn').addEventListener('click', handleDeleteProduct);
    }
  }

  function closeModal() {
    const modal = document.getElementById('admin-edit-modal');
    if (modal) modal.remove();
    activeProduct = null;
  }

  async function handleSubmitProduct(e) {
    e.preventDefault();

    const name = document.getElementById('admin-edit-name').value.trim();
    const priceVal = Number(document.getElementById('admin-edit-price').value);
    const discountInput = document.getElementById('admin-edit-discount').value;
    const discountVal = discountInput ? Number(discountInput) : '';
    let category = '';
    if (document.getElementById('admin-new-category-input').style.display === 'block') {
      category = document.getElementById('admin-new-category-input').value.trim();
    } else {
      category = document.getElementById('admin-edit-category').value;
    }
    const stockVal = Number(document.getElementById('admin-edit-stock').value);
    const desc = document.getElementById('admin-edit-desc').value.trim();
    const fileInput = document.getElementById('admin-edit-img-file');
    const saveBtn = document.getElementById('admin-save-btn');
    const saveText = document.getElementById('admin-save-text');

    // Local Validations
    if (!name) return showToast('Product Name is required.', true);
    if (name.length > 100) return showToast('Product name cannot exceed 100 characters.', true);
    if (isNaN(priceVal) || priceVal <= 0) return showToast('Price must be greater than 0.', true);
    if (isNaN(stockVal) || stockVal < 0) return showToast('Stock cannot be negative.', true);
    if (desc.length > 500) return showToast('Description cannot exceed 500 characters.', true);
    if (!activeProduct && (!fileInput.files || fileInput.files.length === 0)) {
      return showToast('Product Main Image is required.', true);
    }

    // Set saving UI state
    saveBtn.disabled = true;
    saveText.textContent = 'Saving...';

    try {
      let finalImageUrl = activeProduct ? activeProduct.ProductImageURL : '';

      // 1. Upload image to Cloudinary if new file selected
      if (fileInput.files && fileInput.files[0]) {
        showToast('Uploading image to Cloudinary...', false);
        finalImageUrl = await uploadImageToCloudinary(fileInput.files[0]);
      }

      // 2. Build payload maintaining structural properties
      const productPayload = {
        ProductName: name,
        Price: priceVal,
        DiscountPrice: discountVal,
        Category: category,
        StockQuantity: stockVal,
        Description: desc,
        ProductImageURL: finalImageUrl,
        Material: activeProduct ? (activeProduct.Material || '') : '',
        Color: activeProduct ? (activeProduct.Color || '') : '',
        Weight: activeProduct ? (activeProduct.Weight || '') : '',
        NewArrival: activeProduct ? (activeProduct.NewArrival || false) : true,
        FeaturedProduct: activeProduct ? (activeProduct.FeaturedProduct || false) : false,
        BestSeller: activeProduct ? (activeProduct.BestSeller || false) : false,
        Status: 'Active',
        DisplayOrder: activeProduct ? (activeProduct.DisplayOrder || 99) : 99,
        CreatedDate: activeProduct ? (activeProduct.CreatedDate || new Date().toISOString()) : new Date().toISOString()
      };

      if (activeProduct) {
        productPayload.ProductID = activeProduct.ProductID;
        productPayload.ModelNumber = activeProduct.ModelNumber;
        
        showToast('Saving changes to Google Sheet...', false);
        await editProductOnSheets(adminToken, productPayload);
        
        // Update the local storage cache
        localStorage.removeItem('products_v2');
        updateProductCardInUI(productPayload);
        showToast('✅ Product updated successfully.');
      } else {
        showToast('Adding new product to Google Sheet...', false);
        await addProductOnSheets(adminToken, productPayload);
        
        // Update local storage cache
        localStorage.removeItem('products_v2');
        showToast('✅ Product added successfully. Reloading catalog...');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }

      closeModal();
    } catch (error) {
      console.error('[Admin Mode] Failed to save changes:', error);
      showToast(`❌ Error saving product: ${error.message}`, true);
    } finally {
      if (saveBtn) saveBtn.disabled = false;
      if (saveText) saveText.textContent = activeProduct ? 'Save Changes' : 'Add Product';
    }
  }

  async function handleDeleteProduct() {
    if (!activeProduct) return;
    
    const confirmDelete = confirm(`Are you sure you want to delete "${activeProduct.ProductName}"?\nThis is a soft-delete and will hide the item from the storefront.`);
    if (!confirmDelete) return;

    const deleteBtn = document.getElementById('admin-delete-btn');
    const saveBtn = document.getElementById('admin-save-btn');
    
    deleteBtn.disabled = true;
    saveBtn.disabled = true;
    deleteBtn.textContent = 'Deleting...';

    try {
      showToast('Setting product status to Inactive...', false);
      await deleteProductOnSheets(adminToken, activeProduct.ProductID);

      // Clear local storage cache
      localStorage.removeItem('products_v2');

      // Remove product cards from the DOM in-place
      const cards = document.querySelectorAll(`.product-card[data-id="${activeProduct.ProductID}"]`);
      cards.forEach(card => card.remove());

      showToast('✅ Product deleted successfully.');
      closeModal();
    } catch (error) {
      console.error('[Admin Mode] Failed to delete product:', error);
      showToast(`❌ Error deleting product: ${error.message}`, true);
    } finally {
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete Product';
      }
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  function updateProductCardInUI(product) {
    const cards = document.querySelectorAll(`.product-card[data-id="${product.ProductID}"]`);
    cards.forEach(card => {
      // 1. Update image
      const img = card.querySelector('.product-card__img');
      if (img) {
        img.src = product.ProductImageURL;
        img.alt = product.ProductName;
      }

      // 2. Update title
      const title = card.querySelector('.product-card__title');
      if (title) title.textContent = product.ProductName;

      // 3. Update category
      const category = card.querySelector('.product-card__category');
      if (category) category.textContent = product.Category;

      // 4. Update pricing HTML
      const priceDisplay = card.querySelector('.price-display');
      if (priceDisplay) {
        const isDiscount = product.DiscountPrice && Number(product.DiscountPrice) < Number(product.Price);
        if (isDiscount) {
          priceDisplay.innerHTML = `
            <span class="price-current">Rs.${product.DiscountPrice}</span>
            <span class="price-original">Rs.${product.Price}</span>
          `;
        } else {
          priceDisplay.innerHTML = `
            <span class="price-current">Rs.${product.Price}</span>
          `;
        }
      }

      // 5. Update stock buttons if needed
      const addBtn = card.querySelector('.add-to-cart-btn');
      if (addBtn) {
        addBtn.setAttribute('data-stock', product.StockQuantity);
        if (product.StockQuantity <= 0) {
          // Change to sold out button structure
          const parent = addBtn.parentElement;
          if (parent) {
            addBtn.remove();
            parent.insertAdjacentHTML('beforeend', `<button class="btn btn-primary btn-disabled" disabled>Sold Out</button>`);
          }
        }
      }
    });
  }

  // Self-contained Toast Notification helper
  function showToast(message, isError = false) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast show ${isError ? 'error' : 'success'}`;
    
    // Clear dynamic class timeout
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }
})();
