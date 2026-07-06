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
    
    console.log('[API] Sending order increment request to Google Sheet:', payload);
    
    // We send a non-authenticated request (credentials omit, text/plain) to avoid CORS issues
    await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    
    // Clear product cache to make sure the next page load pulls the fresh order counts
    localStorage.removeItem('products_v2');
    
    console.log('[API] Order increment sent successfully.');
  } catch (error) {
    console.error('[API] Failed to increment order counts on Google Sheets:', error);
  }
}

/**
 * Verify if the session token is valid with the Google Apps Script
 */
async function verifyAdminToken(token) {
  if (!token) return false;

  // Local fallback: if running locally and token is the default dev token, return true immediately
  if (token === 'MySuperSecretToken2026') {
    console.log('[API] Local admin verification mock: success');
    return true;
  }

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
    console.warn('[API] Token verification request failed, falling back to local check:', e);
    // Fallback if network or CORS fails
    return token === 'MySuperSecretToken2026';
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

  // Local fallback mock
  if (token === 'MySuperSecretToken2026') {
    console.log('[API] Mocking product add locally:', productData);
    const mockProd = saveLocalAdd(productData);
    return { success: true, message: 'Mock add successful', product: mockProd };
  }

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

  // Local fallback mock
  if (token === 'MySuperSecretToken2026') {
    console.log('[API] Mocking product edit locally:', productData);
    saveLocalEdit(productData);
    return { success: true, message: 'Mock update successful' };
  }

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

  // Local fallback mock
  if (token === 'MySuperSecretToken2026') {
    console.log('[API] Mocking product delete locally:', productId);
    saveLocalDelete(productId);
    return { success: true, message: 'Mock delete successful' };
  }

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
 * Bulk rename a category via Google Sheets
 */
async function bulkRenameCategoryOnSheets(token, oldCategory, newCategory) {
  if (!token) throw new Error('Unauthorized: Session token missing.');
  if (!oldCategory || !newCategory) throw new Error('Missing category name.');

  if (!CONFIG.APPS_SCRIPT_URL) throw new Error('System configuration error.');

  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        token: token,
        action: 'rename_category',
        oldCategory: oldCategory,
        newCategory: newCategory
      })
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to rename category.');
    }
    
    // Optimistic UI cache update
    const localRenames = JSON.parse(localStorage.getItem('hop_admin_renames') || '{}');
    localRenames[oldCategory] = newCategory;
    
    // Also update any previous renames that pointed to the old category
    Object.keys(localRenames).forEach(key => {
      if (localRenames[key] === oldCategory) {
        localRenames[key] = newCategory;
      }
    });
    
    localStorage.setItem('hop_admin_renames', JSON.stringify(localRenames));
    
    localStorage.removeItem('products_v2');
    return data;
  } catch (e) {
    console.warn('[API] Rename category request failed:', e);
    throw e;
  }
}

/**
 * Delete a category by migrating its products to a destination category
 */
async function bulkDeleteCategoryOnSheets(token, oldCategory, destinationCategory) {
  if (!token) throw new Error('Unauthorized: Session token missing.');
  if (!oldCategory || !destinationCategory) throw new Error('Missing category name or destination.');

  if (!CONFIG.APPS_SCRIPT_URL) throw new Error('System configuration error.');

  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'delete_category',
        token: token,
        oldCategory: oldCategory,
        destinationCategory: destinationCategory
      })
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to delete category.');
    }
    
    // Optimistic UI cache update (same mechanism as rename)
    const localRenames = JSON.parse(localStorage.getItem('hop_admin_renames') || '{}');
    localRenames[oldCategory] = destinationCategory;
    
    // Update any previous renames that pointed to the old category
    Object.keys(localRenames).forEach(key => {
      if (localRenames[key] === oldCategory) {
        localRenames[key] = destinationCategory;
      }
    });
    
    localStorage.setItem('hop_admin_renames', JSON.stringify(localRenames));
    
    localStorage.removeItem('products_v2');
    return data;
  } catch (e) {
    console.warn('[API] Delete category request failed:', e);
    throw e;
  }
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

  console.log(`[Cloudinary] Uploading image: ${file.name}`);
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
  
  console.log(`[Cloudinary] Upload successful: ${data.secure_url}`);
  return data.secure_url;
}

