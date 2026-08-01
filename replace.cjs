const fs = require('fs');
const path = require('path');

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;
      
      // Replace Alliance -> Premium
      content = content.replace(/Alliance/g, 'Premium');
      content = content.replace(/alliance/g, 'premium');
      
      // Replace Agape -> VIP, but NOT AgapeMeet, AgapeAdmin, agape-meet
      content = content.replace(/\bAgape\b(?!\s*Meet|\s*Admin)/g, 'VIP');
      content = content.replace(/\bagape\b(?!\s*meet|\s*admin|\s*\-)/g, 'vip');
      
      // Specifically fix admin.utilisateurs.tsx to prevent SyntaxError
      if (fullPath.includes('admin.utilisateurs.tsx')) {
        // Change the first declaration of isPremium to avoid clash
        content = content.replace('const isPremium = i % 7 === 0;', 'const isPremiumPlan = i % 7 === 0;');
        content = content.replace('const isAgape = !isPremium && i % 5 === 0;', 'const isAgape = !isPremiumPlan && i % 5 === 0;');
        content = content.replace('const isPremium = isPremium || isAgape;', 'const isPremium = isPremiumPlan || isAgape;');
        
        // Fix the ternary condition at the bottom
        content = content.replace(
          '{isPremium ? (\n                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gold/10 text-gold text-[10px] font-bold uppercase tracking-wider">\n                                <Crown className="w-3 h-3" /> Premium\n                              </span>',
          '{isPremiumPlan ? (\n                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gold/10 text-gold text-[10px] font-bold uppercase tracking-wider">\n                                <Crown className="w-3 h-3" /> Premium\n                              </span>'
        );
      }
      
      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory(path.join(__dirname, 'src'));
console.log('Done replacing strings.');
