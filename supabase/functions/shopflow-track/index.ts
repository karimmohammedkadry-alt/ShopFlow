import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json();
    const token = String(body.token || "");
    if (!/^[a-f0-9]{48}$/.test(token)) return new Response("Invalid site token", { status: 400 });
    const { data: site, error } = await supabase.from("shopflow_tracking_sites")
      .select("user_id,allowed_origins,is_active").eq("public_token", token).maybeSingle();
    if (error || !site || !site.is_active) return new Response("Tracking site not found", { status: 404 });
    const allowed = (site.allowed_origins || []).map((v: string) => v.toLowerCase().replace(/\/$/, ""));
    const normalizedOrigin = origin.toLowerCase().replace(/\/$/, "");
    if (!origin || !allowed.includes(normalizedOrigin)) return new Response("Origin is not allowed", { status: 403 });
    const eventName = String(body.event_name || "page_view");
    const accepted = ["page_view","session_start","add_to_cart","begin_checkout","purchase","lead","custom"];
    if (!accepted.includes(eventName)) return new Response("Invalid event", { status: 400 });
    const clean = (v: unknown, max = 500) => String(v || "").slice(0, max);
    const { error: insertError } = await supabase.from("shopflow_analytics_events").insert({
      user_id: site.user_id, event_name: eventName,
      visitor_id: clean(body.visitor_id, 80), session_id: clean(body.session_id, 80),
      page_url: clean(body.page_url, 1000), page_path: clean(body.page_path, 500),
      referrer: clean(body.referrer, 1000), utm_source: clean(body.utm_source, 200),
      utm_medium: clean(body.utm_medium, 200), utm_campaign: clean(body.utm_campaign, 200),
      event_value: Number.isFinite(Number(body.event_value)) ? Number(body.event_value) : null,
      currency: clean(body.currency || "EGP", 3).toUpperCase(),
    });
    if (insertError) return new Response("Could not record event", { status: 500 });
    return Response.json({ ok: true }, { headers: cors(origin) });
  } catch {
    return new Response("Invalid request", { status: 400, headers: cors(origin) });
  }
});
