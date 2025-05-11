
interface PayPalButtonsComponentOptions {
  createOrder: () => Promise<string>;
  onApprove: (data: any) => Promise<void>;
  onCancel: () => void;
  onError: (err: any) => void;
}

interface PayPalNamespace {
  Buttons: (options: PayPalButtonsComponentOptions) => {
    render: (selector: string) => void;
  };
}

interface Window {
  paypal?: PayPalNamespace;
}
