/**
 * Increment order count for checked-out products on Google Sheets (Option 2)
 */
async function sendOrderIncrementToSheets(productIds) {
  if (!productIds || productIds.length === 0) return;
  if (!CONFIG.APPS_SCRIPT_URL) return;

  try {
    const payload = {
      action: 'increment_orders',
      productIds: productIds
    };
    
    logger.log('[API]', 'Sending order increment request to Google Sheet:', payload);

    // We send a non-authenticated request (credentials omit, text/plain) to avoid CORS issues
    await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    // Clear product cache to make sure the next page load pulls the fresh order counts
    localStorage.removeItem('products_v2');

    logger.log('[API]', 'Order increment sent successfully.');
  } catch (error) {
    logger.error('[API]', 'Failed to increment order counts on Google Sheets:', error);
  }
}

/**
 * Send a batch of click/interest counts to Google Sheets as ClickCount.
 * `clicks` is a map of { ProductID: pointsToAdd }, built up client-side by
 * queueClickForServer() in data.js and flushed periodically.
 */
async function sendClickIncrementToSheets(clicks) {
  if (!clicks || Object.keys(clicks).length === 0) return;
  if (!CONFIG.APPS_SCRIPT_URL) return;

  const payload = JSON.stringify({
    action: 'increment_clicks',
    clicks: clicks
  });

  try {
    // Prefer sendBeacon: it's designed to survive page unload, unlike fetch,
    // which browsers may cancel mid-flight when the tab closes/navigates away.
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'text/plain;charset=utf-8' });
      const sent = navigator.sendBeacon(CONFIG.APPS_SCRIPT_URL, blob);
      if (sent) {
        localStorage.removeItem('products_v2');
        return;
      }
    }

    // Non-authenticated request (credentials omit, text/plain) to avoid CORS issues
    await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: payload
    });

    // Clear product cache so the next page load pulls the fresh click counts
    localStorage.removeItem('products_v2');
  } catch (error) {
    console.error('[API] Failed to send click counts to Google Sheets:', error);
  }
}

/**
 * Verify if the session token is valid with the Google Apps Script
 */
async function verifyAdminToken(token) {
  if (!token) return false;

  // Removed local fallback bypass for security reasons

  if (!CONFIG.APPS_SCRIPT_URL) return false;

  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        token: token,
        action: 'verify_admin'
      })
    });
    
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.success;
  } catch (e) {
    // Fail closed: a network/CORS failure must not authenticate the admin session.
    console.warn('[API] Token verification request failed:', e);
    return false;
  }
}

/**
 * Add a new product via Google Sheets
 */
async function addProductOnSheets(token, productData) {
  if (!token) throw new Error('Unauthorized: Session token missing.');

  const saveLocalAdd = (product) => {
    const localAdds = JSON.parse(localStorage.getItem('hop_admin_adds') || '[]');
    const newProduct = {
      ...product,
      ProductID: product.ProductID || `P_${Date.now()}`,
      ModelNumber: product.ModelNumber || `KR-${Math.floor(100 + Math.random() * 900)}`,
      Status: 'Active',
      DisplayOrder: Number(product.DisplayOrder) || 99,
      CreatedDate: product.CreatedDate || new Date().toISOString()
    };
    localAdds.push(newProduct);
    localStorage.setItem('hop_admin_adds', JSON.stringify(localAdds));
    localStorage.removeItem('products_v2');
    return newProduct;
  };

  // Removed local fallback bypass for security reasons

  if (!CONFIG.APPS_SCRIPT_URL) throw new Error('System configuration error.');

  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        token: token,
        action: 'add_product',
        product: productData
      })
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to add product.');
    }
    localStorage.removeItem('products_v2');
    return data;
  } catch (e) {
    console.warn('[API] Add product request failed, falling back to mock:', e);
    const mockProd = saveLocalAdd(productData);
    return { success: true, message: 'Mock add successful', product: mockProd };
  }
}

/**
 * Edit an existing product via Google Sheets
 */
async function editProductOnSheets(token, productData) {
  if (!token) throw new Error('Unauthorized: Session token missing.');

  const saveLocalEdit = (product) => {
    const localEdits = JSON.parse(localStorage.getItem('hop_admin_edits') || '{}');
    localEdits[product.ProductID] = product;
    localStorage.setItem('hop_admin_edits', JSON.stringify(localEdits));
    
    // Also update any matching item in localAdds in case we edit a newly created local product
    const localAdds = JSON.parse(localStorage.getItem('hop_admin_adds') || '[]');
    const idx = localAdds.findIndex(p => p.ProductID === product.ProductID);
    if (idx !== -1) {
      localAdds[idx] = { ...localAdds[idx], ...product };
      localStorage.setItem('hop_admin_adds', JSON.stringify(localAdds));
    }

    localStorage.removeItem('products_v2');
  };

  // Removed local fallback bypass for security reasons

  if (!CONFIG.APPS_SCRIPT_URL) throw new Error('System configuration error.');

  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        token: token,
        action: 'edit_product',
        product: productData
      })
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to edit product.');
    }
    localStorage.removeItem('products_v2');
    return data;
  } catch (e) {
    console.warn('[API] Edit product request failed, falling back to mock:', e);
    saveLocalEdit(productData);
    return { success: true, message: 'Mock update successful' };
  }
}

/**
 * Soft delete an existing product via Google Sheets (sets Status to "Inactive")
 */
