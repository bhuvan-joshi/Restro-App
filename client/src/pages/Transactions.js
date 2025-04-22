import React, { useState, useEffect, useCallback } from 'react';
import { Container, Table, Card, Alert, Spinner, Form, Button, Row, Col, Badge, InputGroup } from 'react-bootstrap';
import axios from 'axios';
import { format } from 'date-fns';

// Get API URL from environment variable or use default
const API_URL = process.env.REACT_APP_API_URL || '/api';

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalTransactions: 0,
    totalPages: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter states
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [filters, setFilters] = useState({
    productId: '',
    locationId: '',
    transactionType: '',
    startDate: '',
    endDate: ''
  });

  // Transaction types for dropdown - display values
  const transactionTypes = [
    { value: 'receive', label: 'Receive' },
    { value: 'issue', label: 'Issue' },
    { value: 'transfer', label: 'Transfer' },
    { value: 'adjust', label: 'Adjustment' },
    { value: 'count', label: 'Count' }
  ];

  // Memoize fetchData to avoid recreation on each render
  const fetchData = useCallback(async (pageNumber = pagination.page) => {
    try {
      setLoading(true);
      
      // Fetch metadata (products and locations) for filters if not loaded
      if (products.length === 0) {
        const productsRes = await axios.get(`${API_URL}/products`);
        setProducts(productsRes.data.products || []);
      }
      
      if (locations.length === 0) {
        const locationsRes = await axios.get(`${API_URL}/locations`);
        setLocations(locationsRes.data.locations || []);
      }
      
      // Build query parameters
      const params = {
        page: pageNumber,
        limit: pagination.limit,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        )
      };
      
      console.log(`Fetching transactions for page ${pageNumber}`);
      
      // Get token for authentication
      const token = localStorage.getItem('token');
      
      // Fetch transactions with filters
      const res = await axios.get(`${API_URL}/transactions`, { 
        params,
        headers: {
          'x-auth-token': token
        }
      });
      
      console.log('Transactions response:', res.data);
      
      setTransactions(res.data.transactions || []);
      setPagination({
        page: pageNumber,
        limit: pagination.limit,
        totalTransactions: res.data.pagination.totalTransactions,
        totalPages: res.data.pagination.totalPages
      });
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to load transactions. Please try again later.');
      setLoading(false);
    }
  }, [filters, pagination.limit, products.length, locations.length]);

  // Initial data fetch
  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= pagination.totalPages) {
      console.log(`Changing to page ${newPage}`);
      fetchData(newPage);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
  };

  const handleResetFilters = () => {
    setFilters({
      productId: '',
      locationId: '',
      transactionType: '',
      startDate: '',
      endDate: ''
    });
    fetchData(1);
  };

  const handleApplyFilters = (e) => {
    e.preventDefault();
    fetchData(1);
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
      <nav aria-label="Transaction pagination">
        <ul className="pagination justify-content-center">
          {pages}
        </ul>
      </nav>
    );
  };

  const getTransactionTypeBadge = (type) => {
    let variant = 'secondary';
    let displayType = type;
    
    // Convert database value to display value
    switch(type) {
      case 'receive':
        variant = 'success';
        displayType = 'Receive';
        break;
      case 'issue':
        variant = 'danger';
        displayType = 'Issue';
        break;
      case 'transfer':
        variant = 'info';
        displayType = 'Transfer';
        break;
      case 'adjust':
        variant = 'dark';
        displayType = 'Adjustment';
        break;
      case 'count':
        variant = 'primary';
        displayType = 'Count';
        break;
      default:
        variant = 'secondary';
    }
    
    return <Badge bg={variant}>{displayType}</Badge>;
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (err) {
      return dateString;
    }
  };

  if (loading && transactions.length === 0) {
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
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>TRANSACTIONS</h1>
        <div>
          <Button variant="dark" className="arper-button me-2">
            RECEIVE STOCK
          </Button>
          <Button variant="dark" className="arper-button">
            TRANSFER STOCK
          </Button>
        </div>
      </div>
      
      {error && <Alert variant="danger">{error}</Alert>}
      
      {/* Filters */}
      <Card className="mb-4">
        <Card.Header>Filters</Card.Header>
        <Card.Body>
          <Form onSubmit={handleApplyFilters}>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Product</Form.Label>
                  <Form.Select
                    name="productId"
                    value={filters.productId}
                    onChange={handleFilterChange}
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
              
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Location</Form.Label>
                  <Form.Select
                    name="locationId"
                    value={filters.locationId}
                    onChange={handleFilterChange}
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
                  <Form.Label>Transaction Type</Form.Label>
                  <Form.Select
                    name="transactionType"
                    value={filters.transactionType}
                    onChange={handleFilterChange}
                  >
                    <option value="">All Types</option>
                    {transactionTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Start Date</Form.Label>
                  <Form.Control
                    type="date"
                    name="startDate"
                    value={filters.startDate}
                    onChange={handleFilterChange}
                  />
                </Form.Group>
              </Col>
              
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>End Date</Form.Label>
                  <Form.Control
                    type="date"
                    name="endDate"
                    value={filters.endDate}
                    onChange={handleFilterChange}
                  />
                </Form.Group>
              </Col>
              
              <Col md={4} className="d-flex align-items-end">
                <Button 
                  variant="primary" 
                  type="submit"
                  className="mb-3 me-2 w-50 arper-button"
                >
                  Apply Filters
                </Button>
                <Button 
                  variant="secondary" 
                  className="mb-3 w-50 arper-button"
                  onClick={handleResetFilters}
                >
                  Reset Filters
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>
      
      {/* Transactions Table */}
      <Card>
        <Card.Body>
          {loading && (
            <div className="text-center my-3">
              <Spinner animation="border" size="sm" role="status" />
              <span className="ms-2">Loading...</span>
            </div>
          )}
          
          {!loading && transactions.length === 0 ? (
            <p className="text-center">No transactions found matching your criteria.</p>
          ) : (
            <>
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th>Location</th>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Created By</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(transaction => (
                    <tr key={transaction.transaction_id}>
                      <td>{formatDate(transaction.created_at)}</td>
                      <td>
                        {transaction.product_name || 'Unknown Product'}
                        <div className="small text-muted">{transaction.sku || 'No SKU'}</div>
                      </td>
                      <td>{transaction.location_name || 'Unknown Location'}</td>
                      <td>{getTransactionTypeBadge(transaction.transaction_type)}</td>
                      <td className={transaction.quantity > 0 ? 'text-success' : 'text-danger'}>
                        {transaction.quantity > 0 ? '+' : ''}{transaction.quantity}
                      </td>
                      <td>{transaction.previous_quantity !== null ? transaction.previous_quantity : 'N/A'}</td>
                      <td>{transaction.new_quantity !== null ? transaction.new_quantity : 'N/A'}</td>
                      <td>{transaction.created_by_username}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              
              {/* Pagination */}
              <div className="d-flex justify-content-between align-items-center mt-3">
                <div>
                  Showing {transactions.length} of {pagination.totalTransactions} transactions (Page {pagination.page} of {pagination.totalPages})
                </div>
                <div>
                  {pagination.totalPages > 1 && renderPagination()}
                </div>
              </div>
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default Transactions;