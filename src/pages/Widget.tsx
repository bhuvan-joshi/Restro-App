import { useEffect, useState } from "react";
import ChatWidget from "@/components/chat/ChatWidget";
import { useSearchParams } from "react-router-dom";

const Widget = () => {
  const [searchParams] = useSearchParams();
  const [config, setConfig] = useState({
    botName: "AI Assistant",
    primaryColor: "#9b87f5",
    welcomeMessage: "Hi there! 👋 How can I help you today?",
    position: "bottom-right",
    modelId: "llama-3-small",
    siteContext: {
      siteName: "",
      siteDescription: "",
      primaryContent: "",
      customKnowledge: {}
    }
  });

  useEffect(() => {
    // Extract parameters from URL
    const botName = searchParams.get("name");
    const primaryColor = searchParams.get("color");
    const welcomeMessage = searchParams.get("message");
    const position = searchParams.get("position");
    const modelId = searchParams.get("model");
    
    // Extract site context parameters
    const siteName = searchParams.get("siteName");
    const siteDescription = searchParams.get("siteDescription");
    const primaryContent = searchParams.get("primaryContent");
    const customKnowledge = searchParams.get("customKnowledge");

    // Parse JSON if customKnowledge is provided
    let parsedKnowledge = {};
    if (customKnowledge) {
      try {
        parsedKnowledge = JSON.parse(customKnowledge);
      } catch (error) {
        console.error("Failed to parse customKnowledge:", error);
      }
    }

    // Update config with URL parameters
    setConfig({
      botName: botName || config.botName,
      primaryColor: primaryColor || config.primaryColor,
      welcomeMessage: welcomeMessage || config.welcomeMessage,
      position: (position as "bottom-right" | "bottom-left") || (config.position as "bottom-right" | "bottom-left"),
      modelId: modelId || config.modelId,
      siteContext: {
        siteName: siteName || config.siteContext.siteName,
        siteDescription: siteDescription || config.siteContext.siteDescription,
        primaryContent: primaryContent || config.siteContext.primaryContent,
        customKnowledge: Object.keys(parsedKnowledge).length > 0 ? parsedKnowledge : config.siteContext.customKnowledge
      }
    });

    // No need to manipulate the bubble button anymore as it will be hidden in embed mode
  }, [searchParams]);

  return (
    <div 
      className="widget-container" 
      style={{ 
        width: "100vw", 
        height: "100vh",
        padding: 0,
        margin: 0,
        overflow: "hidden",
        background: "transparent"
      }}
    >
      <style jsx global>{`
        body, html {
          margin: 0;
          padding: 0;
          overflow: hidden;
          background: transparent;
        }
        .chat-widget-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        .chat-widget-window {
          border-radius: 0;
          box-shadow: none;
          width: 100%;
          height: 100%;
        }
      `}</style>
      <ChatWidget
        botName={config.botName}
        primaryColor={config.primaryColor}
        welcomeMessage={config.welcomeMessage}
        widgetPosition={config.position as "bottom-right" | "bottom-left"}
        modelId={config.modelId}
        embedMode={true}
        siteContext={config.siteContext}
      />
    </div>
  );
};

export default Widget; 