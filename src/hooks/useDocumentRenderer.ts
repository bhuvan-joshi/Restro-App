import { useRef, useCallback } from 'react';
import { renderAsync } from 'docx-preview';
import { Document, DocumentFile, FileType } from './useDocuments';

interface RenderOptions {
  onRenderStart?: () => void;
  onRenderComplete?: () => void;
  onRenderError?: (error: Error) => void;
}

export function useDocumentRenderer() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Render DOCX document
  const renderDocx = useCallback(async (
    docFile: DocumentFile, 
    options?: RenderOptions
  ) => {
    if (!containerRef.current || !docFile.file) return;
    
    try {
      options?.onRenderStart?.();
      
      // Clear any previous content
      containerRef.current.innerHTML = '';
      
      // Create a container for the document
      const container = document.createElement('div');
      container.className = 'docx-container h-full w-full';
      containerRef.current.appendChild(container);
      
      // Create a loading indicator
      const loadingIndicator = document.createElement('div');
      loadingIndicator.className = 'flex items-center justify-center h-40';
      loadingIndicator.innerHTML = `
        <div class="flex flex-col items-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
          <p class="text-sm text-gray-600">Rendering document...</p>
        </div>
      `;
      container.appendChild(loadingIndicator);
      
      // DOCX rendering options
      const renderOptions = {
        className: 'docx-viewer',
        inWrapper: true,
        ignoreWidth: true,
        ignoreHeight: false,
        defaultFont: {
          family: 'Arial',
          size: 12,
        }
      };
      
      // Render the DOCX file
      await renderAsync(docFile.file, container, null, renderOptions);
      
      // Remove the loading indicator
      if (loadingIndicator && loadingIndicator.parentNode) {
        loadingIndicator.parentNode.removeChild(loadingIndicator);
      }
      
      options?.onRenderComplete?.();
    } catch (error) {
      console.error("Error rendering DOCX:", error);
      
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div class="p-4 bg-red-50 text-red-800 rounded">
            <h3 class="font-bold mb-2">Failed to render DOCX file</h3>
            <p class="mb-2">Error details: ${error instanceof Error ? error.message : 'Unknown error'}</p>
            <p>Please download the file to view it in your preferred document viewer.</p>
          </div>
        `;
      }
      
      if (options?.onRenderError && error instanceof Error) {
        options.onRenderError(error);
      }
    }
  }, []);

  // Get the appropriate renderer for a document type
  const getRenderer = useCallback((fileType: FileType) => {
    switch (fileType) {
      case 'docx':
        return renderDocx;
      default:
        return null;
    }
  }, [renderDocx]);

  return {
    containerRef,
    renderDocx,
    getRenderer
  };
}
