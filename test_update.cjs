const url = "https://lcymbetnnuokrijynmjm.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794";

async function testUpdate() {
  const req = await fetch(`${url}/rest/v1/orders?select=id`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const orders = await req.json();
  if (orders.length > 0) {
    console.log("Found order, trying to update status to paid...", orders[0].id);
    const updateReq = await fetch(`${url}/rest/v1/orders?id=eq.${orders[0].id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ status: 'paid' })
    });
    console.log("Update response:", updateReq.status, updateReq.statusText);
    const body = await updateReq.text();
    console.log("Body:", body);
  } else {
    console.log("No orders found.");
  }
}
testUpdate();
