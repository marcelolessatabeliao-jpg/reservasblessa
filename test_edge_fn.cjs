const url = "https://lcymbetnnuokrijynmjm.supabase.co/functions/v1/update-booking-status";

async function testEdgeFn() {
  try {
    const res = await fetch(url, {
      method: "OPTIONS",
      headers: { "Origin": "http://localhost:8081" }
    });
    console.log("OPTIONS status:", res.status);
    console.log("CORS ok:", res.headers.get("access-control-allow-origin"));
  } catch (e) {
    console.log("Fetch failed:", e);
  }
}
testEdgeFn();
