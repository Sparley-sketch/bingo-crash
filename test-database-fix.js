const { createClient } = require('@supabase/supabase-js');

// Test database connection and apply schema fixes
async function fixDatabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const { data, error } = await supabase.from('rounds').select('id').limit(1);
    if (error) {
      console.error('Database connection failed:', error);
      return;
    }
    
    console.log('Database connection successful');
    
    // Check if columns exist
    const { data: rounds, error: roundsError } = await supabase
      .from('rounds')
      .select('id, phase, prebuy_ends_at, round_starts_at')
      .limit(1);
      
    if (roundsError) {
      console.error('Schema check failed:', roundsError);
      console.log('Need to apply database schema changes');
    } else {
      console.log('Schema looks good:', rounds);
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

fixDatabase();
