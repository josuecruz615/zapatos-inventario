// Genera los íconos PNG de la app instalable a partir de public/favicon.svg
import sharp from 'sharp'
const svg = 'public/favicon.svg'
await sharp(svg).resize(192, 192).png().toFile('public/pwa-192.png')
await sharp(svg).resize(512, 512).png().toFile('public/pwa-512.png')
await sharp(svg).resize(180, 180).png().toFile('public/apple-touch-icon.png')
console.log('Íconos generados')
