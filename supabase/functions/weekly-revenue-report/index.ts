import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting weekly revenue report generation...");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate date ranges
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // Fetch revenue data
    const { data: allEntries, error } = await supabase
      .from("revenue_entries")
      .select("*")
      .order("payment_date", { ascending: false });

    if (error) {
      console.error("Error fetching revenue entries:", error);
      throw error;
    }

    const entries = allEntries || [];

    // Calculate metrics
    const weeklyPaid = entries
      .filter((e) => e.status === "paid" && new Date(e.payment_date) >= weekAgo)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const weeklyPending = entries
      .filter((e) => e.status === "pending" && new Date(e.payment_date) >= weekAgo)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const monthlyPaid = entries
      .filter((e) => e.status === "paid" && new Date(e.payment_date) >= monthStart)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const yearlyPaid = entries
      .filter((e) => e.status === "paid" && new Date(e.payment_date) >= yearStart)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const totalPending = entries
      .filter((e) => e.status === "pending")
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const overdueCount = entries.filter((e) => e.status === "overdue").length;

    // Recent transactions (last 5)
    const recentTransactions = entries.slice(0, 5);

    const formatCurrency = (amount: number) =>
      `£${amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fafafa; padding: 20px;">
        <div style="background: #1a1a1a; padding: 30px; border-radius: 8px 8px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">Weekly Revenue Report</h1>
          <p style="color: #888; margin: 5px 0 0;">Week ending ${now.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        
        <div style="background: #fff; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5; border-top: none;">
          <h2 style="color: #333; margin-top: 0;">📊 This Week's Summary</h2>
          
          <div style="display: flex; gap: 15px; margin-bottom: 25px;">
            <div style="flex: 1; background: #dcfce7; padding: 15px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; color: #166534; font-size: 12px; text-transform: uppercase;">Paid</p>
              <p style="margin: 5px 0 0; color: #166534; font-size: 24px; font-weight: bold;">${formatCurrency(weeklyPaid)}</p>
            </div>
            <div style="flex: 1; background: #fef3c7; padding: 15px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; color: #92400e; font-size: 12px; text-transform: uppercase;">Pending</p>
              <p style="margin: 5px 0 0; color: #92400e; font-size: 24px; font-weight: bold;">${formatCurrency(weeklyPending)}</p>
            </div>
          </div>

          <h3 style="color: #333; border-bottom: 1px solid #e5e5e5; padding-bottom: 10px;">📈 Overall Stats</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <tr>
              <td style="padding: 10px 0; color: #666;">Monthly Revenue (${now.toLocaleString("en-GB", { month: "long" })})</td>
              <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formatCurrency(monthlyPaid)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #666;">Year to Date (${now.getFullYear()})</td>
              <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formatCurrency(yearlyPaid)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #666;">Total Outstanding</td>
              <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #f59e0b;">${formatCurrency(totalPending)}</td>
            </tr>
            ${overdueCount > 0 ? `
            <tr>
              <td style="padding: 10px 0; color: #ef4444;">Overdue Invoices</td>
              <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #ef4444;">${overdueCount}</td>
            </tr>
            ` : ""}
          </table>

          ${recentTransactions.length > 0 ? `
          <h3 style="color: #333; border-bottom: 1px solid #e5e5e5; padding-bottom: 10px;">💳 Recent Transactions</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${recentTransactions.map((t) => `
              <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 12px 0;">
                  <p style="margin: 0; font-weight: 500;">${t.client_name}</p>
                  <p style="margin: 2px 0 0; color: #888; font-size: 12px;">${t.description}</p>
                </td>
                <td style="padding: 12px 0; text-align: right;">
                  <p style="margin: 0; font-weight: bold;">${formatCurrency(Number(t.amount))}</p>
                  <p style="margin: 2px 0 0; font-size: 11px; color: ${t.status === "paid" ? "#16a34a" : t.status === "overdue" ? "#ef4444" : "#f59e0b"}; text-transform: uppercase;">${t.status}</p>
                </td>
              </tr>
            `).join("")}
          </table>
          ` : "<p style='color: #888;'>No transactions this week.</p>"}
        </div>
        
        <p style="text-align: center; color: #888; font-size: 12px; margin-top: 20px;">
          BrainBulb Design Studio • Weekly Report
        </p>
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: "BrainBulb <onboarding@resend.dev>",
      to: ["jasonarm82@gmail.com"],
      subject: `📊 Weekly Revenue Report - ${formatCurrency(weeklyPaid)} earned this week`,
      html,
    });

    console.log("Weekly report sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, weeklyPaid, weeklyPending }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error generating weekly report:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
