import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Sparkles, Loader2, AlertTriangle, Globe, Plus, X, Bug } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import EmbedCodeGenerator from "@/components/EmbedCodeGenerator";
import ChatWidget from "@/components/chat/ChatWidget";
import PaymentDialog from "@/components/payments/PaymentDialog";
import { Badge } from "@/components/ui/badge";
import { updateWidget, getUserWidgets, getWidget, createWidget, cancelSubscription, updatePaymentInfo, debugWidgetData } from "@/services/api";

// Add custom CSS for widget preview
const widgetPreviewStyles = `
.widget-preview {
  position: relative;
  z-index: 10;
}

.chat-widget-container {
  position: absolute !important;
}

.chat-widget-bubble {
  width: 60px !important;
  height: 60px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  display: flex !important;
  opacity: 1 !important;
  visibility: visible !important;
}
`;

type ModelCapabilities = {
  contextWindow: number; // in tokens
  knowledgeCutoff: string; // date in YYYY-MM format
  specialties: string[]; // e.g., ['code', 'multilingual', 'reasoning']
  documentProcessing: {
    pdf: boolean;
    docx: boolean;
    xlsx: boolean;
    csv: boolean;
    txt: boolean;
  };
  maxDocumentSize: number; // in MB
};

type OpenSourceModel = {
  id: string;
  name: string;
  openSource: true;
  default: boolean;
  capabilities: ModelCapabilities;
  subscriptionLevel: 'free' | 'basic' | 'premium';
};

type PaidModel = {
  id: string;
  name: string;
  openSource: false;
  cost: number;
  capabilities: ModelCapabilities;
  subscriptionLevel: 'basic' | 'premium';
};

type AIModel = OpenSourceModel | PaidModel;

const AI_MODELS = {
  openSource: [
    { 
      id: "llama-3-small", 
      name: "Llama 3 (8B)", 
      openSource: true, 
      default: true,
      subscriptionLevel: 'free',
      capabilities: {
        contextWindow: 8192,
        knowledgeCutoff: "2023-07",
        specialties: ['general', 'reasoning'],
        documentProcessing: {
          pdf: true,
          docx: true,
          xlsx: false,
          csv: true,
          txt: true
        },
        maxDocumentSize: 5
      }
    },
    { 
      id: "mistral-7b", 
      name: "Mistral 7B", 
      openSource: true, 
      default: false,
      subscriptionLevel: 'free',
      capabilities: {
        contextWindow: 8192,
        knowledgeCutoff: "2023-04",
        specialties: ['general', 'multilingual'],
        documentProcessing: {
          pdf: true,
          docx: true,
          xlsx: false,
          csv: true,
          txt: true
        },
        maxDocumentSize: 5
      }
    },
  ] as OpenSourceModel[],
  paid: [
    { 
      id: "gpt-4o", 
      name: "GPT-4o (Premium)", 
      openSource: false, 
      cost: 20,
      subscriptionLevel: 'premium',
      capabilities: {
        contextWindow: 128000,
        knowledgeCutoff: "2023-12",
        specialties: ['general', 'reasoning', 'code', 'multilingual', 'vision'],
        documentProcessing: {
          pdf: true,
          docx: true,
          xlsx: true,
          csv: true,
          txt: true
        },
        maxDocumentSize: 50
      }
    },
    { 
      id: "gpt-4o-mini", 
      name: "GPT-4o Mini", 
      openSource: false, 
      cost: 10,
      subscriptionLevel: 'basic',
      capabilities: {
        contextWindow: 64000,
        knowledgeCutoff: "2023-10",
        specialties: ['general', 'code', 'multilingual'],
        documentProcessing: {
          pdf: true,
          docx: true,
          xlsx: true,
          csv: true,
          txt: true
        },
        maxDocumentSize: 25
      }
    },
    { 
      id: "perplexity-online", 
      name: "Perplexity Online", 
      openSource: false, 
      cost: 15,
      subscriptionLevel: 'premium',
      capabilities: {
        contextWindow: 32000,
        knowledgeCutoff: "2024-04", // Has internet access for up-to-date information
        specialties: ['general', 'research', 'web-search'],
        documentProcessing: {
          pdf: true,
          docx: true,
          xlsx: true,
          csv: true,
          txt: true
        },
        maxDocumentSize: 30
      }
    },
  ] as PaidModel[]
};

