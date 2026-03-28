import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';

// Load environment variables
config({ path: path.join(__dirname, '../../.env') });

function buildDataSourceOptions() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const sslRejectUnauthorized =
    process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true';

  if (databaseUrl) {
    return {
      type: 'postgres' as const,
      url: databaseUrl,
      ssl: { rejectUnauthorized: sslRejectUnauthorized },
      entities: [User],
      // Empty Neon DB: create users table on first seed (app sync creates the rest on startup)
      synchronize: true,
      logging: false,
    };
  }

  return {
    type: 'postgres' as const,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'zatca_einvoicing',
    entities: [User],
    synchronize: true,
    logging: false,
  };
}

async function seedAdmin() {
  const dataSource = new DataSource(buildDataSourceOptions());

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');

    const userRepository = dataSource.getRepository(User);

    // Check if admin already exists
    const existingAdmin = await userRepository.findOne({
      where: { email: 'admin@zatca.com' },
    });

    if (existingAdmin) {
      console.log('ℹ️  Admin user already exists');
      await dataSource.destroy();
      return;
    }

    // Create admin user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

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
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  Please change the password after first login!\n');

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Error seeding admin:', error);
    await dataSource.destroy();
    process.exit(1);
  }
}

seedAdmin();
