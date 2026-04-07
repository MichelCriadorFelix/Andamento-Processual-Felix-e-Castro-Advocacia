const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'components', 'LandingPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Increase heading sizes and add tracking-tight
content = content.replace(/text-4xl md:text-5xl/g, 'text-4xl md:text-6xl tracking-tight');
content = content.replace(/text-xl text-gray-200/g, 'text-xl md:text-2xl text-gray-200 leading-relaxed');

// Make buttons larger
content = content.replace(/px-8 py-4 bg-white/g, 'px-10 py-5 text-lg md:text-xl bg-white shadow-premium');
content = content.replace(/px-8 py-4 border-2/g, 'px-10 py-5 text-lg md:text-xl border-2');

// Improve feature cards
content = content.replace(/p-6 bg-white/g, 'p-8 bg-white shadow-premium rounded-2xl');
content = content.replace(/text-xl font-bold/g, 'text-2xl font-bold');
content = content.replace(/text-gray-600/g, 'text-gray-700 text-lg');

fs.writeFileSync(filePath, content);
console.log('Updated LandingPage.tsx');
