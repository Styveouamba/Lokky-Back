require('dotenv').config();
const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
const https = require('https');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function testUpload() {
  try {
    console.log('📥 Téléchargement d\'une image de test...');
    
    // Télécharger une petite image de test
    const testImageUrl = 'https://via.placeholder.com/150';
    const testImagePath = './uploads/test-image.jpg';
    
    // Créer le dossier uploads s'il n'existe pas
    if (!fs.existsSync('./uploads')) {
      fs.mkdirSync('./uploads');
    }
    
    const file = fs.createWriteStream(testImagePath);
    
    await new Promise((resolve, reject) => {
      https.get(testImageUrl, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(testImagePath, () => {});
        reject(err);
      });
    });
    
    console.log('✅ Image de test téléchargée');
    
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
    console.error('Détails:', error);
  }
}

testUpload();
