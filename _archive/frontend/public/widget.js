(function() {
  // Get the widget ID from the script tag
  const scripts = document.getElementsByTagName('script');
  const currentScript = scripts[scripts.length - 1];
  const widgetId = currentScript.getAttribute('data-widget-id');

  if (!widgetId) {
    console.error('ChattyWidget: Widget ID is required. Add data-widget-id attribute to your script tag.');
    return;
  }

  // Create widget container
  const container = document.createElement('div');
  container.id = 'chatty-widget-container';
  document.body.appendChild(container);

  // Load widget CSS
  const cssLink = document.createElement('link');
  cssLink.rel = 'stylesheet';
  cssLink.href = 'https://localhost:5001/widget.css'; // Change to your production URL
  document.head.appendChild(cssLink);

  // Function to load the widget API
  const loadWidget = async () => {
    try {
      // Fetch widget settings
      const response = await fetch(`https://localhost:5001/api/widgetsettings/public/${widgetId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load widget settings');
      }
      
      const widgetSettings = await response.json();
      
      // Create widget button
      const button = document.createElement('button');
      button.id = 'chatty-widget-button';
      button.innerText = widgetSettings.botName || 'Chat';
      button.style.backgroundColor = widgetSettings.primaryColor || '#4A7DFF';
      container.appendChild(button);
      
      // Create chat window (initially hidden)
      const chatWindow = document.createElement('div');
      chatWindow.id = 'chatty-widget-window';
      chatWindow.style.display = 'none';
      chatWindow.style.position = widgetSettings.position || 'bottom-right';
      container.appendChild(chatWindow);
      
      // Create header
      const header = document.createElement('div');
      header.className = 'chatty-widget-header';
      header.style.backgroundColor = widgetSettings.primaryColor || '#4A7DFF';
      
      if (widgetSettings.logoUrl) {
        const logo = document.createElement('img');
        logo.src = widgetSettings.logoUrl;
        logo.alt = widgetSettings.botName || 'Chat';
        logo.className = 'chatty-widget-logo';
        header.appendChild(logo);
      }
      
      const title = document.createElement('h3');
      title.innerText = widgetSettings.botName || 'Chat';
      header.appendChild(title);
      
      const closeButton = document.createElement('button');
      closeButton.className = 'chatty-widget-close';
      closeButton.innerText = '×';
      header.appendChild(closeButton);
      
      chatWindow.appendChild(header);
      
      // Create messages container
      const messagesContainer = document.createElement('div');
      messagesContainer.className = 'chatty-widget-messages';
      chatWindow.appendChild(messagesContainer);
      
      // Create input form
      const form = document.createElement('form');
      form.className = 'chatty-widget-input';
      
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Type your message...';
      form.appendChild(input);
      
      const sendButton = document.createElement('button');
      sendButton.type = 'submit';
      sendButton.innerText = 'Send';
      sendButton.style.backgroundColor = widgetSettings.primaryColor || '#4A7DFF';
      form.appendChild(sendButton);
      
      chatWindow.appendChild(form);
      
      // Chat session state
      let session = null;
      let messages = [];
      
      // Apply custom CSS if provided
      if (widgetSettings.customCSS) {
        const customStyle = document.createElement('style');
        customStyle.textContent = widgetSettings.customCSS;
        document.head.appendChild(customStyle);
      }
      
      // Event handlers
      button.addEventListener('click', async () => {
        chatWindow.style.display = 'flex';
        button.style.display = 'none';
        
        if (!session) {
          try {
            const userData = {
              location: navigator.language || 'unknown',
              device: navigator.userAgent || 'unknown',
              referrer: document.referrer || window.location.href,
            };
            
            const sessionResponse = await fetch('https://localhost:5001/api/chat/public/sessions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                widgetId,
                userLocation: userData.location,
                userDevice: userData.device,
                referrerUrl: userData.referrer,
              }),
            });
            
            if (!sessionResponse.ok) {
              throw new Error('Failed to create chat session');
            }
            
            session = await sessionResponse.json();
            messages = session.messages;
            renderMessages();
          } catch (error) {
            console.error('Error:', error);
            messagesContainer.innerHTML = '<div class="chatty-widget-error">Could not start chat session. Please try again later.</div>';
          }
        }
      });
      
      closeButton.addEventListener('click', () => {
        chatWindow.style.display = 'none';
        button.style.display = 'block';
      });
      
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!input.value.trim() || !session) return;
        
        try {
          const messageResponse = await fetch('https://localhost:5001/api/chat/public/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sessionId: session.id,
              content: input.value,
              isFromUser: true,
            }),
          });
          
          if (!messageResponse.ok) {
            throw new Error('Failed to send message');
          }
          
          input.value = '';
          
          // Fetch updated session with new messages
          const updatedSessionResponse = await fetch(`https://localhost:5001/api/chat/public/sessions/${session.id}`);
          
          if (!updatedSessionResponse.ok) {
            throw new Error('Failed to fetch updated session');
          }
          
          const updatedSession = await updatedSessionResponse.json();
          messages = updatedSession.messages;
          renderMessages();
        } catch (error) {
          console.error('Error:', error);
          const errorElement = document.createElement('div');
          errorElement.className = 'chatty-widget-error';
          errorElement.innerText = 'Could not send message. Please try again.';
          messagesContainer.appendChild(errorElement);
        }
      });
      
      // Function to render messages
      function renderMessages() {
        messagesContainer.innerHTML = '';
        
        messages.forEach((msg) => {
          const messageElement = document.createElement('div');
          messageElement.className = `chatty-message ${msg.isFromUser ? 'user-message' : 'bot-message'}`;
          
          const contentElement = document.createElement('div');
          contentElement.className = 'message-content';
          contentElement.innerText = msg.content;
          messageElement.appendChild(contentElement);
          
          const timeElement = document.createElement('div');
          timeElement.className = 'message-time';
          timeElement.innerText = new Date(msg.timestamp).toLocaleTimeString();
          messageElement.appendChild(timeElement);
          
          messagesContainer.appendChild(messageElement);
        });
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
      
      // Poll for new messages
      let pollInterval = null;
      
      function startPolling() {
        if (pollInterval) return;
        
        pollInterval = setInterval(async () => {
          if (!session) return;
          
          try {
            const response = await fetch(`https://localhost:5001/api/chat/public/sessions/${session.id}`);
            
            if (!response.ok) {
              throw new Error('Failed to fetch session');
            }
            
            const updatedSession = await response.json();
            
            if (updatedSession.messages.length > messages.length) {
              messages = updatedSession.messages;
              renderMessages();
            }
          } catch (error) {
            console.error('Error polling for messages:', error);
          }
        }, 3000); // Poll every 3 seconds
      }
      
      function stopPolling() {
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      }
      
      // Start/stop polling based on visibility
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && chatWindow.style.display !== 'none') {
          startPolling();
        } else {
          stopPolling();
        }
      });
      
      // Start polling when chat is visible
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'style' && 
              mutation.target === chatWindow && 
              chatWindow.style.display !== 'none') {
            startPolling();
          } else if (mutation.attributeName === 'style' && 
                     mutation.target === chatWindow && 
                     chatWindow.style.display === 'none') {
            stopPolling();
          }
        });
      });
      
      observer.observe(chatWindow, { attributes: true });
    } catch (error) {
      console.error('ChattyWidget Error:', error);
      container.innerHTML = '<div class="chatty-widget-error">Could not load chat widget. Please try again later.</div>';
    }
  };

  // Load the widget when the page is ready
  if (document.readyState === 'complete') {
    loadWidget();
  } else {
    window.addEventListener('load', loadWidget);
  }
})(); 