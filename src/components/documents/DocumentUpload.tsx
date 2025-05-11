import React, { useState, useCallback, useRef } from 'react';
import { Upload, File, X, Check, AlertTriangle, FileText, FileImage, Video, Music, Database, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { uploadDocument } from '@/services/api'; // Import the API function directly

interface DocumentUploadProps {
  onUploadComplete?: (files: File[]) => void;
  acceptedFileTypes?: string[];
  maxFileSizeMB?: number;
  maxFiles?: number;
}

// Helper function to get the appropriate icon based on file type
const getFileIcon = (fileType: string) => {
  const type = fileType.toLowerCase();
  
  if (type.includes('pdf') || type.includes('doc') || type.includes('txt') || type.includes('rtf')) {
    return <FileText className="h-4 w-4 text-blue-500" />;
  } else if (type.includes('image') || type.includes('png') || type.includes('jpg') || type.includes('jpeg') || type.includes('gif')) {
    return <FileImage className="h-4 w-4 text-green-500" />;
  } else if (type.includes('video')) {
    return <Video className="h-4 w-4 text-purple-500" />;
  } else if (type.includes('audio') || type.includes('mp3') || type.includes('wav')) {
    return <Music className="h-4 w-4 text-yellow-500" />;
  } else if (type.includes('json') || type.includes('xml') || type.includes('csv') || type.includes('xls')) {
    return <Database className="h-4 w-4 text-red-500" />;
  } else if (type.includes('html') || type.includes('js') || type.includes('css') || type.includes('py')) {
    return <Code className="h-4 w-4 text-gray-500" />;
  }
  
  return <File className="h-4 w-4 text-gray-500" />;
};

// Helper to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  onUploadComplete,
  acceptedFileTypes = ['.pdf', '.docx', '.doc', '.txt', '.csv', '.xlsx', '.xls', '.json', '.xml', '.md', '.rtf'],
  maxFileSizeMB = 10,
  maxFiles = 5
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const [uploadStatus, setUploadStatus] = useState<{[key: string]: 'pending' | 'uploading' | 'complete' | 'error'}>({});
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const validateFile = (file: File): { valid: boolean; message?: string } => {
    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    const validExtension = acceptedFileTypes.some(ext => 
      fileExtension === ext.toLowerCase() || 
      file.type.includes(ext.replace('.', '').toLowerCase())
    );
    
    if (!validExtension) {
      return { 
        valid: false, 
        message: `"${file.name}" is not an accepted file type. Please upload only ${acceptedFileTypes.join(', ')} files.`
      };
    }

    // Check file size
    if (file.size > maxFileSizeMB * 1024 * 1024) {
      return { 
        valid: false, 
        message: `"${file.name}" exceeds the maximum size of ${maxFileSizeMB}MB.`
      };
    }

    // Check if file already exists in our list
    if (files.some(f => f.name === file.name && f.size === file.size)) {
      return { 
        valid: false, 
        message: `"${file.name}" has already been added.`
      };
    }

    return { valid: true };
  };

  const processFiles = (fileList: FileList) => {
    // Check if we're exceeding the max number of files
    if (files.length + fileList.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `You can upload a maximum of ${maxFiles} files at once.`,
        variant: "destructive"
      });
      return;
    }
    
    const newFiles: File[] = [];
    const newErrors: string[] = [];
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const validation = validateFile(file);
      
      if (validation.valid) {
        newFiles.push(file);
        setUploadStatus(prev => ({ ...prev, [file.name]: 'pending' }));
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
      } else if (validation.message) {
        newErrors.push(validation.message);
      }
    }
    
    if (newErrors.length > 0) {
      setErrors(prev => [...prev, ...newErrors]);
    }
    
    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
      handleFileUpload(newFiles);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [files]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileUpload = async (filesToUpload: File[]) => {
    console.log("Starting upload for files:", filesToUpload.map(f => f.name));
    
    // Track successfully uploaded files
    const successfulFiles: File[] = [];
    
    // Process each file
    for (const file of filesToUpload) {
      try {
        // Set status to uploading
        setUploadStatus(prev => ({ ...prev, [file.name]: 'uploading' }));
        
        // Update progress to show started
        setUploadProgress(prev => ({ ...prev, [file.name]: 10 }));
        
        // Check for auth token
        const token = localStorage.getItem('auth_token');
        if (!token) {
          console.error("No authentication token found");
          toast({
            title: "Authentication Error",
            description: "You must be logged in to upload documents.",
            variant: "destructive"
          });
          setUploadStatus(prev => ({ ...prev, [file.name]: 'error' }));
          continue;
        }
        
        console.log(`Starting upload of ${file.name} (${formatFileSize(file.size)})`);
        
        // Actual API call to upload file
        try {
          const response = await uploadDocument(file);
          console.log(`Upload success for ${file.name}:`, response);
          
          // Set to complete once done
          setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
          setUploadStatus(prev => ({ ...prev, [file.name]: 'complete' }));
          
          // Add to successful files
          successfulFiles.push(file);
        } catch (error) {
          console.error(`API Error uploading ${file.name}:`, error);
          setUploadStatus(prev => ({ ...prev, [file.name]: 'error' }));
          
          if (error.response) {
            // We have a response from server with error details
            const errorMessage = error.response.data?.message || 
                               error.response.data?.title || 
                               `Error ${error.response.status}: ${error.response.statusText}`;
            toast({
              title: "Upload Failed",
              description: errorMessage,
              variant: "destructive"
            });
          } else if (error.request) {
            // Request was made but no response
            toast({
              title: "Server Error",
              description: "No response from server. Please check your network connection.",
              variant: "destructive"
            });
          } else {
            // Other errors
            toast({
              title: "Upload Error",
              description: error.message || "An unexpected error occurred",
              variant: "destructive"
            });
          }
          continue;
        }
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        setUploadStatus(prev => ({ ...prev, [file.name]: 'error' }));
      }
    }
    
    // Check if any files were successfully uploaded
    if (successfulFiles.length > 0 && onUploadComplete) {
      console.log("Successfully uploaded files:", successfulFiles.map(f => f.name));
      onUploadComplete(successfulFiles);
    }
  };

  const removeFile = (fileName: string) => {
    setFiles(prev => prev.filter(file => file.name !== fileName));
    setUploadProgress(prev => {
      const { [fileName]: _, ...rest } = prev;
      return rest;
    });
    setUploadStatus(prev => {
      const { [fileName]: _, ...rest } = prev;
      return rest;
    });
  };

  const clearErrors = (index?: number) => {
    if (index !== undefined) {
      setErrors(prev => prev.filter((_, i) => i !== index));
    } else {
      setErrors([]);
    }
  };

  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="w-full space-y-4">
      {errors.length > 0 && (
        <div className="space-y-2">
          {errors.map((error, index) => (
            <Alert 
              key={index} 
              variant="destructive" 
              className="flex items-center justify-between py-2"
            >
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => clearErrors(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </Alert>
          ))}
        </div>
      )}
      
      <div 
        className={`border-2 border-dashed rounded-lg p-6 text-center ${
          isDragging 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100'
        } transition-all duration-200 cursor-pointer`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={handleBrowseClick}
      >
        <div className="flex flex-col items-center justify-center py-4">
          <Upload className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-700">Drag and drop files here</p>
          <p className="text-sm text-gray-500 mb-4">or click to browse</p>
          
          <Button variant="outline" className="relative">
            Browse Files
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={onFileChange}
              className="hidden"
              accept={acceptedFileTypes.join(',')}
            />
          </Button>
          
          <div className="mt-4 text-xs text-gray-500">
            <p>Accepted file types: {acceptedFileTypes.join(', ')}</p>
            <p>Maximum file size: {maxFileSizeMB}MB</p>
            <p>Maximum files: {maxFiles}</p>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Uploaded Files ({files.length})</h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                setFiles([]);
                setUploadProgress({});
                setUploadStatus({});
              }}
            >
              Clear All
            </Button>
          </div>
          
          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
            {files.map((file) => (
              <div 
                key={`${file.name}-${file.size}`} 
                className="bg-white border rounded-md p-3 shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    {getFileIcon(file.type || file.name.split('.').pop() || '')}
                    <div className="min-w-0">
                      <div className="truncate font-medium text-sm">{file.name}</div>
                      <div className="text-xs text-gray-500">{formatFileSize(file.size)}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {uploadStatus[file.name] === 'complete' ? (
                      <span className="text-green-500">
                        <Check className="h-4 w-4" />
                      </span>
                    ) : uploadStatus[file.name] === 'error' ? (
                      <span className="text-red-500">
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                    ) : null}
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(file.name);
                      }}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      disabled={uploadStatus[file.name] === 'uploading'}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <Progress 
                  value={uploadProgress[file.name] || 0} 
                  className="h-1"
                />
                
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>
                    {uploadStatus[file.name] === 'pending' && 'Ready to upload'}
                    {uploadStatus[file.name] === 'uploading' && 'Uploading...'}
                    {uploadStatus[file.name] === 'complete' && 'Upload complete'}
                    {uploadStatus[file.name] === 'error' && 'Upload failed'}
                  </span>
                  <span>
                    {uploadStatus[file.name] !== 'complete' 
                      ? `${Math.round(uploadProgress[file.name] || 0)}%` 
                      : 'Complete'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