const SUBSCRIPTION_PLANS = [
  { 
    id: "free", 
    name: "Free", 
    price: 0,
    features: [
      "Access to open-source models",
      "Up to 5MB document uploads",
      "Basic document processing",
      "Limited context window",
      "1 widget per account"
    ],
    availableModels: AI_MODELS.openSource.filter(model => model.subscriptionLevel === 'free').map(model => model.id)
  },
  { 
    id: "basic", 
    name: "Basic", 
    price: 9.99,
    features: [
      "Access to GPT-4o Mini",
      "Up to 25MB document uploads",
      "Advanced document processing",
      "Extended context window",
      "5 widgets per account",
      "Custom domain embedding"
    ],
    availableModels: [
      ...AI_MODELS.openSource.map(model => model.id),
      ...AI_MODELS.paid.filter(model => model.subscriptionLevel === 'basic').map(model => model.id)
    ]
  },
  { 
    id: "premium", 
    name: "Premium", 
    price: 19.99,
    features: [
      "Access to all models including GPT-4o",
      "Up to 50MB document uploads",
      "Premium document processing",
      "Maximum context window",
      "Unlimited widgets",
      "Priority support",
      "Advanced analytics"
    ],
    availableModels: [
      ...AI_MODELS.openSource.map(model => model.id),
      ...AI_MODELS.paid.map(model => model.id)
    ]
  }
];

