
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";
import StripePaymentForm from './StripePaymentForm';
import PayPalPaymentForm from './PayPalPaymentForm';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  planName: string;
  amount: number;
  onPaymentSuccess: (transactionId: string, provider: 'stripe' | 'paypal') => void;
}

const PaymentDialog: React.FC<PaymentDialogProps> = ({
  isOpen,
  onClose,
  planId,
  planName,
  amount,
  onPaymentSuccess
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'paypal'>('stripe');
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = (transactionId: string) => {
    onPaymentSuccess(transactionId, paymentMethod);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upgrade to {planName} Plan</DialogTitle>
          <DialogDescription>
            Select your preferred payment method to complete your subscription.
          </DialogDescription>
        </DialogHeader>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">
            {error}
          </div>
        )}
        
        <Tabs defaultValue="stripe" onValueChange={(value) => setPaymentMethod(value as 'stripe' | 'paypal')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="stripe" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Stripe
            </TabsTrigger>
            <TabsTrigger value="paypal" className="flex items-center gap-2">
              <svg 
                className="h-4 w-4" 
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M9.112 8.262l-.258 1.64c-.155-.046-.335-.073-.54-.073-1.926 0-3.355 1.93-2.843 4.482.554-1.069 1.678-1.755 2.745-1.755.705 0 1.354.192 1.887.506 1.442-1.637 2.769-3.93 3.437-6.167-1.755-.317-3.005.72-4.428 1.367m11.891-5.26c-.138-.502-.68-.8-1.193-.67L16.513 3.02c-.198.333-.358.679-.486 1.028l-1.694.468c-.683.19-1.311.483-1.854.868.05.114.097.229.14.345.166.449.302.814.37.964.134.295.294.595.466.879a8.7 8.7 0 0 0 .943-.664l.478 1.634c.267-.842.835-1.563 1.567-1.974l-1.745 11.064-2.89.798.09-.62c-1.835-.59-3.827-.747-5.25.105l.558-3.5c.782.711 1.882 1.183 3.052 1.183 2.508 0 4.531-2.003 4.531-4.476 0-1.173-.047-1.52-.047-1.52-.055-.302-.137-.594-.247-.868 0 0 .781-.402 1.016-.516.282-.137.566-.293.856-.485-.148.945-.45 1.898-.893 2.808l4.571-1.261c.501-.138.8-.681.668-1.193"/>
              </svg>
              PayPal
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="stripe">
            <StripePaymentForm 
              planId={planId}
              amount={amount}
              onSuccess={handleSuccess}
              onError={handleError}
              onCancel={onClose}
            />
          </TabsContent>
          
          <TabsContent value="paypal">
            <PayPalPaymentForm 
              planId={planId}
              amount={amount}
              onSuccess={handleSuccess}
              onError={handleError}
              onCancel={onClose}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;
