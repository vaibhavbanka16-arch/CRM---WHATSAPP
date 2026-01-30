/**
 * Icon Generator Script
 * Run: node scripts/generate-icons.js
 *
 * This creates simple placeholder PNG icons for the extension.
 * For production, replace with professionally designed icons.
 */

const fs = require('fs');
const path = require('path');

// Simple PNG generator - creates a green square with "CRM" text visual representation
// These are minimal valid PNG files

// PNG signature and minimal IHDR + IDAT for colored squares
function createSimplePNG(size, r, g, b) {
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Draw gradient background
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#25D366');
    gradient.addColorStop(1, '#128C7E');

    // Draw rounded rectangle
    const radius = size * 0.15;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(size - radius, 0);
    ctx.quadraticCurveTo(size, 0, size, radius);
    ctx.lineTo(size, size - radius);
    ctx.quadraticCurveTo(size, size, size - radius, size);
    ctx.lineTo(radius, size);
    ctx.quadraticCurveTo(0, size, 0, size - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw phone icon
    ctx.fillStyle = 'white';
    const phoneSize = size * 0.5;
    const phoneX = (size - phoneSize) / 2;
    const phoneY = (size - phoneSize) / 2;

    ctx.beginPath();
    ctx.arc(size/2, size/2, phoneSize/2.2, 0, Math.PI * 2);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = size * 0.06;
    ctx.stroke();

    // Draw CRM badge
    const badgeRadius = size * 0.22;
    const badgeX = size * 0.78;
    const badgeY = size * 0.22;

    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FF6B35';
    ctx.fill();

    // Draw "C" text in badge
    ctx.fillStyle = 'white';
    ctx.font = `bold ${size * 0.18}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('C', badgeX, badgeY + 1);

    return canvas.toBuffer('image/png');
}

// Alternative: Create simple colored PNG without canvas dependency
function createMinimalPNG(size) {
    // Create a simple valid PNG with a solid green color
    // This is a manually constructed PNG file

    const width = size;
    const height = size;

    // PNG signature
    const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

    // IHDR chunk
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData.writeUInt8(8, 8);   // bit depth
    ihdrData.writeUInt8(2, 9);   // color type (RGB)
    ihdrData.writeUInt8(0, 10);  // compression
    ihdrData.writeUInt8(0, 11);  // filter
    ihdrData.writeUInt8(0, 12);  // interlace

    const ihdrCrc = crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]));
    const ihdr = Buffer.alloc(25);
    ihdr.writeUInt32BE(13, 0);
    ihdr.write('IHDR', 4);
    ihdrData.copy(ihdr, 8);
    ihdr.writeUInt32BE(ihdrCrc, 21);

    // IDAT chunk (image data) - simple green pixels
    const rawData = [];
    for (let y = 0; y < height; y++) {
        rawData.push(0); // filter byte
        for (let x = 0; x < width; x++) {
            // Gradient from #25D366 to #128C7E
            const t = (x + y) / (width + height);
            const r = Math.floor(0x25 + (0x12 - 0x25) * t);
            const g = Math.floor(0xD3 + (0x8C - 0xD3) * t);
            const b = Math.floor(0x66 + (0x7E - 0x66) * t);
            rawData.push(r, g, b);
        }
    }

    const zlib = require('zlib');
    const compressed = zlib.deflateSync(Buffer.from(rawData));

    const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), compressed]));
    const idat = Buffer.alloc(12 + compressed.length);
    idat.writeUInt32BE(compressed.length, 0);
    idat.write('IDAT', 4);
    compressed.copy(idat, 8);
    idat.writeUInt32BE(idatCrc, 8 + compressed.length);

    // IEND chunk
    const iendCrc = crc32(Buffer.from('IEND'));
    const iend = Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4E, 0x44,
        (iendCrc >> 24) & 0xFF, (iendCrc >> 16) & 0xFF,
        (iendCrc >> 8) & 0xFF, iendCrc & 0xFF]);

    return Buffer.concat([signature, ihdr, idat, iend]);
}

// CRC32 calculation for PNG
function crc32(data) {
    let crc = 0xFFFFFFFF;
    const table = [];

    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c;
    }

    for (let i = 0; i < data.length; i++) {
        crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }

    return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Main execution
const assetsDir = path.join(__dirname, '..', 'assets');

const sizes = [16, 48, 128];

sizes.forEach(size => {
    const pngBuffer = createMinimalPNG(size);
    const filename = path.join(assetsDir, `icon${size}.png`);
    fs.writeFileSync(filename, pngBuffer);
    console.log(`Created ${filename}`);
});

console.log('\nIcons generated successfully!');
console.log('Note: These are simple placeholder icons. For production, replace with professionally designed icons.');
