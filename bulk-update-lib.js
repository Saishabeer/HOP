const fs = require('fs');
const files = ['index.html', 'shop.html', 'product.html', 'cart.html', 'checkout.html', 'admin.html', 'about.html', 'contact.html', 'faq.html', 'policy.html', '404.html'];

for (const file of files) {
  try {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace api.js
    if (content.includes('js/api.js')) {
      content = content.replace(/<script src="js\/api\.js"( defer)?><\/script>/g, '<script src="js/lib/data.js" defer></script>\n  <script src="js/lib/sheetsWriter.js" defer></script>');
    }
    
    // Inject CartService before cart.js
    if (content.includes('js/cart.js') && !content.includes('js/services/CartService.js')) {
      content = content.replace(/<script src="js\/cart\.js"( defer)?><\/script>/g, '<script src="js/services/CartService.js" defer></script>\n  <script src="js/cart.js" defer></script>');
    }
    
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  } catch (e) {
    console.log('Skipping ' + file + ': ' + e.message);
  }
}
