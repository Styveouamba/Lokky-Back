import bcrypt from 'bcryptjs';
import User from '../models/userModel';

export const initDefaultAdmin = async () => {
  try {
    // Vérifier si un admin existe déjà
    const existingAdmin = await User.findOne({ role: 'admin' });

    if (existingAdmin) {
      console.log('✅ Admin user already exists');
      return;
    }

    // Créer l'admin par défaut
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@lokky.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
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

    console.log('✅ Default admin user created successfully');
    console.log(`📧 Email: ${adminEmail}`);
    console.log(`🔑 Password: ${adminPassword}`);
    console.log('⚠️  Please change the default password after first login!');
  } catch (error) {
    console.error('❌ Error creating default admin:', error);
  }
};
