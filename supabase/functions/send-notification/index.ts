import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: "design_approved" | "design_rejected" | "new_message" | "file_uploaded";
  designTitle?: string;
  clientName: string;
  clientEmail?: string;
  messagePreview?: string;
  feedback?: string;
  fileName?: string;
  fileSize?: string;
  uploadedBy?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, designTitle, clientName, clientEmail, messagePreview, feedback, fileName, fileSize, uploadedBy }: NotificationRequest = await req.json();

    console.log(`Processing notification: ${type} for ${clientName}`);

    // Admin email - your email
    const adminEmail = "jasonarm82@gmail.com";

    let subject = "";
    let html = "";

    switch (type) {
      case "design_approved":
        subject = `✅ Design Approved: ${designTitle}`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #22c55e;">Design Approved!</h1>
            <p><strong>Client:</strong> ${clientName}</p>
            <p><strong>Design:</strong> ${designTitle}</p>
            <p>The client has approved this design. You can proceed with the next steps.</p>
            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;" />
            <p style="color: #666; font-size: 12px;">BrainBulb Design Studio</p>
          </div>
        `;
        break;

      case "design_rejected":
        subject = `❌ Design Needs Revision: ${designTitle}`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #ef4444;">Design Revision Requested</h1>
            <p><strong>Client:</strong> ${clientName}</p>
            <p><strong>Design:</strong> ${designTitle}</p>
            ${feedback ? `<p><strong>Feedback:</strong></p><blockquote style="border-left: 3px solid #e5e5e5; padding-left: 15px; color: #555;">${feedback}</blockquote>` : ""}
            <p>Please review the client's feedback and submit a revision.</p>
            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;" />
            <p style="color: #666; font-size: 12px;">BrainBulb Design Studio</p>
          </div>
        `;
        break;

      case "new_message":
        subject = `💬 New Message from ${clientName}`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #3b82f6;">New Client Message</h1>
            <p><strong>From:</strong> ${clientName}</p>
            ${messagePreview ? `<p><strong>Message:</strong></p><blockquote style="border-left: 3px solid #3b82f6; padding-left: 15px; color: #555;">${messagePreview}</blockquote>` : ""}
            <p>Log in to your admin dashboard to respond.</p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;" />
            <p style="color: #666; font-size: 12px;">BrainBulb Design Studio</p>
          </div>
        `;
        break;

      case "file_uploaded":
        subject = `📁 New File Uploaded: ${fileName}`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #8b5cf6;">New File Uploaded</h1>
            <p><strong>Project:</strong> ${clientName}</p>
            <p><strong>File:</strong> ${fileName}</p>
            <p><strong>Size:</strong> ${fileSize}</p>
            <p><strong>Uploaded by:</strong> ${uploadedBy === 'admin' ? 'Designer' : 'Client'}</p>
            <p>A new file has been added to the project. Log in to view and download.</p>
            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;" />
            <p style="color: #666; font-size: 12px;">BrainBulb Design Studio</p>
          </div>
        `;
        break;

      default:
        throw new Error(`Unknown notification type: ${type}`);
    }

    // Send to admin
    const adminEmailResponse = await resend.emails.send({
      from: "BrainBulb <onboarding@resend.dev>",
      to: [adminEmail],
      subject,
      html,
    });

    console.log("Admin email sent successfully:", adminEmailResponse);

    // For file uploads, also notify the client if it was uploaded by admin
    if (type === "file_uploaded" && clientEmail && uploadedBy === 'admin') {
      const clientHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #8b5cf6;">New File Available</h1>
          <p>Hi ${clientName},</p>
          <p>A new file has been added to your project:</p>
          <p><strong>File:</strong> ${fileName}</p>
          <p><strong>Size:</strong> ${fileSize}</p>
          <p>Log in to your dashboard to view and download the file.</p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">BrainBulb Design Studio</p>
        </div>
      `;

      await resend.emails.send({
        from: "BrainBulb <onboarding@resend.dev>",
        to: [clientEmail],
        subject: `📁 New File Available: ${fileName}`,
        html: clientHtml,
      });

      console.log("Client email sent for file upload");
    }

    return new Response(JSON.stringify({ success: true, id: adminEmailResponse.data?.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
