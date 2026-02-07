const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Generate subdomain from domain name
 */
function generateSubdomain(domainName) {
  const mainPart = domainName.split('.')[0];
  
  const sanitized = mainPart
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  const timestamp = Date.now().toString(36).slice(-4);
  
  return `${sanitized}-${timestamp}`;
}

async function main() {
  console.log('🔄 Backfilling subdomains for existing websites...\n');

  // Find all websites
  const websites = await prisma.website.findMany({
    include: {
      domain: true,
    },
  });
  
  // Filter those without subdomain
  const websitesNeedingSubdomain = websites.filter(w => !w.subdomain || w.subdomain === '');

  if (websitesNeedingSubdomain.length === 0) {
    console.log('✅ No websites need backfilling. All websites have subdomains!');
    return;
  }

  console.log(`Found ${websitesNeedingSubdomain.length} website(s) without subdomain:\n`);

  for (const website of websitesNeedingSubdomain) {
    const subdomain = generateSubdomain(website.domain.domainName);
    
    console.log(`📌 ${website.domain.domainName}`);
    console.log(`   🌐 Generated subdomain: ${subdomain}`);
    
    await prisma.website.update({
      where: { id: website.id },
      data: { subdomain },
    });
    
    console.log(`   ✅ Updated\n`);
  }

  console.log(`\n🎉 Successfully backfilled ${websitesNeedingSubdomain.length} website(s)!`);
  console.log('\n📋 Next steps:');
  console.log('1. Configure wildcard DNS for *.yourdomain.com');
  console.log('2. Update PLATFORM_DOMAIN in backend/.env');
  console.log('3. Restart backend server');
  console.log('4. Users can now access their sites via subdomain!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

