import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const results: any = { users: {}, errors: [] };

  try {
    // Create 3 test users
    const testUsers = [
      { email: "admin@smartq.test", password: "Admin@123", fullName: "Admin User", role: "admin" },
      { email: "owner@smartq.test", password: "Owner@123", fullName: "Business Owner", role: "owner" },
      { email: "customer@smartq.test", password: "Customer@123", fullName: "Test Customer", role: "customer" },
    ];

    const userIds: Record<string, string> = {};

    for (const u of testUsers) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.fullName },
      });
      if (error && error.message.includes("already been registered")) {
        const { data: list } = await supabase.auth.admin.listUsers();
        const found = list?.users?.find((eu: any) => eu.email === u.email);
        if (found) userIds[u.role] = found.id;
      } else if (data?.user) {
        userIds[u.role] = data.user.id;
        await supabase.from("profiles").upsert({ id: data.user.id, full_name: u.fullName });
      }
      if (userIds[u.role]) {
        await supabase.from("user_roles").upsert(
          { user_id: userIds[u.role], role: u.role },
          { onConflict: "user_id,role" }
        );
      }
    }

    results.users = {
      admin: { email: "admin@smartq.test", password: "Admin@123" },
      owner: { email: "owner@smartq.test", password: "Owner@123" },
      customer: { email: "customer@smartq.test", password: "Customer@123" },
    };

    // Create 5 dummy customers for queue entries
    const customerIds: string[] = [];
    if (userIds["customer"]) customerIds.push(userIds["customer"]);

    for (let i = 1; i <= 12; i++) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: `cust${i}@smartq.test`,
        password: "Test@12345",
        email_confirm: true,
        user_metadata: { full_name: `Customer ${i}` },
      });
      if (error && error.message.includes("already been registered")) {
        const { data: list } = await supabase.auth.admin.listUsers();
        const found = list?.users?.find((eu: any) => eu.email === `cust${i}@smartq.test`);
        if (found) customerIds.push(found.id);
      } else if (data?.user) {
        customerIds.push(data.user.id);
        await supabase.from("profiles").upsert({ id: data.user.id, full_name: `Customer ${i}` });
        await supabase.from("user_roles").upsert(
          { user_id: data.user.id, role: "customer" },
          { onConflict: "user_id,role" }
        );
      }
    }

    const ownerId = userIds["owner"];
    if (!ownerId) {
      return new Response(JSON.stringify({ error: "Owner not created", ...results }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Businesses
    const businesses = [
      { name: "Elite Barber Shop", category: "Barber Shop", address: "123 Main St, Downtown", avg: 20 },
      { name: "Glamour Salon", category: "Salon", address: "456 Oak Ave, Midtown", avg: 30 },
      { name: "City Health Clinic", category: "Clinic", address: "789 Pine Blvd, Medical District", avg: 15 },
      { name: "Taste of Italy", category: "Restaurant", address: "321 Elm St, Food Quarter", avg: 45 },
      { name: "Quick Fix Auto", category: "Car Service", address: "654 Garage Lane, Industrial Zone", avg: 60 },
      { name: "Fresh Cuts Studio", category: "Barber Shop", address: "987 Style Ave, Fashion District", avg: 25 },
      { name: "Zen Wellness Spa", category: "Salon", address: "147 Tranquil Rd, Uptown", avg: 40 },
      { name: "MediCare Express", category: "Clinic", address: "258 Health Way, Westside", avg: 10 },
      { name: "Golden Dragon", category: "Restaurant", address: "369 Dragon St, Chinatown", avg: 35 },
      { name: "Premium Auto Care", category: "Car Service", address: "480 Motor Ave, South Park", avg: 50 },
    ];

    const svcMap: Record<string, { name: string; dur: number; price: number }[]> = {
      "Barber Shop": [{ name: "Haircut", dur: 20, price: 25 }, { name: "Beard Trim", dur: 10, price: 15 }],
      "Salon": [{ name: "Hair Styling", dur: 30, price: 40 }, { name: "Manicure", dur: 25, price: 20 }],
      "Clinic": [{ name: "General Checkup", dur: 15, price: 30 }, { name: "Vaccination", dur: 10, price: 20 }],
      "Restaurant": [{ name: "Dine-In Table", dur: 45, price: 0 }, { name: "Takeaway", dur: 15, price: 0 }],
      "Car Service": [{ name: "Oil Change", dur: 30, price: 50 }, { name: "Full Service", dur: 60, price: 120 }],
    };

    for (const biz of businesses) {
      const { data: existing } = await supabase.from("businesses").select("id").eq("name", biz.name).maybeSingle();
      let bizId: string;

      if (existing) {
        bizId = existing.id;
      } else {
        const { data: newBiz, error } = await supabase.from("businesses").insert({
          owner_id: ownerId, name: biz.name, category: biz.category,
          address: biz.address, avg_service_mins: biz.avg, is_open: true, status: "approved",
        }).select("id").single();
        if (error) { results.errors.push(error.message); continue; }
        bizId = newBiz.id;
      }

      // Services
      const { data: existSvcs } = await supabase.from("services").select("id").eq("business_id", bizId);
      let svcIds: string[] = existSvcs?.map(s => s.id) || [];

      if (svcIds.length === 0) {
        const svcs = svcMap[biz.category] || [];
        const { data: insertedSvcs } = await supabase.from("services").insert(
          svcs.map(s => ({ business_id: bizId, name: s.name, duration_mins: s.dur, price: s.price }))
        ).select("id");
        svcIds = insertedSvcs?.map(s => s.id) || [];
      }

      if (svcIds.length === 0) continue;

      // Queue entries (3-12)
      const { count } = await supabase.from("bookings").select("*", { count: "exact", head: true })
        .eq("business_id", bizId).eq("status", "waiting");
      if ((count || 0) > 0) continue;

      const queueSize = 3 + Math.floor(Math.random() * 10);
      const bookings = [];
      for (let j = 0; j < Math.min(queueSize, customerIds.length); j++) {
        bookings.push({
          user_id: customerIds[j], business_id: bizId,
          service_id: svcIds[j % svcIds.length],
          token_number: j + 1, position: j + 1, status: "waiting",
        });
      }
      if (bookings.length > 0) {
        await supabase.from("bookings").insert(bookings);
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message, ...results }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
