/**
 * Environment variable loader for scripts
 *
 * Loads from .env.local and provides required env vars.
 * Scripts should use this instead of hardcoding secrets.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
function loadEnvFile() {
  const envPaths = [
    join(__dirname, '..', '..', '.env.local'),
    join(process.cwd(), '.env.local'),
  ];

  for (const envPath of envPaths) {
    try {
      const content = readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const [key, ...rest] = line.split('=');
        if (key && rest.length && !key.startsWith('#')) {
          const value = rest.join('=').trim();
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = value;
          }
        }
      }
      return true;
    } catch (e) {
      continue;
    }
  }
  return false;
}

// Load env file on import
loadEnvFile();

/**
 * Get required environment variable - fails if not set
 */
export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`\n❌ Missing required environment variable: ${name}`);
    console.error(`   Please ensure it's set in .env.local or as an environment variable.\n`);
    process.exit(1);
  }
  return value;
}

/**
 * Get optional environment variable with default
 */
export function getEnv(name, defaultValue = undefined) {
  return process.env[name] || defaultValue;
}

// Common env vars - use these instead of hardcoding
export const SUPABASE_URL = getEnv('VITE_SUPABASE_URL', 'https://ygpfklhjwwqwrfpsfhue.supabase.co');
export const SUPABASE_ANON_KEY = () => requireEnv('VITE_SUPABASE_ANON_KEY');
export const SUPABASE_SERVICE_KEY = () => requireEnv('SUPABASE_SERVICE_ROLE_KEY');
export const GOOGLE_PLACES_API_KEY = () => requireEnv('GOOGLE_PLACES_API_KEY');
export const FIRECRAWL_API_KEY = () => requireEnv('FIRECRAWL_API_KEY');
export const TELEGRAM_BOT_TOKEN = () => getEnv('TELEGRAM_BOT_TOKEN');
export const TELEGRAM_CHAT_ID = () => getEnv('TELEGRAM_CHAT_ID');
