// Google Apps Script - Web App for House of Prime Database
// Deployed as: "Execute as Me", "Who has access: Anyone"
//
// NOTE: Apps Script does not support doOptions() or ContentService.setHeader().
// CORS is not needed here — the client sends POST with Content-Type: text/plain
// which avoids CORS preflight entirely. Do NOT add doOptions back.

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // 1. Handle Public Orders Increment - No auth token required for checkout clicks
    if (data.action === 'increment_orders') {
      return handleIncrementOrders(data.productIds);
    }

    // 1b. Handle Public Click Tracking - No auth token required, drives "most clicked" popularity
    if (data.action === 'increment_clicks') {
      return handleIncrementClicks(data.clicks);
    }

    // 2. Authenticate Request for Admin actions
    // No hardcoded fallback: if the AUTH_TOKEN Script Property isn't set, every
    // admin request is rejected rather than silently trusting a public default.
    var AUTH_TOKEN = PropertiesService.getScriptProperties().getProperty('AUTH_TOKEN');

    if (!AUTH_TOKEN || data.token !== AUTH_TOKEN) {
      return buildResponse(401, { error: 'Unauthorized' });
    }

    // 3. Dispatch Admin Actions
    if (data.action === 'verify_admin') {
      return buildResponse(200, { success: true });
    }

    if (data.action === 'edit_product') {
      return handleEditProduct(data.product);
    }

    if (data.action === 'delete_product') {
      return handleDeleteProduct(data.productId);
    }

    if (data.action === 'rename_category') {
      return handleRenameCategory(data.oldCategory, data.newCategory);
    }

    if (data.action === 'delete_category') {
      return handleDeleteCategory(data.oldCategory, data.destinationCategory);
    }

    // --- Banner Actions ---
    if (data.action === 'add_banner') {
      return handleAddBanner(data.banner);
    }
    if (data.action === 'edit_banner') {
      return handleEditBanner(data.banner);
    }
    if (data.action === 'delete_banner') {
      return handleDeleteBanner(data.bannerId);
    }

    // Default action: Add Product
    return handleAddProduct(data.product);

  } catch (error) {
    return buildResponse(500, { error: error.toString() });
  }
}

/**
 * Validate product input fields on the server side to protect data integrity.
 */
function validateProductData(product) {
  if (!product) {
    return 'Missing product data';
  }

  // Name validation
  if (!product.ProductName || typeof product.ProductName !== 'string' || product.ProductName.trim() === '') {
    return 'Product Name is required';
  }
  if (product.ProductName.length > 100) {
    return 'Product Name must not exceed 100 characters';
  }

  // Price validation
  var price = Number(product.Price);
  if (isNaN(price) || price <= 0) {
    return 'Price must be a valid number greater than 0';
  }

  // Stock Quantity validation
  var stock = Number(product.StockQuantity);
  if (isNaN(stock) || stock < 0) {
    return 'Stock Quantity must be a valid non-negative number';
  }

  // Description length validation
  if (product.Description && typeof product.Description === 'string' && product.Description.length > 500) {
    return 'Description must not exceed 500 characters';
  }

  return null; // Passes validation
}

/**
 * Add a new product to the bottom of the Sheet
 */
