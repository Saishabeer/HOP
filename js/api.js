// api.js - Data Fetching & Google Sheets Integration

const PRODUCT_CACHE_KEY = 'products_v2';

/**
 * Parses Google Sheets GViz JSON format into clean objects based on headers.
 */
function parseSheetData(gvizJson) {
  const table = gvizJson.table;
  const cols = table.cols.map(col => col.label ? col.label.trim() : '');
  
  return table.rows.map(row => {
    const item = {};
    row.c.forEach((cell, index) => {
      const header = cols[index];
      if (!header) return;
      
      let val = cell ? cell.v : null;
      
      // Parse numeric or boolean strings if needed
      if (typeof val === 'string') {
        if (val.toUpperCase() === 'TRUE') val = true;
        else if (val.toUpperCase() === 'FALSE') val = false;
      }
      
      // Map properties exactly to the schema
      item[header] = val;
    });
    
    // Ensure data types and structures are consistent
    return {
      ProductID: item.ProductID || '',
      ModelNumber: item.ModelNumber || '',
      ProductName: item.ProductName || '',
      Category: item.Category || 'Korean Earrings',
      Description: item.Description || '',
      Price: Number(item.Price) || 0,
      DiscountPrice: item.DiscountPrice !== null && item.DiscountPrice !== undefined && item.DiscountPrice !== '' ? Number(item.DiscountPrice) : null,
      StockQuantity: Number(item.StockQuantity) || 0,
      ProductImageURL: item.ProductImageURL || '',
      AdditionalImage1: item.AdditionalImage1 || '',
      AdditionalImage2: item.AdditionalImage2 || '',
      AdditionalImage3: item.AdditionalImage3 || '',
      Material: item.Material || '',
      Color: item.Color || '',
      Weight: item.Weight || '',
      NewArrival: !!item.NewArrival,
      FeaturedProduct: !!item.FeaturedProduct,
      BestSeller: !!item.BestSeller,
      Status: item.Status || 'Active',
      DisplayOrder: Number(item.DisplayOrder) || 99,
      CreatedDate: item.CreatedDate || ''
    };
  }).filter(item => item.ProductID && item.Status === 'Active');
}

/**
 * Accepts either a raw Google Sheet ID or a full Google Sheets URL.
 */
function getSheetSource(sheetConfig) {
  const source = (sheetConfig || '').trim();
  if (!source) return null;

  const idMatch = source.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = source.match(/[?&#]gid=([0-9]+)/);

  return {
    id: idMatch ? idMatch[1] : source,
    gid: gidMatch ? gidMatch[1] : ''
  };
}

/**
 * Google Sheets GViz does not send CORS headers for normal fetch() calls.
 * Loading it as JSONP works from both file:// previews and deployed sites.
 */
function fetchSheetJsonp(sheetSource) {
  return new Promise((resolve, reject) => {
    const callbackName = `hopSheetCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement('script');
    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };

    const params = new URLSearchParams({
      tqx: `out:json;responseHandler:${callbackName}`
    });
    if (sheetSource.gid) params.set('gid', sheetSource.gid);

    window[callbackName] = (json) => {
      cleanup();
      resolve(json);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Could not load Google Sheet. Check sharing/publishing settings and internet connection.'));
    };

    script.src = `https://docs.google.com/spreadsheets/d/${sheetSource.id}/gviz/tq?${params.toString()}`;
    document.head.appendChild(script);
  });
}

/**
 * Main Fetch Products method
 */
async function fetchProducts() {
  // 1. Check session storage cache
  const cached = sessionStorage.getItem(PRODUCT_CACHE_KEY);
  if (cached) {
    try {
      const cachedPayload = JSON.parse(cached);
      const isFresh = cachedPayload.timestamp && Date.now() - cachedPayload.timestamp < CONFIG.CACHE_EXPIRY_MS;
      if (isFresh && Array.isArray(cachedPayload.data)) {
        return cachedPayload.data;
      }
    } catch (e) {
      console.warn("Cached products could not be parsed, refetching.");
    }
  }

  // Helper to store in session cache
  const cacheProducts = (data) => {
    try {
      sessionStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data
      }));
    } catch (e) {
      console.error("Failed to write to sessionStorage", e);
    }
  };

  // 2. Fetch from Google Sheets if ID exists
  const sheetSource = getSheetSource(CONFIG.SHEET_ID);
  if (sheetSource && sheetSource.id) {
    try {
      const json = await fetchSheetJsonp(sheetSource);
      if (json.status === 'error') {
        throw new Error(json.errors ? json.errors.map(err => err.detailed_message || err.message).join(' ') : 'Google Sheet returned an error.');
      }

      const parsedProducts = parseSheetData(json);
      // Sort by DisplayOrder
      parsedProducts.sort((a, b) => a.DisplayOrder - b.DisplayOrder);
      
      cacheProducts(parsedProducts);
      return parsedProducts;
    } catch (error) {
      console.error("Google Sheets API call failed, falling back to local database.", error);
    }
  }

  // 3. Fallback to local products.json
  try {
    const fallbackRes = await fetch('./data/products.json');
    if (!fallbackRes.ok) throw new Error("Fallback file products.json not found");
    const localData = await fallbackRes.json();
    
    // Sort local data as well
    localData.sort((a, b) => (a.DisplayOrder || 99) - (b.DisplayOrder || 99));
    cacheProducts(localData);
    return localData;
  } catch (err) {
    console.error("Critical: Failed to load fallback local database as well.", err);
    return [];
  }
}

/**
 * Fetch a single product by its ID
 */
async function fetchProductById(id) {
  const products = await fetchProducts();
  return products.find(p => p.ProductID === id) || null;
}
