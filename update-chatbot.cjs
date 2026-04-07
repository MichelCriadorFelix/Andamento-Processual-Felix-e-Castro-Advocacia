const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'components', 'CaseChatbot.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Increase chat text size
content = content.replace(/text-sm/g, 'text-base');
content = content.replace(/p-3 rounded-2xl/g, 'p-4 rounded-2xl text-lg');
content = content.replace(/w-\[350px\] md:w-\[400px\] h-\[600px\]/g, 'w-[90vw] md:w-[450px] h-[70vh] md:h-[650px] shadow-premium');

// Make input larger
content = content.replace(/p-3 border/g, 'p-4 text-lg border');

fs.writeFileSync(filePath, content);
console.log('Updated CaseChatbot.tsx');
