const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'components', 'BenefitsAnalyzer.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace label text sizes
content = content.replace(/text-sm font-medium/g, 'text-base md:text-lg font-medium');

// Replace input paddings and add text-lg and shadow
content = content.replace(/p-2\.5 border border-gray-300/g, 'p-3 md:p-4 text-base md:text-lg border border-gray-300 shadow-sm');

// Make the main button larger
content = content.replace(/px-6 py-3 bg-bordo-900/g, 'px-8 py-4 text-lg md:text-xl bg-bordo-900 shadow-premium');

fs.writeFileSync(filePath, content);
console.log('Updated BenefitsAnalyzer.tsx');