function handleAddProduct(product) {
  try {
    var validationError = validateProductData(product);
    if (validationError) {
      return buildResponse(400, { error: 'Validation failed: ' + validationError });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var lastRow = sheet.getLastRow();
    var newIdNumber = 1;
    
    if (lastRow > 1) {
      var lastIdStr = sheet.getRange(lastRow, 1).getValue();
      if (lastIdStr && lastIdStr.startsWith('P')) {
        var match = lastIdStr.match(/P(\d+)/);
        if (match) {
          newIdNumber = parseInt(match[1], 10) + 1;
        }
      }
    }
    var ProductID = 'P' + ('00000' + newIdNumber).slice(-5);
    var ModelNumber = product.ModelNumber || ('KR-' + ('000' + newIdNumber).slice(-3));

    // Build row matching data/products.json schema
    var newRow = [
      ProductID,                              // A: ProductID
      ModelNumber,                            // B: ModelNumber
      product.ProductName.trim(),             // C: ProductName
      product.Category || 'Korean Earrings',  // D: Category
      product.Description ? product.Description.trim() : '', // E: Description
      Number(product.Price),                  // F: Price
      product.DiscountPrice ? Number(product.DiscountPrice) : '', // G: DiscountPrice
      Number(product.StockQuantity),          // H: StockQuantity
      product.ProductImageURL || '',          // I: ProductImageURL
      product.AdditionalImage1 || '',         // J: AdditionalImage1
      product.AdditionalImage2 || '',         // K: AdditionalImage2
      product.AdditionalImage3 || '',         // L: AdditionalImage3
      product.Material ? product.Material.trim() : '', // M: Material
      product.Color ? product.Color.trim() : '',       // N: Color
      product.Weight ? product.Weight.trim() : '',     // O: Weight
      !!product.NewArrival,                   // P: NewArrival
      !!product.FeaturedProduct,              // Q: FeaturedProduct
      !!product.BestSeller,                   // R: BestSeller
      'Active',                               // S: Status
      product.DisplayOrder ? Number(product.DisplayOrder) : 99, // T: DisplayOrder
      new Date().toISOString().split('T')[0], // U: CreatedDate
      0,                                      // V: OrderCount (starts at 0)
      0                                       // W: ClickCount (starts at 0)
    ];

    sheet.appendRow(newRow);

    return buildResponse(200, { 
      success: true, 
      message: 'Product added successfully',
      productId: ProductID,
      modelNumber: ModelNumber
    });
  } catch (error) {
    return buildResponse(500, { error: error.toString() });
  }
}

/**
 * Locate product by ID and edit its columns
 */
function handleEditProduct(product) {
  try {
    if (!product || !product.ProductID) {
      return buildResponse(400, { error: 'Missing product ID for edit' });
    }

    var validationError = validateProductData(product);
    if (validationError) {
      return buildResponse(400, { error: 'Validation failed: ' + validationError });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return buildResponse(404, { error: 'No products in database' });
    }

    var productIdsRange = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    var foundRow = -1;

    for (var i = 0; i < productIdsRange.length; i++) {
      if (productIdsRange[i][0] === product.ProductID) {
        foundRow = i + 2; // Offset for header (1-indexed and header row)
        break;
      }
    }

    if (foundRow === -1) {
      return buildResponse(404, { error: 'Product not found: ' + product.ProductID });
    }

    // Set updated values in matching columns
    sheet.getRange(foundRow, 3).setValue(product.ProductName.trim());
    sheet.getRange(foundRow, 4).setValue(product.Category || 'Korean Earrings');
    sheet.getRange(foundRow, 5).setValue(product.Description ? product.Description.trim() : '');
    sheet.getRange(foundRow, 6).setValue(Number(product.Price));
    sheet.getRange(foundRow, 7).setValue(product.DiscountPrice ? Number(product.DiscountPrice) : '');
    sheet.getRange(foundRow, 8).setValue(Number(product.StockQuantity));
    sheet.getRange(foundRow, 9).setValue(product.ProductImageURL || '');

    if (product.AdditionalImage1 !== undefined) sheet.getRange(foundRow, 10).setValue(product.AdditionalImage1 || '');
    if (product.AdditionalImage2 !== undefined) sheet.getRange(foundRow, 11).setValue(product.AdditionalImage2 || '');
    if (product.AdditionalImage3 !== undefined) sheet.getRange(foundRow, 12).setValue(product.AdditionalImage3 || '');

    if (product.Material !== undefined) sheet.getRange(foundRow, 13).setValue(product.Material.trim());
    if (product.Color !== undefined) sheet.getRange(foundRow, 14).setValue(product.Color.trim());
    if (product.Weight !== undefined) sheet.getRange(foundRow, 15).setValue(product.Weight.trim());
    
    sheet.getRange(foundRow, 16).setValue(!!product.NewArrival);
    sheet.getRange(foundRow, 17).setValue(!!product.FeaturedProduct);
    sheet.getRange(foundRow, 18).setValue(!!product.BestSeller);
    
    if (product.Status !== undefined) {
      sheet.getRange(foundRow, 19).setValue(product.Status);
    }
    
    if (product.DisplayOrder !== undefined) {
      sheet.getRange(foundRow, 20).setValue(product.DisplayOrder === '' ? 99 : Number(product.DisplayOrder));
    }

    return buildResponse(200, { success: true, message: 'Product updated successfully' });
  } catch (error) {
    return buildResponse(500, { error: error.toString() });
  }
}

/**
 * Locate product by ID and soft delete it (set Status = "Inactive")
 */
function handleDeleteProduct(productId) {
  try {
    if (!productId) {
      return buildResponse(400, { error: 'Missing product ID for delete' });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return buildResponse(404, { error: 'No products in database' });
    }

    var productIdsRange = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    var foundRow = -1;

    for (var i = 0; i < productIdsRange.length; i++) {
      if (productIdsRange[i][0] === productId) {
        foundRow = i + 2;
        break;
      }
    }

    if (foundRow === -1) {
      return buildResponse(404, { error: 'Product not found: ' + productId });
    }

    // Set Status (Column S / 19) to Inactive
    sheet.getRange(foundRow, 19).setValue('Inactive');

    return buildResponse(200, { success: true, message: 'Product marked as Inactive' });
  } catch (error) {
    return buildResponse(500, { error: error.toString() });
  }
}

/**
 * Bulk rename a category for all matching products (Optimized)
 */
function handleRenameCategory(oldCategory, newCategory) {
  try {
    if (!oldCategory || !newCategory) {
      return buildResponse(400, { error: 'Missing old or new category name' });
    }

    oldCategory = String(oldCategory).trim();
    newCategory = String(newCategory).trim();

    if (oldCategory.toLowerCase() === newCategory.toLowerCase()) {
      return buildResponse(400, { error: 'Old and new category cannot be the same.' });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return buildResponse(404, { error: 'No products in database' });
    }

    // Column 4 (D) is Category
    var categoryRange = sheet.getRange(2, 4, lastRow - 1, 1);
    var categories = categoryRange.getValues();
    var updateCount = 0;
    var newCategoryExists = false;

    // Check if new category already exists
    for (var i = 0; i < categories.length; i++) {
      var cat = String(categories[i][0]).trim();
      if (cat.toLowerCase() === newCategory.toLowerCase()) {
        newCategoryExists = true;
        break;
      }
    }

    if (newCategoryExists) {
      return buildResponse(400, { error: 'Category already exists.' });
    }

    // Rename category
    for (var i = 0; i < categories.length; i++) {
      var cat = String(categories[i][0]).trim();
      if (cat.toLowerCase() === oldCategory.toLowerCase()) {
        categories[i][0] = newCategory;
        updateCount++;
      }
    }

    if (updateCount === 0) {
      return buildResponse(404, { error: 'Category not found.' });
    }

    categoryRange.setValues(categories);

    return buildResponse(200, { 
      success: true, 
      message: 'Category renamed successfully',
      updatedCount: updateCount
    });
  } catch (error) {
    return buildResponse(500, { error: error.toString() });
  }
}

/**
 * Delete a category by merging its products into a destination category
 */
function handleDeleteCategory(oldCategory, destinationCategory) {
  try {
    if (!oldCategory || !destinationCategory) {
      return buildResponse(400, { error: 'Old category and destination category are required' });
    }

    oldCategory = String(oldCategory).trim();
    destinationCategory = String(destinationCategory).trim();

    if (oldCategory.toLowerCase() === destinationCategory.toLowerCase()) {
      return buildResponse(400, { error: 'Destination cannot be the same as the old category' });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return buildResponse(404, { error: 'No products in database' });
    }

    // Column 4 (D) is Category
    var categoryRange = sheet.getRange(2, 4, lastRow - 1, 1);
    var categories = categoryRange.getValues();
    var updateCount = 0;

    // Move products to destination category
    for (var i = 0; i < categories.length; i++) {
      var cat = String(categories[i][0]).trim();
      if (cat.toLowerCase() === oldCategory.toLowerCase()) {
        categories[i][0] = destinationCategory;
        updateCount++;
      }
    }

    if (updateCount === 0) {
      return buildResponse(404, { error: 'Category not found or has no products.' });
    }

    categoryRange.setValues(categories);

    return buildResponse(200, { 
      success: true, 
      message: 'Category deleted and products migrated successfully',
      updatedCount: updateCount
    });
  } catch (error) {
    return buildResponse(500, { error: error.toString() });
  }
}

/**
 * Increment order counts for clicked checkout items
 */
function handleIncrementOrders(productIds) {
  try {
    if (!productIds || !Array.isArray(productIds)) {
      return buildResponse(400, { error: 'Invalid productIds' });
    }
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return buildResponse(200, { success: true, message: 'No products in database to increment' });
    }
    
    var productIdsRange = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    
    for (var i = 0; i < productIds.length; i++) {
      var targetId = productIds[i];
      for (var rowIdx = 0; rowIdx < productIdsRange.length; rowIdx++) {
        if (productIdsRange[rowIdx][0] === targetId) {
          var actualRow = rowIdx + 2;
          var orderCountCell = sheet.getRange(actualRow, 22);
          var currentVal = orderCountCell.getValue();
          var currentCount = parseInt(currentVal, 10) || 0;
          orderCountCell.setValue(currentCount + 1);
          break;
        }
      }
    }
    
    return buildResponse(200, { success: true, message: 'Order counts incremented successfully' });
  } catch (error) {
    return buildResponse(500, { error: error.toString() });
  }
}

