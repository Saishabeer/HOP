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
    const isVerified = await verifyAdminToken(adminToken);
    
    if (!isVerified) {
      console.warn('[Admin Mode] Invalid session token. Admin mode disabled.');
      sessionStorage.removeItem('admin_token');
      return;
    }

    console.log('[Admin Mode] Session verified. Enabling inline admin features.');
    enableAdminUI();
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
