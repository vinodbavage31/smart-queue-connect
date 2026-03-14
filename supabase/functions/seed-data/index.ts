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

  const results: any = { users: {}, businesses: [], errors: [] };

  try {
    // 1. Create test users
    const testUsers = [
      { email: "admin@smartq.test", password: "Admin@123", fullName: "Admin User", role: "admin" },
      { email: "owner@smartq.test", password: "Owner@123", fullName: "Business Owner", role: "owner" },
      { email: "customer@smartq.test", password: "Customer@123", fullName: "Test Customer", role: "customer" },
    ];

    const userIds: Record<string, string> = {};

    for (const u of testUsers) {
      // Check if user exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((eu: any) => eu.email === u.email);
      
      if (existing) {
        userIds[u.role] = existing.id;
      } else {
        const { data, error } = await supabase.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.fullName },
        });
        if (error) {
          results.errors.push(`User ${u.email}: ${error.message}`);
          continue;
        }
        userIds[u.role] = data.user.id;

        // Create profile
        await supabase.from("profiles").upsert({
          id: data.user.id,
          full_name: u.fullName,
        });
      }

      // Assign role
      await supabase.from("user_roles").upsert(
        { user_id: userIds[u.role], role: u.role },
        { onConflict: "user_id,role" }
      );
    }

    results.users = {
      admin: { email: "admin@smartq.test", password: "Admin@123" },
      owner: { email: "owner@smartq.test", password: "Owner@123" },
      customer: { email: "customer@smartq.test", password: "Customer@123" },
    };

    // 2. Create 10 dummy businesses
    const ownerId = userIds["owner"];
    if (!ownerId) throw new Error("Owner user not created");

    const dummyBusinesses = [
      { name: "Elite Barber Shop", category: "Barber Shop", address: "123 Main St, Downtown", avg_service_mins: 20, phone: "555-0101" },
      { name: "Glamour Salon", category: "Salon", address: "456 Oak Ave, Midtown", avg_service_mins: 30, phone: "555-0102" },
      { name: "City Health Clinic", category: "Clinic", address: "789 Pine Blvd, Medical District", avg_service_mins: 15, phone: "555-0103" },
      { name: "Taste of Italy", category: "Restaurant", address: "321 Elm St, Food Quarter", avg_service_mins: 45, phone: "555-0104" },
      { name: "Quick Fix Auto", category: "Car Service", address: "654 Garage Lane, Industrial Zone", avg_service_mins: 60, phone: "555-0105" },
      { name: "Fresh Cuts Studio", category: "Barber Shop", address: "987 Style Ave, Fashion District", avg_service_mins: 25, phone: "555-0106" },
      { name: "Zen Wellness Spa", category: "Salon", address: "147 Tranquil Rd, Uptown", avg_service_mins: 40, phone: "555-0107" },
      { name: "MediCare Express", category: "Clinic", address: "258 Health Way, Westside", avg_service_mins: 10, phone: "555-0108" },
      { name: "Golden Dragon Restaurant", category: "Restaurant", address: "369 Dragon St, Chinatown", avg_service_mins: 35, phone: "555-0109" },
      { name: "Premium Auto Care", category: "Car Service", address: "480 Motor Ave, South Park", avg_service_mins: 50, phone: "555-0110" },
    ];

    const servicesMap: Record<string, { name: string; duration_mins: number; price: number }[]> = {
      "Barber Shop": [
        { name: "Haircut", duration_mins: 20, price: 25 },
        { name: "Beard Trim", duration_mins: 10, price: 15 },
        { name: "Hair + Beard Combo", duration_mins: 30, price: 35 },
      ],
      "Salon": [
        { name: "Hair Styling", duration_mins: 30, price: 40 },
        { name: "Manicure", duration_mins: 25, price: 20 },
        { name: "Facial Treatment", duration_mins: 45, price: 50 },
      ],
      "Clinic": [
        { name: "General Checkup", duration_mins: 15, price: 30 },
        { name: "Vaccination", duration_mins: 10, price: 20 },
        { name: "Lab Test", duration_mins: 20, price: 45 },
      ],
      "Restaurant": [
        { name: "Dine-In Table", duration_mins: 45, price: 0 },
        { name: "Takeaway Order", duration_mins: 15, price: 0 },
      ],
      "Car Service": [
        { name: "Oil Change", duration_mins: 30, price: 50 },
        { name: "Full Service", duration_mins: 60, price: 120 },
        { name: "Tire Rotation", duration_mins: 20, price: 40 },
      ],
    };

    // Create a few customer user IDs for bookings
    const customerIds: string[] = [];
    const customerId = userIds["customer"];
    if (customerId) customerIds.push(customerId);

    // Create additional dummy customers
    for (let i = 1; i <= 15; i++) {
      const email = `customer${i}@smartq.test`;
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((eu: any) => eu.email === email);
      
      if (existing) {
        customerIds.push(existing.id);
      } else {
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password: "Test@12345",
          email_confirm: true,
          user_metadata: { full_name: `Customer ${i}` },
        });
        if (!error && data.user) {
          customerIds.push(data.user.id);
          await supabase.from("profiles").upsert({ id: data.user.id, full_name: `Customer ${i}` });
          await supabase.from("user_roles").upsert(
            { user_id: data.user.id, role: "customer" },
            { onConflict: "user_id,role" }
          );
        }
      }
    }

    for (const biz of dummyBusinesses) {
      // Check if business exists
      const { data: existingBiz } = await supabase
        .from("businesses")
        .select("id")
        .eq("name", biz.name)
        .eq("owner_id", ownerId)
        .maybeSingle();

      let bizId: string;
      if (existingBiz) {
        bizId = existingBiz.id;
      } else {
        const { data: newBiz, error } = await supabase.from("businesses").insert({
          owner_id: ownerId,
          name: biz.name,
          category: biz.category,
          address: biz.address,
          avg_service_mins: biz.avg_service_mins,
          phone: biz.phone,
          is_open: true,
          status: "approved",
        }).select("id").single();

        if (error) {
          results.errors.push(`Business ${biz.name}: ${error.message}`);
          continue;
        }
        bizId = newBiz.id;
      }

      results.businesses.push({ name: biz.name, id: bizId });

      // Add services
      const categoryServices = servicesMap[biz.category] || [];
      const { data: existingSvcs } = await supabase
        .from("services")
        .select("id")
        .eq("business_id", bizId);

      if (!existingSvcs || existingSvcs.length === 0) {
        const serviceInserts = categoryServices.map(s => ({
          business_id: bizId,
          name: s.name,
          duration_mins: s.duration_mins,
          price: s.price,
          is_active: true,
        }));
        await supabase.from("services").insert(serviceInserts);
      }

      // Get service IDs for bookings
      const { data: svcData } = await supabase
        .from("services")
        .select("id")
        .eq("business_id", bizId);

      if (!svcData || svcData.length === 0) continue;

      // Check existing bookings
      const { count: existingBookings } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("business_id", bizId)
        .eq("status", "waiting");

      if ((existingBookings || 0) > 0) continue;

      // Create 3-12 queue entries
      const queueSize = 3 + Math.floor(Math.random() * 10);
      const bookingInserts = [];

      for (let j = 0; j < queueSize && j < customerIds.length; j++) {
        const svcId = svcData[j % svcData.length].id;
        bookingInserts.push({
          user_id: customerIds[j],
          business_id: bizId,
          service_id: svcId,
          token_number: j + 1,
          position: j + 1,
          status: "waiting",
        });
      }

      if (bookingInserts.length > 0) {
        await supabase.from("bookings").insert(bookingInserts);
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message, ...results }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
