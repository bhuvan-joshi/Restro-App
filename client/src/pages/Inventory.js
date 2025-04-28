import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Alert, Spinner, Form, InputGroup, Row, Col, Modal, Badge } from 'react-bootstrap';
import axios from 'axios';
import ProductImage from '../components/ProductImage';
import { toast } from 'react-toastify';

// Get API URL from environment variable or use default
const API_URL = process.env.REACT_APP_API_URL || '/api';

const Inventory = () => {
  const [inventoryItems, setInventoryItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 1
  });

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  
  // Reason options for different actions
  const [receiveReasons, setReceiveReasons] = useState([
    "Purchase", 
    "Return", 
    "Transfer", 
    "Other"
  ]);
  const [issueReasons, setIssueReasons] = useState([
    "Sale", 
    "Damage/Loss", 
    "Transfer", 
    "Other"
  ]);
  const [adjustReasons, setAdjustReasons] = useState([
    "Inventory Count", 
    "Correction", 
    "Damage/Loss", 
    "Other"
  ]);
  
  // Custom reason state
  const [customReason, setCustomReason] = useState('');
  const [showCustomReason, setShowCustomReason] = useState(false);
  const [savingReason, setSavingReason] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch locations
        const locationsRes = await axios.get(`${API_URL}/locations`);
        setLocations(locationsRes.data.locations || []);
        
        // Fetch inventory
        await fetchInventory();
        
        // Fetch reasons
        await fetchReasons();
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again later.');
        setLoading(false);
      }
    };
    
    fetchData();
  });

  const fetchReasons = async () => {
    try {
      // Fetch receive reasons
      const receiveRes = await axios.get(`${API_URL}/reasons?type=receive`);
      if (receiveRes.data.reasons && receiveRes.data.reasons.length > 0) {
        setReceiveReasons(receiveRes.data.reasons.map(r => r.reason));
      }
      
      // Fetch issue reasons
      const issueRes = await axios.get(`${API_URL}/reasons?type=issue`);
      if (issueRes.data.reasons && issueRes.data.reasons.length > 0) {
        setIssueReasons(issueRes.data.reasons.map(r => r.reason));
      }
      
      // Fetch adjust reasons
      const adjustRes = await axios.get(`${API_URL}/reasons?type=adjust`);
      if (adjustRes.data.reasons && adjustRes.data.reasons.length > 0) {
        setAdjustReasons(adjustRes.data.reasons.map(r => r.reason));
      }
    } catch (err) {
      console.error('Error fetching reasons:', err);
      // Don't show an error to the user, just use default reasons
    }
  };

  const fetchInventory = async (page = 1) => {
    try {
      const params = {
        page,
        limit: pagination.limit,
        search: search || undefined,
        location: selectedLocation || undefined,
        lowStock: lowStockOnly || undefined
      };
      
      const res = await axios.get(`${API_URL}/inventory`, { params });
      console.log('Inventory response:', res.data);
      
      setInventoryItems(res.data.items || []);
      setPagination({
        page: res.data.pagination.page,
        limit: res.data.pagination.limit,
        totalItems: res.data.pagination.totalItems,
        totalPages: res.data.pagination.totalPages
      });
      
      setError(null);
    } catch (err) {
      console.error('Error fetching inventory:', err);
      setError('Failed to load inventory data. Please try again later.');
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchInventory(1); // Reset to first page when searching
  };

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= pagination.totalPages) {
      fetchInventory(newPage);
    }
  };

  const getStockStatusBadge = (status) => {
    switch (status) {
      case 'Low':
        return <Badge bg="danger">Low Stock</Badge>;
      case 'Overstocked':
        return <Badge bg="warning">Overstocked</Badge>;
      default:
        return <Badge bg="success">In Stock</Badge>;
    }
  };

  // Reset form fields when opening modals
  const resetFormFields = () => {
    setQuantity(1);
    setReason('');
    setNotes('');
    setCustomReason('');
    setShowCustomReason(false);
  };

  // Open Add Inventory modal
  const handleAddInventory = () => {
    resetFormFields();
    setShowAddModal(true);
  };

  // Open Receive modal for an item
  const handleReceiveClick = (item) => {
    setSelectedItem(item);
    resetFormFields();
    setShowReceiveModal(true);
  };

  // Open Issue modal for an item
  const handleIssueClick = (item) => {
    setSelectedItem(item);
    resetFormFields();
    setShowIssueModal(true);
  };

  // Open Adjust modal for an item
  const handleAdjustClick = (item) => {
    setSelectedItem(item);
    resetFormFields();
    setQuantity(item.quantity); // Set current quantity as default
    setShowAdjustModal(true);
  };

  // Handle Add Inventory submission
  const handleAddInventorySubmit = async () => {
    try {
      setActionLoading(true);
      
      // Add inventory logic will be implemented here
      // This would typically involve selecting a product and location, and setting initial quantity
      
      toast.success('Inventory added successfully');
      setShowAddModal(false);
      fetchInventory(pagination.page); // Refresh inventory data
    } catch (err) {
      console.error('Error adding inventory:', err);
      toast.error('Failed to add inventory. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Receive Inventory submission
  const handleReceiveSubmit = async () => {
    if (!selectedItem || quantity <= 0) return;
    
    try {
      setActionLoading(true);
      
      await axios.post(`${API_URL}/inventory/receive`, {
        inventory_id: selectedItem.inventory_id,
        quantity: quantity,
        reason: reason,
        notes: notes
      });
      
      toast.success(`Received ${quantity} units of ${selectedItem.product_name}`);
      setShowReceiveModal(false);
      fetchInventory(pagination.page); // Refresh inventory data
    } catch (err) {
      console.error('Error receiving inventory:', err);
      toast.error('Failed to receive inventory. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Issue Inventory submission
  const handleIssueSubmit = async () => {
    if (!selectedItem || quantity <= 0 || quantity > selectedItem.quantity) return;
    
    try {
      setActionLoading(true);
      
      await axios.post(`${API_URL}/inventory/issue`, {
        inventory_id: selectedItem.inventory_id,
        quantity: quantity,
        reason: reason,
        notes: notes
      });
      
      toast.success(`Issued ${quantity} units of ${selectedItem.product_name}`);
      setShowIssueModal(false);
      fetchInventory(pagination.page); // Refresh inventory data
    } catch (err) {
      console.error('Error issuing inventory:', err);
      toast.error('Failed to issue inventory. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Adjust Inventory submission
  const handleAdjustSubmit = async () => {
    if (!selectedItem || quantity < 0) return;
    
    try {
      setActionLoading(true);
      
      await axios.post(`${API_URL}/inventory/adjust`, {
        inventory_id: selectedItem.inventory_id,
        quantity: quantity,
        reason: reason,
        notes: notes
      });
      
      toast.success(`Adjusted ${selectedItem.product_name} quantity to ${quantity}`);
      setShowAdjustModal(false);
      fetchInventory(pagination.page); // Refresh inventory data
    } catch (err) {
      console.error('Error adjusting inventory:', err);
      toast.error('Failed to adjust inventory. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Add a new custom reason to the appropriate list
  const addCustomReason = async (type) => {
    if (!customReason.trim()) return;
    
    setSavingReason(true);
    
    try {
      // Save the reason to the database
      await axios.post(`${API_URL}/reasons`, {
        reason: customReason,
        type
      });
      
      // Update the appropriate reason list
      switch(type) {
        case 'receive':
          if (!receiveReasons.includes(customReason)) {
            setReceiveReasons([...receiveReasons, customReason]);
          }
          break;
        case 'issue':
          if (!issueReasons.includes(customReason)) {
            setIssueReasons([...issueReasons, customReason]);
          }
          break;
        case 'adjust':
          if (!adjustReasons.includes(customReason)) {
            setAdjustReasons([...adjustReasons, customReason]);
          }
          break;
        default:
          break;
      }
      
      // Set the current reason to the new custom reason
      setReason(customReason);
      
      // Reset the custom reason input
      setCustomReason('');
      setShowCustomReason(false);
      
      // Show success toast
      toast.success('Custom reason added successfully');
    } catch (err) {
      console.error('Error saving custom reason:', err);
      toast.error('Failed to save custom reason');
    } finally {
      setSavingReason(false);
    }
  };

  // Reset modal states when closing
  const resetModalStates = () => {
    setQuantity(1);
    setReason('');
    setNotes('');
    setCustomReason('');
    setShowCustomReason(false);
  };
  
  const handleCloseReceiveModal = () => {
    setShowReceiveModal(false);
    resetModalStates();
  };
  
  const handleCloseIssueModal = () => {
    setShowIssueModal(false);
    resetModalStates();
  };
  
  const handleCloseAdjustModal = () => {
    setShowAdjustModal(false);
    resetModalStates();
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
      <nav aria-label="Inventory pagination">
        <ul className="pagination justify-content-center">
          {pages}
        </ul>
      </nav>
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
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>INVENTORY</h1>
        <Button 
          variant="dark" 
          className="arper-button"
          onClick={handleAddInventory}
        >
          ADD INVENTORY
        </Button>
      </div>
      
      {error && <Alert variant="danger">{error}</Alert>}
      
      <Card className="mb-4">
        <Card.Body>
          <Form onSubmit={handleSearch}>
            <Row>
              <Col md={5}>
                <Form.Group className="mb-3">
                  <Form.Control
                    type="text"
                    placeholder="Search product name or SKU"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Select 
                    value={selectedLocation} 
                    onChange={(e) => setSelectedLocation(e.target.value)}
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
              <Col md={2}>
                <Form.Group className="mb-3">
                  <Form.Check 
                    type="switch"
                    id="low-stock-switch"
                    label="Low Stock Only"
                    checked={lowStockOnly}
                    onChange={(e) => setLowStockOnly(e.target.checked)}
                  />
                </Form.Group>
              </Col>
              <Col md={2} className="d-flex align-items-end">
                <Button variant="primary" type="submit" className="w-100">
                  Apply Filters
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>
      
      <Card>
        <Card.Body>
          {inventoryItems.length === 0 ? (
            <p className="text-center">No inventory items found.</p>
          ) : (
            <>
              <div className="table-responsive">
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Location</th>
                      <th>Quantity</th>
                      <th>Min Qty</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryItems.map(item => (
                      <tr key={item.inventory_id}>
                        <td className="text-center" style={{ width: '80px' }}>
                          <ProductImage 
                            src={item.image_path} 
                            alt={item.product_name}
                            style={{ width: '60px', height: '60px' }} 
                            className="img-thumbnail"
                          />
                        </td>
                        <td>{item.product_name}</td>
                        <td>{item.sku}</td>
                        <td>{item.location_name}</td>
                        <td>{item.quantity}</td>
                        <td>{item.min_quantity}</td>
                        <td>{getStockStatusBadge(item.stock_status)}</td>
                        <td>
                          <Button 
                            variant="outline-success" 
                            size="sm" 
                            className="me-1"
                            onClick={() => handleReceiveClick(item)}
                          >
                            Receive
                          </Button>
                          <Button 
                            variant="outline-warning" 
                            size="sm" 
                            className="me-1"
                            onClick={() => handleIssueClick(item)}
                            disabled={item.quantity <= 0}
                          >
                            Issue
                          </Button>
                          <Button 
                            variant="outline-primary" 
                            size="sm"
                            onClick={() => handleAdjustClick(item)}
                          >
                            Adjust
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              
              <div className="d-flex justify-content-between align-items-center mt-3">
                <div>
                  Showing {inventoryItems.length} of {pagination.totalItems} inventory items
                </div>
                {pagination.totalPages > 1 && renderPagination()}
              </div>
            </>
          )}
        </Card.Body>
      </Card>

      {/* Add Inventory Modal */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Add Inventory</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Product</Form.Label>
              <Form.Select>
                <option value="">Select Product</option>
                {/* Product options would be populated here */}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Location</Form.Label>
              <Form.Select>
                <option value="">Select Location</option>
                {locations.map(location => (
                  <option key={location.location_id} value={location.location_id}>
                    {location.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Initial Quantity</Form.Label>
              <Form.Control 
                type="number" 
                min="0" 
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Notes</Form.Label>
              <Form.Control 
                as="textarea" 
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional information"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleAddInventorySubmit}
            disabled={actionLoading}
          >
            {actionLoading ? 'Processing...' : 'Add Inventory'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Receive Inventory Modal */}
      <Modal show={showReceiveModal} onHide={handleCloseReceiveModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Receive Inventory</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedItem && (
            <Form>
              <div className="mb-3 d-flex align-items-center">
                <ProductImage 
                  src={selectedItem.image_path} 
                  alt={selectedItem.product_name}
                  style={{ width: '60px', height: '60px' }} 
                  className="img-thumbnail me-3"
                />
                <div>
                  <h5 className="mb-0">{selectedItem.product_name}</h5>
                  <small className="text-muted">SKU: {selectedItem.sku}</small>
                  <div>Location: {selectedItem.location_name}</div>
                  <div>Current Quantity: {selectedItem.quantity}</div>
                </div>
              </div>
              <Form.Group className="mb-3">
                <Form.Label>Quantity to Receive</Form.Label>
                <Form.Control 
                  type="number" 
                  min="1" 
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Reason</Form.Label>
                {!showCustomReason ? (
                  <>
                    <Form.Select 
                      value={reason}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          setShowCustomReason(true);
                          setReason('');
                        } else {
                          setReason(e.target.value);
                        }
                      }}
                    >
                      <option value="">Select Reason</option>
                      {receiveReasons.map((r, index) => (
                        <option key={index} value={r}>{r}</option>
                      ))}
                      <option value="custom">+ Add Custom Reason</option>
                    </Form.Select>
                  </>
                ) : (
                  <InputGroup>
                    <Form.Control
                      type="text"
                      placeholder="Enter custom reason"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                    />
                    <Button 
                      variant="outline-secondary"
                      onClick={() => addCustomReason('receive')}
                      disabled={savingReason || !customReason.trim()}
                    >
                      {savingReason ? (
                        <>
                          <Spinner
                            as="span"
                            animation="border"
                            size="sm"
                            role="status"
                            aria-hidden="true"
                            className="me-1"
                          />
                          Saving...
                        </>
                      ) : 'Add'}
                    </Button>
                    <Button 
                      variant="outline-secondary"
                      onClick={() => setShowCustomReason(false)}
                      disabled={savingReason}
                    >
                      Cancel
                    </Button>
                  </InputGroup>
                )}
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Notes</Form.Label>
                <Form.Control 
                  as="textarea" 
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional information"
                />
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseReceiveModal}>
            Cancel
          </Button>
          <Button 
            variant="success" 
            onClick={handleReceiveSubmit}
            disabled={actionLoading || !quantity || quantity <= 0 || !reason}
          >
            {actionLoading ? 'Processing...' : 'Receive Inventory'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Issue Inventory Modal */}
      <Modal show={showIssueModal} onHide={handleCloseIssueModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Issue Inventory</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedItem && (
            <Form>
              <div className="mb-3 d-flex align-items-center">
                <ProductImage 
                  src={selectedItem.image_path} 
                  alt={selectedItem.product_name}
                  style={{ width: '60px', height: '60px' }} 
                  className="img-thumbnail me-3"
                />
                <div>
                  <h5 className="mb-0">{selectedItem.product_name}</h5>
                  <small className="text-muted">SKU: {selectedItem.sku}</small>
                  <div>Location: {selectedItem.location_name}</div>
                  <div>Current Quantity: {selectedItem.quantity}</div>
                </div>
              </div>
              <Form.Group className="mb-3">
                <Form.Label>Quantity to Issue</Form.Label>
                <Form.Control 
                  type="number" 
                  min="1" 
                  max={selectedItem.quantity}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                />
                {quantity > selectedItem.quantity && (
                  <Form.Text className="text-danger">
                    Cannot issue more than available quantity
                  </Form.Text>
                )}
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Reason</Form.Label>
                {!showCustomReason ? (
                  <>
                    <Form.Select 
                      value={reason}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          setShowCustomReason(true);
                          setReason('');
                        } else {
                          setReason(e.target.value);
                        }
                      }}
                    >
                      <option value="">Select Reason</option>
                      {issueReasons.map((r, index) => (
                        <option key={index} value={r}>{r}</option>
                      ))}
                      <option value="custom">+ Add Custom Reason</option>
                    </Form.Select>
                  </>
                ) : (
                  <InputGroup>
                    <Form.Control
                      type="text"
                      placeholder="Enter custom reason"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                    />
                    <Button 
                      variant="outline-secondary"
                      onClick={() => addCustomReason('issue')}
                      disabled={savingReason || !customReason.trim()}
                    >
                      {savingReason ? (
                        <>
                          <Spinner
                            as="span"
                            animation="border"
                            size="sm"
                            role="status"
                            aria-hidden="true"
                            className="me-1"
                          />
                          Saving...
                        </>
                      ) : 'Add'}
                    </Button>
                    <Button 
                      variant="outline-secondary"
                      onClick={() => setShowCustomReason(false)}
                      disabled={savingReason}
                    >
                      Cancel
                    </Button>
                  </InputGroup>
                )}
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Notes</Form.Label>
                <Form.Control 
                  as="textarea" 
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional information"
                />
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseIssueModal}>
            Cancel
          </Button>
          <Button 
            variant="warning" 
            onClick={handleIssueSubmit}
            disabled={actionLoading || !quantity || quantity <= 0 || quantity > (selectedItem?.quantity || 0) || !reason}
          >
            {actionLoading ? 'Processing...' : 'Issue Inventory'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Adjust Inventory Modal */}
      <Modal show={showAdjustModal} onHide={handleCloseAdjustModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Adjust Inventory</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedItem && (
            <Form>
              <div className="mb-3 d-flex align-items-center">
                <ProductImage 
                  src={selectedItem.image_path} 
                  alt={selectedItem.product_name}
                  style={{ width: '60px', height: '60px' }} 
                  className="img-thumbnail me-3"
                />
                <div>
                  <h5 className="mb-0">{selectedItem.product_name}</h5>
                  <small className="text-muted">SKU: {selectedItem.sku}</small>
                  <div>Location: {selectedItem.location_name}</div>
                  <div>Current Quantity: {selectedItem.quantity}</div>
                </div>
              </div>
              <Form.Group className="mb-3">
                <Form.Label>New Quantity</Form.Label>
                <Form.Control 
                  type="number" 
                  min="0" 
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Reason</Form.Label>
                {!showCustomReason ? (
                  <>
                    <Form.Select 
                      value={reason}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          setShowCustomReason(true);
                          setReason('');
                        } else {
                          setReason(e.target.value);
                        }
                      }}
                    >
                      <option value="">Select Reason</option>
                      {adjustReasons.map((r, index) => (
                        <option key={index} value={r}>{r}</option>
                      ))}
                      <option value="custom">+ Add Custom Reason</option>
                    </Form.Select>
                  </>
                ) : (
                  <InputGroup>
                    <Form.Control
                      type="text"
                      placeholder="Enter custom reason"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                    />
                    <Button 
                      variant="outline-secondary"
                      onClick={() => addCustomReason('adjust')}
                      disabled={savingReason || !customReason.trim()}
                    >
                      {savingReason ? (
                        <>
                          <Spinner
                            as="span"
                            animation="border"
                            size="sm"
                            role="status"
                            aria-hidden="true"
                            className="me-1"
                          />
                          Saving...
                        </>
                      ) : 'Add'}
                    </Button>
                    <Button 
                      variant="outline-secondary"
                      onClick={() => setShowCustomReason(false)}
                      disabled={savingReason}
                    >
                      Cancel
                    </Button>
                  </InputGroup>
                )}
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Notes</Form.Label>
                <Form.Control 
                  as="textarea" 
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional information"
                />
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseAdjustModal}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleAdjustSubmit}
            disabled={actionLoading || quantity < 0 || !reason}
          >
            {actionLoading ? 'Processing...' : 'Adjust Inventory'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Inventory;