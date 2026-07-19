require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://mwsstrbanpgppapscrwk.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
  console.log("Checking Supabase connection...");
  
  // Test connection to 'units'
  const { data: unitsData, error: unitsError } = await supabase.from('units').select('*');
  
  if (unitsError) {
    console.error("Units error:", unitsError);
  } else {
    console.log(`Units found: ${unitsData.length}`);
  }

  // Attempt login with supervisor credentials to check role
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'supervisor@portoterapia.com',
    password: 'admin123'
  });

  if (authError) {
    console.error("Auth error:", authError.message);
  } else {
    console.log("Login successful!");
    console.log("Role metadata:", authData.user.user_metadata?.role);
    
    // Now try to fetch interns
    const { data: internsData, error: internsError } = await supabase.from('interns').select('id, name');
    if (internsError) {
      console.error("Interns fetch error:", internsError);
    } else {
      console.log(`Interns found: ${internsData.length}`);
      console.log("Interns:", internsData);
    }
  }
}

checkData();
