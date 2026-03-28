const { createClient } = require('@supabase/supabase-js');
const url = "https://lcymbetnnuokrijynmjm.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794";
const supabase = createClient(url, key);

async function testStorage() {
  // 1. List buckets
  console.log("=== Listing Buckets ===");
  const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets();
  if (bucketsErr) console.error("Error listing buckets:", bucketsErr);
  else console.log("Buckets:", buckets.map(b => `${b.name} (public: ${b.public})`));

  // 2. Try to create receipts bucket
  console.log("\n=== Creating 'receipts' bucket ===");
  const { data: createData, error: createErr } = await supabase.storage.createBucket('receipts', {
    public: true,
    fileSizeLimit: 10485760, // 10MB
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
  });
  if (createErr) console.error("Create bucket error:", createErr.message);
  else console.log("Bucket created:", createData);

  // 3. Try upload a test file
  console.log("\n=== Test Upload ===");
  const testContent = Buffer.from('test file content');
  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from('receipts')
    .upload('test_upload.txt', testContent, { contentType: 'text/plain', upsert: true });
  if (uploadErr) console.error("Upload error:", uploadErr.message);
  else {
    console.log("Upload OK:", uploadData);
    // Get public URL
    const { data: urlData } = supabase.storage.from('receipts').getPublicUrl('test_upload.txt');
    console.log("Public URL:", urlData.publicUrl);
    // Clean up
    await supabase.storage.from('receipts').remove(['test_upload.txt']);
    console.log("Test file cleaned up.");
  }
}

testStorage();
