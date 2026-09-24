import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const localAuthEnabled = process.env.NODE_ENV === 'development' && process.env.LOCAL_AUTH_ENABLED === 'true';
const supabaseUrl = process.env.SUPABASE_URL || (localAuthEnabled ? 'http://127.0.0.1:54321' : undefined);
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || (localAuthEnabled ? 'local-development-key' : undefined);
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL environment variable is required');
}

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey)
  .schema('log_frotamax');

export const supabaseAnon = createClient(
  supabaseUrl, 
  supabaseAnonKey || supabaseServiceKey
).schema('log_frotamax');
