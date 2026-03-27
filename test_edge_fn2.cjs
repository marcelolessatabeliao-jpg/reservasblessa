const url1 = "https://lcymbetnnuokrijynmjm.supabase.co/functions/v1/admin-delete";
const url2 = "https://lcymbetnnuokrijynmjm.supabase.co/functions/v1/create-payment";

async function testEdgeFn(url) {
  const res = await fetch(url, { method: "OPTIONS", headers: { "Origin": "http://localhost:8081" } });
  console.log(url, res.status);
}
testEdgeFn(url1);
testEdgeFn(url2);
