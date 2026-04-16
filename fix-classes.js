const fs = require('fs');
const path = require('path');

const files = [
  'ApiSettings.tsx',
  'CloudSettings.tsx',
  'DataSettings.tsx',
  'FirmwareSettings.tsx',
  'RedSettings.tsx',
  'SecuritySettings.tsx',
  'SensorSettings.tsx',
  'SmtpSettings.tsx',
  'UserSettings.tsx',
  'WhatsAppSettings.tsx'
];

const dir = '/home/guilledev/Documents/PlatformIO/Projects/React_Esp32S3N16R8_LCD/frontend/src/views/Settings/';

files.forEach(file => {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(/text-secondary/g, 'text-text-secondary');
  content = content.replace(/text-primary/g, 'text-text-primary');
  // Avoid doubling up like text-text-text-primary
  content = content.replace(/text-text-text-primary/g, 'text-text-primary');
  content = content.replace(/text-text-text-secondary/g, 'text-text-secondary');

  fs.writeFileSync(filePath, content, 'utf8');
});
console.log("Fixed classes");