/**
 * Increment click counts for viewed/interacted-with products.
 * `clicks` is a map of { ProductID: pointsToAdd }, batched client-side so a
 * single flush covers many clicks instead of one request per click.
 */
function handleIncrementClicks(clicks) {
  try {
    if (!clicks || typeof clicks !== 'object') {
      return buildResponse(400, { error: 'Invalid clicks payload' });
    }

    var productIds = Object.keys(clicks);
    if (productIds.length === 0) {
      return buildResponse(200, { success: true, message: 'No clicks to record' });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return buildResponse(200, { success: true, message: 'No products in database to increment' });
    }

    var productIdsRange = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

    for (var i = 0; i < productIds.length; i++) {
      var targetId = productIds[i];
      var points = parseInt(clicks[targetId], 10) || 0;
      if (points <= 0) continue;

      for (var rowIdx = 0; rowIdx < productIdsRange.length; rowIdx++) {
        if (productIdsRange[rowIdx][0] === targetId) {
          var actualRow = rowIdx + 2;
          var clickCountCell = sheet.getRange(actualRow, 23); // W: ClickCount
          var currentVal = clickCountCell.getValue();
          var currentCount = parseInt(currentVal, 10) || 0;
          clickCountCell.setValue(currentCount + points);
          break;
        }
      }
    }

    return buildResponse(200, { success: true, message: 'Click counts incremented successfully' });
  } catch (error) {
    return buildResponse(500, { error: error.toString() });
  }
}

