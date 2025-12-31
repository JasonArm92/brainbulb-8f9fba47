import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "jasonarm82@gmail.com";

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  status: string;
  progress: number;
  client_id: string | null;
}

interface Client {
  id: string;
  name: string;
  email: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date().toISOString().split('T')[0];

    console.log(`Checking for overdue milestones as of ${today}`);

    // Fetch overdue milestones (due_date < today and not completed)
    const { data: overdueMilestones, error: milestonesError } = await supabase
      .from('milestones')
      .select('*')
      .lt('due_date', today)
      .neq('status', 'completed');

    if (milestonesError) {
      console.error('Error fetching milestones:', milestonesError);
      throw milestonesError;
    }

    if (!overdueMilestones || overdueMilestones.length === 0) {
      console.log('No overdue milestones found');
      return new Response(JSON.stringify({ message: 'No overdue milestones' }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Found ${overdueMilestones.length} overdue milestones`);

    // Fetch all clients for reference
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email');

    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
      throw clientsError;
    }

    const clientMap = new Map<string, Client>();
    clients?.forEach(client => clientMap.set(client.id, client));

    // Group milestones by client
    const clientMilestones = new Map<string, { client: Client | null; milestones: Milestone[] }>();
    
    overdueMilestones.forEach((milestone: Milestone) => {
      const client = milestone.client_id ? clientMap.get(milestone.client_id) || null : null;
      const key = milestone.client_id || 'no-client';
      
      if (!clientMilestones.has(key)) {
        clientMilestones.set(key, { client, milestones: [] });
      }
      clientMilestones.get(key)!.milestones.push(milestone);
    });

    const emailsSent: string[] = [];

    // Send admin summary email
    const adminHtml = `
      <h1>⚠️ Overdue Milestone Alert</h1>
      <p>The following milestones are past their due dates:</p>
      ${Array.from(clientMilestones.entries()).map(([_, data]) => `
        <div style="margin-bottom: 24px; padding: 16px; background: #f8f9fa; border-radius: 8px;">
          <h3 style="margin: 0 0 12px 0; color: #333;">
            ${data.client ? `Client: ${data.client.name}` : 'No Client Assigned'}
          </h3>
          ${data.milestones.map(m => `
            <div style="margin-bottom: 12px; padding: 12px; background: white; border-left: 4px solid #dc2626; border-radius: 4px;">
              <strong style="color: #111;">${m.title}</strong>
              <p style="margin: 4px 0; color: #666; font-size: 14px;">
                Due: ${new Date(m.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                | Progress: ${m.progress}%
              </p>
              ${m.description ? `<p style="margin: 4px 0; color: #888; font-size: 13px;">${m.description}</p>` : ''}
            </div>
          `).join('')}
        </div>
      `).join('')}
      <p style="margin-top: 24px; color: #666;">
        <a href="https://jasonarm.co.uk/admin" style="color: #2563eb;">View Dashboard</a> to update these milestones.
      </p>
    `;

    await resend.emails.send({
      from: "JasonArm Design <onboarding@resend.dev>",
      to: [ADMIN_EMAIL],
      subject: `⚠️ ${overdueMilestones.length} Overdue Milestone${overdueMilestones.length > 1 ? 's' : ''} Require Attention`,
      html: adminHtml,
    });
    emailsSent.push(ADMIN_EMAIL);
    console.log('Admin notification sent');

    // Send individual client emails
    for (const [_, data] of clientMilestones) {
      if (data.client && data.client.email) {
        const clientHtml = `
          <h1>📋 Project Update: Milestone Status</h1>
          <p>Hi ${data.client.name},</p>
          <p>We wanted to update you on some milestones that are past their scheduled dates:</p>
          ${data.milestones.map(m => `
            <div style="margin: 16px 0; padding: 16px; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 4px;">
              <strong style="color: #111; font-size: 16px;">${m.title}</strong>
              <p style="margin: 8px 0 0 0; color: #666;">
                Originally due: ${new Date(m.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p style="margin: 4px 0 0 0; color: #666;">
                Current progress: ${m.progress}%
              </p>
              ${m.description ? `<p style="margin: 8px 0 0 0; color: #888; font-size: 13px;">${m.description}</p>` : ''}
            </div>
          `).join('')}
          <p style="margin-top: 24px;">
            You can view your full project status in your 
            <a href="https://jasonarm.co.uk/client-dashboard" style="color: #2563eb;">client dashboard</a>.
          </p>
          <p style="margin-top: 16px; color: #666;">
            If you have any questions, feel free to reach out!
          </p>
          <p style="margin-top: 24px; color: #333;">
            Best regards,<br>
            Jason Armstrong<br>
            JasonArm Design
          </p>
        `;

        try {
          await resend.emails.send({
            from: "JasonArm Design <onboarding@resend.dev>",
            to: [data.client.email],
            subject: `Project Update: ${data.milestones.length} Milestone${data.milestones.length > 1 ? 's' : ''} Need Attention`,
            html: clientHtml,
          });
          emailsSent.push(data.client.email);
          console.log(`Client notification sent to ${data.client.email}`);
        } catch (emailError) {
          console.error(`Failed to send email to ${data.client.email}:`, emailError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        overdueMilestones: overdueMilestones.length,
        emailsSent,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in milestone-reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
