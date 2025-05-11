/**
 * Chatty Widget - Client side implementation
 */
class ChattyWidget {
    constructor(options = {}) {
        this.options = {
            apiUrl: options.apiUrl || window.location.origin + '/api',
            widgetPosition: options.widgetPosition || 'bottom-right',
            initiallyOpen: options.initiallyOpen || false,
            primaryColor: options.primaryColor || '#3b82f6',
            ...options
        };

        this.currentSession = null;
        this.messages = [];
        
        this.init();
    }

    init() {
        this.createWidgetElements();
        this.setupEventListeners();
        
        if (this.options.initiallyOpen) {
            this.openChat();
        }
    }

    createWidgetElements() {
        // Create widget container
        this.widgetContainer = document.createElement('div');
        this.widgetContainer.id = 'chatty-widget-container';
        this.widgetContainer.className = `chatty-widget-${this.options.widgetPosition}`;
        document.body.appendChild(this.widgetContainer);

        // Create chat button
        this.chatButton = document.createElement('button');
        this.chatButton.id = 'chatty-widget-button';
        this.chatButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>';
        this.chatButton.style.backgroundColor = this.options.primaryColor;
        this.widgetContainer.appendChild(this.chatButton);

        // Create chat window
        this.chatWindow = document.createElement('div');
        this.chatWindow.id = 'chatty-widget-window';
        this.chatWindow.className = 'chatty-widget-hidden';
        this.widgetContainer.appendChild(this.chatWindow);

        // Create chat header
        this.chatHeader = document.createElement('div');
        this.chatHeader.id = 'chatty-widget-header';
        this.chatHeader.style.backgroundColor = this.options.primaryColor;
        this.chatHeader.innerHTML = `
            <div class="chatty-widget-header-title">Chat Support</div>
            <button id="chatty-widget-close">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        `;
        this.chatWindow.appendChild(this.chatHeader);

        // Create messages container
        this.messagesContainer = document.createElement('div');
        this.messagesContainer.id = 'chatty-widget-messages';
        this.chatWindow.appendChild(this.messagesContainer);

        // Create input form
        this.inputForm = document.createElement('form');
        this.inputForm.id = 'chatty-widget-input';
        this.inputForm.innerHTML = `
            <input type="text" id="chatty-widget-message" placeholder="Type your message..." autocomplete="off">
            <button type="submit" id="chatty-widget-send" style="background-color: ${this.options.primaryColor}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
            </button>
        `;
        this.chatWindow.appendChild(this.inputForm);

        // Add necessary styles
        this.loadStyles();
    }

    setupEventListeners() {
        // Toggle chat window when button is clicked
        this.chatButton.addEventListener('click', () => this.openChat());
        
        // Close chat when close button is clicked
        document.getElementById('chatty-widget-close').addEventListener('click', () => this.closeChat());
        
        // Send message when form is submitted
        this.inputForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });
    }

    loadStyles() {
        // Check if styles are already loaded
        if (document.getElementById('chatty-widget-styles')) return;
        
        // Create style element
        const style = document.createElement('link');
        style.id = 'chatty-widget-styles';
        style.rel = 'stylesheet';
        style.href = `${this.options.apiUrl.replace('/api', '')}/widget.css`;
        document.head.appendChild(style);
    }

    openChat() {
        this.chatWindow.classList.remove('chatty-widget-hidden');
        this.chatButton.classList.add('chatty-widget-hidden');
        
        // Create a session if none exists
        if (!this.currentSession) {
            this.createSession();
        }
    }

    closeChat() {
        this.chatWindow.classList.add('chatty-widget-hidden');
        this.chatButton.classList.remove('chatty-widget-hidden');
    }

    async createSession() {
        try {
            this.showLoading();
            
            const response = await fetch(`${this.options.apiUrl}/chat/sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to create chat session');
            }
            
            this.currentSession = await response.json();
            this.messages = this.currentSession.messages || [];
            
            this.renderMessages();
            this.hideLoading();
        } catch (error) {
            console.error('Error creating chat session:', error);
            this.showError('Could not start chat session. Please try again later.');
            this.hideLoading();
        }
    }

    async sendMessage() {
        const messageInput = document.getElementById('chatty-widget-message');
        const content = messageInput.value.trim();
        
        if (!content || !this.currentSession) return;
        
        // Clear input
        messageInput.value = '';
        
        // Add user message to UI immediately
        const userMessage = {
            id: Date.now().toString(),
            chatSessionId: this.currentSession.id,
            content: content,
            sender: 'user',
            timestamp: new Date().toISOString()
        };
        
        this.messages.push(userMessage);
        this.renderMessages();
        
        try {
            this.showTypingIndicator();
            
            const response = await fetch(`${this.options.apiUrl}/chat/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.currentSession.id,
                    content: content
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to send message');
            }
            
            const botMessage = await response.json();
            this.messages.push(botMessage);
            
            this.hideTypingIndicator();
            this.renderMessages();
        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('Failed to send message. Please try again.');
            this.hideTypingIndicator();
        }
    }

    renderMessages() {
        this.messagesContainer.innerHTML = '';
        
        if (this.messages.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'chatty-widget-empty-state';
            emptyState.textContent = 'No messages yet. Start the conversation!';
            this.messagesContainer.appendChild(emptyState);
            return;
        }
        
        this.messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.className = `chatty-widget-message chatty-widget-${message.sender}`;
            
            const contentElement = document.createElement('div');
            contentElement.className = 'chatty-widget-message-content';
            contentElement.textContent = message.content;
            messageElement.appendChild(contentElement);
            
            this.messagesContainer.appendChild(messageElement);
        });
        
        // Scroll to bottom
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    showLoading() {
        const loadingElement = document.createElement('div');
        loadingElement.id = 'chatty-widget-loading';
        loadingElement.innerHTML = '<div class="chatty-widget-spinner"></div>';
        this.messagesContainer.appendChild(loadingElement);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    hideLoading() {
        const loadingElement = document.getElementById('chatty-widget-loading');
        if (loadingElement) {
            loadingElement.remove();
        }
    }

    showTypingIndicator() {
        const typingElement = document.createElement('div');
        typingElement.id = 'chatty-widget-typing';
        typingElement.className = 'chatty-widget-message chatty-widget-assistant';
        typingElement.innerHTML = '<div class="chatty-widget-typing-indicator"><span></span><span></span><span></span></div>';
        this.messagesContainer.appendChild(typingElement);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const typingElement = document.getElementById('chatty-widget-typing');
        if (typingElement) {
            typingElement.remove();
        }
    }

    showError(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'chatty-widget-error';
        errorElement.textContent = message;
        this.messagesContainer.appendChild(errorElement);
        
        setTimeout(() => {
            errorElement.remove();
        }, 5000);
    }
}

// Auto-initialize if script has data-auto-init attribute
document.addEventListener('DOMContentLoaded', () => {
    const script = document.querySelector('script[src*="chatty-widget.js"]');
    if (script && script.hasAttribute('data-auto-init')) {
        window.chattyWidget = new ChattyWidget({
            apiUrl: script.getAttribute('data-api-url'),
            widgetPosition: script.getAttribute('data-position') || 'bottom-right',
            initiallyOpen: script.getAttribute('data-initially-open') === 'true',
            primaryColor: script.getAttribute('data-primary-color') || '#3b82f6'
        });
    }
    
    // Expose widget to global scope
    window.ChattyWidget = ChattyWidget;
}); 