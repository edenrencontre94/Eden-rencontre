import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import fs from 'fs';
import path from 'path';

const srcLogo = path.join(process.cwd(), 'src', 'assets', 'logo.png');
const publicDir = path.join(process.cwd(), 'public');

async function generateIcons() {
  console.log('Generating icons from', srcLogo);
  
  if (!fs.existsSync(srcLogo)) {
    console.error('Logo file not found!');
    process.exit(1);
  }

  // Generate PNGs
  const sizes = [48, 96, 144, 180, 192, 512];
  
  for (const size of sizes) {
    let filename = `favicon-${size}x${size}.png`;
    if (size === 192) filename = 'icon-192.png';
    if (size === 512) filename = 'icon-512.png';
    if (size === 180) filename = 'apple-touch-icon.png';
    
    await sharp(srcLogo)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .toFile(path.join(publicDir, filename));
    
    console.log(`Generated ${filename}`);
  }

  // Generate ICO
  const buf = await pngToIco(path.join(publicDir, 'favicon-48x48.png'));
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), buf);
  console.log('Generated favicon.ico');
  
  // Overwrite favicon.png just in case (though it's usually just a copy)
  await sharp(srcLogo)
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toFile(path.join(publicDir, 'favicon.png'));
  console.log('Generated favicon.png');
  
  console.log('All icons generated successfully!');
}

generateIcons().catch(err => {
  console.error(err);
  process.exit(1);
});
