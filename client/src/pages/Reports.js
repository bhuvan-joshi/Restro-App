import React, { useState, useEffect } from 'react';
import { Card, Alert, Spinner, Tabs, Tab, Form, Row, Col, Table, Badge } from 'react-bootstrap';
import axios from 'axios';

// Get API URL from environment variable or use default
const API_URL = process.env.REACT_APP_API_URL || '/api';

const Reports = () => {
  const [activeTab, setActiveTab] = useState('inventory-status');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Data states
  const [inventoryStatusData, setInventoryStatusData] = useState(null);
  const [inventoryValueData, setInventoryValueData] = useState(null);
  const [inventoryMovementData, setInventoryMovementData] = useState(null);
  
  // Filter states
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // Filter values for each report
  const [statusFilters, setStatusFilters] = useState({
    locationId: '',
    categoryId: '',
    lowStockOnly: false
  });
  
  const [valueFilters, setValueFilters] = useState({
    locationId: '',
    categoryId: ''
  });
  
  const [movementFilters, setMovementFilters] = useState({
    productId: '',
    locationId: '',
    startDate: '',
    endDate: ''
  });

  const fetchInventoryMovement = async () => {
    setLoading(true);
    try {
      const params = {
        ...movementFilters
      };
      
      const res = await axios.get(`${API_URL}/reports/inventory/movement`, { params });
      setInventoryMovementData(res.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching inventory movement report:', err);
      setError('Failed to load inventory movement report. Please try again later.');
      setInventoryMovementData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventoryStatus = async () => {
    setLoading(true);
    try {
      const params = {
        ...statusFilters
      };
      
      const res = await axios.get(`${API_URL}/reports/inventory/status`, { params });
      setInventoryStatusData(res.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching inventory status report:', err);
      setError('Failed to load inventory status report. Please try again later.');
      setInventoryStatusData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventoryValue = async () => {
    setLoading(true);
    try {
      const params = {
        ...valueFilters
      };
      
      const res = await axios.get(`${API_URL}/reports/inventory/value`, { params });
      setInventoryValueData(res.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching inventory value report:', err);
      setError('Failed to load inventory value report. Please try again later.');
      setInventoryValueData(null);
    } finally {
      setLoading(false);
    }
  };

  // Load reference data on mount
  useEffect(() => {
    fetchReferenceData();
  }, []);
  
  // Load report data when tab changes or filters change
  useEffect(() => {
    if (activeTab === 'inventory-status') {
      fetchInventoryStatus();
    } else if (activeTab === 'inventory-value') {
      fetchInventoryValue();
    } else if (activeTab === 'inventory-movement') {
      fetchInventoryMovement();
    }
  }, [activeTab, statusFilters, valueFilters, movementFilters, fetchInventoryStatus, fetchInventoryValue, fetchInventoryMovement]);

  const fetchReferenceData = async () => {
    try {
      const [productsRes, locationsRes, categoriesRes] = await Promise.all([
        axios.get(`${API_URL}/products`),
        axios.get(`${API_URL}/locations`),
        axios.get(`${API_URL}/categories`)
      ]);
      
      setProducts(productsRes.data.products || []);
      setLocations(locationsRes.data.locations || []);
      setCategories(categoriesRes.data.categories || []);
    } catch (err) {
      console.error('Error fetching reference data:', err);
      setError('Failed to load reference data. Please try again later.');
    }
  };

  const handleStatusFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setStatusFilters({
      ...statusFilters,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleValueFilterChange = (e) => {
    const { name, value } = e.target;
    setValueFilters({
      ...valueFilters,
      [name]: value
    });
  };

  const handleMovementFilterChange = (e) => {
    const { name, value } = e.target;
    setMovementFilters({
      ...movementFilters,
      [name]: value
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  /*const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return format(date, 'MMM d, yyyy');
    } catch (err) {
      return dateString;
    }
  };*/

  const renderInventoryStatusReport = () => {
    if (!inventoryStatusData) return null;
    
    const { items, summary } = inventoryStatusData;
    
    return (
      <>
        <Card className="mb-4">
          <Card.Header>Summary</Card.Header>
          <Card.Body>
            <Row>
              <Col md={3} className="text-center mb-3">
                <h5>Total Items</h5>
                <div className="h2">{summary.totalItems}</div>
              </Col>
              <Col md={3} className="text-center mb-3">
                <h5>Low Stock</h5>
                <div className="h2 text-danger">{summary.lowStock}</div>
              </Col>
              <Col md={3} className="text-center mb-3">
                <h5>OK</h5>
                <div className="h2 text-success">{summary.ok}</div>
              </Col>
              <Col md={3} className="text-center mb-3">
                <h5>Overstocked</h5>
                <div className="h2 text-warning">{summary.overstocked}</div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
        
        <Card>
          <Card.Header>Inventory Status Details</Card.Header>
          <Card.Body>
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Quantity</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td>
                      {item.product_name}
                      <div className="small text-muted">{item.sku}</div>
                    </td>
                    <td>{item.category_name || 'Uncategorized'}</td>
                    <td>{item.location_name}</td>
                    <td className="text-center">{item.quantity}</td>
                    <td className="text-center">{item.min_quantity}</td>
                    <td className="text-center">{item.max_quantity || '-'}</td>
                    <td className="text-center">
                      <Badge
                        bg={
                          item.stock_status === 'Low'
                            ? 'danger'
                            : item.stock_status === 'Overstocked'
                            ? 'warning'
                            : 'success'
                        }
                      >
                        {item.stock_status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      </>
    );
  };

  const renderInventoryValueReport = () => {
    if (!inventoryValueData) return null;
    
    const { items, summary, categoryBreakdown, locationBreakdown } = inventoryValueData;
    
    return (
      <>
        <Card className="mb-4">
          <Card.Header>Summary</Card.Header>
          <Card.Body>
            <Row>
              <Col md={3} className="text-center mb-3">
                <h5>Total Items</h5>
                <div className="h2">{summary.totalItems}</div>
              </Col>
              <Col md={3} className="text-center mb-3">
                <h5>Total Quantity</h5>
                <div className="h2">{summary.totalQuantity}</div>
              </Col>
              <Col md={3} className="text-center mb-3">
                <h5>Total Cost</h5>
                <div className="h2">{formatCurrency(summary.totalCost)}</div>
              </Col>
              <Col md={3} className="text-center mb-3">
                <h5>Total Value</h5>
                <div className="h2">{formatCurrency(summary.totalValue)}</div>
              </Col>
            </Row>
            <Row className="mt-2">
              <Col className="text-center">
                <h5>Potential Profit</h5>
                <div className="h2 text-success">{formatCurrency(summary.potentialProfit)}</div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
        
        <Row>
          <Col md={6}>
            <Card className="mb-4">
              <Card.Header>Value by Category</Card.Header>
              <Card.Body>
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Quantity</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(categoryBreakdown).map(([category, data]) => (
                      <tr key={category}>
                        <td>{category}</td>
                        <td className="text-center">{data.quantity}</td>
                        <td className="text-end">{formatCurrency(data.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Col>
          
          <Col md={6}>
            <Card className="mb-4">
              <Card.Header>Value by Location</Card.Header>
              <Card.Body>
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Location</th>
                      <th>Quantity</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(locationBreakdown).map(([location, data]) => (
                      <tr key={location}>
                        <td>{location}</td>
                        <td className="text-center">{data.quantity}</td>
                        <td className="text-end">{formatCurrency(data.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Col>
        </Row>
        
        <Card>
          <Card.Header>Inventory Value Details</Card.Header>
          <Card.Body>
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Location</th>
                  <th>Category</th>
                  <th>Quantity</th>
                  <th>Cost</th>
                  <th>Price</th>
                  <th>Total Cost</th>
                  <th>Total Value</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td>
                      {item.product_name}
                      <div className="small text-muted">{item.sku}</div>
                    </td>
                    <td>{item.location_name}</td>
                    <td>{item.category_name || 'Uncategorized'}</td>
                    <td className="text-center">{item.quantity}</td>
                    <td className="text-end">{formatCurrency(item.cost)}</td>
                    <td className="text-end">{formatCurrency(item.price)}</td>
                    <td className="text-end">{formatCurrency(item.total_cost)}</td>
                    <td className="text-end">{formatCurrency(item.total_value)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      </>
    );
  };

  const renderInventoryMovementReport = () => {
    if (!inventoryMovementData) return null;
    
    const { productSummary, locationSummary, typeSummary, overallSummary } = inventoryMovementData;
    
    return (
      <>
        <Card className="mb-4">
          <Card.Header>Summary</Card.Header>
          <Card.Body>
            <Row>
              <Col md={3} className="text-center mb-3">
                <h5>Total In</h5>
                <div className="h2 text-success">{overallSummary.total_in}</div>
              </Col>
              <Col md={3} className="text-center mb-3">
                <h5>Total Out</h5>
                <div className="h2 text-danger">{overallSummary.total_out}</div>
              </Col>
              <Col md={3} className="text-center mb-3">
                <h5>Net Change</h5>
                <div className={`h2 ${overallSummary.net_change >= 0 ? 'text-success' : 'text-danger'}`}>
                  {overallSummary.net_change}
                </div>
              </Col>
              <Col md={3} className="text-center mb-3">
                <h5>Transactions</h5>
                <div className="h2">{overallSummary.transaction_count}</div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
        
        <Row>
          <Col md={6}>
            <Card className="mb-4">
              <Card.Header>Movement by Product</Card.Header>
              <Card.Body>
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>In</th>
                      <th>Out</th>
                      <th>Net Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productSummary.map((product, index) => (
                      <tr key={index}>
                        <td>
                          {product.product_name}
                          <div className="small text-muted">{product.sku}</div>
                        </td>
                        <td className="text-center text-success">{product.total_in}</td>
                        <td className="text-center text-danger">{product.total_out}</td>
                        <td className={`text-center ${product.net_change >= 0 ? 'text-success' : 'text-danger'}`}>
                          {product.net_change}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Col>
          
          <Col md={6}>
            <Card className="mb-4">
              <Card.Header>Movement by Location</Card.Header>
              <Card.Body>
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Location</th>
                      <th>In</th>
                      <th>Out</th>
                      <th>Net Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locationSummary.map((location, index) => (
                      <tr key={index}>
                        <td>{location.location_name}</td>
                        <td className="text-center text-success">{location.total_in}</td>
                        <td className="text-center text-danger">{location.total_out}</td>
                        <td className={`text-center ${location.net_change >= 0 ? 'text-success' : 'text-danger'}`}>
                          {location.net_change}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Col>
        </Row>
        
        <Card>
          <Card.Header>Movement by Transaction Type</Card.Header>
          <Card.Body>
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>In</th>
                  <th>Out</th>
                  <th>Net Change</th>
                  <th>Transactions</th>
                </tr>
              </thead>
              <tbody>
                {typeSummary.map((type, index) => (
                  <tr key={index}>
                    <td>{type.transaction_type}</td>
                    <td className="text-center text-success">{type.total_in}</td>
                    <td className="text-center text-danger">{type.total_out}</td>
                    <td className={`text-center ${type.net_change >= 0 ? 'text-success' : 'text-danger'}`}>
                      {type.net_change}
                    </td>
                    <td className="text-center">{type.transaction_count}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      </>
    );
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
      <div className="mb-4">
        <h1>REPORTS</h1>
      </div>
      
      {error && <Alert variant="danger">{error}</Alert>}
      
      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-4"
      >
        <Tab eventKey="inventory-status" title="Inventory Status">
          <Card className="mb-4">
            <Card.Header>Filters</Card.Header>
            <Card.Body>
              <Row>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Location</Form.Label>
                    <Form.Select
                      name="locationId"
                      value={statusFilters.locationId}
                      onChange={handleStatusFilterChange}
                    >
                      <option value="">All Locations</option>
                      {locations.map(location => (
                        <option key={location.location_id} value={location.location_id}>
                          {location.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Category</Form.Label>
                    <Form.Select
                      name="categoryId"
                      value={statusFilters.categoryId}
                      onChange={handleStatusFilterChange}
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
                
                <Col md={4} className="d-flex align-items-end">
                  <Form.Group className="mb-3">
                    <Form.Check
                      type="checkbox"
                      label="Show Low Stock Items Only"
                      name="lowStockOnly"
                      checked={statusFilters.lowStockOnly}
                      onChange={handleStatusFilterChange}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Card.Body>
          </Card>
          
          {loading ? (
            <div className="text-center my-5">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            </div>
          ) : (
            renderInventoryStatusReport()
          )}
        </Tab>
        
        <Tab eventKey="inventory-value" title="Inventory Value">
          <Card className="mb-4">
            <Card.Header>Filters</Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Location</Form.Label>
                    <Form.Select
                      name="locationId"
                      value={valueFilters.locationId}
                      onChange={handleValueFilterChange}
                    >
                      <option value="">All Locations</option>
                      {locations.map(location => (
                        <option key={location.location_id} value={location.location_id}>
                          {location.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Category</Form.Label>
                    <Form.Select
                      name="categoryId"
                      value={valueFilters.categoryId}
                      onChange={handleValueFilterChange}
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
              </Row>
            </Card.Body>
          </Card>
          
          {loading ? (
            <div className="text-center my-5">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            </div>
          ) : (
            renderInventoryValueReport()
          )}
        </Tab>
        
        <Tab eventKey="inventory-movement" title="Inventory Movement">
          <Card className="mb-4">
            <Card.Header>Filters</Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Product</Form.Label>
                    <Form.Select
                      name="productId"
                      value={movementFilters.productId}
                      onChange={handleMovementFilterChange}
                    >
                      <option value="">All Products</option>
                      {products.map(product => (
                        <option key={product.product_id} value={product.product_id}>
                          {product.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Location</Form.Label>
                    <Form.Select
                      name="locationId"
                      value={movementFilters.locationId}
                      onChange={handleMovementFilterChange}
                    >
                      <option value="">All Locations</option>
                      {locations.map(location => (
                        <option key={location.location_id} value={location.location_id}>
                          {location.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
              
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Start Date</Form.Label>
                    <Form.Control
                      type="date"
                      name="startDate"
                      value={movementFilters.startDate}
                      onChange={handleMovementFilterChange}
                    />
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>End Date</Form.Label>
                    <Form.Control
                      type="date"
                      name="endDate"
                      value={movementFilters.endDate}
                      onChange={handleMovementFilterChange}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Card.Body>
          </Card>
          
          {loading ? (
            <div className="text-center my-5">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            </div>
          ) : (
            renderInventoryMovementReport()
          )}
        </Tab>
      </Tabs>
    </div>
  );
};

export default Reports;