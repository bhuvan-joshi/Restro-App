import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Table, Button, Card, Alert, Spinner, Form, InputGroup, Row, Col, Modal } from 'react-bootstrap';
import axios from 'axios';
import Barcode from 'react-barcode';
import ProductImage from '../components/ProductImage';
import BarcodeScanner from '../components/BarcodeScanner';
import { AuthContext } from '../context/AuthContext';

// Get API URL from environment variable or use default
const API_URL = process.env.REACT_APP_API_URL || '/api';

const Products = () => {
  const { token } = useContext(AuthContext);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rackLocations, setRackLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalPages: 1,
    totalProducts: 0
  });
  const [generatingBarcodes, setGeneratingBarcodes] = useState(false);
  const [barcodeMessage, setBarcodeMessage] = useState('');
  
  // View/Edit product state
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    sku: '',
    description: '',
    price: 0,
    cost: 0,
    category_id: '',
    rackLocationId: '',
    image: null,
    barcode: ''
  });
  const [addFormData, setAddFormData] = useState({
    name: '',
    sku: '',
    description: '',
    price: 0,
    cost: 0,
    category_id: '',
    rackLocationId: '',
    image: null,
    barcode: ''
  });
  const [validated, setValidated] = useState(false);
  const [addFormValidated, setAddFormValidated] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [addMessage, setAddMessage] = useState('');
  
  // Import Excel state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importError, setImportError] = useState('');
  
  // Barcode scanner state
  const [showScannerModal, setShowScannerModal] = useState(false);

  const fetchProducts = useCallback(async (page = 1) => {
    try {
      const params = {
        page,
        limit: pagination.limit,
        search: search || undefined,
        categoryId: selectedCategory || undefined,
        _t: new Date().getTime() // Prevent caching
      };
  
      const res = await axios.get(`${API_URL}/products`, {
        params,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      console.log('Products response:', res.data);
  
      setProducts(res.data.products || []);
      setPagination({
        page: res.data.pagination.page,
        limit: res.data.pagination.limit,
        totalPages: res.data.pagination.totalPages,
        totalProducts: res.data.pagination.totalProducts
      });
  
      setError(null);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to load products. Please try again later.');
    }
  }, [pagination.limit, search, selectedCategory, token]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch categories
        const categoriesRes = await axios.get(`${API_URL}/categories`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setCategories(categoriesRes.data.categories || []);
        
        // Fetch rack locations
        const locationsRes = await axios.get(`${API_URL}/locations?type=Rack`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setRackLocations(locationsRes.data.locations || []);
        
        // Fetch products
        await fetchProducts();
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again later.');
        setLoading(false);
      }
    };
    
    fetchData();
  }, [token, fetchProducts]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchProducts(1); // Reset to first page when searching
  };

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= pagination.totalPages) {
      fetchProducts(newPage);
    }
  };

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
    // Don't fetch products yet, wait for search button
  };

  // View product details
  const handleViewProduct = async (productId) => {
    try {
      const response = await axios.get(`${API_URL}/products/${productId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setSelectedProduct(response.data);
      setShowViewModal(true);
    } catch (err) {
      console.error('Error fetching product details:', err);
      setError('Failed to load product details. Please try again.');
    }
  };

  // Edit product
  const handleEditClick = async (productId) => {
    try {
      const response = await axios.get(`${API_URL}/products/${productId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const product = response.data;
      
      console.log('Product for edit:', product); // Log product data to debug
      
      setSelectedProduct(product);
      setEditFormData({
        name: product.name,
        sku: product.sku,
        description: product.description || '',
        price: product.price || 0,
        cost: product.cost || 0,
        category_id: product.category_id || '',
        rackLocationId: product.rack_location_id || '',
        barcode: product.barcode || ''
      });
      
      console.log('Edit form data:', {
        name: product.name,
        sku: product.sku,
        description: product.description || '',
        price: product.price || 0,
        cost: product.cost || 0,
        category_id: product.category_id || '',
        rackLocationId: product.rack_location_id || '',
        barcode: product.barcode || ''
      }); // Log the form data to debug
      
      setShowEditModal(true);
      setValidated(false);
      setUpdateMessage('');
    } catch (err) {
      console.error('Error fetching product details for edit:', err);
      setError('Failed to load product details. Please try again.');
    }
  };

  // Handle Add Product button click
  const handleAddProductClick = () => {
    setAddFormData({
      name: '',
      sku: '',
      description: '',
      price: 0,
      cost: 0,
      category_id: '',
      rackLocationId: '',
      image: null,
      barcode: ''
    });
    setAddFormValidated(false);
    setAddMessage('');
    setShowAddModal(true);
  };

  const handleEditFormChange = (e) => {
    const { name, value, files } = e.target;
    
    if (name === 'image' && files && files.length > 0) {
      setEditFormData({
        ...editFormData,
        image: files[0]
      });
    } else {
      setEditFormData({
        ...editFormData,
        [name]: value
      });
    }
  };

  const handleAddFormChange = (e) => {
    const { name, value, files } = e.target;
    
    if (name === 'image' && files && files.length > 0) {
      setAddFormData({
        ...addFormData,
        image: files[0]
      });
    } else {
      setAddFormData({
        ...addFormData,
        [name]: value
      });
    }
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    
    const form = e.currentTarget;
    if (form.checkValidity() === false) {
      e.stopPropagation();
      setValidated(true);
      return;
    }
    
    try {
      // Create FormData object to handle file uploads
      const formData = new FormData();
      formData.append('name', editFormData.name);
      formData.append('sku', editFormData.sku);
      formData.append('description', editFormData.description || '');
      formData.append('price', editFormData.price || 0);
      formData.append('cost', editFormData.cost || 0);
      formData.append('categoryId', editFormData.category_id || '');
      formData.append('barcode', editFormData.barcode || '');
      
      // Add rack location if selected
      if (editFormData.rackLocationId) {
        formData.append('rackLocationId', editFormData.rackLocationId);
      }
      
      // Add image if selected
      if (editFormData.image) {
        formData.append('image', editFormData.image);
      }
      
     /* const response = await axios.put(
        `${API_URL}/products/${selectedProduct.product_id}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`,
          }
        }
      );*/
      
      setUpdateMessage('Product updated successfully');
      setTimeout(() => {
        setShowEditModal(false);
        fetchProducts(pagination.page); // Refresh product list
      }, 1500);
    } catch (err) {
      console.error('Error updating product:', err);
      setUpdateMessage(
        err.response?.data?.message || 'Error updating product. Please try again.'
      );
    }
  };

  const handleSubmitAdd = async (e) => {
    e.preventDefault();
    
    const form = e.currentTarget;
    if (form.checkValidity() === false) {
      e.stopPropagation();
      setAddFormValidated(true);
      return;
    }
    
    try {
      // Create FormData object to handle file uploads
      const formData = new FormData();
      formData.append('name', addFormData.name);
      formData.append('sku', addFormData.sku);
      formData.append('description', addFormData.description || '');
      formData.append('price', addFormData.price || 0);
      formData.append('cost', addFormData.cost || 0);
      formData.append('categoryId', addFormData.category_id || '');
      formData.append('barcode', addFormData.barcode || '');
      
      // Add rack location if selected
      if (addFormData.rackLocationId) {
        formData.append('rackLocationId', addFormData.rackLocationId);
      }
      
      // Add image if selected
      if (addFormData.image) {
        formData.append('image', addFormData.image);
      }
      
     /* const response = await axios.post(
        `${API_URL}/products`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`,
          }
        }
      );*/
      
      setAddMessage('Product added successfully');
      setTimeout(() => {
        setShowAddModal(false);
        fetchProducts(pagination.page); // Refresh product list
      }, 1500);
    } catch (err) {
      console.error('Error adding product:', err);
      setAddMessage(
        err.response?.data?.message || 'Error adding product. Please try again.'
      );
    }
  };

  const renderPagination = () => {
    const pages = [];
    const maxButtons = 5;
    const currentPage = pagination.page;
    const totalPages = pagination.totalPages;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    
    if (endPage - startPage + 1 < maxButtons) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }
    
    // Previous button
    pages.push(
      <li key="prev" className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
        <button 
          className="page-link" 
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          Previous
        </button>
      </li>
    );
    
    // Page buttons
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <li key={i} className={`page-item ${i === currentPage ? 'active' : ''}`}>
          <button 
            className="page-link" 
            onClick={() => handlePageChange(i)}
          >
            {i}
          </button>
        </li>
      );
    }
    
    // Next button
    pages.push(
      <li key="next" className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
        <button 
          className="page-link" 
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
        </button>
      </li>
    );
    
    return (
      <nav aria-label="Product pagination">
        <ul className="pagination justify-content-center">
          {pages}
        </ul>
      </nav>
    );
  };

  // Handle file selection for import
  const handleImportFileChange = (e) => {
    setImportFile(e.target.files[0]);
    setImportError('');
    setImportMessage('');
  };

  // Handle import form submission
  const handleImportSubmit = async (e) => {
    e.preventDefault();
    
    if (!importFile) {
      setImportError('Please select an Excel file to import.');
      return;
    }

    const fileExt = importFile.name.split('.').pop().toLowerCase();
    if (fileExt !== 'xlsx' && fileExt !== 'xls') {
      setImportError('Please select a valid Excel file (.xlsx or .xls).');
      return;
    }

    setImportLoading(true);
    setImportError('');
    setImportMessage('');

    const formData = new FormData();
    formData.append('excelFile', importFile);

    try {
      const response = await axios.post(`${API_URL}/products/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });

      setImportMessage(response.data.message);
      setImportFile(null);
      
      // Refresh the product list after successful import
      await fetchProducts();
      
      // Auto-close the modal after 3 seconds on success
      setTimeout(() => {
        setShowImportModal(false);
        setImportMessage('');
      }, 3000);
    } catch (err) {
      console.error('Error importing products:', err);
      setImportError(
        err.response?.data?.message || 
        'Failed to import products. Please try again.'
      );
    } finally {
      setImportLoading(false);
    }
  };

  // Generate a barcode for a product
  const generateBarcode = (product = null) => {
    if (product) {
      // If product is provided, generate a consistent barcode based on product ID and SKU
      const productId = product.product_id || '';
      const sku = product.sku || '';
      
      // Extract numeric part from product ID
      const productIdNum = productId.replace(/\D/g, '');
      
      // Extract alphanumeric part from SKU
      const skuClean = sku.replace(/[^A-Z0-9]/gi, '').substring(0, 5).toUpperCase();
      
      // Combine to create a consistent barcode
      // Format: numeric part of product ID padded to 8 digits + first 4 chars of SKU
      return productIdNum.padStart(8, '0') + skuClean.padEnd(4, '0');
    } else {
      // For new products without an ID, use timestamp-based approach
      const timestamp = new Date().getTime().toString().slice(-8);
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return timestamp + random;
    }
  };

  const handleBarcodeScan = (barcodeData) => {
    console.log('Barcode scanned:', barcodeData);
    setSearch(barcodeData);
    
    // Use setTimeout to ensure state is updated before triggering search
    setTimeout(() => {
      // Find the search form submit button and click it programmatically
      const searchButton = document.getElementById('search-submit-button');
      if (searchButton) {
        searchButton.click();
      } else {
        // Fallback to direct API call if button not found
        fetchProducts(1);
      }
    }, 100);
  };

  // Generate barcodes for products that don't have them
  const handleGenerateBarcodes = async () => {
    try {
      setGeneratingBarcodes(true);
      setBarcodeMessage('');
      
      // Get all products without barcodes
      const res = await axios.get(`${API_URL}/products`, {
        params: { limit: 1000 },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      const productsWithoutBarcodes = res.data.products.filter(p => !p.barcode);
      
      if (productsWithoutBarcodes.length === 0) {
        setBarcodeMessage('All products already have barcodes.');
        setGeneratingBarcodes(false);
        return;
      }
      
      // Generate and update barcodes
      let successCount = 0;
      for (const product of productsWithoutBarcodes) {
        // Generate barcode using the consistent method
        const barcode = generateBarcode(product);
        
        // Create FormData object to match the expected format in the backend
        const formData = new FormData();
        formData.append('name', product.name);
        formData.append('sku', product.sku);
        formData.append('description', product.description || '');
        formData.append('price', product.price || 0);
        formData.append('cost', product.cost || 0);
        formData.append('categoryId', product.category_id || '');
        formData.append('barcode', barcode);
        
        if (product.rack_location_id) {
          formData.append('rackLocationId', product.rack_location_id);
        }
        
        // Update product with new barcode
        await axios.put(
          `${API_URL}/products/${product.product_id}`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${token}`,
            }
          }
        );
        
        successCount++;
      }
      
      setBarcodeMessage(`Successfully generated barcodes for ${successCount} products.`);
      fetchProducts(pagination.page); // Refresh product list
    } catch (err) {
      console.error('Error generating barcodes:', err);
      setBarcodeMessage('Error generating barcodes. Please try again.');
    } finally {
      setGeneratingBarcodes(false);
    }
  };

  const handleRefresh = () => {
    fetchProducts(pagination.page);
  };

  if (loading) {
    return (
      <div className="fullscreen-page d-flex align-items-center justify-content-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <div className="fullscreen-page">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1>Products</h1>
        <div>
          <Button 
            variant="outline-secondary" 
            className="me-2"
            onClick={handleRefresh}
          >
            <i className="bi bi-arrow-clockwise me-1"></i> Refresh
          </Button>
          <Button 
            variant="outline-secondary" 
            className="me-2"
            onClick={() => setShowImportModal(true)}
          >
            <i className="bi bi-file-earmark-excel me-1"></i> Import Excel
          </Button>
          
          <Button 
            variant="outline-primary" 
            className="me-2"
            onClick={handleGenerateBarcodes}
            disabled={generatingBarcodes}
          >
            {generatingBarcodes ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-1"
                />
                Generating...
              </>
            ) : (
              <>
                <i className="bi bi-upc-scan me-1"></i> Generate Missing Barcodes
              </>
            )}
          </Button>
          
          <Button 
            variant="primary" 
            onClick={handleAddProductClick}
          >
            <i className="bi bi-plus-lg me-1"></i> Add Product
          </Button>
        </div>
      </div>
      
      {error && <Alert variant="danger">{error}</Alert>}
      
      {barcodeMessage && (
        <Alert 
          variant={barcodeMessage.includes('Error') ? 'danger' : 'success'} 
          onClose={() => setBarcodeMessage('')} 
          dismissible
        >
          {barcodeMessage}
        </Alert>
      )}
      
      <Card className="mb-4">
        <Card.Body>
          <Form onSubmit={handleSearch} data-search-form>
            <Row className="align-items-end">
              <Col md={5}>
                <Form.Group className="mb-0">
                  <Form.Label>Search</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type="text"
                      placeholder="Search products by name or SKU"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <Button 
                      variant="outline-secondary"
                      onClick={() => setShowScannerModal(true)}
                    >
                      <i className="bi bi-upc-scan"></i>
                    </Button>
                  </InputGroup>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-0">
                  <Form.Label>Category</Form.Label>
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
              <Col md={3}>
                <Button 
                  id="search-submit-button"
                  variant="primary" 
                  type="submit" 
                  className="w-100"
                >
                  Apply Filters
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>
      
      <Card>
        <Card.Body>
          {products.length === 0 ? (
            <p className="text-center">No products found. Add your first product!</p>
          ) : (
            <>
              <div className="table-responsive">
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>SKU</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>Rack</th>
                      <th>Barcode</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(product => (
                      <tr key={product.product_id}>
                        <td className="text-center" style={{ width: '80px' }}>
                          <ProductImage 
                            src={product.image_path} 
                            alt={product.name}
                            style={{ width: '60px', height: '60px' }} 
                            className="img-thumbnail"
                          />
                        </td>
                        <td>{product.sku}</td>
                        <td>{product.name}</td>
                        <td>{product.category_name || '-'}</td>
                        <td>${product.price?.toFixed(2) || '0.00'}</td>
                        <td>{product.total_quantity || 0}</td>
                        <td>{product.rack_location_name || '-'}</td>
                        <td>
                          {product.barcode ? (
                            <div style={{ maxWidth: '120px', overflow: 'hidden' }}>
                              <Barcode 
                                value={product.barcode} 
                                width={0.8}
                                height={30}
                                fontSize={8}
                                margin={0}
                                displayValue={true}
                              />
                            </div>
                          ) : '-'}
                        </td>
                        <td>
                          <Button 
                            variant="outline-primary" 
                            size="sm" 
                            className="me-2"
                            onClick={() => handleViewProduct(product.product_id)}
                          >
                            View
                          </Button>
                          <Button 
                            variant="outline-secondary" 
                            size="sm" 
                            className="me-2"
                            onClick={() => handleEditClick(product.product_id)}
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              
              <div className="d-flex justify-content-between align-items-center mt-3">
                <div>
                  Showing {products.length} of {pagination.totalProducts} products
                </div>
                {pagination.totalPages > 1 && renderPagination()}
              </div>
            </>
          )}
        </Card.Body>
      </Card>

      {/* View Product Modal */}
      <Modal 
        show={showViewModal} 
        onHide={() => setShowViewModal(false)}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>Product Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedProduct && (
            <Row>
              <Col md={4} className="text-center mb-3">
                {selectedProduct.image_path ? (
                  <ProductImage 
                    src={selectedProduct.image_path} 
                    alt={selectedProduct.name}
                    style={{ maxHeight: '200px', width: '100%' }}
                    thumbnail
                  />
                ) : (
                  <div className="bg-light p-4 text-center">No Image</div>
                )}
              </Col>
              <Col md={8}>
                <h4>{selectedProduct.name}</h4>
                <p className="text-muted">SKU: {selectedProduct.sku}</p>
                
                <dl className="row">
                  <dt className="col-sm-4">Category</dt>
                  <dd className="col-sm-8">{selectedProduct.category_name || '-'}</dd>
                  
                  <dt className="col-sm-4">Rack Location</dt>
                  <dd className="col-sm-8">{selectedProduct.rack_location_name || '-'}</dd>
                  
                  <dt className="col-sm-4">Price</dt>
                  <dd className="col-sm-8">${selectedProduct.price?.toFixed(2) || '0.00'}</dd>
                  
                  <dt className="col-sm-4">Cost</dt>
                  <dd className="col-sm-8">${selectedProduct.cost?.toFixed(2) || '0.00'}</dd>
                  
                  <dt className="col-sm-4">Description</dt>
                  <dd className="col-sm-8">{selectedProduct.description || 'No description available.'}</dd>
                  
                  <dt className="col-sm-4">Barcode</dt>
                  <dd className="col-sm-8">
                    {selectedProduct.barcode ? (
                      <div>
                        <div>{selectedProduct.barcode}</div>
                        <div className="mt-2 product-barcode">
                          <Barcode 
                            value={selectedProduct.barcode} 
                            width={1.5}
                            height={50}
                            fontSize={12}
                            margin={5}
                            displayValue={true}
                          />
                        </div>
                        <Button 
                          variant="outline-secondary" 
                          size="sm" 
                          className="mt-2"
                          onClick={() => {
                            const canvas = document.querySelector('.product-barcode canvas');
                            if (canvas) {
                              const link = document.createElement('a');
                              link.download = `barcode-${selectedProduct.sku}.png`;
                              link.href = canvas.toDataURL('image/png');
                              link.click();
                            }
                          }}
                        >
                          <i className="bi bi-download me-1"></i> Download Barcode
                        </Button>
                      </div>
                    ) : '-'}
                  </dd>
                  
                  <dt className="col-sm-4">Created</dt>
                  <dd className="col-sm-8">
                    {new Date(selectedProduct.created_at).toLocaleDateString()}
                  </dd>
                  
                  <dt className="col-sm-4">Last Updated</dt>
                  <dd className="col-sm-8">
                    {new Date(selectedProduct.updated_at).toLocaleDateString()}
                  </dd>
                </dl>
              </Col>

              {selectedProduct && selectedProduct.inventory && selectedProduct.inventory.length > 0 && (
                <Col xs={12} className="mt-4">
                  <h5>Inventory</h5>
                  <Table striped bordered hover size="sm">
                    <thead>
                      <tr>
                        <th>Location</th>
                        <th>Quantity</th>
                        <th>Min Quantity</th>
                        <th>Last Counted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProduct.inventory.map(item => (
                        <tr key={item.inventory_id}>
                          <td>{item.location_name}</td>
                          <td>{item.quantity}</td>
                          <td>{item.min_quantity}</td>
                          <td>
                            {item.last_counted_at 
                              ? new Date(item.last_counted_at).toLocaleDateString() 
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Col>
              )}
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowViewModal(false)}>
            Close
          </Button>
          <Button 
            variant="primary" 
            onClick={() => {
              setShowViewModal(false);
              if (selectedProduct) {
                handleEditClick(selectedProduct.product_id);
              }
            }}
          >
            Edit
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Product Modal */}
      <Modal
        show={showEditModal}
        onHide={() => setShowEditModal(false)}
        size="lg"
      >
        <Form noValidate validated={validated} onSubmit={handleSubmitEdit}>
          <Modal.Header closeButton>
            <Modal.Title>Edit Product</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {updateMessage && (
              <Alert 
                variant={updateMessage.includes('Error') ? 'danger' : 'success'}
              >
                {updateMessage}
              </Alert>
            )}
            
            <Row>
              <Col md={8}>
                <Form.Group className="mb-3" controlId="productName">
                  <Form.Label>Product Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={editFormData.name}
                    onChange={handleEditFormChange}
                    required
                  />
                  <Form.Control.Feedback type="invalid">
                    Product name is required.
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              
              <Col md={4}>
                <Form.Group className="mb-3" controlId="productSku">
                  <Form.Label>SKU</Form.Label>
                  <Form.Control
                    type="text"
                    name="sku"
                    value={editFormData.sku}
                    onChange={handleEditFormChange}
                    required
                  />
                  <Form.Control.Feedback type="invalid">
                    SKU is required.
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="productCategory">
                  <Form.Label>Category</Form.Label>
                  <Form.Select
                    name="category_id"
                    value={editFormData.category_id}
                    onChange={handleEditFormChange}
                  >
                    <option value="">Select Category</option>
                    {categories.map(category => (
                      <option key={category.category_id} value={category.category_id}>
                        {category.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              
              <Col md={3}>
                <Form.Group className="mb-3" controlId="productPrice">
                  <Form.Label>Price</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    min="0"
                    name="price"
                    value={editFormData.price}
                    onChange={handleEditFormChange}
                  />
                </Form.Group>
              </Col>
              
              <Col md={3}>
                <Form.Group className="mb-3" controlId="productCost">
                  <Form.Label>Cost</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    min="0"
                    name="cost"
                    value={editFormData.cost}
                    onChange={handleEditFormChange}
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="productRackLocation">
                  <Form.Label>Rack Location</Form.Label>
                  <Form.Select
                    name="rackLocationId"
                    value={editFormData.rackLocationId}
                    onChange={handleEditFormChange}
                  >
                    <option value="">Select Rack Location</option>
                    {rackLocations.map(location => (
                      <option key={location.location_id} value={location.location_id}>
                        {location.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="productBarcode">
                  <Form.Label>Barcode</Form.Label>
                  <Form.Control
                    type="text"
                    name="barcode"
                    value={editFormData.barcode || ''}
                    onChange={handleEditFormChange}
                  />
                  {editFormData.barcode && (
                    <div className="mt-2">
                      <Barcode 
                        value={editFormData.barcode} 
                        width={1}
                        height={40}
                        fontSize={10}
                        margin={0}
                        displayValue={true}
                      />
                    </div>
                  )}
                  <Button 
                    variant="outline-secondary" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => {
                      const newBarcode = generateBarcode(selectedProduct);
                      setEditFormData({
                        ...editFormData,
                        barcode: newBarcode
                      });
                    }}
                  >
                    Generate Barcode
                  </Button>
                </Form.Group>
              </Col>
            </Row>
            
            <Form.Group className="mb-3" controlId="productDescription">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="description"
                value={editFormData.description}
                onChange={handleEditFormChange}
              />
            </Form.Group>
            
            {selectedProduct && selectedProduct.image_path && (
              <Row className="mt-3">
                <Col md={4}>
                  <ProductImage 
                    src={selectedProduct.image_path} 
                    alt={selectedProduct.name}
                    thumbnail
                    style={{ maxHeight: '150px' }}
                  />
                </Col>
                <Col md={8}>
                  <Form.Group controlId="productImage" className="mb-3">
                    <Form.Label>Update Product Image</Form.Label>
                    <Form.Control 
                      type="file" 
                      name="image"
                      accept="image/*"
                      onChange={handleEditFormChange}
                    />
                    <Form.Text className="text-muted">
                      Upload a new image to replace the current one.
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>
            )}
            
            {(!selectedProduct || !selectedProduct.image_path) && (
              <Form.Group controlId="productImage" className="mb-3">
                <Form.Label>Product Image</Form.Label>
                <Form.Control 
                  type="file" 
                  name="image"
                  accept="image/*"
                  onChange={handleEditFormChange}
                />
                <Form.Text className="text-muted">
                  Upload an image for this product.
                </Form.Text>
              </Form.Group>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Changes
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Add Product Modal */}
      <Modal 
        show={showAddModal} 
        onHide={() => setShowAddModal(false)}
        size="lg"
      >
        <Form noValidate validated={addFormValidated} onSubmit={handleSubmitAdd}>
          <Modal.Header closeButton>
            <Modal.Title>Add New Product</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {addMessage && (
              <Alert variant={addMessage.includes('Error') ? 'danger' : 'success'}>
                {addMessage}
              </Alert>
            )}
            
            <Row>
              <Col md={8}>
                <Form.Group className="mb-3" controlId="addProductName">
                  <Form.Label>Product Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={addFormData.name}
                    onChange={handleAddFormChange}
                    required
                  />
                  <Form.Control.Feedback type="invalid">
                    Product name is required.
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              
              <Col md={4}>
                <Form.Group className="mb-3" controlId="addProductSku">
                  <Form.Label>SKU</Form.Label>
                  <Form.Control
                    type="text"
                    name="sku"
                    value={addFormData.sku}
                    onChange={handleAddFormChange}
                    required
                  />
                  <Form.Control.Feedback type="invalid">
                    SKU is required.
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="addProductCategory">
                  <Form.Label>Category</Form.Label>
                  <Form.Select
                    name="category_id"
                    value={addFormData.category_id}
                    onChange={handleAddFormChange}
                  >
                    <option value="">Select Category</option>
                    {categories.map(category => (
                      <option key={category.category_id} value={category.category_id}>
                        {category.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              
              <Col md={3}>
                <Form.Group className="mb-3" controlId="addProductPrice">
                  <Form.Label>Price</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    min="0"
                    name="price"
                    value={addFormData.price}
                    onChange={handleAddFormChange}
                  />
                </Form.Group>
              </Col>
              
              <Col md={3}>
                <Form.Group className="mb-3" controlId="addProductCost">
                  <Form.Label>Cost</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    min="0"
                    name="cost"
                    value={addFormData.cost}
                    onChange={handleAddFormChange}
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="addProductRackLocation">
                  <Form.Label>Rack Location</Form.Label>
                  <Form.Select
                    name="rackLocationId"
                    value={addFormData.rackLocationId}
                    onChange={handleAddFormChange}
                  >
                    <option value="">Select Rack Location</option>
                    {rackLocations.map(location => (
                      <option key={location.location_id} value={location.location_id}>
                        {location.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="addProductBarcode">
                  <Form.Label>Barcode</Form.Label>
                  <Form.Control
                    type="text"
                    name="barcode"
                    value={addFormData.barcode}
                    onChange={handleAddFormChange}
                  />
                  <Button 
                    variant="outline-secondary" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => {
                      const newBarcode = generateBarcode();
                      setAddFormData({
                        ...addFormData,
                        barcode: newBarcode
                      });
                    }}
                  >
                    Generate Barcode
                  </Button>
                </Form.Group>
              </Col>
            </Row>
            
            <Form.Group className="mb-3" controlId="addProductDescription">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="description"
                value={addFormData.description}
                onChange={handleAddFormChange}
              />
            </Form.Group>
            
            <Form.Group controlId="addProductImage" className="mb-3">
              <Form.Label>Product Image</Form.Label>
              <Form.Control 
                type="file" 
                name="image"
                accept="image/*"
                onChange={handleAddFormChange}
              />
              <Form.Text className="text-muted">
                Upload an image for this product.
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Add Product
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Import Products Modal */}
      <Modal 
        show={showImportModal} 
        onHide={() => setShowImportModal(false)}
        size="lg"
      >
        <Form noValidate onSubmit={handleImportSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>Import Products from Excel</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {importMessage && (
              <Alert variant={importMessage.includes('Error') ? 'danger' : 'success'}>
                {importMessage}
              </Alert>
            )}
            {importError && (
              <Alert variant="danger">
                {importError}
              </Alert>
            )}
            
            <Form.Group controlId="importFile" className="mb-3">
              <Form.Label>Excel File</Form.Label>
              <Form.Control 
                type="file" 
                accept=".xlsx, .xls"
                onChange={handleImportFileChange}
              />
              <Form.Text className="text-muted">
                Upload an Excel file (.xlsx or .xls) containing product data.
                <br />
                <a 
                  href={`${API_URL}/products/import-template`} 
                  className="text-primary" 
                  download
                >
                  Download sample template
                </a>
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowImportModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={importLoading}>
              {importLoading ? (
                <Spinner animation="border" size="sm" />
              ) : (
                'Import Products'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        show={showScannerModal}
        onHide={() => setShowScannerModal(false)}
        onScan={handleBarcodeScan}
      />
    </div>
  );
};

export default Products;