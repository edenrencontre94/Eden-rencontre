const fs = require('fs');
let c = fs.readFileSync('src/routes/onboarding.tsx', 'utf8');

c = c.replace(/Ã©/g, 'é')
     .replace(/Ã¨/g, 'è')
     .replace(/Ã /g, 'à')
     .replace(/Ã¢/g, 'â')
     .replace(/Ã®/g, 'î')
     .replace(/Ã§/g, 'ç')
     .replace(/Ã´/g, 'ô')
     .replace(/Ãª/g, 'ê')
     .replace(/Ã»/g, 'û')
     .replace(/Ã¹/g, 'ù')
     .replace(/ðŸ˜Š/g, '😊')
     .replace(/â€”/g, '—')
     .replace(/Â«/g, '«')
     .replace(/Â»/g, '»')
     .replace(/â€™/g, '’')
     .replace(/Â·/g, '·');

fs.writeFileSync('src/routes/onboarding.tsx', c, 'utf8');
