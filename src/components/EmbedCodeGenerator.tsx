import React, { useState, useEffect } from 'react';
import { Copy, Check, Plus, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface EmbedCodeGeneratorProps {
  botName: string;
  primaryColor: string;
  welcomeMessage: string;
  position: 'bottom-right' | 'bottom-left';
  modelId?: string;
}

const EmbedCodeGenerator: React.FC<EmbedCodeGeneratorProps> = ({
  botName,
  primaryColor,
  welcomeMessage,
  position,
  modelId = 'llama-3-small'
}) => {
  const [copied, setCopied] = useState(false);
  const [domain, setDomain] = useState('');
  const [hostName, setHostName] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [siteContext, setSiteContext] = useState({
    siteName: '',
    siteDescription: '',
    primaryContent: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    // Get the current domain from localStorage or default to window location
    const savedDomain = localStorage.getItem('widget_domain') || window.location.origin;
    setDomain(savedDomain);
    
    // Extract hostname for display
    try {
      const url = new URL(savedDomain);
      setHostName(url.hostname);
    } catch (e) {
      setHostName(window.location.hostname);
    }
  }, []);

  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDomain(e.target.value);
    localStorage.setItem('widget_domain', e.target.value);
    
    try {
      const url = new URL(e.target.value);
      setHostName(url.hostname);
    } catch (e) {
      // Invalid URL, keep the hostname as is
    }
  };

  const handleSiteContextChange = (field: string, value: string) => {
    setSiteContext(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Generate the iframe embed code with site context
  const iframeCode = `<iframe
  src="${domain}/widget?name=${encodeURIComponent(botName)}&color=${encodeURIComponent(primaryColor)}&message=${encodeURIComponent(welcomeMessage)}&position=${position}&model=${encodeURIComponent(modelId)}${
    siteContext.siteName ? `&siteName=${encodeURIComponent(siteContext.siteName)}` : ''
  }${
    siteContext.siteDescription ? `&siteDescription=${encodeURIComponent(siteContext.siteDescription)}` : ''
  }${
    siteContext.primaryContent ? `&primaryContent=${encodeURIComponent(siteContext.primaryContent)}` : ''
  }"
  width="0"
  height="0"
  frameborder="0"
  style="position: fixed; bottom: 0; right: 0; border: none; min-width: 0; min-height: 0;"
></iframe>`;

  // Generate the script embed code with site context
  const scriptCode = `<script>
  (function(w,d,s,o,f,js,fjs){
    w['AI-Chat-Widget']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    w[o].l=1*new Date();js=d.createElement(s);fjs=d.getElementsByTagName(s)[0];
    js.async=1;js.src=f;js.dataset.botName="${botName}";
    js.dataset.primaryColor="${primaryColor}";
    js.dataset.welcomeMessage="${welcomeMessage.replace(/"/g, '&quot;')}";
    js.dataset.position="${position}";
    js.dataset.modelId="${modelId}";
    ${siteContext.siteName ? `js.dataset.siteName="${siteContext.siteName.replace(/"/g, '&quot;')}";` : ''}
    ${siteContext.siteDescription ? `js.dataset.siteDescription="${siteContext.siteDescription.replace(/"/g, '&quot;')}";` : ''}
    ${siteContext.primaryContent ? `js.dataset.primaryContent="${siteContext.primaryContent.replace(/"/g, '&quot;')}";` : ''}
    fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','aiChat','${domain}/widget.js'));
</script>`;

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast({
      title: "Code copied to clipboard",
      description: "You can now paste it into your website.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-5">
      <h3 className="text-lg font-semibold mb-4">Embed Code</h3>
      <p className="text-sm text-gray-600 mb-4">
        Copy and paste this code into your website to add the chat widget.
      </p>
      
      <div className="mb-6">
        <Label htmlFor="domainSetting">Widget Domain</Label>
        <div className="flex items-center gap-2 mt-1">
          <Input
            id="domainSetting"
            value={domain}
            onChange={handleDomainChange}
            placeholder="https://your-domain.com"
            className="flex-1"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          This is the domain where your widget is hosted. The embed code will load the widget from this domain.
        </p>
        
        {domain && (
          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-md text-sm">
            <span className="font-semibold text-green-700">Allowed domains:</span>
            <div className="mt-1 text-green-600">
              <code className="bg-green-100 px-1 py-0.5 rounded">✓ {hostName}</code>
            </div>
            <p className="text-xs mt-1 text-green-600">
              Your widget will be accessible from this domain.
            </p>
          </div>
        )}
      </div>
      
      <Accordion type="single" collapsible className="mb-6">
        <AccordionItem value="site-context">
          <AccordionTrigger className="text-sm font-medium">
            Site Context (Recommended)
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="siteName">Site Name</Label>
                <Input
                  id="siteName"
                  value={siteContext.siteName}
                  onChange={(e) => handleSiteContextChange('siteName', e.target.value)}
                  placeholder="Your Site Name"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="siteDescription">Site Description</Label>
                <Textarea
                  id="siteDescription"
                  value={siteContext.siteDescription}
                  onChange={(e) => handleSiteContextChange('siteDescription', e.target.value)}
                  placeholder="A brief description of your website and what it offers"
                  className="mt-1"
                  rows={2}
                />
              </div>
              
              <div>
                <Label htmlFor="primaryContent">Primary Content/Products</Label>
                <Textarea
                  id="primaryContent"
                  value={siteContext.primaryContent}
                  onChange={(e) => handleSiteContextChange('primaryContent', e.target.value)}
                  placeholder="Describe your main products, services, or content"
                  className="mt-1"
                  rows={3}
                />
              </div>
              
              <div className="pt-2 text-xs text-gray-500">
                <p>Adding site context helps the chat widget provide relevant answers about your specific website instead of generic responses.</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
      <Tabs defaultValue="script">
        <TabsList className="mb-4">
          <TabsTrigger value="script">Script Tag</TabsTrigger>
          <TabsTrigger value="iframe">IFrame</TabsTrigger>
        </TabsList>
        
        <TabsContent value="script">
          <div className="relative">
            <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-x-auto">
              {scriptCode}
            </pre>
            <Button 
              size="sm" 
              variant="ghost" 
              className="absolute top-2 right-2" 
              onClick={() => copyToClipboard(scriptCode)}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            ℹ️ Recommended: This method loads asynchronously and won't block your page load.
          </p>
        </TabsContent>
        
        <TabsContent value="iframe">
          <div className="relative">
            <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-x-auto">
              {iframeCode}
            </pre>
            <Button 
              size="sm" 
              variant="ghost" 
              className="absolute top-2 right-2" 
              onClick={() => copyToClipboard(iframeCode)}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default EmbedCodeGenerator;
