import { useState, useEffect } from 'react';

interface TypewriterOptions {
  text: string;
  speed?: number;
  delay?: number;
}

/**
 * A hook that creates a typewriter effect for text
 * @param options Configuration options
 * @returns The current displayed text
 */
export function useTypewriterEffect({ text, speed = 20, delay = 0 }: TypewriterOptions) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Reset when text changes
    setDisplayedText('');
    setIsComplete(false);
    
    if (!text) return;
    
    // Initial delay before starting
    const delayTimer = setTimeout(() => {
      let currentIndex = 0;
      
      // Function to add the next character
      const addNextChar = () => {
        if (currentIndex < text.length) {
          setDisplayedText(prev => prev + text.charAt(currentIndex));
          currentIndex++;
          
          // Schedule the next character
          setTimeout(addNextChar, speed);
        } else {
          setIsComplete(true);
        }
      };
      
      // Start the effect
      addNextChar();
    }, delay);
    
    return () => clearTimeout(delayTimer);
  }, [text, speed, delay]);
  
  return { displayedText, isComplete };
}
