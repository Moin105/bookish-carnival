import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcryptjs';

config({ path: path.join(__dirname, '../../.env') });

async function createAdmin() {
  console.log('Creating admin user...\n');

  const databaseUrl = process.env.DATABASE_URL?.trim();
  const sslRejectUnauthorized =
    process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true';

  if (databaseUrl) {
    console.log('Database: using DATABASE_URL (Neon / hosted Postgres)\n');
  } else {
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      database: process.env.DB_DATABASE || 'zatca_einvoicing',
    };
    console.log('Database Config:');
    console.log(`  Host: ${dbConfig.host}`);
    console.log(`  Port: ${dbConfig.port}`);
    console.log(`  Database: ${dbConfig.database}`);
    console.log(`  Username: ${dbConfig.username}\n`);
  }

  const dataSource = new DataSource(
    databaseUrl
      ? {
          type: 'postgres',
          url: databaseUrl,
          ssl: { rejectUnauthorized: sslRejectUnauthorized },
          entities: [User],
          synchronize: true,
          logging: false,
        }
      : {
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: process.env.DB_USERNAME || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_DATABASE || 'zatca_einvoicing',
          entities: [User],
          synchronize: true,
          logging: false,
        },
  );

  try {
    await dataSource.initialize();
    console.log('✅ Database connected successfully\n');

    const userRepository = dataSource.getRepository(User);

    // Check if admin already exists
    const existingAdmin = await userRepository.findOne({
      where: { email: 'admin@zatca.com' },
    });

    if (existingAdmin) {
      console.log('ℹ️  Admin user already exists');
      console.log('   Email: admin@zatca.com');
      console.log('   If you want to reset password, delete the user first\n');
      await dataSource.destroy();
      return;
    }

    // Create admin user
    console.log('Creating admin user...');
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('admin123', salt);

    const admin = userRepository.create({
      email: 'admin@zatca.com',
      password: hashedPassword,
      name: 'System Administrator',
      role: 'admin',
      isActive: true,
    });

    await userRepository.save(admin);

    console.log('\n✅ Admin user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:    admin@zatca.com');
    console.log('🔑 Password: admin123');
    console.log('👤 Role:     admin');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  Please change the password after first login!\n');

    await dataSource.destroy();
  } catch (error: any) {
    console.error('\n❌ Error creating admin user:');
    if (error.code === '28P01') {
      console.error('   Database authentication failed!');
      console.error('   Please check your database credentials in backend/.env');
      console.error('   Or update the script with correct credentials\n');
    } else if (error.code === '3D000') {
      console.error('   Database does not exist!');
      console.error(
        `   Please create the database in Neon or set DB_DATABASE in .env\n`,
      );
    } else {
      console.error('   ', error.message);
    }
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
}

createAdmin();
