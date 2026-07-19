import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mwsstrbanpgppapscrwk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13c3N0cmJhbnBncHBhcHNjcndrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMTk1MjEsImV4cCI6MjA5OTY5NTUyMX0.jghlhDbwFN2I47H434SjBY-jchZTIHlmwKJZ6C2KYBY';

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
