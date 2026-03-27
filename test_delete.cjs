const url = "https://lcymbetnnuokrijynmjm.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794";

async function testDelete() {
  const req = await fetch(`${url}/rest/v1/orders?select=id`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const orders = await req.json();
  if (orders.length > 0) {
    console.log("Found order, trying to delete...", orders[0].id);
    const delReq = await fetch(`${url}/rest/v1/orders?id=eq.${orders[0].id}`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    console.log("Delete order response:", delReq.status, delReq.statusText);
  } else {
    console.log("No orders found.");
  }
}
testDelete();
