const fs = require('fs');
const files = ['index.html', 'shop.html', 'product.html', 'cart.html', 'checkout.html', 'admin.html'];

for (const file of files) {
  try {
    let content = fs.readFileSync(file, 'utf8');
    
    // Check if ui scripts already injected
    if (content.includes('js/ui/ProductCard.js')) continue;

    const uiStr = `  <!-- shared services & ui -->\n  <script src="js/services/ImageService.js" defer></script>\n  <script src="js/ui/Toast.js" defer></script>\n  <script src="js/ui/Skeleton.js" defer></script>\n  <script src="js/ui/ProductCard.js" defer></script>\n`;
    
    // Inject right before js/config.js
    if (content.includes('<script src="js/config.js"')) {
       content = content.replace('<script src="js/config.js"', uiStr + '  <!-- core scripts -->\n  <script src="js/config.js"');
    }
    
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  } catch (e) {
    console.log('Skipping ' + file + ': ' + e.message);
  }
}
