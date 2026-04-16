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
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Container Cards
  content = content.replace(/bg-gray-50 p-6 rounded-lg border border-gray-200/g, 'card p-6');
  content = content.replace(/bg-white p-5 rounded-lg border border-gray-200/g, 'card p-5');
  content = content.replace(/bg-white p-5 rounded-lg border/g, 'card p-5');
  content = content.replace(/bg-gray-50 p-4 md:p-6 rounded-lg border border-gray-200/g, 'card p-4 md:p-6');
  content = content.replace(/bg-white p-4 rounded-lg border border-gray-200/g, 'card p-4');
  content = content.replace(/bg-white p-4 rounded border border-gray-200/g, 'card p-4');
  content = content.replace(/bg-gray-50 p-6 rounded-lg shadow-sm border border-gray-200/g, 'card p-6');
  content = content.replace(/bg-gray-50 p-5 rounded-lg border border-gray-200/g, 'card p-5');

  // 2. Inputs and Selects
  content = content.replace(/w-full p-2 border border-gray-300 rounded(?:-l|-r)? focus:ring-2 focus:ring-[a-zA-Z0-9-]+(?: focus:outline-none| outline-none)?(?: bg-white)?(?: font-mono)?(?: text-sm)?(?: bg-gray-50)?/g, (match) => {
    let res = 'input-field';
    if (match.includes('rounded-l')) res += ' rounded-l';
    if (match.includes('rounded-r')) res += ' rounded-r';
    if (match.includes('font-mono')) res += ' font-mono';
    if (match.includes('text-sm')) res += ' text-sm';
    if (match.includes('bg-gray-50')) res += ' bg-app';
    return res;
  });

  // 3. Labels
  content = content.replace(/block text-sm font-semibold text-gray-600 mb-1/g, 'label-field');
  content = content.replace(/block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider/g, 'label-field text-xs uppercase tracking-wider');
  content = content.replace(/block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider/g, 'label-field text-xs uppercase tracking-wider');
  content = content.replace(/block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1/g, 'label-field text-xs uppercase tracking-wider mb-1');

  // 4. Checkboxes
  content = content.replace(/w-4 h-4 text-[a-zA-Z0-9-]+ rounded(?: focus:ring-[a-zA-Z0-9-]+)?(?: border-gray-300)?/g, 'checkbox-field');

  // 5. Primary Buttons
  content = content.replace(/px-6 py-2 bg-[a-zA-Z0-9-]+ text-white rounded font-bold hover:bg-[a-zA-Z0-9-\[\]#]+ (?:shadow )?transition-(?:all|colors)/g, 'btn btn-primary');
  content = content.replace(/px-6 py-2 bg-[a-zA-Z0-9-]+ text-white rounded font-bold hover:bg-[a-zA-Z0-9-\[\]#]+ shadow transition-(?:all|colors)/g, 'btn btn-primary');
  content = content.replace(/px-6 py-[0-9]+ bg-navy-dark text-white rounded font-bold hover:bg-gray-800 shadow whitespace-nowrap/g, 'btn btn-primary whitespace-nowrap');
  content = content.replace(/px-6 py-[0-9]+ bg-[a-zA-Z0-9-]+ text-white rounded font-bold hover:bg-[a-zA-Z0-9-]+ shadow-lg transition-transform active:scale-95 whitespace-nowrap/g, 'btn btn-primary whitespace-nowrap');
  content = content.replace(/w-full md:w-auto px-6 py-2 bg-[a-zA-Z0-9-]+ text-white rounded font-bold hover:bg-[a-zA-Z0-9-]+ transition-colors shadow flex items-center justify-center gap-2 whitespace-nowrap h-\[42px\]/g, 'btn btn-primary w-full md:w-auto flex items-center justify-center gap-2 whitespace-nowrap h-[42px]');
  content = content.replace(/px-4 py-2 bg-navy-dark text-white rounded font-bold hover:bg-gray-800 shadow whitespace-nowrap/g, 'btn btn-primary whitespace-nowrap');
  content = content.replace(/w-full py-2 bg-navy-dark text-white rounded font-bold hover:bg-gray-800 transition-colors/g, 'btn btn-primary w-full');

  // 6. Secondary Buttons
  content = content.replace(/px-6 py-2 bg-gray-200 text-gray-700 rounded font-bold hover:bg-gray-300 transition-colors/g, 'btn btn-secondary');
  content = content.replace(/px-6 py-2 border border-gray-300 text-[a-zA-Z0-9-]+ rounded font-bold hover:bg-gray-100 transition-colors flex items-center gap-2/g, 'btn btn-secondary flex items-center gap-2');
  content = content.replace(/px-6 py-2 border border-gray-300 text-[a-zA-Z0-9-]+ rounded font-bold hover:bg-gray-100 transition-colors/g, 'btn btn-secondary');
  content = content.replace(/w-full md:w-auto px-6 py-2 border border-gray-300 text-gray-700 rounded font-bold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 h-\[42px\]/g, 'btn btn-secondary w-full md:w-auto flex items-center justify-center gap-2 h-[42px]');

  // 7. Danger Buttons
  content = content.replace(/w-full py-2 bg-white border-2 border-red-500 text-red-600 rounded font-bold hover:bg-red-50 transition-colors/g, 'btn btn-danger-outline w-full');
  content = content.replace(/w-full py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700 shadow transition-colors/g, 'btn btn-danger w-full');
  content = content.replace(/px-6 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition-colors shadow flex items-center gap-2/g, 'btn btn-danger flex items-center gap-2');
  content = content.replace(/px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded font-bold hover:bg-red-100 transition-colors shadow-sm/g, 'btn btn-danger-outline');

  // 11. Badges
  content = content.replace(/bg-teal-50 text-teal-700 border border-teal-200 text-xs px-3 py-1 rounded-full font-semibold/g, 'badge badge-success');
  content = content.replace(/bg-blue-50 text-blue-700 border border-blue-200 text-xs px-3 py-1 rounded-full font-semibold/g, 'badge badge-info');
  content = content.replace(/bg-orange-50 text-orange-[a-zA-Z0-9-]+ border border-orange-200 text-xs px-3 py-1 rounded-full font-semibold/g, 'badge badge-warning');
  content = content.replace(/bg-red-50 text-red-600 border border-red-200 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1/g, 'badge badge-danger flex items-center gap-1');
  content = content.replace(/bg-gray-100 text-gray-700 border border-gray-300 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1/g, 'badge badge-neutral flex items-center gap-1');
  content = content.replace(/bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1 shadow-sm/g, 'badge badge-info flex items-center gap-1 shadow-sm');
  content = content.replace(/bg-green-50 text-green-700 border border-green-200 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1/g, 'badge badge-success flex items-center gap-1');

  // 8. Backgrounds, 9. Texts, 10. Borders
  const classMap = {
    'bg-white': 'bg-panel',
    'bg-gray-50': 'bg-app',
    'text-gray-800': 'text-primary',
    'text-navy-dark': 'text-primary',
    'text-gray-900': 'text-primary',
    'text-gray-600': 'text-secondary',
    'text-gray-500': 'text-muted',
    'border-gray-200': 'border-border-color',
    'border-gray-300': 'border-border-color'
  };

  const processClasses = (match, classNames) => {
    let newClassNames = classNames.split(/\s+/).map(cls => classMap[cls] || cls).join(' ');
    return `className="${newClassNames}"`;
  };
  
  const processTemplateClasses = (match, classNames) => {
    let newClassNames = classNames.split(/\s+/).map(cls => classMap[cls] || cls).join(' ');
    return `className={\`${newClassNames}\`}`;
  };

  content = content.replace(/className=["']([^"']*)["']/g, processClasses);
  content = content.replace(/className=\{`([^`]*)`\}/g, processTemplateClasses);

  fs.writeFileSync(filePath, content, 'utf8');
});
console.log("Refactoring complete");
