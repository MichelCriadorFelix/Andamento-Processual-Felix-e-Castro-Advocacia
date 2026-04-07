const fs = require('fs');
const path = require('path');

const updateFile = (filename) => {
  const filePath = path.join(__dirname, 'components', filename);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace common text sizes
  content = content.replace(/text-sm/g, 'text-base');
  content = content.replace(/text-xs/g, 'text-sm');
  
  fs.writeFileSync(filePath, content);
  console.log(`Updated ${filename}`);
};

updateFile('ClientProfile.tsx');
updateFile('Timeline.tsx');
updateFile('StepModal.tsx');
