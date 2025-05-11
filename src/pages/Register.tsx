import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, CreditCard, MessageSquare, Shield } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { register as registerUser } from "@/services/api";

// Super admin credentials for development only
const SUPERADMIN_EMAIL = "admin@example.com";
const SUPERADMIN_PASSWORD = "Admin123!";

// Subscription plan options
const SUBSCRIPTION_PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "Basic features for individuals",
    features: [
      "1 chat widget",
      "100 messages/month",
      "Basic customization",
      "1,000 document tokens",
    ],
  },
  {
    id: "basic",
    name: "Basic",
    price: 9.99,
    description: "Advanced features for professionals",
    features: [
      "3 chat widgets",
      "1,000 messages/month",
      "Advanced customization",
      "10,000 document tokens",
      "Email support",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: 19.99,
    description: "Premium features for businesses",
    features: [
      "Unlimited chat widgets",
      "Unlimited messages",
      "Full customization",
      "Unlimited document tokens",
      "Priority support",
      "Analytics dashboard",
    ],
  },
];

// PaymentDialog component
const PaymentDialog = ({ isOpen, onClose, planId, planName, amount, onPaymentSuccess }) => {
  const [paymentMethod, setPaymentMethod] = useState("stripe");
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    setIsProcessing(true);
    
    // Simulate payment processing
    setTimeout(() => {
      setIsProcessing(false);
      onPaymentSuccess(`${planId}-${Date.now()}`, paymentMethod);
    }, 1500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Your Purchase</DialogTitle>
          <DialogDescription>
            You've selected the {planName} plan for ${amount.toFixed(2)}/month.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handlePaymentSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <RadioGroup 
              defaultValue={paymentMethod} 
              onValueChange={setPaymentMethod}
              className="flex flex-col space-y-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="stripe" id="stripe" />
                <Label htmlFor="stripe" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Credit Card (Stripe)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="paypal" id="paypal" />
                <Label htmlFor="paypal">PayPal</Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-2">
            {paymentMethod === "stripe" && (
              <>
                <Label htmlFor="cardNumber">Card Number</Label>
                <Input id="cardNumber" placeholder="4242 4242 4242 4242" />
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="expMonth">Month</Label>
                    <Input id="expMonth" placeholder="MM" />
                  </div>
                  <div>
                    <Label htmlFor="expYear">Year</Label>
                    <Input id="expYear" placeholder="YY" />
                  </div>
                  <div>
                    <Label htmlFor="cvc">CVC</Label>
                    <Input id="cvc" placeholder="123" />
                  </div>
                </div>
              </>
            )}
            
            {paymentMethod === "paypal" && (
              <div className="text-center p-4 bg-gray-50 rounded-md">
                <p>You'll be redirected to PayPal to complete your purchase.</p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isProcessing}>
              {isProcessing ? "Processing..." : `Pay $${amount.toFixed(2)}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuperadminButton, setShowSuperadminButton] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(SUBSCRIPTION_PLANS[0].id);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      plan: "free"
    }
  });

  useEffect(() => {
    const superadminExists = localStorage.getItem("superadmin_created") === "true";
    setShowSuperadminButton(!superadminExists);
  }, []);

  const createSuperAdmin = () => {
    setIsLoading(true);
    
    // For development only - in production this would use a secure API endpoint
    localStorage.setItem("auth_token", "superadmin_token_12345");
    localStorage.setItem("user_role", "superadmin");
    localStorage.setItem("user_name", "Super Admin");
    localStorage.setItem("user_email", SUPERADMIN_EMAIL);
    localStorage.setItem("superadmin_created", "true");
    localStorage.setItem("is_superadmin", "true");
    
    toast({
      title: "Superadmin created",
      description: `Email: ${SUPERADMIN_EMAIL}, Password: ${SUPERADMIN_PASSWORD}`,
    });
    
    setIsLoading(false);
    navigate("/dashboard");
  };

  const handlePlanSelect = (planId) => {
    setSelectedPlan(planId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);

    try {
      if (selectedPlan === "free") {
        // Register user with the API
        const response = await registerUser(name, email, password);
        
        // Store user data from API response
        localStorage.setItem("auth_token", response.data.token);
        localStorage.setItem("user_id", response.data.userId);
        localStorage.setItem("user_name", response.data.username);
        localStorage.setItem("user_email", response.data.email);
        localStorage.setItem("user_role", response.data.role);
        localStorage.setItem("is_superadmin", "false");
        localStorage.setItem("subscription_plan", "free");
        
        toast({
          title: "Registration successful",
          description: "Your free account has been created",
        });
        
        navigate("/dashboard");
      } else {
        // For paid plans, open payment dialog
        setIsPaymentDialogOpen(true);
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast({
        title: "Registration failed",
        description: error.response?.data?.message || "An error occurred during registration",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = (transactionId, provider) => {
    try {
      if (name && email && password) {
        // Note: In a real application, we would make an API call here to register the user
        // with payment information. This is just a mockup for demonstration.
        
        toast({
          title: "Registration successful",
          description: `Your account has been created with the ${selectedPlan} plan`,
        });
        
        // Mock user data for paid plans
        localStorage.setItem("auth_token", `paid_${selectedPlan}_${Date.now()}`);
        localStorage.setItem("user_id", `user_${Date.now()}`);
        localStorage.setItem("user_name", name);
        localStorage.setItem("user_email", email);
        localStorage.setItem("user_role", "user");
        localStorage.setItem("is_superadmin", "false");
        localStorage.setItem("subscription_plan", selectedPlan);
        
        setIsPaymentDialogOpen(false);
        navigate("/dashboard");
      } else {
        toast({
          title: "Registration failed",
          description: "Please fill in all fields",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast({
        title: "Registration failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const currentPlan = SUBSCRIPTION_PLANS.find(plan => plan.id === selectedPlan);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-2 bg-purple-100 rounded-full mb-4">
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">AI Chat Widget</h1>
          <p className="text-gray-600 mt-2">Create your account</p>
        </div>

        {showSuperadminButton && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-amber-500" />
                Admin Access
              </CardTitle>
              <CardDescription>
                Create a superadmin account to manage the platform
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button 
                onClick={createSuperAdmin} 
                className="w-full bg-amber-500 hover:bg-amber-600"
                disabled={isLoading}
              >
                Create Superadmin Account
              </Button>
            </CardFooter>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <Card 
              key={plan.id}
              className={`cursor-pointer transition-all ${selectedPlan === plan.id ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'}`}
              onClick={() => handlePlanSelect(plan.id)}
            >
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>
                  {plan.price === 0 ? 
                    "Free" : 
                    `$${plan.price.toFixed(2)}/month`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4">{plan.description}</p>
                <ul className="text-sm space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-primary mr-2">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {selectedPlan === plan.id && (
                  <div className="w-full text-center text-sm font-medium text-primary">
                    Selected
                  </div>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create an Account</CardTitle>
            <CardDescription>Enter your information to create an account</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col">
              <Button type="submit" className="w-full flex items-center gap-2" disabled={isLoading}>
                {isLoading ? "Creating account..." : (
                  <>
                    {selectedPlan !== "free" && <CreditCard className="h-4 w-4" />}
                    {selectedPlan === "free" ? "Create Free Account" : `Subscribe for $${currentPlan.price.toFixed(2)}/month`}
                  </>
                )}
              </Button>
              <p className="text-sm text-center mt-4">
                Already have an account?{" "}
                <Link to="/login" className="text-primary hover:underline">
                  Login
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>

      {currentPlan && currentPlan.id !== "free" && (
        <PaymentDialog
          isOpen={isPaymentDialogOpen}
          onClose={() => setIsPaymentDialogOpen(false)}
          planId={selectedPlan}
          planName={currentPlan.name}
          amount={currentPlan.price}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

export default Register;
