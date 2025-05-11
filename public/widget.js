// AI Chat Widget - Embed Script

// This will be called before any DOM elements are loaded
const aiChatWidgetInit = function() {
  const scriptTag = document.currentScript;
  const aiObj = window[scriptTag.dataset.objectName || 'aiChat'];
  
  // Tracking if widget has been initialized
  let widgetInitialized = false;
  let widgetElement = null;
  
  // Site domain validation
  let domainsChecked = false;
  let domainAllowed = false;
  let domainCheckRunning = false;
  
  // Configuration defaults
  const config = {
    botName: scriptTag.dataset.botName || 'AI Assistant',
    primaryColor: scriptTag.dataset.primaryColor || '#7c3aed',
    position: scriptTag.dataset.position || 'bottom-right',
    welcomeMessage: scriptTag.dataset.welcomeMessage || 'Hello! How can I help you today?',
    modelId: scriptTag.dataset.modelId || 'llama-3-small',
    // Site context parameters
    siteName: scriptTag.dataset.siteName || '',
    siteDescription: scriptTag.dataset.siteDescription || '',
    primaryContent: scriptTag.dataset.primaryContent || '',
    customKnowledge: scriptTag.dataset.customKnowledge || ''
  };

  function checkDomainAllowed() {
    if (domainCheckRunning) return;
    if (domainsChecked) return createWidget();
    
    domainCheckRunning = true;
    const hostname = window.location.hostname;
    
    // Get the script src domain
    const scriptSrc = scriptTag.src;
    const widgetDomain = new URL(scriptSrc).origin;
    
    fetch(`${widgetDomain}/api/allowed-domains`)
      .then(response => response.json())
      .then(data => {
        domainsChecked = true;
        domainCheckRunning = false;
        
        // Check if current hostname is in the allowed domains
        if (data && Array.isArray(data.domains)) {
          // Allow localhost for development
          if (hostname === 'localhost' || hostname === '127.0.0.1') {
            domainAllowed = true;
            createWidget();
            return;
          }
          
          // Check for domain or subdomain match
          for (const domain of data.domains) {
            if (hostname === domain || hostname.endsWith('.' + domain)) {
              domainAllowed = true;
              createWidget();
              return;
            }
          }
        }
        
        console.warn('AI Chat Widget: This domain is not authorized to use this widget.');
      })
      .catch(error => {
        console.error('AI Chat Widget: Error checking domain allowlist', error);
        domainCheckRunning = false;
        // Default to allowed if check fails (to prevent blocking in case of API issues)
        domainAllowed = true;
        createWidget();
      });
  }

  function createBubble() {
    // Create floating chat bubble
    const bubble = document.createElement('div');
    bubble.className = 'ai-chat-bubble';
    bubble.setAttribute('aria-label', 'Chat with ' + config.botName);
    bubble.setAttribute('role', 'button');
    bubble.setAttribute('tabindex', '0');
    
    // Position the bubble based on config
    bubble.style.position = 'fixed';
    bubble.style.bottom = '20px';
    bubble.style.width = '60px';
    bubble.style.height = '60px';
    bubble.style.borderRadius = '50%';
    bubble.style.backgroundColor = config.primaryColor;
    bubble.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    bubble.style.cursor = 'pointer';
    bubble.style.zIndex = '999999';
    bubble.style.transition = 'all 0.3s ease';
    bubble.style.display = 'flex';
    bubble.style.justifyContent = 'center';
    bubble.style.alignItems = 'center';
    
    if (config.position === 'bottom-right') {
      bubble.style.right = '20px';
    } else {
      bubble.style.left = '20px';
    }
    
    // Add hover effect
    bubble.onmouseover = function() {
      this.style.transform = 'scale(1.1)';
    };
    bubble.onmouseout = function() {
      this.style.transform = 'scale(1)';
    };
    
    // Add chat icon
    const icon = document.createElement('div');
    icon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>`;
    bubble.appendChild(icon);
    
    // Add click handler to open chat window
    bubble.addEventListener('click', toggleChatWindow);
    bubble.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleChatWindow();
      }
    });
    
    return bubble;
  }

  function createChatWindow() {
    // Get script domain for iframe src
    const scriptSrc = scriptTag.src;
    const widgetDomain = new URL(scriptSrc).origin;
    
    // Create chat window container
    const chatWindow = document.createElement('div');
    chatWindow.className = 'ai-chat-window';
    chatWindow.setAttribute('aria-label', 'Chat with ' + config.botName);
    chatWindow.setAttribute('role', 'dialog');
    
    // Position and style the window
    chatWindow.style.position = 'fixed';
    chatWindow.style.bottom = '100px';
    chatWindow.style.height = '500px';
    chatWindow.style.width = '350px';
    chatWindow.style.borderRadius = '10px';
    chatWindow.style.boxShadow = '0 5px 40px rgba(0, 0, 0, 0.16)';
    chatWindow.style.overflow = 'hidden';
    chatWindow.style.zIndex = '999999';
    chatWindow.style.transition = 'all 0.3s ease';
    chatWindow.style.opacity = '0';
    chatWindow.style.transform = 'translateY(20px)';
    chatWindow.style.display = 'none';
    
    if (config.position === 'bottom-right') {
      chatWindow.style.right = '20px';
    } else {
      chatWindow.style.left = '20px';
    }
    
    // Build iframe URL with parameters
    let iframeSrc = `${widgetDomain}/widget?name=${encodeURIComponent(config.botName)}&color=${encodeURIComponent(config.primaryColor)}&message=${encodeURIComponent(config.welcomeMessage)}&position=${config.position}&embedded=true&model=${encodeURIComponent(config.modelId)}`;
    
    // Add site context parameters if available
    if (config.siteName) {
      iframeSrc += `&siteName=${encodeURIComponent(config.siteName)}`;
    }
    if (config.siteDescription) {
      iframeSrc += `&siteDescription=${encodeURIComponent(config.siteDescription)}`;
    }
    if (config.primaryContent) {
      iframeSrc += `&primaryContent=${encodeURIComponent(config.primaryContent)}`;
    }
    if (config.customKnowledge) {
      iframeSrc += `&customKnowledge=${encodeURIComponent(config.customKnowledge)}`;
    }
    
    // Create and add iframe
    const iframe = document.createElement('iframe');
    iframe.className = 'ai-chat-iframe';
    iframe.src = iframeSrc;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.setAttribute('title', 'Chat with ' + config.botName);
    
    chatWindow.appendChild(iframe);
    
    return chatWindow;
  }

  function toggleChatWindow() {
    if (!widgetElement) return;
    
    const bubble = widgetElement.querySelector('.ai-chat-bubble');
    const chatWindow = widgetElement.querySelector('.ai-chat-window');
    
    if (chatWindow.style.display === 'none') {
      // Show chat window
      chatWindow.style.display = 'block';
      // Use setTimeout to trigger CSS transition
      setTimeout(() => {
        chatWindow.style.opacity = '1';
        chatWindow.style.transform = 'translateY(0)';
      }, 10);
      
      // Change bubble icon to close
      const icon = bubble.querySelector('div');
      icon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>`;
    } else {
      // Hide chat window
      chatWindow.style.opacity = '0';
      chatWindow.style.transform = 'translateY(20px)';
      
      // Wait for transition to complete before hiding
      setTimeout(() => {
        chatWindow.style.display = 'none';
      }, 300);
      
      // Change close icon back to chat
      const icon = bubble.querySelector('div');
      icon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>`;
    }
  }

  function createWidget() {
    if (widgetInitialized || !domainAllowed) return;
    
    // Create container for the widget components
    widgetElement = document.createElement('div');
    widgetElement.className = 'ai-chat-widget';
    
    // Create and add bubble button
    const bubble = createBubble();
    widgetElement.appendChild(bubble);
    
    // Create and add chat window
    const chatWindow = createChatWindow();
    widgetElement.appendChild(chatWindow);
    
    // Add to document
    document.body.appendChild(widgetElement);
    
    widgetInitialized = true;
  }
  
  // Define public API for aiChat object
  aiObj.q = aiObj.q || [];
  
  // Process any queued commands
  const queue = aiObj.q;
  aiObj.q = {
    push: function(args) {
      // Handle new commands
      console.log('AI Chat command:', args);
    }
  };
  
  // Process any queued commands
  if (queue && queue.length) {
    for (let i = 0; i < queue.length; i++) {
      aiObj.q.push(queue[i]);
    }
  }
  
  // Init when DOM is ready or immediately if already loaded
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    checkDomainAllowed();
  } else {
    document.addEventListener('DOMContentLoaded', checkDomainAllowed);
  }
};

// Initialize the widget
aiChatWidgetInit();
