require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const dbPath = path.join(process.cwd(), 'amana_clinic.db');
const db = new DatabaseSync(dbPath);

async function fix() {
  console.log('Fetching missing doctor and facility from local DB...');
  const doctor = db.prepare('SELECT * FROM referring_doctors WHERE id = ?').get('15e4d37e-8db8-4555-a98d-f2da05031469');
  const facility = db.prepare('SELECT * FROM referring_facilities WHERE id = ?').get('aac71c10-f60a-41ed-ae95-660cbe0ab88d');

  if (facility) {
    console.log('Inserting facility into Supabase...');
    const { error } = await supabase.from('referring_facilities').upsert({
      ...facility,
      is_active: facility.is_active === 1
    });
    if (error) console.error('Facility upsert error:', error);
    else console.log('Facility inserted successfully.');
  }

  if (doctor) {
    console.log('Inserting doctor into Supabase...');
    const { error } = await supabase.from('referring_doctors').upsert({
      ...doctor,
      is_active: doctor.is_active === 1
    });
    if (error) console.error('Doctor upsert error:', error);
    else console.log('Doctor inserted successfully.');
  }
}

fix().then(() => console.log('Done')).catch(console.error);
