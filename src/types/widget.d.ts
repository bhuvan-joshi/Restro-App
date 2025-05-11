declare module '@/components/widget/ChatWidget' {
  interface ChatWidgetProps {
    widgetId: string;
  }
  
  const ChatWidget: React.FC<ChatWidgetProps>;
  export default ChatWidget;
}

// Global declarations for window.aiChat
interface Window {
  aiChat?: {
    init: (config: {
      widgetId: string;
      position?: 'bottom-right' | 'bottom-left';
      primaryColor?: string;
    }) => void;
    open: () => void;
    close: () => void;
  };
} 