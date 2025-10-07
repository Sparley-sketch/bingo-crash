#!/usr/bin/env node

/**
 * Development Environment Setup Script
 * This script helps set up the development environment
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Bingo Crash Development Environment...\n');

// Check if .env.local exists
const envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env.local file...');
  
  const envContent = `# Development Environment Variables
# Copy your development Supabase credentials here

# Development Supabase Project (use a separate project from production)
NEXT_PUBLIC_SUPABASE_URL_DEV=your_dev_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV=your_dev_anon_key
SUPABASE_SERVICE_ROLE_KEY_DEV=your_dev_service_role_key

# Production Supabase Project (keep existing values)
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key

# Development Mode
DEV_MODE=true
NODE_ENV=development
`;

  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env.local file');
} else {
  console.log('✅ .env.local already exists');
}

// Create development database setup instructions
const devSetupPath = path.join(__dirname, 'DEV_SETUP.md');
if (!fs.existsSync(devSetupPath)) {
  console.log('📝 Creating development setup instructions...');
  
  const devSetupContent = `# Development Environment Setup

## 1. Database Setup

### Create a separate Supabase project for development:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project called "bingo-crash-dev"
3. Copy the project URL and API keys

### Apply the development schema:
\`\`\`sql
-- Run the contents of supabase/schema-dev.sql in your development Supabase project
\`\`\`

## 2. Environment Variables

Update \`.env.local\` with your development credentials:

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL_DEV=your_dev_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV=your_dev_anon_key
SUPABASE_SERVICE_ROLE_KEY_DEV=your_dev_service_role_key
\`\`\`

## 3. Development Mode

The application will automatically use development tables when:
- \`NODE_ENV=development\` OR
- \`DEV_MODE=true\`

## 4. Development Tables

Development uses separate tables with \`_dev\` suffix:
- \`config_dev\` instead of \`config\`
- \`rounds_dev\` instead of \`rounds\`
- \`players_dev\` instead of \`players\`
- \`cards_dev\` instead of \`cards\`
- \`users_dev\` instead of \`users\`

## 5. Running Development

\`\`\`bash
npm run dev
\`\`\`

## 6. Safety Features

- Development environment is completely isolated from production
- Uses different Supabase project
- Uses different table names
- No risk of affecting production data
`;

  fs.writeFileSync(devSetupPath, devSetupContent);
  console.log('✅ Created DEV_SETUP.md');
} else {
  console.log('✅ DEV_SETUP.md already exists');
}

console.log('\n🎉 Development environment setup complete!');
console.log('\n📋 Next steps:');
console.log('1. Create a separate Supabase project for development');
console.log('2. Update .env.local with your dev credentials');
console.log('3. Run the development schema in your dev Supabase project');
console.log('4. Run: npm run dev');
console.log('\n📖 See DEV_SETUP.md for detailed instructions');
