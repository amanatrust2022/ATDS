const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function uploadFile(filePath, destName, contentType) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  
  const fileBuffer = fs.readFileSync(filePath);
  
  // Upload to the public bucket named 'updates'
  const { data, error } = await supabase.storage
    .from('updates')
    .upload(destName, fileBuffer, {
      contentType,
      upsert: true // Overwrites existing file
    });

  if (error) {
    throw new Error(`Failed to upload ${destName}: ${error.message}`);
  }
  
  console.log(`✅ Uploaded ${destName} successfully!`);
}

async function main() {
  try {
    const distDir = path.join(__dirname, 'dist');
    
    // Upload version.json
    console.log('Uploading version.json...');
    await uploadFile(
      path.join(distDir, 'version.json'),
      'version.json',
      'application/json'
    );
    
    // Upload update-latest.zip
    console.log('Uploading update-latest.zip...');
    await uploadFile(
      path.join(distDir, 'update-latest.zip'),
      'update-latest.zip',
      'application/zip'
    );

    // Upload amana-hub-portable.zip
    console.log('Uploading amana-hub-portable.zip...');
    await uploadFile(
      path.join(distDir, 'amana-hub-portable.zip'),
      'amana-hub-portable.zip',
      'application/zip'
    );
    
    console.log('🎉 Update files deployed successfully to Supabase Storage!');
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

main();
