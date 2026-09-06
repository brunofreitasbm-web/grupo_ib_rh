import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vththexblpxwocbowhsv.supabase.co';
const supabaseAnonKey = 'sb_publishable_Hq1T72bd1XYHv-iGw_CPZQ_L6P2-3KI';

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
}

checkData();
