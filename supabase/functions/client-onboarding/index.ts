import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OnboardingRequest {
  clientName: string;
  clientEmail: string;
  company?: string;
  budgetRange?: string;
  projectTimeline?: string;
  message?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Client onboarding email function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientName, clientEmail, company, budgetRange, projectTimeline, message }: OnboardingRequest = await req.json();

    console.log(`Sending onboarding email to: ${clientEmail}`);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%); border-radius: 16px; padding: 40px; border: 1px solid #333;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #fff; font-size: 28px; margin: 0; font-weight: 700;">
                  Welcome, ${clientName}! 🎉
                </h1>
              </div>
              
              <p style="color: #ccc; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Thank you for reaching out! We're thrilled to have you on board and excited about the opportunity to work together.
              </p>

              <div style="background: #1f1f1f; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #3b82f6;">
                <h2 style="color: #fff; font-size: 18px; margin: 0 0 16px 0;">Your Project Details</h2>
                ${company ? `<p style="color: #aaa; margin: 8px 0;"><strong style="color: #fff;">Company:</strong> ${company}</p>` : ''}
                ${budgetRange ? `<p style="color: #aaa; margin: 8px 0;"><strong style="color: #fff;">Budget Range:</strong> ${budgetRange}</p>` : ''}
                ${projectTimeline ? `<p style="color: #aaa; margin: 8px 0;"><strong style="color: #fff;">Timeline:</strong> ${projectTimeline}</p>` : ''}
              </div>

              ${message ? `
              <div style="background: #1f1f1f; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <h3 style="color: #fff; font-size: 16px; margin: 0 0 12px 0;">Your Message</h3>
                <p style="color: #aaa; margin: 0; font-style: italic;">"${message}"</p>
              </div>
              ` : ''}

              <h3 style="color: #fff; font-size: 18px; margin: 24px 0 16px 0;">What Happens Next?</h3>
              <ol style="color: #ccc; padding-left: 20px; line-height: 1.8;">
                <li>We'll review your project requirements within 24 hours</li>
                <li>You'll receive a detailed proposal with timeline and costs</li>
                <li>Once approved, we'll schedule a kickoff call</li>
                <li>Your project dashboard will be set up for progress tracking</li>
              </ol>

              <div style="text-align: center; margin-top: 32px;">
                <p style="color: #888; font-size: 14px; margin-bottom: 16px;">Have questions? Reply to this email anytime.</p>
              </div>

              <hr style="border: none; border-top: 1px solid #333; margin: 32px 0;">

              <p style="color: #666; font-size: 12px; text-align: center; margin: 0;">
                This email was sent because you submitted a contact form on our website.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "JA Web Services <onboarding@resend.dev>",
      to: [clientEmail],
      subject: `Welcome to JA Web Services, ${clientName}! 🚀`,
      html: emailHtml,
    });

    console.log("Onboarding email sent successfully:", emailResponse);

    // Also send notification to admin
    await resend.emails.send({
      from: "JA Web Services <onboarding@resend.dev>",
      to: ["jasonarm82@gmail.com"],
      subject: `New Client: ${clientName} from ${company || 'N/A'}`,
      html: `
        <h2>New Client Onboarded</h2>
        <p><strong>Name:</strong> ${clientName}</p>
        <p><strong>Email:</strong> ${clientEmail}</p>
        <p><strong>Company:</strong> ${company || 'Not provided'}</p>
        <p><strong>Budget:</strong> ${budgetRange || 'Not provided'}</p>
        <p><strong>Timeline:</strong> ${projectTimeline || 'Not provided'}</p>
        ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
      `,
    });

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in client-onboarding function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);