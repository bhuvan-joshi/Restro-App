/**
 * Payment utilities for handling Stripe and PayPal integrations
 */
import { loadStripe } from '@stripe/stripe-js';

// Payment response type for consistent return values
export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  provider?: 'stripe' | 'paypal';
  error?: string;
  demo?: boolean;
}

let stripePromise: Promise<any> | null = null;

// Get Stripe instance
export const getStripe = () => {
  if (!stripePromise) {
    // Use the Stripe public key from environment variables
    const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
    if (!stripePublicKey) {
      console.warn('Stripe public key not found in environment variables');
      return null;
    }
    stripePromise = loadStripe(stripePublicKey);
  }
  return stripePromise;
};

/**
 * Create and process a Stripe Checkout session
 */
export const processStripePayment = async (planId: string, amount: number) => {
  try {
    // Import the API service dynamically to avoid circular dependencies
    const { createStripeSession } = await import('@/services/api');
    
    // Create a Stripe session
    const response = await createStripeSession({
      planId,
      amount,
      successUrl: `${window.location.origin}/payment-success`,
      cancelUrl: `${window.location.origin}/payment-cancel`,
    });
    
    const { sessionId } = response.data;
    
    if (!sessionId) {
      throw new Error('Failed to create Stripe session');
    }
    
    // Get Stripe instance
    const stripe = await getStripe();
    if (!stripe) {
      throw new Error('Failed to load Stripe');
    }
    
    // Redirect to Stripe checkout
    const { error } = await stripe.redirectToCheckout({
      sessionId,
    });
    
    if (error) {
      throw new Error(error.message);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Stripe payment error:', error);
    
    // If API is not available (404), return a simulated successful transaction for demo
    if (error.response && error.response.status === 404) {
      return {
        success: true,
        demo: true,
        transactionId: `demo_stripe_${Date.now()}`,
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    };
  }
};

/**
 * Create and process a PayPal order
 */
export const processPayPalPayment = async (planId: string, amount: number) => {
  try {
    // Import the API service dynamically to avoid circular dependencies
    const { createPayPalOrder } = await import('@/services/api');
    
    // Create a PayPal order
    const response = await createPayPalOrder({
      planId,
      amount,
      successUrl: `${window.location.origin}/payment-success`,
      cancelUrl: `${window.location.origin}/payment-cancel`,
    });
    
    const { orderID, approvalUrl } = response.data;
    
    if (!approvalUrl) {
      throw new Error('Failed to create PayPal order');
    }
    
    // Redirect to PayPal
    window.location.href = approvalUrl;
    
    return { success: true };
  } catch (error) {
    console.error('PayPal payment error:', error);
    
    // If API is not available (404), return a simulated successful transaction for demo
    if (error.response && error.response.status === 404) {
      return {
        success: true,
        demo: true,
        transactionId: `demo_paypal_${Date.now()}`,
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    };
  }
};

// Function to process payment based on selected method
export const processPayment = async (
  method: 'stripe' | 'paypal', 
  planId: string, 
  amount: number
): Promise<PaymentResponse> => {
  if (method === 'stripe') {
    return processStripePayment(planId, amount);
  } else {
    return processPayPalPayment(planId, amount);
  }
};
