require('dotenv').config();
const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
const { createCanvas } = require('canvas');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function testUpload() {
  try {
    console.log('🎨 Création d\'une image de test...');
    
    // Créer le dossier uploads s'il n'existe pas
    if (!fs.existsSync('./uploads')) {
      fs.mkdirSync('./uploads');
    }
    
    // Créer une image simple avec canvas
    const canvas = createCanvas(200, 200);
    const ctx = canvas.getContext('2d');
    
    // Fond bleu
    ctx.fillStyle = '#4A90E2';
    ctx.fillRect(0, 0, 200, 200);
    
    // Texte blanc
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('TEST', 100, 100);
    
    const testImagePath = './uploads/test-image.jpg';
    const buffer = canvas.toBuffer('image/jpeg');
    fs.writeFileSync(testImagePath, buffer);
    
    console.log('✅ Image de test créée');
    
    console.log('\n📤 Upload vers Cloudinary...');
    const startTime = Date.now();
    
    const result = await cloudinary.uploader.upload(testImagePath, {
      folder: 'lokky',
      timeout: 60000,
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Upload réussi en ${duration}ms`);
    console.log('\nDétails:');
    console.log('  URL:', result.secure_url);
    console.log('  Public ID:', result.public_id);
    console.log('  Format:', result.format);
    console.log('  Taille:', result.bytes, 'bytes');
    console.log('  Dimensions:', `${result.width}x${result.height}`);
    
    // Nettoyer
    fs.unlinkSync(testImagePath);
    console.log('\n🗑️  Fichier temporaire supprimé');
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    if (error.http_code) {
      console.error('HTTP Code:', error.http_code);
    }
    console.error('Stack:', error.stack);
  }
}

testUpload();
