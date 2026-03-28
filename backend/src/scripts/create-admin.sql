-- Manual SQL script to create admin user
-- Run this in your PostgreSQL database

-- First, make sure the users table exists (it will be created when backend starts)
-- Then run this SQL:

-- Note: Password is hashed with bcrypt for 'admin123'
-- If you need to generate a new hash, use: bcrypt.hash('admin123', 10)

INSERT INTO users (id, email, password, name, role, "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@zatca.com',
  '$2b$10$rQ8K8K8K8K8K8K8K8K8K8eK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', -- This is a placeholder, will be updated
  'System Administrator',
  'admin',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- To generate proper bcrypt hash, you can:
-- 1. Start backend server (it will create the table)
-- 2. Use the API to register: POST /auth/register
-- OR
-- 3. Use Node.js to generate hash:
--    const bcrypt = require('bcrypt');
--    bcrypt.hash('admin123', 10).then(console.log);
