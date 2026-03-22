require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lokky';

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  name: String,
  role: String,
  authProvider: String,
  location: {
    type: { type: String },
    coordinates: [Number],
  },
  moderation: {
    status: String,
    warningCount: Number,
    reportCount: Number,
  },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function createAdmin() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    // Vérifier si un admin existe
    const existingAdmin = await User.findOne({ role: 'admin' });
    
    if (existingAdmin) {
      console.log('✅ Un admin existe déjà:');
      console.log('   Email:', existingAdmin.email);
      console.log('   Nom:', existingAdmin.name);
      console.log('   Rôle:', existingAdmin.role);
      console.log('   ID:', existingAdmin._id);
      
      // Vérifier si c'est bien un admin
      if (existingAdmin.role !== 'admin') {
        console.log('⚠️  Correction du rôle...');
        existingAdmin.role = 'admin';
        await existingAdmin.save();
        console.log('✅ Rôle corrigé en admin');
      }
    } else {
      console.log('📝 Création d\'un nouvel admin...');
      
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@lokky.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@Lokky2024';
      const adminName = process.env.ADMIN_NAME || 'Admin Lokky';

      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      const admin = await User.create({
        email: adminEmail,
        password: hashedPassword,
        name: adminName,
        role: 'admin',
        authProvider: 'email',
        location: {
          type: 'Point',
          coordinates: [0, 0],
        },
        moderation: {
          status: 'active',
          warningCount: 0,
          reportCount: 0,
        },
      });

      console.log('✅ Admin créé avec succès!');
      console.log('   Email:', adminEmail);
      console.log('   Mot de passe:', adminPassword);
      console.log('   ID:', admin._id);
      console.log('');
      console.log('⚠️  IMPORTANT: Changez le mot de passe après la première connexion!');
    }

    // Lister tous les admins
    console.log('\n📋 Liste de tous les admins:');
    const allAdmins = await User.find({ role: 'admin' });
    allAdmins.forEach((admin, index) => {
      console.log(`   ${index + 1}. ${admin.name} (${admin.email}) - ID: ${admin._id}`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Terminé');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

createAdmin();
