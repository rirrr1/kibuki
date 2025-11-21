const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface SendEmailRequest {
  email: string;
  heroName: string;
  comicTitle: string;
  comicUrl: string;
  emailType?: 'digital' | 'physical';
  shippingInfo?: {
    name: string;
    street1: string;
    street2?: string;
    city: string;
    postcode: string;
    country: string;
    phone: string;
  };
  printJobId?: number;
  sessionId?: string;
}

Deno.serve(async (req: Request) => {
  console.log('[send-confirmation-email] Function started');
  console.log('[send-confirmation-email] Request method:', req.method);
  console.log('[send-confirmation-email] Request headers:', Object.fromEntries(req.headers.entries()));
  
  if (req.method === "OPTIONS") {
    console.log('[send-confirmation-email] Handling OPTIONS request');
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      console.log('[send-confirmation-email] Invalid method:', req.method);
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    console.log('[send-confirmation-email] RESEND_API_KEY exists:', !!RESEND_API_KEY);
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not found");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse the full request body once
    console.log('[send-confirmation-email] Parsing request body...');
    const requestData: SendEmailRequest = await req.json();
    console.log('[send-confirmation-email] Request data received:', {
      email: requestData.email,
      heroName: requestData.heroName,
      comicTitle: requestData.comicTitle,
      emailType: requestData.emailType,
      hasComicUrl: !!requestData.comicUrl
    });
    
    const { email: recipientEmail, heroName, comicTitle, comicUrl, emailType = 'digital', shippingInfo, printJobId, sessionId } = requestData;

    if (!recipientEmail || !heroName || !comicTitle || !comicUrl) {
      console.log('[send-confirmation-email] Missing required fields:', {
        hasEmail: !!recipientEmail,
        hasHeroName: !!heroName,
        hasComicTitle: !!comicTitle,
        hasComicUrl: !!comicUrl
      });
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log('[send-confirmation-email] Creating email template for type:', emailType);
    // Create HTML email template based on type
    const htmlContent = emailType === 'physical' ? `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Physical Comic Book Order Confirmed!</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; }
    .header { background: linear-gradient(135deg, #dc2626, #2563eb); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
    .header p { margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; }
    .content { padding: 40px 20px; }
    .order-info { background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .order-info h3 { margin: 0 0 10px 0; color: #1f2937; }
    .order-info p { margin: 5px 0; color: #6b7280; }
    .shipping-info { background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
    .shipping-info h3 { margin: 0 0 10px 0; color: #1e40af; }
    .shipping-info p { margin: 3px 0; color: #1e40af; font-size: 14px; }
    .timeline { margin: 30px 0; }
    .timeline ul { list-style: none; padding: 0; }
    .timeline li { padding: 8px 0; color: #4b5563; position: relative; padding-left: 25px; }
    .timeline li:before { content: "📦 "; position: absolute; left: 0; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
    .footer a { color: #dc2626; text-decoration: none; }
    a { color: #dc2626; text-decoration: underline; }
    a:hover { color: #b91c1c; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📦 Physical Comic Order Confirmed!</h1>
      <p>Your premium printed comic is on its way</p>
    </div>
    
    <div class="content">
      <p>Hi ${shippingInfo?.name || 'there'}!</p>
      
      <p>Great news! Your physical comic book order has been confirmed and sent to our printing partner.</p>
      
      <div class="order-info">
        <h3>📚 Order Details</h3>
        <p><strong>Comic Title:</strong> ${comicTitle}</p>
        <p><strong>Hero Name:</strong> ${heroName}</p>
        ${sessionId ? `<p><strong>Order ID:</strong> ${sessionId.slice(-8).toUpperCase()}</p>` : ''}
        ${printJobId ? `<p><strong>Print Job ID:</strong> #${printJobId}</p>` : ''}
        <p><strong>Status:</strong> Order confirmed & sent to printer</p>
      </div>
      
      ${shippingInfo ? `
      <div class="shipping-info">
        <h3>🚚 Shipping Address</h3>
        <p><strong>${shippingInfo.name}</strong></p>
        <p>${shippingInfo.street1}</p>
        ${shippingInfo.street2 ? `<p>${shippingInfo.street2}</p>` : ''}
        <p>${shippingInfo.city}, ${shippingInfo.postcode}</p>
        <p>${shippingInfo.country === 'DE' ? 'Germany' : shippingInfo.country === 'CH' ? 'Switzerland' : shippingInfo.country === 'AT' ? 'Austria' : shippingInfo.country}</p>
        <p>Phone: ${shippingInfo.phone}</p>
      </div>
      ` : ''}
      
      <div class="timeline">
        <h3>📅 What happens next:</h3>
        <ul>
          <li>Your order is validated and processed (1-2 hours)</li>
          <li>Production begins at our printing facility (2-3 business days)</li>
          <li>Quality check and packaging</li>
          <li>Shipped via Standard Mail (7-14 business days)</li>
          <li>Delivered to your address</li>
        </ul>
      </div>
      
      <p><strong>📧 Updates:</strong> You'll receive email notifications about your order status and tracking information once your comic ships.</p>
      
      <p><strong>💡 Meanwhile:</strong> Don't forget you can still <a href="${comicUrl}" style="color: #dc2626 !important; text-decoration: underline;">download your digital copy</a> to enjoy right away!</p>
      
      <p><strong>📖 Preview Online:</strong> <a href="${comicUrl}" style="color: #dc2626 !important; text-decoration: underline;">View your comic book in your browser</a> anytime.</p>
      
      <p>Thank you for choosing MyComic-Book.com for your personalized comic adventure!</p>
      
      <p>Best regards,<br>The MyComic-Book.com Team</p>
    </div>
    
    <div class="footer">
      <p>© 2025 MyComic-Book.com. All rights reserved.</p>
      <p>Need help? Contact us at <a href="mailto:support@mycomic-book.com">support@mycomic-book.com</a></p>
    </div>
  </div>
</body>
</html>` : `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Comic Book is Ready!</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; }
    .header { background: linear-gradient(135deg, #dc2626, #2563eb); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
    .header p { margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; }
    .content { padding: 40px 20px; }
    .comic-info { background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .comic-info h3 { margin: 0 0 10px 0; color: #1f2937; }
    .comic-info p { margin: 5px 0; color: #6b7280; }
    .download-button { display: inline-block; background: linear-gradient(135deg, #dc2626, #2563eb); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
    .download-button:hover { opacity: 0.9; }
    .features { margin: 30px 0; }
    .features ul { list-style: none; padding: 0; }
    .features li { padding: 8px 0; color: #4b5563; }
    .features li:before { content: "✓ "; color: #10b981; font-weight: bold; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
    .footer a { color: #dc2626; text-decoration: none; }
    a { color: #dc2626; text-decoration: underline; }
    a:hover { color: #b91c1c; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Your Comic Book is Ready!</h1>
      <p>Your personalized adventure awaits</p>
    </div>
    
    <div class="content">
      <p>Hi there!</p>
      
      <p>Great news! Your personalized comic book has been successfully created and is ready for download.</p>
      
      <div class="comic-info">
        <h3>📚 Your Comic Details</h3>
        <p><strong>Hero Name:</strong> ${heroName}</p>
        <p><strong>Comic Title:</strong> ${comicTitle}</p>
        <p><strong>Status:</strong> Ready for download</p>
      </div>
      
      <div style="text-align: center;">
        <a href="${comicUrl}" class="download-button">Download Your Comic Book</a>
      </div>
      
      <div class="features">
        <h3>What's included:</h3>
        <ul>
          <li>Full-color comic book with your character</li>
          <li>Professional illustration and storytelling</li>
          <li>Multiple pages of adventure</li>
          <li>High-resolution PDF ready for printing</li>
          <li>Personalized cover with hero name</li>
        </ul>
      </div>
      
      <p><strong>💡 Pro Tip:</strong> You can also order a premium physical copy of your comic book for just €34.00. Visit your download page to place an order!</p>
      
      <p><strong>📖 Preview Your Comic:</strong> <a href="${comicUrl}" style="color: #dc2626 !important; text-decoration: underline;">View your comic book online</a> before downloading.</p>
      
      <p>Thank you for choosing MyComic-Book.com to bring your story to life!</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${comicUrl}" style="display: inline-block; background: linear-gradient(135deg, #dc2626, #2563eb); color: white !important; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px;">📖 Read Your Comic Book Now</a>
      </div>
      
      <p>Best regards,<br>The MyComic-Book.com Team</p>
    </div>
    
    <div class="footer">
      <p>© 2025 MyComic-Book.com. All rights reserved.</p>
      <p>Need help? Contact us at <a href="mailto:support@mycomic-book.com">support@mycomic-book.com</a></p>
    </div>
  </div>
</body>
</html>`;

    console.log('[send-confirmation-email] Sending email to Resend API...');
    // Send email using Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "MyComic-Book.com <noreply@mycomic-book.com>",
        to: [recipientEmail],
        subject: emailType === 'physical' 
          ? `📦 Physical Comic Order Confirmed - "${comicTitle}"`
          : `🎉 Your Comic Book "${comicTitle}" is Ready!`,
        html: htmlContent,
      }),
    });

    console.log('[send-confirmation-email] Resend API response status:', response.status);
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Resend API error:", errorData);
      throw new Error(`Resend API error: ${response.status} - ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: data.id 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Email sending error:", error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error occurred" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});