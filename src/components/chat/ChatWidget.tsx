import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, X, MessageSquare, Upload, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  sources?: { title: string; url: string }[];
}

interface ChatWidgetProps {
  botName?: string;
  botAvatar?: string;
  primaryColor?: string;
  welcomeMessage?: string;
  widgetPosition?: 'bottom-right' | 'bottom-left';
  modelId?: string;
  embedMode?: boolean;
  siteContext?: {
    siteName?: string;
    siteDescription?: string;
    primaryContent?: string;
    customKnowledge?: Record<string, any>;
  };
}

// Default knowledge base for the chat widget product
const defaultKnowledgeBase = {
  pricing: {
    content: "We offer three pricing plans: Free, Basic ($9.99/month), and Premium ($19.99/month). Each plan offers different features and levels of support.",
    sources: [
      { title: "Pricing Page", url: "#pricing" },
      { title: "Feature Comparison", url: "#features" }
    ]
  },
  account: {
    content: "You can manage your account by logging in to the dashboard. From there, you can update your profile, change your subscription, and manage your payment methods.",
    sources: [
      { title: "Account Settings", url: "#account" },
      { title: "Subscription Management", url: "#subscription" }
    ]
  },
  help: {
    content: "I'm here to help! You can ask me about our product features, pricing, account management, or technical support. If I can't answer your question, I can connect you with a human agent.",
    sources: [
      { title: "Help Center", url: "#help" },
      { title: "Contact Support", url: "#contact" }
    ]
  },
  features: {
    content: "Our AI chat widget offers customizable appearance, multiple AI models, domain control for embedding, and comprehensive analytics. You can integrate it easily with your website using our embed code.",
    sources: [
      { title: "Feature Documentation", url: "#features" },
      { title: "Integration Guide", url: "#integration" }
    ]
  }
};

// Common intents and response patterns
const intentPatterns = [
  {
    pattern: /(hi|hello|hey|greetings)/i,
    response: "Hello there! How can I assist you today?",
  },
  {
    pattern: /(bye|goodbye|see you|farewell)/i,
    response: "Thank you for chatting with me! If you have more questions later, feel free to return. Have a great day!",
  },
  {
    pattern: /(thanks|thank you|appreciate)/i,
    response: "You're welcome! I'm happy I could help. Is there anything else you'd like to know?",
  },
];

const DEFAULT_WELCOME_MESSAGE = "Hi there! 👋 I'm your AI assistant. How can I help you today?";

