# Supabase Authentication Configuration Guide

This guide provides step-by-step instructions for configuring authentication in your Supabase project to enable email confirmation and Google OAuth for mycomic-book.com.

## Table of Contents
1. [Email Authentication Setup](#email-authentication-setup)
2. [Google OAuth Configuration](#google-oauth-configuration)
3. [Email Templates Configuration](#email-templates-configuration)
4. [SMTP Configuration](#smtp-configuration)
5. [Testing and Troubleshooting](#testing-and-troubleshooting)

---

## Email Authentication Setup

### 1. Access Supabase Dashboard
1. Navigate to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project: `nsbnsmgcvktojmlgfloa`
3. Go to **Authentication** in the sidebar

### 2. Configure Authentication Settings
1. Click on **Settings** in the Authentication section
2. Navigate to **Auth Providers**
3. Find **Email** provider and ensure it's enabled

### 3. Set URL Configuration
1. Go to **Authentication > URL Configuration**
2. Set **Site URL** to: `https://mycomic-book.com`
3. Add the following **Redirect URLs**:
   - `https://mycomic-book.com`
   - `https://mycomic-book.com/**`
   - `http://localhost:5173` (for local development)
   - `http://localhost:5173/**` (for local development)

### 4. Enable Email Confirmation
1. Go to **Authentication > Settings > Email Auth**
2. Ensure **Confirm email** is enabled
3. Set **Email confirmation expiry** (recommended: 24 hours)
4. Enable **Secure email change** (recommended)

---

## Google OAuth Configuration

### 1. Create Google OAuth Credentials

#### In Google Cloud Console:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth 2.0 Client ID**
5. Configure OAuth consent screen:
   - User Type: External
   - App name: MyComic Book
   - Support email: Your email
   - Authorized domains: `mycomic-book.com`
6. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Name: MyComic Book Production
   - Authorized JavaScript origins:
     - `https://mycomic-book.com`
     - `https://nsbnsmgcvktojmlgfloa.supabase.co`
   - Authorized redirect URIs:
     - `https://nsbnsmgcvktojmlgfloa.supabase.co/auth/v1/callback`
     - `https://mycomic-book.com`
7. Save and copy the **Client ID** and **Client Secret**

### 2. Configure Google OAuth in Supabase

1. In Supabase Dashboard, go to **Authentication > Providers**
2. Find **Google** provider
3. Enable Google authentication
4. Enter your **Client ID** from Google Cloud Console
5. Enter your **Client Secret** from Google Cloud Console
6. Set **Authorized Client IDs** (optional, leave empty for now)
7. Click **Save**

### 3. Verify OAuth Callback URL

Ensure the following callback URL is whitelisted in both Google and Supabase:
```
https://nsbnsmgcvktojmlgfloa.supabase.co/auth/v1/callback
```

---

## Email Templates Configuration

### 1. Access Email Templates
1. Go to **Authentication > Email Templates** in Supabase Dashboard
2. You'll see templates for:
   - Confirm signup
   - Invite user
   - Magic Link
   - Change Email Address
   - Reset Password

### 2. Configure "Confirm Signup" Template

#### Subject Line:
```
Confirm your MyComic Book account
```

#### Email Body (HTML):
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm your email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="text-align: center; margin-bottom: 40px;">
      <h1 style="color: #DC2626; margin: 0;">MyComic Book</h1>
    </div>

    <div style="background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <h2 style="color: #1F2937; margin: 0 0 20px 0;">Verify Your Email Address</h2>

      <p style="color: #4B5563; line-height: 1.6; margin: 0 0 20px 0;">
        Thanks for signing up! Click the button below to confirm your email address and activate your account.
      </p>

      <p style="color: #4B5563; line-height: 1.6; margin: 0 0 30px 0;">
        You'll receive <strong>100 free credits</strong> to create your first comic!
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="{{ .ConfirmationURL }}"
           style="display: inline-block; background: linear-gradient(to right, #DC2626, #2563EB); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Confirm Email Address
        </a>
      </div>

      <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; padding-top: 20px; border-top: 1px solid #E5E7EB;">
        If the button doesn't work, copy and paste this link into your browser:
        <br>
        <a href="{{ .ConfirmationURL }}" style="color: #2563EB; word-break: break-all;">{{ .ConfirmationURL }}</a>
      </p>

      <p style="color: #9CA3AF; font-size: 12px; margin: 20px 0 0 0;">
        This link will expire in 24 hours. If you didn't create an account with MyComic Book, you can safely ignore this email.
      </p>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
        &copy; 2024 MyComic Book. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
```

### 3. Test Email Template
1. Click **Send Test Email** to verify the template works
2. Check your inbox and spam folder
3. Verify all links and formatting are correct

---

## SMTP Configuration

For reliable email delivery in production, configure a custom SMTP provider.

### Recommended SMTP Providers
1. **SendGrid** (Recommended - Free tier available)
2. **AWS SES** (Pay as you go)
3. **Mailgun** (Good deliverability)
4. **Postmark** (Excellent for transactional emails)

### Configure SMTP in Supabase

1. Go to **Project Settings > Auth > SMTP Settings**
2. Enable **Enable Custom SMTP**
3. Enter your SMTP credentials:
   - **Host**: Your SMTP host (e.g., `smtp.sendgrid.net`)
   - **Port**: Usually 587 (TLS) or 465 (SSL)
   - **Username**: Your SMTP username
   - **Password**: Your SMTP password
   - **Sender email**: `noreply@mycomic-book.com` (must be verified)
   - **Sender name**: MyComic Book

### SendGrid Setup Example

1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Create an API key with Mail Send permissions
3. Verify your domain `mycomic-book.com` in SendGrid
4. Use these settings in Supabase:
   - Host: `smtp.sendgrid.net`
   - Port: `587`
   - Username: `apikey`
   - Password: Your SendGrid API key
   - Sender: `noreply@mycomic-book.com`

### Important Notes
- **Domain Verification**: Ensure your sending domain is verified with your SMTP provider
- **SPF/DKIM Records**: Configure SPF and DKIM DNS records for better deliverability
- **Rate Limits**: Check your SMTP provider's rate limits
- **Monitoring**: Set up bounce and spam complaint monitoring

---

## Testing and Troubleshooting

### Test Email Confirmation Flow

1. **Test Signup**:
   - Go to your application
   - Create a new account with a test email
   - Check email delivery time (should be < 30 seconds)

2. **Verify Email Reception**:
   - Check inbox
   - Check spam/junk folder
   - Verify email formatting and branding

3. **Test Confirmation Link**:
   - Click the confirmation link
   - Verify redirect to `https://mycomic-book.com`
   - Verify user can log in immediately after

4. **Test Welcome Credits**:
   - After confirmation, check if user receives 100 credits
   - Verify in Supabase Dashboard under Authentication > Users

### Test Google OAuth Flow

1. **Test OAuth Initiation**:
   - Click "Sign in with Google" button
   - Verify Google consent screen appears
   - Check that app name and branding are correct

2. **Test OAuth Callback**:
   - Complete Google sign-in
   - Verify redirect back to `https://mycomic-book.com`
   - Confirm user is logged in
   - Check welcome credits are granted

3. **Test Error Handling**:
   - Try signing in with cancelled OAuth flow
   - Verify error messages are user-friendly

### Common Issues and Solutions

#### Issue: Emails Not Being Received

**Solution 1 - Check SMTP Configuration**:
- Verify SMTP credentials are correct
- Test connection to SMTP server
- Check SMTP provider dashboard for errors

**Solution 2 - Check Spam Folder**:
- Add sender to safe senders list
- Verify SPF/DKIM records are configured

**Solution 3 - Check Rate Limits**:
- Verify you haven't exceeded rate limits
- Check Supabase logs for rate limit errors

#### Issue: Google OAuth Not Working

**Solution 1 - Verify OAuth Configuration**:
- Double-check Client ID and Secret in Supabase
- Verify redirect URIs in Google Cloud Console
- Ensure OAuth consent screen is published

**Solution 2 - Check Redirect URLs**:
- Verify `https://nsbnsmgcvktojmlgfloa.supabase.co/auth/v1/callback` is in Google's authorized redirect URIs
- Check that `https://mycomic-book.com` is in authorized JavaScript origins

**Solution 3 - Check Browser Console**:
- Look for CORS errors
- Verify popup blockers aren't interfering

#### Issue: Email Confirmation Link Expired

**Solution**:
- Increase expiry time in Authentication Settings
- Implement resend confirmation email functionality (already implemented in the app)

### Monitoring and Logs

#### Check Authentication Logs
1. Go to **Authentication > Logs** in Supabase Dashboard
2. Filter by event type (signup, login, email_confirmation)
3. Look for errors or failed attempts

#### Check Edge Function Logs
1. Go to **Edge Functions** in Supabase Dashboard
2. Select the relevant function
3. View logs for errors or issues

#### Monitor Email Delivery
- Check your SMTP provider's dashboard for:
  - Delivery rates
  - Bounce rates
  - Spam complaints
  - Failed deliveries

---

## Production Checklist

Before going live, verify:

- [ ] Site URL is set to `https://mycomic-book.com`
- [ ] All redirect URLs are whitelisted
- [ ] Email confirmation is enabled
- [ ] Custom SMTP is configured and tested
- [ ] Sender domain is verified with SMTP provider
- [ ] SPF and DKIM DNS records are configured
- [ ] Google OAuth is enabled with production credentials
- [ ] OAuth consent screen is published
- [ ] Email templates are customized with branding
- [ ] Test emails are being delivered successfully
- [ ] OAuth flow completes successfully
- [ ] Welcome credits are granted automatically
- [ ] All error messages are user-friendly
- [ ] Email resend functionality works
- [ ] Rate limits are appropriate for expected traffic

---

## Support Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [SendGrid Documentation](https://docs.sendgrid.com/)
- [Email Deliverability Best Practices](https://postmarkapp.com/guides/email-deliverability)

---

## Contact

For issues or questions regarding authentication setup:
- Check Supabase documentation
- Contact your SMTP provider support
- Review application logs in browser console
