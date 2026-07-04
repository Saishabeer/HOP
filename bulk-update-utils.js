const fs = require('fs');
const files = ['index.html', 'shop.html', 'product.html', 'cart.html', 'checkout.html', 'admin.html', 'about.html', 'contact.html', 'faq.html', 'policy.html', '404.html'];

for (const file of files) {
  try {
    let content = fs.readFileSync(file, 'utf8');
    
    // Inject validator and formatter
    if (content.includes('js/utils/logger.js') && !content.includes('js/utils/validator.js')) {
      content = content.replace(/<script src="js\/utils\/logger\.js"( defer)?><\/script>/g, '<script src="js/utils/logger.js" defer></script>\n  <script src="js/utils/validator.js" defer></script>\n  <script src="js/utils/formatter.js" defer></script>');
    }
    
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  } catch (e) {
    console.log('Skipping ' + file + ': ' + e.message);
  }
}
