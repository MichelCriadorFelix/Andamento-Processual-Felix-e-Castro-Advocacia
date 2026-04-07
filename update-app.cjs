const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Dashboard cards
content = content.replace(/bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100/g, 'bg-white dark:bg-slate-800 rounded-2xl shadow-premium border border-gray-100');

// Main layout background
content = content.replace(/bg-gray-50/g, 'bg-slate-50');

fs.writeFileSync(filePath, content);
console.log('Updated App.tsx');
