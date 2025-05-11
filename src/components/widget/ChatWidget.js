import React, { useState, useEffect, useRef } from 'react';
import { createPublicSession, getPublicWidget, sendPublicMessage, getPublicSession } from '@/services/api';
import './ChatWidget.css';

const ChatWidget = ({ widgetId }) => {
  const [widget, setWidget] = useState(null);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  
  const messagesEndRef = useRef(null);
  const pollInterval = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load widget settings
  useEffect(() => {
    const loadWidget = async () => {
      try {
        setLoading(true);
        const response = await getPublicWidget(widgetId);
        setWidget(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error loading widget:', err);
        setError('Could not load chat widget. Please try again later.');
        setLoading(false);
      }
    };

    loadWidget();
  }, [widgetId]);

  // Create a session when the widget is opened
  const handleOpenWidget = async () => {
    if (!session) {
      try {
        const userData = {
          location: navigator.language || 'unknown',
          device: navigator.userAgent || 'unknown',
          referrer: document.referrer || window.location.href,
        };
        
        const response = await createPublicSession(widgetId, userData);
        setSession(response.data);
        setMessages(response.data.messages);
      } catch (err) {
        console.error('Error creating session:', err);
        setError('Could not start a chat session. Please try again later.');
      }
    }
    
    setIsOpen(true);
  };

  // Poll for new messages when the widget is open
  useEffect(() => {
    if (isOpen && session) {
      // Set up polling for new messages
      pollInterval.current = setInterval(async () => {
        try {
          const response = await getPublicSession(session.id);
          if (response.data.messages.length > messages.length) {
            setMessages(response.data.messages);
          }
        } catch (err) {
          console.error('Error polling for messages:', err);
        }
      }, 3000); // Poll every 3 seconds
    }

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [isOpen, session, messages.length]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Send a message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!input.trim() || !session) return;
    
    try {
      await sendPublicMessage(session.id, input, true);
      setInput('');
      
      // Immediately fetch updated messages
      const response = await getPublicSession(session.id);
      setMessages(response.data.messages);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Could not send message. Please try again.');
    }
  };

  if (loading) return <div className="chat-widget-loading">Loading...</div>;
  if (error) return <div className="chat-widget-error">{error}</div>;
  if (!widget) return null;

  // Apply custom styles if provided
  const widgetStyles = widget.customCSS ? 
    { style: { dangerouslySetInnerHTML: { __html: widget.customCSS } } } : {};

  return (
    <div className="chat-widget-container" {...widgetStyles}>
      {/* Chat button */}
      {!isOpen && (
        <button 
          className="chat-widget-button"
          onClick={handleOpenWidget}
          style={{ backgroundColor: widget.primaryColor || '#4A7DFF' }}
        >
          <span>{widget.botName || 'Chat'}</span>
        </button>
      )}
      
      {/* Chat window */}
      {isOpen && (
        <div 
          className="chat-widget-window"
          style={{ position: widget.position || 'bottom-right' }}
        >
          {/* Header */}
          <div 
            className="chat-widget-header"
            style={{ backgroundColor: widget.primaryColor || '#4A7DFF' }}
          >
            {widget.logoUrl && (
              <img 
                src={widget.logoUrl} 
                alt={widget.botName || 'Chat'} 
                className="chat-widget-logo"
              />
            )}
            <h3>{widget.botName || 'Chat'}</h3>
            <button 
              className="chat-widget-close"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>
          
          {/* Messages */}
          <div className="chat-widget-messages">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`chat-message ${msg.isFromUser ? 'user-message' : 'bot-message'}`}
              >
                <div className="message-content">{msg.content}</div>
                <div className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input */}
          <form className="chat-widget-input" onSubmit={handleSendMessage}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
            />
            <button 
              type="submit"
              style={{ backgroundColor: widget.primaryColor || '#4A7DFF' }}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatWidget; 