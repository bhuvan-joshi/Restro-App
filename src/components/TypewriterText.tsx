import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface TypewriterTextProps {
  text: string;
  isStreaming?: boolean;
  speed?: number;
  className?: string;
}

const TypewriterText: React.FC<TypewriterTextProps> = ({
  text,
  isStreaming = false,
  speed = 10,
  className = '',
}) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isStreaming) {
      setDisplayText(text);
      return;
    }

    if (currentIndex < text.length) {
      timerRef.current = setTimeout(() => {
        setDisplayText(prev => prev + text.charAt(currentIndex));
        setCurrentIndex(prev => prev + 1);
      }, speed);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [text, currentIndex, isStreaming, speed]);

  // Reset when text changes completely
  useEffect(() => {
    setDisplayText('');
    setCurrentIndex(0);
  }, [text]);

  return (
    <div className={`typewriter-container ${className}`}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ node, ...props }) => (
            <div className="table-container">
              <table {...props} />
            </div>
          ),
          pre: ({ node, ...props }) => (
            <pre className="code-block" {...props} />
          )
        }}
      >
        {displayText}
      </ReactMarkdown>
      {isStreaming && currentIndex < text.length && (
        <span className="cursor"></span>
      )}
    </div>
  );
};

export default TypewriterText;
