import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: "VAPID anahtarları yapılandırılmamış" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const emergencyId = body.emergencyId;

    if (!emergencyId) {
      return new Response(
        JSON.stringify({ error: "emergencyId gerekli" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: emergency, error: emErr } = await supabase
      .from("emergencies")
      .select("*, trips(name)")
      .eq("id", emergencyId)
      .maybeSingle();

    if (emErr || !emergency) {
      return new Response(
        JSON.stringify({ error: "Acil durum bulunamadı" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: subscriptions, error: subErr } = await supabase
      .from("push_subscriptions")
      .select("*");

    if (subErr || !subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "Push aboneliği yok", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const webpush = await import("npm:web-push@3.6.7");
    webpush.setVapidDetails("mailto:admin@geziyonet.com", vapidPublicKey, vapidPrivateKey);

    const payload = JSON.stringify({
      title: "🚨 ACİL DURUM",
      body: `Acil durum: ${getLabel(emergency.emergency_type)}\nGezi: ${emergency.trips?.name || "-"}\nKonum: ${emergency.location || "-"}`,
      url: "/dashboard/acil-durum",
      emergencyId: emergencyId,
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const sub of subscriptions) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
      };
      try {
        await webpush.sendNotification(pushSubscription, payload);
        sentCount++;
      } catch (error: any) {
        failedCount++;
        if (error.statusCode === 410 || error.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ sent: sentCount, failed: failedCount, total: subscriptions.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getLabel(type: string): string {
  const labels: Record<string, string> = {
    saglik_durumu: "Sağlık Durumu",
    kayip_ogrenci: "Kayıp Öğrenci",
    otobus_arizasi: "Otobüs Arızası",
    trafik_kazasi: "Trafik Kazası",
    guvenlik_sorunu: "Güvenlik Sorunu",
    ogrenci_acil_durum: "Öğrenciyle İlgili Acil Durum",
    dogal_olay: "Doğal Olay",
    diger: "Diğer",
  };
  return labels[type] || type;
}