function buildResponse(statusCode, data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ==========================================
// BANNER MANAGEMENT
// ==========================================

function getOrCreateBannersSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Banners");
  if (!sheet) {
    sheet = ss.insertSheet("Banners");
    sheet.appendRow(['BannerID', 'ImageURL', 'Subtitle', 'Title', 'Description', 'ButtonText', 'ButtonLink', 'DisplayOrder', 'Status']);
    
    // Auto-populate with one default banner so frontend doesn't break if empty
    sheet.appendRow([
      'B_00001',
      'https://images.unsplash.com/photo-1630019852942-f89202989a59?w=1440&auto=format&fit=crop&q=80',
      'Exquisite Korean Designs',
      'Sophistication in Every Detail',
      'Discover our premium range of Korean earrings & fashion accessories. Hand-selected quality, priced affordably between Rs.70 - Rs.100.',
      'Shop Collections',
      'shop.html',
      1,
      'Active'
    ]);
  }
  return sheet;
}

function handleAddBanner(banner) {
  try {
    if (!banner || !banner.ImageURL) return buildResponse(400, { error: 'Missing image URL' });

    var sheet = getOrCreateBannersSheet();
    var lastRow = sheet.getLastRow();
    var newIdNumber = 1;
    
    if (lastRow > 1) {
      var lastIdStr = sheet.getRange(lastRow, 1).getValue();
      if (lastIdStr && lastIdStr.toString().startsWith('B_')) {
        var match = lastIdStr.toString().match(/B_(\d+)/);
        if (match) newIdNumber = parseInt(match[1], 10) + 1;
      }
    }
    var BannerID = 'B_' + ('00000' + newIdNumber).slice(-5);

    var newRow = [
      BannerID,
      banner.ImageURL || '',
      banner.Subtitle || '',
      banner.Title || '',
      banner.Description || '',
      banner.ButtonText || '',
      banner.ButtonLink || '',
      banner.DisplayOrder ? Number(banner.DisplayOrder) : 99,
      'Active'
    ];

    sheet.appendRow(newRow);
    return buildResponse(200, { success: true, message: 'Banner added successfully', bannerId: BannerID });
  } catch (error) {
    return buildResponse(500, { error: error.toString() });
  }
}

