import React, { useState, useEffect, useContext } from 'react';
import { Container, Row, Col, Card, Button, Form, Alert, Spinner, Table } from 'react-bootstrap';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

// Get API URL from environment variable or use default
const API_URL = process.env.REACT_APP_API_URL || '/api';

const BarcodePrinting = () => {
  const { token } = useContext(AuthContext);
  
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [barcodeSize, setBarcodeSize] = useState('medium');
  
  // Fetch products and categories on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch categories
        const categoriesResponse = await axios.get(`${API_URL}/categories`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setCategories(categoriesResponse.data.categories || []);
        
        // Fetch products
        const productsResponse = await axios.get(`${API_URL}/products`, {
          params: { search, categoryId: selectedCategory },
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setProducts(productsResponse.data.products || []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load products. Please try again.');
        setLoading(false);
      }
    };
    
    fetchData();
  }, [token, search, selectedCategory]);
  
  // Handle category filter change
  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
  };
  
  // Handle search input change
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };
  
  // Handle product selection
  const handleProductSelect = (product) => {
    if (selectedProducts.some(p => p.product_id === product.product_id)) {
      setSelectedProducts(selectedProducts.filter(p => p.product_id !== product.product_id));
    } else {
      setSelectedProducts([...selectedProducts, { ...product, printQuantity: quantity }]);
    }
  };
  
  // Handle quantity change for a selected product
  const handleQuantityChange = (productId, newQuantity) => {
    setSelectedProducts(
      selectedProducts.map(p => 
        p.product_id === productId 
          ? { ...p, printQuantity: parseInt(newQuantity) || 1 } 
          : p
      )
    );
  };
  
  // Function to handle printing the selected barcodes
  const handlePrint = () => {
    if (selectedProducts.length === 0) {
      setError('Please select at least one product to print barcodes for.');
      return;
    }

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Pop-up blocked. Please allow pop-ups for this site to print barcodes.');
      return;
    }

    // Get dimensions based on the selected barcode size
    const getBarcodeSettings = (size) => {
      switch(size) {
        case 'small':
          return { width: 150, scale: 2, textsize: 10 };
        case 'large':
          return { width: 300, scale: 4, textsize: 14 };
        case 'medium':
        default:
          return { width: 200, scale: 3, textsize: 12 };
      }
    };

    const settings = getBarcodeSettings(barcodeSize);
    
    // Generate HTML content for the print window
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Barcodes for Printing</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
          }
          .barcode-container {
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-start;
          }
          .barcode-item {
            border: 1px solid #ddd;
            margin: 5px;
            padding: 10px;
            text-align: center;
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .barcode-small {
            width: 150px;
          }
          .barcode-medium {
            width: 200px;
          }
          .barcode-large {
            width: 300px;
          }
          .product-name {
            font-weight: bold;
            font-size: ${settings.textsize}px;
            margin-bottom: 5px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 100%;
          }
          .product-sku {
            font-size: ${Math.max(8, settings.textsize - 2)}px;
            color: #666;
            margin-bottom: 5px;
          }
          .barcode-img {
            max-width: 100%;
            height: auto;
          }
          .barcode-number {
            font-size: ${Math.max(8, settings.textsize - 2)}px;
            margin-top: 5px;
          }
          @media print {
            @page {
              size: auto;
              margin: 10mm;
            }
            body {
              margin: 0;
              padding: 0;
            }
            .barcode-item {
              break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="barcode-container">
          ${selectedProducts.map(product => {
            if (!product.barcode) {
              return `
                <div class="barcode-item ${barcodeSize}">
                  <div class="product-name">${product.name}</div>
                  <div class="product-sku">${product.sku || ''}</div>
                  <div style="color: red; font-size: 12px;">No barcode available</div>
                </div>
              `;
            }
            
            // Create multiple copies based on quantity
            let barcodes = '';
            for (let i = 0; i < product.printQuantity; i++) {
              // Build the barcode URL with proper parameters
              const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(product.barcode)}&scale=${settings.scale}&includetext=true&textsize=${settings.textsize}&textyoffset=5&height=${Math.floor(settings.width/3)}&width=${settings.width}`;
              
              barcodes += `
                <div class="barcode-item ${barcodeSize}">
                  <div class="product-name">${product.name}</div>
                  <div class="product-sku">${product.sku || ''}</div>
                  <img 
                    src="${barcodeUrl}" 
                    alt="${product.barcode}"
                    class="barcode-img"
                    onerror="this.onerror=null; this.src='data:image/svg+xml;charset=UTF-8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'${settings.width}\\' height=\\'80\\'><text x=\\'10\\' y=\\'20\\' fill=\\'red\\'>Error loading barcode</text></svg>';"
                  />
                  <div class="barcode-number">${product.barcode}</div>
                </div>
              `;
            }
            return barcodes;
          }).join('')}
        </div>
        <script>
          window.onload = function() {
            // Wait a bit longer to ensure images are loaded
            setTimeout(function() {
              window.print();
            }, 1000);
          };
        </script>
      </body>
      </html>
    `;

    // Write the HTML content to the new window
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };
  
  // Render loading spinner
  if (loading) {
    return (
      <Container className="mt-4">
        <div className="d-flex justify-content-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      </Container>
    );
  }
  
  return (
    <Container fluid className="mt-4">
      <Row>
        <Col>
          <h1>Barcode Printing</h1>
          <p>Select products to print barcodes for inventory management.</p>
        </Col>
      </Row>
      
      {error && (
        <Row>
          <Col>
            <Alert variant="danger">{error}</Alert>
          </Col>
        </Row>
      )}
      
      <Row className="mb-4">
        <Col md={4}>
          <Form.Group className="mb-3">
            <Form.Label>Search Products</Form.Label>
            <Form.Control
              type="text"
              placeholder="Search by name, SKU, or barcode"
              value={search}
              onChange={handleSearchChange}
            />
          </Form.Group>
        </Col>
        
        <Col md={4}>
          <Form.Group className="mb-3">
            <Form.Label>Filter by Category</Form.Label>
            <Form.Select
              value={selectedCategory}
              onChange={handleCategoryChange}
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.category_id} value={category.category_id}>
                  {category.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        
        <Col md={4}>
          <Form.Group className="mb-3">
            <Form.Label>Default Quantity</Form.Label>
            <Form.Control
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            />
          </Form.Group>
        </Col>
      </Row>
      
      <Row className="mb-4">
        <Col md={4}>
          <Form.Group className="mb-3">
            <Form.Label>Barcode Size</Form.Label>
            <Form.Select
              value={barcodeSize}
              onChange={(e) => setBarcodeSize(e.target.value)}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </Form.Select>
          </Form.Group>
        </Col>
        
        <Col md={8} className="d-flex align-items-end">
          <Button 
            variant="primary" 
            className="mb-3 me-2"
            onClick={handlePrint}
            disabled={selectedProducts.length === 0}
          >
            <i className="bi bi-printer me-1"></i> Print Barcodes
          </Button>
          
          <Button 
            variant="outline-secondary" 
            className="mb-3"
            onClick={() => setSelectedProducts([])}
            disabled={selectedProducts.length === 0}
          >
            Clear Selection
          </Button>
        </Col>
      </Row>
      
      <Row>
        <Col md={6}>
          <Card>
            <Card.Header>Available Products</Card.Header>
            <Card.Body style={{ maxHeight: '500px', overflow: 'auto' }}>
              <Table striped hover>
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}></th>
                    <th>Name</th>
                    <th>SKU</th>
                    <th>Barcode</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center">No products found</td>
                    </tr>
                  ) : (
                    products.map(product => (
                      <tr 
                        key={product.product_id}
                        onClick={() => handleProductSelect(product)}
                        className={selectedProducts.some(p => p.product_id === product.product_id) ? 'table-primary' : ''}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <Form.Check
                            type="checkbox"
                            checked={selectedProducts.some(p => p.product_id === product.product_id)}
                            onChange={() => handleProductSelect(product)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td>{product.name}</td>
                        <td>{product.sku}</td>
                        <td>{product.barcode || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={6}>
          <Card>
            <Card.Header>Selected Products</Card.Header>
            <Card.Body style={{ maxHeight: '500px', overflow: 'auto' }}>
              {selectedProducts.length === 0 ? (
                <p className="text-center">No products selected</p>
              ) : (
                <Table striped>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ width: '100px' }}>Quantity</th>
                      <th style={{ width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProducts.map(product => (
                      <tr key={product.product_id}>
                        <td>
                          <div>{product.name}</div>
                          <small className="text-muted">{product.sku}</small>
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            min="1"
                            value={product.printQuantity}
                            onChange={(e) => handleQuantityChange(product.product_id, e.target.value)}
                            size="sm"
                          />
                        </td>
                        <td>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleProductSelect(product)}
                          >
                            <i className="bi bi-x"></i>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default BarcodePrinting;
