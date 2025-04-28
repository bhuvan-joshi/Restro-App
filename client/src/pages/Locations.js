import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Alert, Spinner, Modal, Form, Col, Row } from 'react-bootstrap';
import axios from 'axios';

// Get API URL from environment variable or use default
const API_URL = process.env.REACT_APP_API_URL || '/api';

const Locations = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: ''
  });
  const [validated, setValidated] = useState(false);

  // Location types for dropdown
  const locationTypes = [
    'Warehouse',
    'Store',
    'Production',
    'Distribution Center',
    'Supplier',
    'Customer',
    'Other'
  ];

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/locations`);
      console.log('Locations response:', res.data);
      setLocations(res.data.locations || []);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error fetching locations:', err);
      setError('Failed to load locations. Please try again later.');
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: '',
      address: '',
      city: '',
      state: '',
      postalCode: '',
      country: ''
    });
    setValidated(false);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    resetForm();
    setCurrentLocation(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAddLocation = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleEditLocation = (location) => {
    setCurrentLocation(location);
    setFormData({
      name: location.name,
      description: location.description || '',
      type: location.type,
      address: location.address || '',
      city: location.city || '',
      state: location.state || '',
      postalCode: location.postal_code || '',
      country: location.country || ''
    });
    setShowEditModal(true);
  };

  const handleDeleteLocation = (location) => {
    setCurrentLocation(location);
    setShowDeleteModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    
    if (form.checkValidity() === false) {
      e.stopPropagation();
      setValidated(true);
      return;
    }
    
    try {
      if (showAddModal) {
        await axios.post(`${API_URL}/locations`, formData);
      } else if (showEditModal && currentLocation) {
        await axios.put(`${API_URL}/locations/${currentLocation.location_id}`, formData);
      }
      handleCloseModal();
      fetchLocations();
    } catch (err) {
      console.error('Error saving location:', err);
      setError(err.response?.data?.message || 'Failed to save location');
    }
  };

  const confirmDelete = async () => {
    try {
      await axios.delete(`${API_URL}/locations/${currentLocation.location_id}`);
      handleCloseModal();
      fetchLocations();
    } catch (err) {
      console.error('Error deleting location:', err);
      setError(err.response?.data?.message || 'Failed to delete location. It may be in use.');
    }
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
        <h1>LOCATIONS</h1>
        <Button variant="dark" className="arper-button" onClick={handleAddLocation}>
          ADD LOCATION
        </Button>
      </div>
      
      {error && <Alert variant="danger">{error}</Alert>}
      
      <Card>
        <Card.Body>
          {locations.length === 0 ? (
            <p className="text-center">No locations found. Add your first location!</p>
          ) : (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Address</th>
                  <th>Items</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {locations.map(location => (
                  <tr key={location.location_id}>
                    <td>{location.name}</td>
                    <td>{location.type}</td>
                    <td>
                      {location.address ? (
                        <>
                          {location.address}
                          {location.city && `, ${location.city}`}
                          {location.state && `, ${location.state}`}
                          {location.postal_code && ` ${location.postal_code}`}
                          {location.country && `, ${location.country}`}
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{location.total_items || 0} ({location.inventory_count || 0} items)</td>
                    <td>
                      <Button 
                        variant="outline-primary" 
                        size="sm" 
                        className="me-2"
                        onClick={() => handleEditLocation(location)}
                      >
                        Edit
                      </Button>
                      <Button 
                        variant="outline-danger" 
                        size="sm"
                        onClick={() => handleDeleteLocation(location)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
      
      {/* Add/Edit Location Form Modal */}
      <Modal show={showAddModal || showEditModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{showAddModal ? 'Add New Location' : 'Edit Location'}</Modal.Title>
        </Modal.Header>
        <Form noValidate validated={validated} onSubmit={handleSubmit}>
          <Modal.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter location name"
                  />
                  <Form.Control.Feedback type="invalid">
                    Please provide a location name.
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Type</Form.Label>
                  <Form.Select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select type</option>
                    {locationTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">
                    Please select a location type.
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>
            
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter location description (optional)"
                rows={2}
              />
            </Form.Group>
            
            <hr className="my-3" />
            <h6>Address Information (Optional)</h6>
            
            <Form.Group className="mb-3">
              <Form.Label>Address</Form.Label>
              <Form.Control
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Street address"
              />
            </Form.Group>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>City</Form.Label>
                  <Form.Control
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="City"
                  />
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>State/Province</Form.Label>
                  <Form.Control
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    placeholder="State or province"
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Postal Code</Form.Label>
                  <Form.Control
                    type="text"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleInputChange}
                    placeholder="Postal code"
                  />
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Country</Form.Label>
                  <Form.Control
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    placeholder="Country"
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {showAddModal ? 'Save Location' : 'Update Location'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
      
      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {currentLocation && (
            <p>
              Are you sure you want to delete the location "{currentLocation.name}"?
              {currentLocation.inventory_count > 0 && (
                <Alert variant="warning" className="mt-2">
                  This location has {currentLocation.inventory_count} inventory items. 
                  You cannot delete locations with associated inventory.
                </Alert>
              )}
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={confirmDelete}
            disabled={currentLocation && currentLocation.inventory_count > 0}
          >
            Delete Location
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Locations;