function handleEditBanner(banner) {
  try {
    if (!banner || !banner.BannerID) return buildResponse(400, { error: 'Missing Banner ID' });

    var sheet = getOrCreateBannersSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return buildResponse(404, { error: 'No banners in database' });

    var bannerIdsRange = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    var foundRow = -1;

    for (var i = 0; i < bannerIdsRange.length; i++) {
      if (bannerIdsRange[i][0] === banner.BannerID) {
        foundRow = i + 2;
        break;
      }
    }

    if (foundRow === -1) return buildResponse(404, { error: 'Banner not found' });

    sheet.getRange(foundRow, 2).setValue(banner.ImageURL || '');
    sheet.getRange(foundRow, 3).setValue(banner.Subtitle || '');
    sheet.getRange(foundRow, 4).setValue(banner.Title || '');
    sheet.getRange(foundRow, 5).setValue(banner.Description || '');
    sheet.getRange(foundRow, 6).setValue(banner.ButtonText || '');
    sheet.getRange(foundRow, 7).setValue(banner.ButtonLink || '');
    
    if (banner.DisplayOrder !== undefined) {
      sheet.getRange(foundRow, 8).setValue(banner.DisplayOrder === '' ? 99 : Number(banner.DisplayOrder));
    }
    if (banner.Status !== undefined) {
      sheet.getRange(foundRow, 9).setValue(banner.Status);
    }

    return buildResponse(200, { success: true, message: 'Banner updated successfully' });
  } catch (error) {
    return buildResponse(500, { error: error.toString() });
  }
}

function handleDeleteBanner(bannerId) {
  try {
    if (!bannerId) return buildResponse(400, { error: 'Missing Banner ID' });

    var sheet = getOrCreateBannersSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return buildResponse(404, { error: 'No banners in database' });

    var bannerIdsRange = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    var foundRow = -1;

    for (var i = 0; i < bannerIdsRange.length; i++) {
      if (bannerIdsRange[i][0] === bannerId) {
        foundRow = i + 2;
        break;
      }
    }

    if (foundRow === -1) return buildResponse(404, { error: 'Banner not found' });

    sheet.getRange(foundRow, 9).setValue('Inactive'); // Soft delete
    return buildResponse(200, { success: true, message: 'Banner marked as Inactive' });
  } catch (error) {
    return buildResponse(500, { error: error.toString() });
  }
}