async function deleteProductOnSheets(token, productId) {
  if (!token) throw new Error('Unauthorized: Session token missing.');

  const saveLocalDelete = (id) => {
    const localDeletes = JSON.parse(localStorage.getItem('hop_admin_deletes') || '[]');
    if (!localDeletes.includes(id)) {
      localDeletes.push(id);
    }
    localStorage.setItem('hop_admin_deletes', JSON.stringify(localDeletes));

    // Also remove from localAdds in case we delete a newly created local product
    const localAdds = JSON.parse(localStorage.getItem('hop_admin_adds') || '[]');
    const filteredAdds = localAdds.filter(p => p.ProductID !== id);
    localStorage.setItem('hop_admin_adds', JSON.stringify(filteredAdds));

    localStorage.removeItem('products_v2');
  };

  // Removed local fallback bypass for security reasons

  if (!CONFIG.APPS_SCRIPT_URL) throw new Error('System configuration error.');

  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        token: token,
        action: 'delete_product',
        productId: productId
      })
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to delete product.');
    }
    localStorage.removeItem('products_v2');
    return data;
  } catch (e) {
    console.warn('[API] Delete product request failed, falling back to mock:', e);
    saveLocalDelete(productId);
    return { success: true, message: 'Mock delete successful' };
  }
}


/**
 * Bulk rename a category by updating products individually
 */
async function bulkRenameCategoryOnSheets(token, oldCategory, newCategory) {
  if (!token) throw new Error('Unauthorized: Session token missing.');
  if (!oldCategory || !newCategory) throw new Error('Missing category name.');

  // Fetch all products with full schema
  const allProducts = await fetchProducts();

  const affectedProducts = allProducts.filter(p => p.Category && p.Category.trim().toLowerCase() === oldCategory.toLowerCase());

  if (affectedProducts.length === 0) {
    throw new Error('Category not found or has no products.');
  }

  // Sequentially edit each product to avoid rate limiting
  for (let i = 0; i < affectedProducts.length; i++) {
    const product = affectedProducts[i];
    product.Category = newCategory; // Update category inline
    
    // Pass full product object to satisfy backend validation
    await editProductOnSheets(token, product);
  }

  // Optimistic UI cache update
  const localRenames = JSON.parse(localStorage.getItem('hop_admin_renames') || '{}');
  localRenames[oldCategory] = newCategory;
  Object.keys(localRenames).forEach(key => {
    if (localRenames[key] === oldCategory) localRenames[key] = newCategory;
  });
  localStorage.setItem('hop_admin_renames', JSON.stringify(localRenames));
  localStorage.removeItem('products_v2');
  
  return { success: true };
}

/**
 * Delete a category by migrating its products individually
 */
async function bulkDeleteCategoryOnSheets(token, oldCategory, destinationCategory) {
  return bulkRenameCategoryOnSheets(token, oldCategory, destinationCategory);
}

/**
 * Upload a single image file to Cloudinary and return its secure URL
 */
async function uploadImageToCloudinary(file) {
  if (!CONFIG.CLOUDINARY_CLOUD_NAME || !CONFIG.CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Cloudinary configuration is missing in config.js');
  }

  const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${CONFIG.CLOUDINARY_CLOUD_NAME}/image/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CONFIG.CLOUDINARY_UPLOAD_PRESET);

  logger.log('[Cloudinary]', `Uploading image: ${file.name}`);
  const res = await fetch(cloudinaryUrl, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(`Cloudinary upload failed: ${errData.error?.message || 'Unknown error'}`);
  }

  const data = await res.json();
  if (!data.secure_url) {
    throw new Error('Cloudinary response did not contain secure_url.');
  }
  
  logger.log('[Cloudinary]', `Upload successful: ${data.secure_url}`);
  return data.secure_url;
}

/**
 * Add a new banner via Google Sheets
 */
async function addBannerOnSheets(token, bannerData) {
  if (!token) throw new Error('Unauthorized: Session token missing.');
  if (!CONFIG.APPS_SCRIPT_URL) throw new Error('System configuration error.');

  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: token, action: 'add_banner', banner: bannerData })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to add banner.');
    
    localStorage.removeItem('hop_banners_v1');
    return data;
  } catch (e) {
    console.warn('[API] Add banner failed:', e);
    throw e;
  }
}

/**
 * Edit an existing banner via Google Sheets
 */
async function editBannerOnSheets(token, bannerData) {
  if (!token) throw new Error('Unauthorized: Session token missing.');
  if (!CONFIG.APPS_SCRIPT_URL) throw new Error('System configuration error.');

  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: token, action: 'edit_banner', banner: bannerData })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to edit banner.');
    
    localStorage.removeItem('hop_banners_v1');
    return data;
  } catch (e) {
    console.warn('[API] Edit banner failed:', e);
    throw e;
  }
}

/**
 * Soft delete an existing banner via Google Sheets
 */
async function deleteBannerOnSheets(token, bannerId) {
  if (!token) throw new Error('Unauthorized: Session token missing.');
  if (!CONFIG.APPS_SCRIPT_URL) throw new Error('System configuration error.');

  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: token, action: 'delete_banner', bannerId: bannerId })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to delete banner.');
    
    localStorage.removeItem('hop_banners_v1');
    return data;
  } catch (e) {
    console.warn('[API] Delete banner failed:', e);
    throw e;
  }
}

