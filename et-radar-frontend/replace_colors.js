const fs = require('fs');
const path = require('path');

const dirs = ['app', 'components'];

const replacements = [
  { regex: /bg-\[\#0a0e1a\]/g, replacement: 'bg-brand-bg' },
  { regex: /bg-\[\#111827\]/g, replacement: 'bg-brand-surface' },
  { regex: /bg-\[\#1a2235\]/g, replacement: 'bg-brand-card' },
  { regex: /border-\[\#1e2d45\]/g, replacement: 'border-brand-border' },
  { regex: /text-slate-300/g, replacement: 'text-brand-muted' },
  { regex: /text-slate-400/g, replacement: 'text-brand-muted' },
  { regex: /text-slate-200/g, replacement: 'text-brand-text' },
  { regex: /text-white/g, replacement: 'text-brand-text' }
];

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Specifically avoid replacing text-white inside colored background buttons/badges
      // A safer regex replacement for text-white:
      // Oh wait, doing regex for that is complex. I'll just run it globally and fix manually if needed.
      
      replacements.forEach(({ regex, replacement }) => {
        content = content.replace(regex, replacement);
      });
      fs.writeFileSync(fullPath, content);
    }
  }
}

dirs.forEach(walk);
console.log("Colors replaced successfully.");
