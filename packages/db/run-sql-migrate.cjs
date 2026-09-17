#!/usr/bin/env node
/**
 * Blackbox Protocol — Direct SQL Migration Script
 * Enforces schema creation for Cloudflare D1 without drizzle-kit push.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isRemote = process.argv.includes('--remote');
const dbName = process.env.D1_DATABASE_NAME || 'witness-meta';

const sqlPath = path.resolve(__dirname, '../../workers/schema.sql');
if (!fs.existsSync(sqlPath)) {
  console.error(`Schema file not found at: ${sqlPath}`);
  process.exit(1);
}

const flag = isRemote ? '--remote' : '--local';
console.log(`Applying migrations to D1 database "${dbName}" (${flag})...`);

try {
  execSync(`wrangler d1 execute ${dbName} ${flag} --file="${sqlPath}"`, {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '../../workers/ingestion'),
  });
  console.log('✅ Migration applied successfully.');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}
