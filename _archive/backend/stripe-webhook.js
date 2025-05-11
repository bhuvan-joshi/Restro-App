
// This would be implemented as a Supabase Edge Function
// Example implementation of stripe-webhook

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@12.0.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), {
  apiVersion: '2023-10-16',
});

// Create a Supabase client with the service role key (for database operations)
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
);

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  
  if (!signature || !webhookSecret) {
    return new Response(
      JSON.stringify({ error: 'Missing signature or webhook secret' }),
      { status: 400 }
    );
  }
  
  try {
    // Get the request body as text
    const body = await req.text();
    
    // Verify and construct the webhook event
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
    
    console.log(`Received event: ${event.type}`);
    
    // Handle the event based on its type
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
        
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
    }
    
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    console.error(`Error processing webhook: ${error.message}`);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400 }
    );
  }
});

// Handler functions for different event types

async function handleCheckoutSessionCompleted(session) {
  // A checkout session has completed - record the payment and update user subscription status
  console.log(`Checkout session completed: ${session.id}`);
  
  // Get customer info
  const customer = await stripe.customers.retrieve(session.customer);
  
  // Update the database with subscription info
  const { error } = await supabaseAdmin
    .from('subscribers')
    .upsert({
      stripe_customer_id: session.customer,
      email: customer.email,
      subscribed: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' });
    
  if (error) {
    console.error(`Error updating subscriber: ${error.message}`);
  }
}

async function handleInvoicePaid(invoice) {
  // Handle successful payment
  console.log(`Invoice paid: ${invoice.id}`);
  
  // Find the subscription associated with this invoice
  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    
    // Update subscription details in database
    const { error } = await supabaseAdmin
      .from('subscribers')
      .update({
        subscribed: true,
        subscription_tier: getSubscriptionTier(subscription),
        subscription_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', invoice.customer);
      
    if (error) {
      console.error(`Error updating subscriber: ${error.message}`);
    }
  }
}

async function handleInvoicePaymentFailed(invoice) {
  // Handle failed payment
  console.log(`Invoice payment failed: ${invoice.id}`);
  
  // You might want to notify the user or take other actions
  // For now, we'll just log it
}

async function handleSubscriptionUpdated(subscription) {
  // Handle subscription creation or update
  console.log(`Subscription updated: ${subscription.id}`);
  
  // Update subscription details in database
  const { error } = await supabaseAdmin
    .from('subscribers')
    .update({
      subscribed: subscription.status === 'active',
      subscription_tier: getSubscriptionTier(subscription),
      subscription_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', subscription.customer);
    
  if (error) {
    console.error(`Error updating subscriber: ${error.message}`);
  }
}

async function handleSubscriptionDeleted(subscription) {
  // Handle subscription deletion
  console.log(`Subscription deleted: ${subscription.id}`);
  
  // Update subscription details in database
  const { error } = await supabaseAdmin
    .from('subscribers')
    .update({
      subscribed: false,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', subscription.customer);
    
  if (error) {
    console.error(`Error updating subscriber: ${error.message}`);
  }
}

// Helper function to determine subscription tier from the subscription object
function getSubscriptionTier(subscription) {
  if (!subscription.items.data.length) return null;
  
  const priceId = subscription.items.data[0].price.id;
  
  // Map price IDs to subscription tiers
  // Note: In a real implementation, you would define these mappings
  // based on your actual Stripe price IDs
  const priceTierMap = {
    'price_basic': 'basic',
    'price_premium': 'premium',
    // Add more mappings as needed
  };
  
  return priceTierMap[priceId] || 'basic';
}