const ChatWidget: React.FC<ChatWidgetProps> = ({
  botName = 'AI Assistant',
  botAvatar,
  primaryColor,
  welcomeMessage = DEFAULT_WELCOME_MESSAGE,
  widgetPosition = 'bottom-right',
  modelId = 'llama-3-small',
  embedMode = false,
  siteContext = {},
}) => {
  const [isOpen, setIsOpen] = useState(embedMode);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationContext, setConversationContext] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Combine default knowledge with custom knowledge if provided
  const knowledgeBase = useMemo(() => {
    if (siteContext?.customKnowledge && Object.keys(siteContext.customKnowledge).length > 0) {
      return { ...defaultKnowledgeBase, ...siteContext.customKnowledge };
    }
    return defaultKnowledgeBase;
  }, [siteContext?.customKnowledge]);
  
  // Store site context information
  const siteInfo = useMemo(() => {
    return {
      name: siteContext?.siteName || 'our website',
      description: siteContext?.siteDescription || '',
      content: siteContext?.primaryContent || '',
      hasSiteContext: !!(siteContext?.siteName || siteContext?.siteDescription || siteContext?.primaryContent)
    };
  }, [siteContext]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Add the welcome message when the widget is first opened
      setMessages([
        {
          id: '1',
          content: welcomeMessage,
          sender: 'bot',
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, welcomeMessage]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Check if the input matches any knowledge base topics
  const checkKnowledgeBase = (input: string) => {
    const topics = Object.keys(knowledgeBase);
    for (const topic of topics) {
      if (input.toLowerCase().includes(topic)) {
        return knowledgeBase[topic as keyof typeof knowledgeBase];
      }
    }
    return null;
  };
  
  // Check if the input matches any intent patterns
  const checkIntentPatterns = (input: string) => {
    for (const intent of intentPatterns) {
      if (intent.pattern.test(input)) {
        return intent.response;
      }
    }
    return null;
  };
  
  // Modified to use site context
  const generateContextualResponse = (input: string, context: string[]) => {
    // If we have site context, prioritize answering about the site we're embedded in
    if (siteInfo.hasSiteContext) {
      // Check if asking about the website or what it does
      if (/what (is|about) (this site|this website|this page)/i.test(input) || 
          /what (does|do) (this site|this website|you) (do|offer|sell|have)/i.test(input)) {
        return `This is ${siteInfo.name}. ${siteInfo.description}`;
      }
      
      // Check if asking about products or inventory
      if (/product|service|offer|provide|do you have|sell|inventory|item/i.test(input)) {
        if (siteInfo.content) {
          return siteInfo.content;
        }
      }
    }
    
    // If no site context matches or no site context provided, fall back to chat widget info
    
    // Check if asking about the chat widget itself
    if (/what (is|are) you|who are you|what can you do|what's your purpose/i.test(input)) {
      return `I'm ${botName}, an AI assistant powered by ${modelId}. I'm here to help answer questions and provide assistance.${siteInfo.hasSiteContext ? ` I'm specifically knowledgeable about ${siteInfo.name}.` : ''}`;
    }
    
    // Check if asking about products or services with no site context
    if (/product|service|offer|provide|do you have|sell/i.test(input) && !siteInfo.hasSiteContext) {
      return "We offer an AI-powered chat widget that can be embedded on your website to provide instant support to your customers. It's customizable, easy to set up, and uses advanced AI models to answer questions accurately.";
    }
    
    // Check if asking how to do something
    if (/how (can|do) (i|we|you)|how to/i.test(input)) {
      if (siteInfo.hasSiteContext) {
        return `I can help answer questions about ${siteInfo.name}. What would you like to know?`;
      } else {
        return "To get started, you'll need to sign up for an account, configure your chat widget settings in the dashboard, and then embed the widget on your website using our easy-to-use code snippet. Would you like me to guide you through this process?";
      }
    }
    
    // If asking about integration (only relevant if not in site context)
    if (/integrate|integration|connect|add to (my|our) (site|website)/i.test(input) && !siteInfo.hasSiteContext) {
      return "Integrating our chat widget is simple. Once you've configured it in the dashboard, you'll get an embed code that you can add to your website's HTML. The widget will appear right away and start helping your customers. Would you like more details about the integration process?";
    }
    
    // If asking about pricing or cost (only relevant if not in site context)
    if (/price|pricing|cost|how much|fee/i.test(input) && !siteInfo.hasSiteContext) {
      return "We offer three pricing tiers: Free (with basic features), Basic ($9.99/month), and Premium ($19.99/month). Each tier offers different features and capabilities. Would you like to know what's included in each plan?";
    }
    
    // If nothing specific matched but we have site info, give a site-aware default response
    if (siteInfo.hasSiteContext) {
      return `I'm here to help with any questions about ${siteInfo.name}. What would you like to know?`;
    }
    
    // Default response if no specific pattern is matched
    return "I understand you're asking about " + input.substring(0, 30) + "... Let me help with that. Could you provide a bit more detail about what specific information you're looking for?";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim()) return;
    
    // Store the current input for processing
    const currentInput = inputValue;
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: currentInput,
      sender: 'user',
      timestamp: new Date(),
    };
    
    // Update conversation context
    const updatedContext = [...conversationContext, currentInput];
    setConversationContext(updatedContext);
    
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    
    // Simulate AI is typing
    setIsTyping(true);
    
    // Simulate AI response based on various factors
    setTimeout(() => {
      let response: Message;
      
      // Check if user wants to talk to a human
      if (currentInput.toLowerCase().includes('human') || 
          currentInput.toLowerCase().includes('agent') || 
          currentInput.toLowerCase().includes('person') ||
          currentInput.toLowerCase().includes('support') ||
          currentInput.toLowerCase().includes('talk to someone')) {
        response = {
          id: Date.now().toString() + '-bot',
          content: "I'll connect you with a human agent. Please wait a moment while I transfer your conversation. Someone from our team will be with you shortly.",
          sender: 'bot',
          timestamp: new Date(),
        };
      } 
      // Check if the input matches a knowledge base topic
      else if (checkKnowledgeBase(currentInput)) {
        const kbResult = checkKnowledgeBase(currentInput);
        response = {
          id: Date.now().toString() + '-bot',
          content: kbResult!.content,
          sender: 'bot',
          timestamp: new Date(),
          sources: kbResult!.sources
        };
      }
      // Check if the input matches an intent pattern
      else if (checkIntentPatterns(currentInput)) {
        response = {
          id: Date.now().toString() + '-bot',
          content: checkIntentPatterns(currentInput)!,
          sender: 'bot',
          timestamp: new Date(),
        };
      } 
      // Generate contextual response based on input and site context
      else {
        response = {
          id: Date.now().toString() + '-bot',
          content: generateContextualResponse(currentInput, updatedContext),
          sender: 'bot',
          timestamp: new Date(),
        };
      }
      
      setMessages((prev) => [...prev, response]);
      setIsTyping(false);
    }, 1000);
  };

  const toggleWidget = () => {
    setIsOpen(!isOpen);
    // Focus the input when opening
    if (!isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  };

  return (
    <div className={`chat-widget-container ${widgetPosition === 'bottom-left' ? 'left-4' : 'right-4'}`}>
      {isOpen && (
        <div className="chat-widget-window" style={{ '--chat-primary-color': primaryColor } as React.CSSProperties}>
          <div className="widget-header">
            <div className="flex items-center">
              {botAvatar ? (
                <img src={botAvatar} alt={botName} className="w-8 h-8 rounded-full mr-2" />
              ) : (
                <MessageSquare className="w-6 h-6 mr-2" />
              )}
              <span>{botName}</span>
            </div>
            {!embedMode && (
              <Button variant="ghost" size="icon" onClick={toggleWidget} className="text-white hover:bg-white/20">
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
          
          <div className="messages-container">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={message.sender === 'user' ? 'user-message' : 'bot-message'}>
                  {message.content}
                  
                  {/* Sources section if available */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 text-xs opacity-80">
                      <div className="font-semibold">Sources:</div>
                      <ul className="list-disc pl-4">
                        {message.sources.map((source, index) => (
                          <li key={index}>
                            <a 
                              href={source.url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="underline"
                            >
                              {source.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bot-message flex items-center space-x-1">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse delay-100"></div>
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse delay-200"></div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={handleSubmit} className="message-input-container">
            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your message..."
                className="resize-none min-h-[60px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <Button type="submit" size="icon" className="flex-shrink-0">
                <Send className="h-5 w-5" />
              </Button>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Press Enter to send. Use Shift+Enter for a new line.
            </div>
          </form>
        </div>
      )}
      
      {!embedMode && (
        <button 
          onClick={toggleWidget}
          className="chat-widget-bubble"
        >
          {isOpen ? (
            <X className="h-6 w-6 text-white" />
          ) : (
            <MessageSquare className="h-6 w-6 text-white" />
          )}
        </button>
      )}
    </div>
  );
};

export default ChatWidget;
