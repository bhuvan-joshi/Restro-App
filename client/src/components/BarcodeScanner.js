import React, { useState, useRef, useEffect } from 'react';
import { Modal, Button, Alert, Tabs, Tab, Form, Spinner } from 'react-bootstrap';
import Quagga from 'quagga';
import jsQR from 'jsqr';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';

const BarcodeScanner = ({ show, onHide, onScan }) => {
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState('camera');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [processedSuccessfully, setProcessedSuccessfully] = useState(false);
  
  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  // Reset state when modal is shown
  useEffect(() => {
    if (show) {
      setScanning(true);
      setError(null);
      setProcessedSuccessfully(false);
    } else {
      // Clean up when modal is hidden
      stopScanner();
      setScanning(false);
    }
  }, [show]);

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  // Start/stop scanner based on tab and visibility
  useEffect(() => {
    if (show && activeTab === 'camera' && scanning) {
      startScanner();
    } else {
      stopScanner();
    }
    
    return () => {
      stopScanner();
    };
  }, [show, activeTab, scanning]);

  const startScanner = () => {
    if (!scannerRef.current) return;
    
    setError(null);
    console.log("Starting scanner...");
    
    // Stop any existing scanner
    stopScanner();
    
    // Initialize Quagga
    Quagga.init({
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: scannerRef.current,
        constraints: {
          width: { min: 640 },
          height: { min: 480 },
          facingMode: "environment", // Use back camera
          aspectRatio: { min: 1, max: 2 }
        },
        willReadFrequently: true // Add this to improve performance
      },
      locator: {
        patchSize: "medium",
        halfSample: true
      },
      numOfWorkers: navigator.hardwareConcurrency || 4,
      frequency: 10, // Increase scanning frequency for better detection
      decoder: {
        readers: [
          // Prioritize readers that work well with numeric barcodes
          "ean_reader",
          "ean_8_reader",
          "upc_reader",
          "upc_e_reader",
          "code_128_reader",
          "code_39_reader",
          "i2of5_reader" // Added for better numeric code detection
        ],
        debug: {
          showCanvas: false,
          showPatches: false,
          showFoundPatches: false,
          showSkeleton: false,
          showLabels: false,
          showPatchLabels: false,
          showRemainingPatchLabels: false
        }
      },
      locate: true
    }, function(err) {
      if (err) {
        console.error("Quagga initialization error:", err);
        setError(`Error starting camera: ${err.message || err}. Please make sure you've granted camera permissions and are using HTTPS.`);
        return;
      }
      
      console.log("Quagga initialized successfully");
      
      // Start Quagga
      Quagga.start();
      
      // Add result listener
      Quagga.onDetected(handleBarcodeDetected);
    });
  };

  const stopScanner = () => {
    try {
      Quagga.offDetected(handleBarcodeDetected);
      Quagga.stop();
    } catch (e) {
      console.log("Error stopping Quagga:", e);
    }
  };

  const handleBarcodeDetected = (result) => {
    if (!result || !result.codeResult) return;
    
    const code = result.codeResult.code;
    console.log("Quagga detected:", code);
    
    // Check if it's a valid barcode (numeric with 8-13 digits, matching Arper's format)
    if (/^\d+$/.test(code) && code.length >= 8 && code.length <= 13) {
      console.log("Valid barcode detected:", code);
      
      // Stop scanning and return the result
      stopScanner();
      setScanning(false);
      setError(null);
      setProcessedSuccessfully(true);
      
      // Add a small delay to ensure UI updates before closing
      setTimeout(() => {
        onScan(code);
        onHide();
      }, 300);
    }
  };

  const resetScanner = () => {
    setError(null);
    setScanning(true);
    setUploadedImage(null);
    setManualBarcode('');
    setProcessedSuccessfully(false);
    
    // Re-initialize scanner if on camera tab
    if (activeTab === 'camera') {
      setTimeout(() => {
        startScanner();
      }, 500);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check if file is an image
    if (!file.type.match('image.*')) {
      setError('Please select an image file');
      return;
    }

    setUploadedImage(URL.createObjectURL(file));
    setError(null);
  };

  const processUploadedImage = () => {
    if (!uploadedImage) return;

    setProcessingImage(true);
    setError(null);
    setProcessedSuccessfully(false);
    
    console.log("Processing uploaded image:", uploadedImage);

    // Try multiple barcode scanning libraries for better reliability
    tryMultipleBarcodeScanners(uploadedImage)
      .then(code => {
        console.log("Barcode detected:", code);
        setError(null);
        setProcessedSuccessfully(true);
        
        // Add a small delay to ensure UI updates before closing
        setTimeout(() => {
          onScan(code);
          onHide();
        }, 300);
      })
      .catch(err => {
        console.error("Error detecting barcode:", err);
        setError('No barcode found in the image. Try uploading a clearer image or use the camera scanner.');
      })
      .finally(() => {
        setProcessingImage(false);
      });
  };
  
  // Try multiple barcode scanning libraries for better reliability
  const tryMultipleBarcodeScanners = (imageUrl) => {
    return new Promise(async (resolve, reject) => {
      try {
        // Try ZXing first (good for various barcode formats)
        const zxingResult = await tryZXing(imageUrl);
        if (zxingResult) {
          return resolve(zxingResult);
        }
        
        // Try jsQR next (good for QR codes but can sometimes detect barcodes)
        const jsQRResult = await tryJsQR(imageUrl);
        if (jsQRResult) {
          return resolve(jsQRResult);
        }
        
        // Try Quagga last (specifically for barcodes)
        const quaggaResult = await tryQuagga(imageUrl);
        if (quaggaResult) {
          return resolve(quaggaResult);
        }
        
        // If all methods fail, reject
        reject(new Error("No barcode detected with any method"));
      } catch (error) {
        reject(error);
      }
    });
  };
  
  // Try ZXing library
  const tryZXing = (imageUrl) => {
    return new Promise(async (resolve, reject) => {
      try {
        console.log("Trying ZXing...");
        const hints = new Map();
        const formats = [
          BarcodeFormat.CODE_128,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_39
        ];
        hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
        hints.set(DecodeHintType.TRY_HARDER, true);
        
        const reader = new BrowserMultiFormatReader(hints);
       // const img = await createImageElement(imageUrl);
        
        const result = await reader.decodeFromImage(undefined, imageUrl);
        if (result && result.getText()) {
          const text = result.getText();
          console.log("ZXing detected:", text);
          
          // Check if it's a valid barcode (numeric with 8-13 digits)
          if (/^\d+$/.test(text) && text.length >= 8 && text.length <= 13) {
            return resolve(text);
          }
        }
        resolve(null); // No valid barcode found with ZXing
      } catch (err) {
        console.log("ZXing error (this is normal if no barcode found):", err);
        resolve(null); // Continue to next method on error
      }
    });
  };
  
  // Try jsQR library
  const tryJsQR = (imageUrl) => {
    return new Promise((resolve, reject) => {
      console.log("Trying jsQR...");
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      const img = new Image();
      img.onload = () => {
        // Set canvas size to match image
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw image to canvas
        ctx.drawImage(img, 0, 0);
        
        // Get image data for processing
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Process with jsQR
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code && code.data) {
          console.log("jsQR detected:", code.data);
          
          // Check if it's a valid barcode (numeric with 8-13 digits)
          if (/^\d+$/.test(code.data) && code.data.length >= 8 && code.data.length <= 13) {
            return resolve(code.data);
          }
        }
        
        resolve(null); // No valid barcode found with jsQR
      };
      
      img.onerror = () => {
        resolve(null); // Continue to next method on error
      };
      
      img.src = imageUrl;
    });
  };
  
  // Try Quagga library
  const tryQuagga = (imageUrl) => {
    return new Promise((resolve, reject) => {
      console.log("Trying Quagga...");
      
      Quagga.decodeSingle({
        decoder: {
          readers: [
            "ean_reader",
            "ean_8_reader",
            "upc_reader",
            "upc_e_reader",
            "code_128_reader",
            "code_39_reader",
            "i2of5_reader"
          ]
        },
        locate: true,
        src: imageUrl
      }, function(result) {
        if (result && result.codeResult) {
          const code = result.codeResult.code;
          console.log("Quagga detected:", code);
          
          // Check if it's a valid barcode (numeric with 8-13 digits)
          if (/^\d+$/.test(code) && code.length >= 8 && code.length <= 13) {
            return resolve(code);
          }
        }
        
        resolve(null); // No valid barcode found with Quagga
      });
    });
  };
  
  // Helper function to create an image element from URL
  const createImageElement = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualBarcode && /^\d+$/.test(manualBarcode) && manualBarcode.length >= 8 && manualBarcode.length <= 13) {
      setError(null);
      onScan(manualBarcode);
      onHide();
    } else {
      setError('Please enter a valid numeric barcode (8-13 digits)');
    }
  };

  // Handle tab change
  const handleTabChange = (key) => {
    setActiveTab(key);
    setError(null);
    
    // Reset scanning state when switching tabs
    if (key === 'camera') {
      setScanning(true);
    } else {
      stopScanner();
    }
  };

  // Custom onHide handler to ensure proper cleanup
  const handleHide = () => {
    stopScanner();
    onHide();
  };

  return (
    <Modal show={show} onHide={handleHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Scan Product Barcode</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && !processedSuccessfully && (
          <Alert variant="danger" className="d-flex align-items-center">
            <div className="flex-grow-1">{error}</div>
            <Button 
              variant="outline-danger" 
              size="sm"
              onClick={resetScanner}
            >
              Try Again
            </Button>
          </Alert>
        )}
        
        <Tabs
          activeKey={activeTab}
          onSelect={handleTabChange}
          className="mb-3"
        >
          <Tab eventKey="camera" title="Camera Scanner">
            <div className="text-center mb-3">
              <p>Position the barcode within the scanner area.</p>
              
              <div 
                ref={scannerRef}
                className="scanner-container" 
                style={{ 
                  position: 'relative',
                  height: '400px', 
                  overflow: 'hidden', 
                  borderRadius: '8px', 
                  border: '1px solid #dee2e6',
                  backgroundColor: '#000'
                }}
              >
                {/* Scanner guide overlay */}
                <div className="scanner-overlay" style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '80%',
                  height: '50%',
                  border: '2px solid rgba(0, 123, 255, 0.8)',
                  boxShadow: '0 0 0 1000px rgba(0, 0, 0, 0.3)',
                  zIndex: 10,
                  pointerEvents: 'none'
                }}></div>
                
                {/* Scanner status text */}
                <div style={{
                  position: 'absolute',
                  bottom: '20px',
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                  color: 'white',
                  zIndex: 20,
                  pointerEvents: 'none',
                  textShadow: '0 0 4px #000'
                }}>
                  {scanning ? 'Scanning for barcode...' : 'Barcode detected!'}
                </div>
              </div>
              
              {/* Instructions */}
              <div className="mt-3 text-muted small">
                <p>For best results:</p>
                <ul className="text-start">
                  <li>Ensure good lighting</li>
                  <li>Hold the barcode steady</li>
                  <li>Position the barcode within the blue box</li>
                  <li>Try the "Upload Image" tab if camera scanning doesn't work</li>
                </ul>
              </div>
            </div>
          </Tab>
          
          <Tab eventKey="upload" title="Upload Image">
            <div className="text-center mb-3">
              <p>Upload an image containing a barcode to scan.</p>
              
              <Form.Group controlId="barcodeImageUpload" className="mb-3">
                <Form.Label>Select Image</Form.Label>
                <Form.Control 
                  type="file" 
                  accept="image/*"
                  onChange={handleImageUpload}
                  ref={fileInputRef}
                />
                <Form.Text className="text-muted">
                  For best results, ensure the barcode is clear and well-lit in the image.
                </Form.Text>
              </Form.Group>
              
              {uploadedImage && (
                <div className="mt-3">
                  <div className="mb-2">
                    <img 
                      src={uploadedImage} 
                      alt="Uploaded barcode" 
                      style={{ maxWidth: '100%', maxHeight: '300px' }} 
                      ref={imageRef}
                    />
                  </div>
                  <Button 
                    variant="primary" 
                    onClick={processUploadedImage}
                    disabled={processingImage}
                    className="me-2"
                  >
                    {processingImage ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                          className="me-2"
                        />
                        Processing...
                      </>
                    ) : 'Scan Barcode'}
                  </Button>
                </div>
              )}
              
              {/* Hidden canvas for image processing */}
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
          </Tab>
          
          <Tab eventKey="manual" title="Manual Entry">
            <div className="text-center mb-3">
              <p>Enter the barcode number manually.</p>
              
              <Form onSubmit={handleManualSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Barcode Number</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g. 00081113479"
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)}
                    pattern="\d{8,13}"
                    title="Barcode should be 8-13 digits"
                  />
                  <Form.Text className="text-muted">
                    Enter the numeric barcode value (8-13 digits).
                  </Form.Text>
                </Form.Group>
                <Button 
                  type="submit" 
                  variant="primary" 
                  disabled={!manualBarcode || !/^\d+$/.test(manualBarcode) || manualBarcode.length < 8 || manualBarcode.length > 13}
                >
                  Submit
                </Button>
              </Form>
            </div>
          </Tab>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleHide}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default BarcodeScanner;
