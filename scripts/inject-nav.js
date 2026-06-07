const fs = require('fs');
const path = require('path');

const modules = [
  'buchhaltung', 'marketing', 'warendurchlauf', 'kontrolle', 
  'performance', 'lager', 'baeder', 'customers', 'orders', 
  'lieferanten', 'kommunikation'
];

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function processDirectory(dir, moduleName) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath, moduleName);
    } else if ((file === 'page.tsx' && !fullPath.includes('neu')) || file.endsWith('Client.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      if (content.includes('<Breadcrumb') || content.includes('<BackButton')) {
        continue;
      }

      // If it's a page that just renders a Client component, skip it and modify the Client component instead
      if (file === 'page.tsx' && content.includes('Client')) {
        const lines = content.split('\n');
        const hasClientReturn = lines.some(l => l.includes('return <') && l.includes('Client'));
        if (hasClientReturn) {
            console.log(`Skipping ${fullPath} because it delegates to a Client component.`);
            continue;
        }
      }
      
      const relPath = fullPath.split(/src[\\\/]app[\\\/]/)[1];
      if (!relPath) continue;
      
      const parts = relPath.replace(/\\/g, '/').split('/');
      parts.pop(); // remove filename
      
      let backLabel = 'Home';
      let backHref = '/';
      let breadcrumbItems = `[{label:'Home',href:'/'}, {label:'${capitalize(moduleName)}',href:'/${moduleName}'}]`;
      
      if (parts.length === 1) { // /buchhaltung
        backLabel = 'Home';
        backHref = '/';
      } else if (parts.length === 2) { // /buchhaltung/belege
        backLabel = capitalize(moduleName);
        backHref = `/${moduleName}`;
        breadcrumbItems = `[{label:'Home',href:'/'}, {label:'${capitalize(moduleName)}',href:'/${moduleName}'}, {label:'${capitalize(parts[1])}'}]`;
      } else if (parts.length >= 3) { // /buchhaltung/belege/[id]
        let parentRoute = parts[1];
        let plabel = capitalize(parentRoute);
        if (parentRoute === 'belege') plabel = 'Belegliste';
        backLabel = plabel;
        backHref = `/${moduleName}/${parentRoute}`;
        breadcrumbItems = `[{label:'Home',href:'/'}, {label:'${capitalize(moduleName)}',href:'/${moduleName}'}, {label:'${capitalize(parentRoute)}',href:'/${moduleName}/${parentRoute}'}, {label:'Detail'}]`;
      }
      
      const injection = `
      <div className="mb-6">
        <Breadcrumb items={${breadcrumbItems}} />
        <BackButton label="${backLabel}" href="${backHref}" />
      </div>
      `;
      
      // Inject imports safely below "use client" if it exists
      if (!content.includes('import { Breadcrumb }')) {
        const lines = content.split('\n');
        let insertIndex = 0;
        if (lines[0].includes('"use client"') || lines[0].includes("'use client'")) {
           insertIndex = 1;
        }
        lines.splice(insertIndex, 0, `import { Breadcrumb } from "@/components/ui/Breadcrumb";\nimport { BackButton } from "@/components/ui/BackButton";`);
        content = lines.join('\n');
      }
      
      // Avoid injecting into files that have <KreileAppShell> and return early inside functions.
      // We will look for <div className="min-h-screen or <div className="pb-12 or just <div className="... right after return
      
      const returnIndex = content.indexOf('return (');
      if (returnIndex === -1) continue;
      
      const divMatch = content.slice(returnIndex).match(/<div[^>]*>/);
      if (divMatch) {
        const divIndex = returnIndex + divMatch.index + divMatch[0].length;
        content = content.slice(0, divIndex) + injection + content.slice(divIndex);
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Injected into ${fullPath}`);
      } else {
        const fragmentMatch = content.slice(returnIndex).match(/<>/);
        if (fragmentMatch) {
            const fragIndex = returnIndex + fragmentMatch.index + fragmentMatch[0].length;
            content = content.slice(0, fragIndex) + injection + content.slice(fragIndex);
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log(`Injected into ${fullPath}`);
        } else {
            console.log(`Could not find insertion point in ${fullPath}`);
        }
      }
    }
  }
}

for (const mod of modules) {
  const dir = path.join(__dirname, '..', 'src', 'app', mod);
  if (fs.existsSync(dir)) {
    processDirectory(dir, mod);
  }
}
