const fs = require('fs');

const url = "https://lcymbetnnuokrijynmjm.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794";
const adminToken = Buffer.from('admin:master').toString('base64');

async function wipe() {
  console.log("Buscando orders...");
  const res1 = await fetch(`${url}/rest/v1/orders?select=id`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const orders = await res1.json();
  
  console.log("Buscando bookings legados...");
  const res2 = await fetch(`${url}/rest/v1/bookings?select=id`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const bks = await res2.json();

  console.log(`Encontrados ${orders.length} orders e ${bks.length} bookings.`);

  for(const o of orders) {
    if(!o.id) continue;
    console.log("Deletando order", o.id);
    await fetch(`${url}/functions/v1/admin-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ bookingId: o.id, isOrder: true, adminToken })
    });
  }

  for(const b of bks) {
    if(!b.id) continue;
    console.log("Deletando booking", b.id);
    await fetch(`${url}/functions/v1/admin-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ bookingId: b.id, isOrder: false, adminToken })
    });
  }
  
  console.log("TUDO LIMPO!");
}

wipe();
