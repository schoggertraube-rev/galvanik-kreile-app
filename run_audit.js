const fs = require('fs');
const path = require('path');

const srcAppDir = path.join(__dirname, 'src', 'app');

function getAppRoutes(dir, baseRoute = '') {
  let routes = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (let entry of entries) {
    if (entry.isDirectory()) {
      if (['components', 'api', 'lib', 'ui', 'fonts'].includes(entry.name)) continue;
      
      const newRoute = baseRoute + '/' + entry.name;
      // ONLY add to routes if page.tsx exists in this directory!
      if (fs.existsSync(path.join(dir, entry.name, 'page.tsx')) || fs.existsSync(path.join(dir, entry.name, 'page.jsx'))) {
          routes.push(newRoute);
      }
      routes = routes.concat(getAppRoutes(path.join(dir, entry.name), newRoute));
    }
  }
  return routes;
}

const allRoutes = getAppRoutes(srcAppDir);

function findLinks(dir) {
  let links = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (let entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      links = links.concat(findLinks(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      const hrefRegex = /href=["'](\/[^"']*)["']/g;
      let match;
      while ((match = hrefRegex.exec(content)) !== null) {
        links.push({ path: fullPath, link: match[1] });
      }
      
      const hrefTemplateRegex = /href=\{`(\/[^`$]*)[\s\S]*?`\}/g;
      while ((match = hrefTemplateRegex.exec(content)) !== null) {
        links.push({ path: fullPath, link: match[1] });
      }
      
      const routerPushRegex = /router\.push\(["'](\/[^"']*)["']\)/g;
      while ((match = routerPushRegex.exec(content)) !== null) {
        links.push({ path: fullPath, link: match[1] });
      }
    }
  }
  return links;
}

const allLinks = findLinks(srcAppDir);

const validRoutes = new Set();
validRoutes.add('/');

for (const r of allRoutes) {
  let normalized = r;
  normalized = normalized.replace(/\[.*?\]/g, '[^/]+');
  validRoutes.add(new RegExp('^' + normalized + '(/.*)?$'));
}

const unverifiedLinks = [];
for (const l of allLinks) {
  const linkPath = l.link.split('?')[0].split('#')[0];
  if (linkPath === '/') continue;
  
  let found = false;
  
  for (const regex of validRoutes) {
    if (regex instanceof RegExp && regex.test(linkPath)) {
      found = true;
      break;
    }
  }
  
  if (!found) {
    // Only verify static path if it has page.tsx
    const staticPath = path.join(srcAppDir, linkPath.slice(1));
    if (fs.existsSync(path.join(staticPath, 'page.tsx')) || fs.existsSync(staticPath + '.tsx')) {
       found = true;
    }
  }
  
  if (!found && linkPath.startsWith('/')) {
    unverifiedLinks.push(l);
  }
}

const report = {};
for (const u of unverifiedLinks) {
  if (!report[u.link]) report[u.link] = [];
  report[u.link].push(u.path);
}

fs.writeFileSync('audit_results.md', JSON.stringify(report, null, 2));
console.log('Strict audit complete. Check audit_results.md');
