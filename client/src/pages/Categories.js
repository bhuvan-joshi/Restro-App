import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Alert, Spinner, Form, Modal } from 'react-bootstrap';
import axios from 'axios';

// Get API URL from environment variable or use default
const API_URL = process.env.REACT_APP_API_URL || '/api';

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [validated, setValidated] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/categories`);
      console.log('Categories response:', res.data);
      setCategories(res.data.categories || []);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError('Failed to load categories. Please try again later.');
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setNewCategory({ name: '', description: '' });
    setValidated(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewCategory({ ...newCategory, [name]: value });
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
      await axios.post(`${API_URL}/categories`, newCategory);
      handleCloseModal();
      fetchCategories();
    } catch (err) {
      console.error('Error creating category:', err);
      setError(err.response?.data?.message || 'Failed to create category');
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
        <h1>CATEGORIES</h1>
        <Button variant="dark" className="arper-button" onClick={() => setShowAddModal(true)}>
          ADD CATEGORY
        </Button>
      </div>
      
      {error && <Alert variant="danger">{error}</Alert>}
      
      <Card>
        <Card.Body>
          {categories.length === 0 ? (
            <p className="text-center">No categories found. Add your first category!</p>
          ) : (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Products</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(category => (
                  <tr key={category.category_id}>
                    <td>{category.name}</td>
                    <td>{category.description || '-'}</td>
                    <td>{category.product_count || 0}</td>
                    <td>
                      <Button variant="outline-primary" size="sm" className="me-2">
                        Edit
                      </Button>
                      <Button variant="outline-danger" size="sm">
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
      
      {/* Add Category Modal */}
      <Modal show={showAddModal} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>Add New Category</Modal.Title>
        </Modal.Header>
        <Form noValidate validated={validated} onSubmit={handleSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                name="name"
                value={newCategory.name}
                onChange={handleInputChange}
                required
                placeholder="Enter category name"
              />
              <Form.Control.Feedback type="invalid">
                Please provide a category name.
              </Form.Control.Feedback>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                name="description"
                value={newCategory.description}
                onChange={handleInputChange}
                placeholder="Enter category description (optional)"
                rows={3}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Category
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Categories;