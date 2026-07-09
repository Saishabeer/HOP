// api.js - Data Fetching & Google Sheets Integration

const PRODUCT_CACHE_KEY = 'products_v2';

/**
 * Parses Google Sheets GViz JSON format into clean objects based on headers.
 */
function parseSheetData(gvizJson) {
  const table = gvizJson.table;
  const cols = table.cols.map(col => col.label ? col.label.trim() : '');
  const localRenames = JSON.parse(localStorage.getItem('hop_admin_renames') || '{}');

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
    
    // Apply optimistic category renames
    let category = item.Category || 'Korean Earrings';
    if (localRenames[category]) {
      category = localRenames[category];
    }

    // Ensure data types and structures are consistent
    return {
      ProductID: item.ProductID || '',
      ModelNumber: item.ModelNumber || '',
      ProductName: item.ProductName || '',
      Category: category,
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
      OrderCount: Number(item.OrderCount) || 0,
      ClickCount: Number(item.ClickCount) || 0
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
      tqx: `out:json;responseHandler:${callbackName}`,
      t: Date.now()
    });
    if (sheetSource.gid) params.set('gid', sheetSource.gid);
    if (sheetSource.sheetName) params.set('sheet', sheetSource.sheetName);

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
        logger.log('[API]', 'Parsed products from sheet:', parsedProducts);
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
 * Fetch banners from Google Sheets "Banners" tab
 */
async function fetchBanners() {
  const CACHE_KEY = 'hop_banners_v1';
  let rawData = [];

  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      const cachedPayload = JSON.parse(cached);
      if (cachedPayload.timestamp && Date.now() - cachedPayload.timestamp < CONFIG.CACHE_EXPIRY_MS && Array.isArray(cachedPayload.data)) {
        rawData = cachedPayload.data;
      }
    } catch (e) {}
  }

  if (rawData.length === 0) {
    const sheetSource = getSheetSource(CONFIG.SHEET_ID);
    if (sheetSource && sheetSource.id) {
      sheetSource.sheetName = "Banners";
      try {
        const json = await fetchSheetJsonp(sheetSource);
        if (json.status !== 'error') {
          const table = json.table;
          const cols = table.cols.map(col => col.label ? col.label.trim() : '');
          
          let parsedBanners = table.rows.map(row => {
            const item = {};
            row.c.forEach((cell, index) => {
              const header = cols[index];
              if (header) item[header] = cell ? cell.v : null;
            });
            return {
              BannerID: item.BannerID || '',
              ImageURL: item.ImageURL || '',
              Subtitle: item.Subtitle || '',
              Title: item.Title || '',
              Description: item.Description || '',
              ButtonText: item.ButtonText || '',
              ButtonLink: item.ButtonLink || '',
              DisplayOrder: Number(item.DisplayOrder) || 99,
              Status: item.Status || 'Active'
            };
          }).filter(b => b.BannerID && b.Status !== 'Inactive');

          parsedBanners.sort((a, b) => a.DisplayOrder - b.DisplayOrder);
          
          localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: parsedBanners }));
          rawData = parsedBanners;
        }
      } catch (e) {
        console.warn("Failed to fetch banners from sheet", e);
      }
    }
  }

  // Fallback default banner if network fails or sheet is empty
  if (rawData.length === 0) {
    rawData = [{
      BannerID: 'B_00001',
      ImageURL: 'https://images.unsplash.com/photo-1630019852942-f89202989a59?w=1440&auto=format&fit=crop&q=80',
      Subtitle: 'Exquisite Korean Designs',
      Title: 'Sophistication in Every Detail',
      Description: 'Discover our premium range of Korean earrings & fashion accessories.',
      ButtonText: 'Shop Collections',
      ButtonLink: 'shop.html'
    }];
  }

  // Merge local optimistic updates for admin
  const localAdds = JSON.parse(localStorage.getItem('hop_admin_banner_adds') || '[]');
  const localEdits = JSON.parse(localStorage.getItem('hop_admin_banner_edits') || '{}');
  const localDeletes = JSON.parse(localStorage.getItem('hop_admin_banner_deletes') || '[]');

  let combined = [...rawData];
  localAdds.forEach(b => { if (!combined.some(item => item.BannerID === b.BannerID)) combined.push(b); });
  
  combined = combined.map(b => localEdits[b.BannerID] ? { ...b, ...localEdits[b.BannerID] } : b);
  combined = combined.filter(b => !localDeletes.includes(b.BannerID) && b.Status !== 'Inactive');
  combined.sort((a, b) => a.DisplayOrder - b.DisplayOrder);

  return combined;
}

// Make globals available
window.fetchProducts = fetchProducts;
window.fetchBanners = fetchBanners;
window.fetchProductById = fetchProductById;

/**
 * Local Customer Interest Tracker (Option 3)
 * Also queues the same signal for server-side sync (see queueClickForServer)
 * so popularity reflects all visitors, not just this browser.
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

  queueClickForServer(productId, points);
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

/**
 * Batches click/interest signals in localStorage and flushes them to Google
 * Sheets as ClickCount via sheetsWriter.js, instead of one request per click.
 */
const CLICK_QUEUE_KEY = 'hop_pending_clicks';
const CLICK_FLUSH_DELAY_MS = 3000;
let clickFlushTimer = null;

function queueClickForServer(productId, points) {
  try {
    const queue = JSON.parse(localStorage.getItem(CLICK_QUEUE_KEY) || '{}');
    queue[productId] = (queue[productId] || 0) + points;
    localStorage.setItem(CLICK_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to queue click for server sync:', e);
    return;
  }

  clearTimeout(clickFlushTimer);
  clickFlushTimer = setTimeout(flushClickQueue, CLICK_FLUSH_DELAY_MS);
}

function flushClickQueue() {
  let queue;
  try {
    queue = JSON.parse(localStorage.getItem(CLICK_QUEUE_KEY) || '{}');
  } catch (e) {
    return;
  }
  if (Object.keys(queue).length === 0) return;

  localStorage.removeItem(CLICK_QUEUE_KEY);

  if (typeof sendClickIncrementToSheets === 'function') {
    sendClickIncrementToSheets(queue);
  }
}

// Flush any queued clicks when the visitor navigates away, so short visits aren't lost
window.addEventListener('pagehide', flushClickQueue);

/**
 * Shared popularity score for "Best Sellers" / "Most Selling" ranking.
 * Real sales dominate; server-synced ClickCount is a lightweight secondary
 * signal. Local, unsynced interest is only used as a fallback when a product
 * has no ClickCount yet (e.g. Sheets unreachable and running off the local
 * products.json fallback).
 */
function getPopularityScore(product) {
  const sales = Number(product.OrderCount) || 0;
  const clicks = Number(product.ClickCount) || 0;
  const localFallback = clicks === 0 ? getLocalInterest(product.ProductID) : 0;
  return sales * 10 + clicks + localFallback;
}

window.getPopularityScore = getPopularityScore;

