/**
 * Script to create Super Admin account
 * 
 * Usage: node scripts/create-admin.js
 */

// Load environment variables
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createAdmin() {
  const email = 'admin@cms.com';
  const password = 'abcd1234';

  try {
    // Check if admin already exists
    const existing = await prisma.users.findUnique({
      where: { email },
    });

    if (existing) {
      console.log('❌ Admin account already exists:', email);
      console.log('   Current role:', existing.role);
      
      if (existing.role !== 'SUPER_ADMIN') {
        // Update to super admin
        await prisma.users.update({
          where: { id: existing.id },
          data: { role: 'SUPER_ADMIN' },
        });
        console.log('✅ Updated to SUPER_ADMIN role');
      }
      
      process.exit(0);
    }

    // Generate password hash
    console.log('🔐 Generating password hash...');
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user
    console.log('👤 Creating admin user...');
    const { v4: uuidv4 } = require('uuid');
    const admin = await prisma.users.create({
      data: {
        id: uuidv4(),
        email,
        password_hash: passwordHash,
        role: 'SUPER_ADMIN',
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    console.log('\n✅ Super Admin created successfully!');
    console.log('\n📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('👑 Role:', admin.role);
    console.log('\n🚀 You can now login to the admin portal at http://localhost:3002\n');

  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();