const ChatSettings = () => {
  const [botName, setBotName] = useState("AI Assistant");
  const [welcomeMessage, setWelcomeMessage] = useState("Hi there! 👋 How can I help you today?");
  const [primaryColor, setPrimaryColor] = useState("#9b87f5");
  const [widgetPosition, setWidgetPosition] = useState<"bottom-right" | "bottom-left">("bottom-right");
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [offlineMessage, setOfflineMessage] = useState("Sorry, we're currently offline. Please leave a message and we'll get back to you soon.");
  const [showSources, setShowSources] = useState(true);
  const [selectedModel, setSelectedModel] = useState(AI_MODELS.openSource.find(model => model.default)?.id || "llama-3-small");
  const [allowPaidModels, setAllowPaidModels] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState("free");
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [planToUpgrade, setPlanToUpgrade] = useState<"basic" | "premium">("basic");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [requireEmailToStart, setRequireEmailToStart] = useState(false);
  const [collectUserFeedback, setCollectUserFeedback] = useState(false);
  const [siteName, setSiteName] = useState("");
  const [siteDescription, setSiteDescription] = useState("");
  
  const { toast } = useToast();
  
  useEffect(() => {
    const plan = localStorage.getItem("subscription_plan");
    if (plan) {
      setSubscriptionPlan(plan);
      if (plan !== "free") {
        setAllowPaidModels(true);
      }
    }
    
    // Load allowed domains
    const savedDomains = localStorage.getItem("widget_allowed_domains");
    if (savedDomains) {
      try {
        setAllowedDomains(JSON.parse(savedDomains));
      } catch (e) {
        setAllowedDomains([]);
      }
    }
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await getUserWidgets();
        const savedSettings = response.data;

        if (savedSettings && savedSettings.length > 0) {
          const currentWidget = savedSettings[0]; // Get the first widget's settings
          setBotName(currentWidget.botName || "AI Assistant");
          setWelcomeMessage(currentWidget.welcomeMessage || "Hi there! 👋 How can I help you today?");
          setPrimaryColor(currentWidget.primaryColor || "#9b87f5");
          setWidgetPosition(currentWidget.position || "bottom-right");
          setIsOfflineMode(currentWidget.isOfflineMode || false);
          setOfflineMessage(currentWidget.offlineMessage || "Sorry, we're currently offline. Please leave a message and we'll get back to you soon.");
          setShowSources(currentWidget.showSources ?? true);
          setSelectedModel(currentWidget.modelId || "llama-3-small");
          setRequireEmailToStart(currentWidget.requireEmailToStart || false);
          setCollectUserFeedback(currentWidget.collectUserFeedback || false);
          setSiteName(currentWidget.siteName || "");
          setSiteDescription(currentWidget.siteDescription || "");
          
          if (currentWidget.allowedDomains) {
            setAllowedDomains(currentWidget.allowedDomains.split(',').filter(Boolean));
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        toast({
          title: "Error loading settings",
          description: error instanceof Error ? error.message : "There was a problem loading your saved settings.",
          variant: "destructive",
        });
      }
    };

    loadSettings();
  }, []);

  const handleSaveSettings = async () => {
    try {
      // Get the current widget or create a new one if it doesn't exist
      let widgetId = localStorage.getItem("current_widget_id");
      const userId = localStorage.getItem("user_id");
      
      if (!userId) {
        toast({
          title: "Authentication error",
          description: "You must be logged in to save settings.",
          variant: "destructive",
        });
        return;
      }
      
      // Convert allowedDomains array to comma-separated string
      const allowedDomainsString = allowedDomains.join(',');
      
      // Create the data object that exactly matches backend model properties
      const widgetData = {
        botName: botName || "AI Assistant",
        welcomeMessage: welcomeMessage || "Hello! How can I help you today?",
        primaryColor: primaryColor || "#3498db",
        position: widgetPosition || "bottom-right",
        allowedDomains: allowedDomainsString || "*",
        isActive: true,
        modelId: selectedModel || "llama-3-small",
        trackingEnabled: true,
        isOfflineMode: isOfflineMode,
        offlineMessage: offlineMessage,
        showSources: showSources,
        requireEmailToStart: requireEmailToStart,
        collectUserFeedback: collectUserFeedback,
        siteName: siteName,
        siteDescription: siteDescription
      };
      
      // Make sure userId is a valid GUID format when sending to backend
      if (widgetId) {
        // For updates, include the id
        await updateWidget(widgetId, {
          ...widgetData,
          id: widgetId,
          userId: userId
        });
      } else {
        // For creation, don't send an id (backend will generate it)
        const response = await createWidget({
          ...widgetData,
          userId: userId
        });
        
        if (response.data && response.data.id) {
          localStorage.setItem("current_widget_id", response.data.id);
          console.log("Widget created successfully with ID:", response.data.id);
        }
      }
      
      // Update localStorage to reflect changes for the UI
      localStorage.setItem("widget_bot_name", botName);
      localStorage.setItem("widget_welcome_message", welcomeMessage);
      localStorage.setItem("widget_primary_color", primaryColor);
      localStorage.setItem("widget_position", widgetPosition);
      localStorage.setItem("widget_allowed_domains", JSON.stringify(allowedDomains));
      localStorage.setItem("widget_is_offline_mode", isOfflineMode.toString());
      localStorage.setItem("widget_offline_message", offlineMessage);
      localStorage.setItem("widget_selected_model", selectedModel);
      localStorage.setItem("widget_require_email", requireEmailToStart.toString());
      localStorage.setItem("widget_collect_feedback", collectUserFeedback.toString());
      localStorage.setItem("widget_site_name", siteName);
      localStorage.setItem("widget_site_description", siteDescription);
      
      toast({
        title: "Settings saved",
        description: "Your chat widget settings have been updated.",
      });
    } catch (error) {
      console.error("Failed to save settings", error);
      
      // Log more detailed error information
      if (error.response && error.response.data && error.response.data.errors) {
        console.error("Validation errors:", error.response.data.errors);
      }
      
      toast({
        title: "Error saving settings",
        description: "There was a problem saving your settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getCurrentModelDetails = (): AIModel | undefined => {
    const allModels = [...AI_MODELS.openSource, ...AI_MODELS.paid];
    return allModels.find(model => model.id === selectedModel);
  };

  const isPaidModel = (model: AIModel | undefined): model is PaidModel => {
    return model !== undefined && !model.openSource;
  };

  const handleUpgradeClick = (plan: "basic" | "premium") => {
    setPlanToUpgrade(plan);
    setIsPaymentDialogOpen(true);
  };

  const handlePaymentSuccess = async (transactionId: string, provider: 'stripe' | 'paypal') => {
    setIsProcessingPayment(false);
    
    try {
      const planData = SUBSCRIPTION_PLANS.find(p => p.id === planToUpgrade);
      if (!planData) {
        throw new Error("Invalid plan selected");
      }

      // Verify user is logged in first
      const userId = localStorage.getItem("user_id");
      if (!userId) {
        toast({
          title: "Authentication required",
          description: "Please log in to upgrade your subscription.",
          variant: "destructive",
        });
        return;
      }
      
      // Update subscription plan
      try {
        await updateWidget({
          userId,
          subscriptionPlan: planToUpgrade,
          paymentProvider: provider,
          transactionId
        });
      } catch (error) {
        if (error.response?.status === 400 && error.response?.data?.errors?.User) {
          toast({
            title: "Authentication error",
            description: "Please log in again to complete your subscription upgrade.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }
      
      // Update local state after successful API call
      localStorage.setItem("subscription_plan", planToUpgrade);
      localStorage.setItem("payment_transaction", transactionId);
      localStorage.setItem("payment_provider", provider);
      
      setSubscriptionPlan(planToUpgrade);
      setAllowPaidModels(true);
      
      setIsPaymentDialogOpen(false);
      toast({
        title: "Subscription upgraded!",
        description: `You've successfully upgraded to the ${planToUpgrade.charAt(0).toUpperCase() + planToUpgrade.slice(1)} plan.`,
      });
    } catch (error) {
      console.error("Payment processing error:", error);
      toast({
        title: "Payment failed",
        description: error instanceof Error 
          ? error.message 
          : "An error occurred while processing your payment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCancelSubscription = () => {
    setShowCancelDialog(true);
  };

  const confirmCancelSubscription = async () => {
    setIsCancelling(true);
    
    try {
      // Call the real API method to cancel subscription
      await cancelSubscription();
      
      // Update local state
      setSubscriptionPlan("free");
      setAllowPaidModels(false);
      
      // Update localStorage to reflect changes
      localStorage.setItem("subscription_plan", "free");
      
      setIsCancelling(false);
      setShowCancelDialog(false);
      
      toast({
        title: "Subscription cancelled",
        description: "Your subscription has been cancelled. You will retain access until the end of the current billing period.",
      });
    } catch (error) {
      console.error("Failed to cancel subscription", error);
      
      toast({
        title: "Error cancelling subscription",
        description: "There was a problem cancelling your subscription. Please try again or contact support.",
        variant: "destructive",
      });
      
      setIsCancelling(false);
      setShowCancelDialog(false);
    }
  };

  const handleUpdatePaymentInfo = async () => {
    try {
      // Call the real API method to update payment info
      const response = await updatePaymentInfo();
      
      // This would typically return a URL to redirect to the payment provider's portal
      if (response.data && response.data.redirectUrl) {
        window.location.href = response.data.redirectUrl;
      } else {
        toast({
          title: "Update payment information",
          description: "Please check your email for instructions to update your payment details.",
        });
      }
    } catch (error) {
      console.error("Failed to update payment info", error);
      
      toast({
        title: "Error updating payment info",
        description: "There was a problem updating your payment information. Please try again or contact support.",
        variant: "destructive",
      });
    }
  };
  
  const currentPlanData = SUBSCRIPTION_PLANS.find(p => p.id === planToUpgrade);
  const currentModel = getCurrentModelDetails();

  const handleAddDomain = () => {
    if (!newDomain) return;
    
    // Try to parse and normalize the domain
    let domainToAdd = newDomain.trim().toLowerCase();
    
    // If it's a full URL, extract just the hostname
    try {
      const url = new URL(domainToAdd);
      domainToAdd = url.hostname;
    } catch (e) {
      // Not a URL, assume it's just a domain name
    }
    
    // Add if not already in the list
    if (!allowedDomains.includes(domainToAdd)) {
      const updatedDomains = [...allowedDomains, domainToAdd];
      setAllowedDomains(updatedDomains);
      localStorage.setItem("widget_allowed_domains", JSON.stringify(updatedDomains));
      setNewDomain("");
      
      toast({
        title: "Domain added",
        description: `${domainToAdd} has been added to allowed domains.`,
      });
    } else {
      toast({
        title: "Domain already exists",
        description: "This domain is already in your allowed list.",
        variant: "destructive",
      });
    }
  };
  
  const handleRemoveDomain = (domain: string) => {
    const updatedDomains = allowedDomains.filter(d => d !== domain);
    setAllowedDomains(updatedDomains);
    localStorage.setItem("widget_allowed_domains", JSON.stringify(updatedDomains));
    
    toast({
      title: "Domain removed",
      description: `${domain} has been removed from allowed domains.`,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Chat Settings</h1>
        <p className="text-gray-600">Customize your AI chat widget appearance and behavior</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue="appearance">
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="appearance" className="flex-1">Appearance</TabsTrigger>
              <TabsTrigger value="behavior" className="flex-1">Behavior</TabsTrigger>
              <TabsTrigger value="model" className="flex-1">AI Model</TabsTrigger>
              <TabsTrigger value="domains" className="flex-1">Domains</TabsTrigger>
              <TabsTrigger value="subscription" className="flex-1">Subscription</TabsTrigger>
              <TabsTrigger value="embed" className="flex-1">Embed Code</TabsTrigger>
            </TabsList>
            
            <TabsContent value="appearance">
              <Card>
                <CardHeader>
                  <CardTitle>Widget Appearance</CardTitle>
                  <CardDescription>Customize how your chat widget looks to your users</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="botName">Bot Name</Label>
                    <Input
                      id="botName"
                      value={botName}
                      onChange={(e) => setBotName(e.target.value)}
                      placeholder="AI Assistant"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="welcomeMessage">Welcome Message</Label>
                    <Textarea
                      id="welcomeMessage"
                      value={welcomeMessage}
                      onChange={(e) => setWelcomeMessage(e.target.value)}
                      placeholder="Hi there! How can I help you today?"
                      rows={3}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">Primary Color</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="primaryColor"
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-12 h-10 p-1"
                      />
                      <Input
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        placeholder="#9b87f5"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Widget Position</Label>
                    <RadioGroup 
                      defaultValue="bottom-right" 
                      value={widgetPosition}
                      onValueChange={(value) => setWidgetPosition(value as "bottom-right" | "bottom-left")}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="bottom-right" id="bottom-right" />
                        <Label htmlFor="bottom-right">Bottom Right</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="bottom-left" id="bottom-left" />
                        <Label htmlFor="bottom-left">Bottom Left</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleSaveSettings}>Save Appearance Settings</Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="behavior">
              <Card>
                <CardHeader>
                  <CardTitle>Widget Behavior</CardTitle>
                  <CardDescription>Configure how your chat widget behaves</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="siteName">Site Name</Label>
                    <Input
                      id="siteName"
                      value={siteName}
                      onChange={(e) => setSiteName(e.target.value)}
                      placeholder="Enter your website name"
                    />
                    <p className="text-sm text-gray-500">Helps the AI understand the context of your website</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="siteDescription">Site Description</Label>
                    <Textarea
                      id="siteDescription"
                      value={siteDescription}
                      onChange={(e) => setSiteDescription(e.target.value)}
                      placeholder="Brief description of what your website is about"
                      rows={3}
                    />
                    <p className="text-sm text-gray-500">Provides context for your AI assistant to better answer visitor questions</p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="offline-mode" className="block mb-1">Offline Mode</Label>
                      <p className="text-sm text-gray-500">Display an offline message when you're not available</p>
                    </div>
                    <Switch
                      id="offline-mode"
                      checked={isOfflineMode}
                      onCheckedChange={setIsOfflineMode}
                    />
                  </div>
                  
                  {isOfflineMode && (
                    <div className="space-y-2">
                      <Label htmlFor="offlineMessage">Offline Message</Label>
                      <Textarea
                        id="offlineMessage"
                        value={offlineMessage}
                        onChange={(e) => setOfflineMessage(e.target.value)}
                        placeholder="Sorry, we're currently offline. Please leave a message."
                        rows={3}
                      />
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="show-sources" className="block mb-1">Show Sources</Label>
                      <p className="text-sm text-gray-500">Display source documents for AI responses</p>
                    </div>
                    <Switch
                      id="show-sources"
                      checked={showSources}
                      onCheckedChange={setShowSources}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="require-email" className="block mb-1">Require Email</Label>
                      <p className="text-sm text-gray-500">Require users to provide their email before starting a chat</p>
                    </div>
                    <Switch
                      id="require-email"
                      checked={requireEmailToStart}
                      onCheckedChange={setRequireEmailToStart}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="collect-feedback" className="block mb-1">Collect Feedback</Label>
                      <p className="text-sm text-gray-500">Allow users to provide feedback on AI responses</p>
                    </div>
                    <Switch
                      id="collect-feedback"
                      checked={collectUserFeedback}
                      onCheckedChange={setCollectUserFeedback}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleSaveSettings}>Save Behavior Settings</Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="model">
              <Card>
                <CardHeader>
                  <CardTitle>AI Model Configuration</CardTitle>
                  <CardDescription>Select which AI model powers your chat</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Default Model (Open Source)</Label>
                    <Select value={selectedModel} onValueChange={(value) => setSelectedModel(value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select AI model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="header-opensource" disabled className="font-semibold">
                          Open Source Models (Free)
                        </SelectItem>
                        {AI_MODELS.openSource.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name}
                          </SelectItem>
                        ))}
                        
                        {allowPaidModels && (
                          <>
                            <SelectItem value="header-paid" disabled className="font-semibold mt-2">
                              Premium Models (Additional Cost)
                            </SelectItem>
                            {AI_MODELS.paid.map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                {model.name} (${model.cost}/mo)
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 pb-2">
                    <div>
                      <Label htmlFor="allow-paid-models" className="block mb-1">Enable Premium Models</Label>
                      <p className="text-sm text-gray-500">Allow users to select paid models (requires payment integration)</p>
                    </div>
                    <Switch
                      id="allow-paid-models"
                      checked={allowPaidModels}
                      onCheckedChange={setAllowPaidModels}
                    />
                  </div>
                  
                  {!allowPaidModels && (
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm">
                      <p className="text-amber-800">Premium AI models are currently disabled. Enable them to offer more advanced capabilities to your users.</p>
                    </div>
                  )}
                  
                  {currentModel && !currentModel.openSource && isPaidModel(currentModel) && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm mt-4">
                      <p className="text-blue-800">
                        <span className="font-semibold">Note:</span> You've selected {currentModel.name}, which costs ${currentModel.cost} per month. 
                        You'll need to implement a payment system to charge users for this premium model.
                      </p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button onClick={handleSaveSettings}>Save Model Settings</Button>
                  
                  {process.env.NODE_ENV === 'development' && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="ml-auto flex items-center gap-1 text-sm" 
                      onClick={async () => {
                        try {
                          const allowedDomainsString = allowedDomains.join(',');
                          
                          // Create test data that exactly matches backend model
                          const testData = {
                            botName: botName || "AI Assistant",
                            welcomeMessage: welcomeMessage || "Hello! How can I help you today?",
                            primaryColor: primaryColor || "#3498db",
                            position: widgetPosition || "bottom-right",
                            allowedDomains: allowedDomainsString || "*",
                            isActive: true,
                            modelId: selectedModel || "llama-3-small",
                            trackingEnabled: true,
                            isOfflineMode: isOfflineMode,
                            offlineMessage: offlineMessage,
                            showSources: showSources,
                            requireEmailToStart: requireEmailToStart,
                            collectUserFeedback: collectUserFeedback,
                            siteName: siteName,
                            siteDescription: siteDescription,
                            userId: localStorage.getItem("user_id")
                          };
                          
                          // Send to debug endpoint
                          const response = await debugWidgetData(testData);
                          console.log("Debug endpoint response:", response.data);
                          
                          toast({
                            title: "Debug successful",
                            description: "Check the console for debug information.",
                          });
                        } catch (error) {
                          console.error("Debug error:", error);
                          toast({
                            title: "Debug failed",
                            description: "Error testing the API. Check console for details.",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <Bug size={16} /> Debug API
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="domains">
              <Card>
                <CardHeader>
                  <CardTitle>Allowed Domains</CardTitle>
                  <CardDescription>Control which domains can embed your chat widget</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newDomain">Add Domain</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="newDomain"
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        placeholder="example.com"
                        className="flex-1"
                      />
                      <Button onClick={handleAddDomain} type="button">
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Enter domain names where you want to embed your chat widget. You can enter just the domain (e.g. "example.com") or subdomain (e.g. "app.example.com").
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Current Allowed Domains</Label>
                    <div className="border rounded-md p-4">
                      {allowedDomains.length === 0 ? (
                        <div className="text-center py-6 text-gray-500">
                          <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No domains added yet. Add domains where you want to embed your chat widget.</p>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {allowedDomains.map((domain) => (
                            <Badge key={domain} variant="secondary" className="py-1.5">
                              {domain}
                              <button 
                                onClick={() => handleRemoveDomain(domain)}
                                className="ml-1 hover:text-red-500"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Your chat widget can only be embedded on these domains. Add "localhost" for local development.
                    </p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleSaveSettings}>Save Domain Settings</Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="subscription">
              <Card>
                <CardHeader>
                  <CardTitle>Subscription Management</CardTitle>
                  <CardDescription>Manage your subscription plan and payment details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <Sparkles className="h-5 w-5 text-purple-500 mr-2" />
                        <h3 className="font-medium">Current Plan</h3>
                      </div>
                      <span className="text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded">
                        {subscriptionPlan === "free" ? "Free" : 
                         subscriptionPlan === "basic" ? "Basic" : "Premium"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {subscriptionPlan === "free" ? (
                        "You are currently on the Free plan with limited features."
                      ) : subscriptionPlan === "basic" ? (
                        "You are subscribed to the Basic plan. You have access to standard features."
                      ) : (
                        "You are subscribed to the Premium plan. You have access to all features."
                      )}
                    </p>
                  </div>

                  {subscriptionPlan !== "free" && (
                    <div className="space-y-4">
                      <div className="border rounded-md p-4">
                        <h3 className="font-medium mb-2">Payment Information</h3>
                        <div className="flex items-center gap-3">
                          <CreditCard className="h-10 w-10 text-gray-400" />
                          <div>
                            <p className="font-medium">
                              {localStorage.getItem("payment_provider") === "stripe" ? "Credit Card" : "PayPal"}
                            </p>
                            <p className="text-sm text-gray-500">
                              Billing frequency: Monthly
                            </p>
                          </div>
                        </div>
                      </div>

                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={handleUpdatePaymentInfo}
                      >
                        Update Payment Information
                      </Button>
                    </div>
                  )}

                  {subscriptionPlan === "free" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="border border-blue-100">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">Basic Plan</CardTitle>
                          <CardDescription className="text-lg font-bold">$9.99/month</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm">
                          <ul className="space-y-1">
                            <li className="flex items-start">
                              <span className="text-green-500 mr-2">✓</span>
                              Unlimited messages
                            </li>
                            <li className="flex items-start">
                              <span className="text-green-500 mr-2">✓</span>
                              Standard AI models
                            </li>
                            <li className="flex items-start">
                              <span className="text-green-500 mr-2">✓</span>
                              Basic customization
                            </li>
                          </ul>
                        </CardContent>
                        <CardFooter>
                          <Button className="w-full" onClick={() => handleUpgradeClick("basic")}>
                            Upgrade to Basic
                          </Button>
                        </CardFooter>
                      </Card>

                      <Card className="border-2 border-purple-200 shadow-md">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-center">
                            <CardTitle className="text-lg">Premium Plan</CardTitle>
                            <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-1 rounded">Popular</span>
                          </div>
                          <CardDescription className="text-lg font-bold">$19.99/month</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm">
                          <ul className="space-y-1">
                            <li className="flex items-start">
                              <span className="text-green-500 mr-2">✓</span>
                              Unlimited messages
                            </li>
                            <li className="flex items-start">
                              <span className="text-green-500 mr-2">✓</span>
                              All AI models
                            </li>
                            <li className="flex items-start">
                              <span className="text-green-500 mr-2">✓</span>
                              Full customization
                            </li>
                            <li className="flex items-start">
                              <span className="text-green-500 mr-2">✓</span>
                              Priority support
                            </li>
                          </ul>
                        </CardContent>
                        <CardFooter>
                          <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => handleUpgradeClick("premium")}>
                            Upgrade to Premium
                          </Button>
                        </CardFooter>
                      </Card>
                    </div>
                  ) : (
                    <>
                      {subscriptionPlan === "basic" && (
                        <Card className="border-2 border-purple-200 shadow-md">
                          <CardHeader className="pb-2">
                            <div className="flex justify-between items-center">
                              <CardTitle className="text-lg">Premium Plan</CardTitle>
                              <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-1 rounded">Popular</span>
                            </div>
                            <CardDescription className="text-lg font-bold">$19.99/month</CardDescription>
                          </CardHeader>
                          <CardContent className="text-sm">
                            <ul className="space-y-1">
                              <li className="flex items-start">
                                <span className="text-green-500 mr-2">✓</span>
                                Unlimited messages
                              </li>
                              <li className="flex items-start">
                                <span className="text-green-500 mr-2">✓</span>
                                All AI models
                              </li>
                              <li className="flex items-start">
                                <span className="text-green-500 mr-2">✓</span>
                                Full customization
                              </li>
                              <li className="flex items-start">
                                <span className="text-green-500 mr-2">✓</span>
                                Priority support
                              </li>
                            </ul>
                          </CardContent>
                          <CardFooter>
                            <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => handleUpgradeClick("premium")}>
                              Upgrade to Premium
                            </Button>
                          </CardFooter>
                        </Card>
                      )}

                      <div className="border-t pt-4 mt-4">
                        <Button 
                          variant="outline" 
                          className="w-full text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={handleCancelSubscription}
                        >
                          Cancel Subscription
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="embed">
              <EmbedCodeGenerator
                botName={botName}
                primaryColor={primaryColor}
                welcomeMessage={welcomeMessage}
                position={widgetPosition}
              />
            </TabsContent>
          </Tabs>
        </div>
        
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Widget Preview</CardTitle>
              <CardDescription>
                This is how your chat widget will look
                {currentModel && (
                  <span className="block text-xs mt-1">
                    Powered by: <span className="font-semibold">{currentModel.name}</span>
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-96 relative bg-gray-50 rounded-b-lg overflow-hidden">
              <div className="mockup-site relative flex flex-col w-full h-full bg-gray-50 overflow-hidden">
                {/* Header */}
                <div className="site-header h-16 w-full bg-white border-b border-gray-200 flex items-center px-6">
                  <div className="site-logo flex items-center">
                    <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-lg">A</div>
                    <div className="text-lg font-semibold text-gray-800 ml-3">Acme Inc</div>
                  </div>
                  <div className="flex space-x-6 ml-auto">
                    <div className="text-sm font-medium text-gray-600">Home</div>
                    <div className="text-sm font-medium text-gray-600">Products</div>
                    <div className="text-sm font-medium text-gray-600">About</div>
                    <div className="text-sm font-medium text-gray-600">Contact</div>
                  </div>
                </div>
                
                {/* Content */}
                <div className="site-content flex-1 p-6 overflow-y-auto">
                  <div className="max-w-4xl mx-auto">
                    <div className="mb-6">
                      <h1 className="text-2xl font-bold text-gray-800 mb-4">Welcome to Acme Inc.</h1>
                      <p className="text-gray-600 mb-2">We provide innovative solutions for businesses of all sizes. Our cutting-edge technology helps streamline your workflow and boost productivity.</p>
                      <p className="text-gray-600 mb-2">Founded in 2010, Acme Inc. has helped over 10,000 businesses transform their operations.</p>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="w-full h-20 bg-blue-100 rounded-md mb-3 flex items-center justify-center">
                          <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                        </div>
                        <h3 className="font-medium text-gray-800">Quality Service</h3>
                        <p className="text-sm text-gray-600 mt-1">We pride ourselves on delivering exceptional quality.</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="w-full h-20 bg-green-100 rounded-md mb-3 flex items-center justify-center">
                          <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"></path><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"></path></svg>
                        </div>
                        <h3 className="font-medium text-gray-800">Cost Effective</h3>
                        <p className="text-sm text-gray-600 mt-1">Affordable solutions that maximize your ROI.</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="w-full h-20 bg-purple-100 rounded-md mb-3 flex items-center justify-center">
                          <svg className="w-8 h-8 text-purple-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path></svg>
                        </div>
                        <h3 className="font-medium text-gray-800">24/7 Support</h3>
                        <p className="text-sm text-gray-600 mt-1">Our team is always available to help you.</p>
                      </div>
                    </div>
                    
                    <div className="mb-6">
                      <h2 className="text-xl font-semibold text-gray-800 mb-4">Why Choose Us</h2>
                      <p className="text-gray-600 mb-2">Our dedicated team works tirelessly to ensure your success. We believe in building long-term relationships with our clients.</p>
                      <p className="text-gray-600 mb-2">With Acme Inc., you get more than just a service provider – you get a partner committed to your growth and success.</p>
                      <p className="text-gray-600 mb-2">Ready to transform your business? Get in touch with us today!</p>
                    </div>
                  </div>
                </div>
                
                {/* Chat Widget Button */}
                <div 
                  className={`absolute ${widgetPosition === 'bottom-left' ? 'left-6' : 'right-6'} bottom-6 w-14 h-14 rounded-full flex items-center justify-center shadow-md cursor-pointer hover:scale-105 transition-all duration-300`}
                  style={{ 
                    backgroundColor: primaryColor,
                    animation: isChatOpen ? 'none' : 'pulse 2s infinite'
                  }}
                  onClick={() => setIsChatOpen(!isChatOpen)}
                >
                  {isChatOpen ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 6L6 18M6 6L18 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 12H8.01M12 12H12.01M16 12H16.01M21 12C21 16.418 16.97 20 12 20C10.5286 20 9.14077 19.6926 7.91633 19.1502C7.42436 18.9412 7.17837 18.8367 7.01542 18.8244C6.84287 18.8114 6.74559 18.8425 6.61901 18.8973C6.50035 18.9485 6.35975 19.0555 6.07854 19.2695L3.5 21L4.031 18.332C4.15522 17.7748 4.21732 17.4962 4.2322 17.2529C4.24875 16.9847 4.21981 16.8319 4.18517 16.7219C4.14674 16.6001 4.06568 16.4569 3.90358 16.1706C3.32246 15.1156 3 13.9223 3 12C3 7.58172 7.02944 4 12 4C16.97 4 21 7.58172 21 12Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                
                {/* Chat Widget Interface */}
                {isChatOpen && (
                  <div 
                    className={`absolute ${widgetPosition === 'bottom-left' ? 'left-6' : 'right-6'} bottom-24 w-80 h-96 bg-white rounded-lg shadow-xl flex flex-col overflow-hidden transition-all duration-300 ease-in-out`}
                    style={{ 
                      transform: isChatOpen ? 'translateY(0)' : 'translateY(20px)',
                      opacity: isChatOpen ? 1 : 0,
                    }}
                  >
                    {/* Chat Header */}
                    <div className="p-4 flex items-center" style={{ backgroundColor: primaryColor }}>
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center mr-3">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9 21H5C3.89543 19 3 17.1046 3 15C3 14.5 3 13 3 12C3 9.23858 5.23858 7 8 7C10.7614 7 13 9.23858 13 12C13 12.5 13 14 13 15C13 17.1046 12.1046 19 11 21M15 7C15 9.76142 12.7614 12 10 12C7.23858 12 5 9.76142 5 7C5 4.23858 7.23858 2 10 2C12.7614 2 15 4.23858 15 7ZM16.7302 16C17.4944 16.6325 18.5324 17 19.6789 17C21.5124 17 23 15.6569 23 14C23 12.3431 21.5124 11 19.6789 11C18.5324 11 17.4944 11.3675 16.7302 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-medium">{botName}</h3>
                        <p className="text-white/70 text-xs">Online</p>
                      </div>
                      <button 
                        className="text-white/80 hover:text-white"
                        onClick={() => setIsChatOpen(false)}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                    
                    {/* Chat Messages */}
                    <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                      {/* Bot welcome message */}
                      <div className="flex mb-4">
                        <div className="rounded-lg rounded-tl-none bg-gray-200 p-3 ml-2 max-w-[80%]">
                          <p className="text-sm">{welcomeMessage}</p>
                        </div>
                      </div>
                      
                      {/* Sample conversation for preview */}
                      <div className="flex justify-end mb-4">
                        <div className="rounded-lg rounded-tr-none p-3 mr-2 max-w-[80%]" style={{ backgroundColor: primaryColor + '20', color: '#333' }}>
                          <p className="text-sm">Hi! Can you tell me more about your services?</p>
                        </div>
                      </div>
                      
                      <div className="flex mb-4">
                        <div className="rounded-lg rounded-tl-none bg-gray-200 p-3 ml-2 max-w-[80%]">
                          <p className="text-sm">I'd be happy to! Acme Inc. offers a range of business solutions including software development, cloud services, and IT consulting. Our team specializes in creating custom solutions tailored to your specific needs.</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Input Area */}
                    <div className="p-3 border-t">
                      <div className="flex items-center">
                        <input 
                          type="text" 
                          placeholder="Type your message..." 
                          className="flex-1 border border-gray-300 rounded-l-lg px-3 py-2 focus:outline-none"
                          disabled
                        />
                        <button 
                          className="px-3 py-2 rounded-r-lg text-white"
                          style={{ backgroundColor: primaryColor }}
                          disabled
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 text-center">
                        Powered by {getCurrentModelDetails()?.name || "AI Assistant"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {currentPlanData && (
        <PaymentDialog
          isOpen={isPaymentDialogOpen}
          onClose={() => setIsPaymentDialogOpen(false)}
          planId={planToUpgrade}
          planName={currentPlanData.name}
          amount={currentPlanData.price}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4">
                <p>Are you sure you want to cancel your subscription?</p>
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold">Important:</p>
                    <p>You'll lose access to premium features at the end of your current billing period.</p>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>
              Keep Subscription
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmCancelSubscription();
              }}
              disabled={isCancelling}
              className="bg-red-500 hover:bg-red-600"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Cancel Subscription"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ChatSettings;
