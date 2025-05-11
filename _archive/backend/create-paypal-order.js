
// This would be implemented as a Supabase Edge Function
// Example implementation of create-paypal-order

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PayPal API base URLs
const PAYPAL_API_BASE = Deno.env.get('PAYPAL_ENVIRONMENT') === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// Function to get an access token from PayPal
async function getPayPalAccessToken() {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
  
  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured');
  }
  
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: 'grant_type=client_credentials',
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Failed to get PayPal access token: ${data.error_description}`);
  }
  
  return data.access_token;
}

// Function to create a PayPal order
async function createPayPalOrder(amount, planId) {
  const accessToken = await getPayPalAccessToken();
  
  const orderPayload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: planId,
        description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan`,
        amount: {
          currency_code: 'USD',
          value: amount.toFixed(2),
        },
      },
    ],
    application_context: {
      brand_name: 'AI Chat Widget',
      landing_page: 'BILLING',
      user_action: 'PAY_NOW',
      return_url: `${Deno.env.get('SITE_URL') || 'http://localhost:3000'}/dashboard`,
      cancel_url: `${Deno.env.get('SITE_URL') || 'http://localhost:3000'}/register`,
    },
  };
  
  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(orderPayload),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Failed to create PayPal order: ${data.message}`);
  }
  
  // Find the approval URL from the HATEOAS links
  const approvalUrl = data.links.find(link => link.rel === 'approve').href;
  
  return {
    orderID: data.id,
    approvalUrl,
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
    });
  }
  
  try {
    const { planId, amount } = await req.json();
    
    // Create a PayPal order
    const orderData = await createPayPalOrder(amount, planId);
    
    return new Response(
      JSON.stringify(orderData),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 400,
      }
    );
  }
});
