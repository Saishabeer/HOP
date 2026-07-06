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

      // Parse GViz Date strings (e.g., "Date(2026,6,1)") to standard YYYY-MM-DD
      if (typeof val === 'string' && val.startsWith('Date(')) {
        const match = val.match(/Date\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
          const y = match[1];
          const m = String(parseInt(match[2], 10) + 1).padStart(2, '0');
          const d = String(parseInt(match[3], 10)).padStart(2, '0');
          val = `${y}-${m}-${d}`;
        }
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
      ProductImageURL: item.ProductImageURL || item.ProductImageURI || '',
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
      CreatedDate: item.CreatedDate || '',
      OrderCount: Number(item.OrderCount) || 0
    };

    // Apply optimistic category renames
    const localRenames = JSON.parse(localStorage.getItem('hop_admin_renames') || '{}');
    if (localRenames[item.Category]) {
      item.Category = localRenames[item.Category];
    }

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
      tqx: `out:json;responseHandler:${callbackName}`,
      t: Date.now()
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
  let rawData = [];

  // 1. Check local storage cache (shared across tabs)
  const cached = localStorage.getItem(PRODUCT_CACHE_KEY);
  if (cached) {
    try {
      const cachedPayload = JSON.parse(cached);
      const isFresh = cachedPayload.timestamp && Date.now() - cachedPayload.timestamp < CONFIG.CACHE_EXPIRY_MS;
      if (isFresh && Array.isArray(cachedPayload.data)) {
        rawData = cachedPayload.data;
      }
    } catch (e) {
      console.warn("Cached products could not be parsed, refetching.");
    }
  }

  // Helper to store in local cache
  const cacheProducts = (data) => {
    try {
      localStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data
      }));
    } catch (e) {
      console.error("Failed to write to localStorage", e);
    }
  };

  if (rawData.length === 0) {
    // 2. Fetch from Google Sheets if ID exists
    const sheetSource = getSheetSource(CONFIG.SHEET_ID);
    if (sheetSource && sheetSource.id) {
      try {
        const json = await fetchSheetJsonp(sheetSource);
        if (json.status === 'error') {
          throw new Error(json.errors ? json.errors.map(err => err.detailed_message || err.message).join(' ') : 'Google Sheet returned an error.');
        }

        const parsedProducts = parseSheetData(json);
        console.log('[API] Parsed products from sheet:', parsedProducts);
        // Sort by DisplayOrder
        parsedProducts.sort((a, b) => a.DisplayOrder - b.DisplayOrder);
        
        cacheProducts(parsedProducts);
        rawData = parsedProducts;
      } catch (error) {
        console.error("Google Sheets API call failed, falling back to local database.", error);
      }
    }

    if (rawData.length === 0) {
      // 3. Fallback to local products.json
      try {
        const fallbackRes = await fetch('./data/products.json');
        if (!fallbackRes.ok) throw new Error("Fallback file products.json not found");
        const localData = await fallbackRes.json();
        
        // Sort local data as well
        localData.sort((a, b) => (a.DisplayOrder || 99) - (b.DisplayOrder || 99));
        cacheProducts(localData);
        rawData = localData;
      } catch (err) {
        console.error("Critical: Failed to load fallback local database as well.", err);
        rawData = [];
      }
    }
  }

  // 4. Merge persistent local storage mock updates (adds, edits, deletes)
  // This makes local changes survive page reloads for admin testing
  const localAdds = JSON.parse(localStorage.getItem('hop_admin_adds') || '[]');
  const localEdits = JSON.parse(localStorage.getItem('hop_admin_edits') || '{}');
  const localDeletes = JSON.parse(localStorage.getItem('hop_admin_deletes') || '[]');

  // Combine raw data with local additions
  let combined = [...rawData];
  localAdds.forEach(p => {
    if (!combined.some(item => item.ProductID === p.ProductID)) {
      combined.push(p);
    }
  });

  // Apply edits in-place
  combined = combined.map(p => {
    if (localEdits[p.ProductID]) {
      return { ...p, ...localEdits[p.ProductID] };
    }
    return p;
  });

  // Filter out soft deleted items
  combined = combined.filter(p => !localDeletes.includes(p.ProductID) && p.Status !== 'Inactive');

  // Sort overall by DisplayOrder
  combined.sort((a, b) => (a.DisplayOrder || 99) - (b.DisplayOrder || 99));

  return combined;
}

/**
 * Fetch a single product by its ID
 */
async function fetchProductById(id) {
  const products = await fetchProducts();
  return products.find(p => p.ProductID === id) || null;
}

/**
 * Local Customer Interest Tracker (Option 3)
 */
function trackLocalInterest(productId, points) {
  try {
    const key = 'hop_local_interests';
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    data[productId] = (data[productId] || 0) + points;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save local interest:', e);
  }
}

function getLocalInterest(productId) {
  try {
    const key = 'hop_local_interests';
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    return Number(data[productId]) || 0;
  } catch (e) {
    return 0;
  }
}

