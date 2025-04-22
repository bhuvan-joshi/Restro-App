import React, { useState, useContext, useEffect } from 'react';
import { Form, Button, Alert, Card, Container, Row, Col, InputGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [validated, setValidated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, error, user, loading } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    // If user is already logged in, redirect to dashboard
    if (user) {
      navigate('/dashboard');
    }
    
    // Add the login-page class to body for specific styling
    document.body.classList.add('login-page');
    
    // Cleanup function
    return () => {
      document.body.classList.remove('login-page');
    };
  }, [user, navigate]);

  const { username, password } = formData;

  const onChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const onSubmit = async e => {
    e.preventDefault();
    
    const form = e.currentTarget;
    if (form.checkValidity() === false) {
      e.stopPropagation();
      setValidated(true);
      return;
    }
    
    setValidated(true);
    
    const success = await login(username, password);
    if (success) {
      navigate('/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="login-loading">
        <div className="spinner-container">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Logging you in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-fullscreen">
      <Container fluid className="p-0 h-100">
        <Row className="g-0 h-100">
          <Col md={7} lg={8} className="login-banner d-none d-md-flex">
            <div className="login-banner-content">
              <div className="login-banner-overlay">
                <h1>ARPER</h1>
                <p>Inventory Management System</p>
              </div>
            </div>
          </Col>
          <Col md={5} lg={4} className="login-form-container d-flex align-items-center justify-content-center">
            <div className="login-form-wrapper w-100 px-4">
              <div className="text-center mb-4">
                <img 
                  src="/logo.svg" 
                  alt="Arper Logo" 
                  className="login-logo mb-3" 
                  width="80" 
                  height="80"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <h2 className="login-title">ARPER</h2>
                <p className="login-subtitle">Inventory Management</p>
              </div>
              
              <Card className="login-card shadow-lg">
                <Card.Body className="p-4">
                  <h2 className="text-center mb-4 fw-bold">Welcome Back</h2>
                  
                  {error && (
                    <Alert variant="danger" className="animate__animated animate__headShake">
                      <i className="bi bi-exclamation-triangle-fill me-2"></i>
                      {error}
                    </Alert>
                  )}
                  
                  <Form noValidate validated={validated} onSubmit={onSubmit} className="login-form">
                    <Form.Group className="mb-4" controlId="username">
                      <Form.Label className="fw-medium">Username</Form.Label>
                      <InputGroup>
                        <InputGroup.Text className="bg-light border-end-0">
                          <i className="bi bi-person"></i>
                        </InputGroup.Text>
                        <Form.Control
                          type="text"
                          name="username"
                          value={username}
                          onChange={onChange}
                          required
                          placeholder="Enter your username"
                          className="border-start-0 ps-0"
                        />
                        <Form.Control.Feedback type="invalid">
                          Please enter your username.
                        </Form.Control.Feedback>
                      </InputGroup>
                    </Form.Group>

                    <Form.Group className="mb-4" controlId="password">
                      <Form.Label className="fw-medium">Password</Form.Label>
                      <InputGroup>
                        <InputGroup.Text className="bg-light border-end-0">
                          <i className="bi bi-lock"></i>
                        </InputGroup.Text>
                        <Form.Control
                          type={showPassword ? "text" : "password"}
                          name="password"
                          value={password}
                          onChange={onChange}
                          required
                          placeholder="Enter your password"
                          className="border-start-0 border-end-0 ps-0"
                        />
                        <Button 
                          variant="light" 
                          className="border border-start-0" 
                          onClick={togglePasswordVisibility}
                          type="button"
                        >
                          <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                        </Button>
                        <Form.Control.Feedback type="invalid">
                          Please enter your password.
                        </Form.Control.Feedback>
                      </InputGroup>
                    </Form.Group>

                    <div className="d-flex justify-content-between align-items-center mb-4">
                      <Form.Check
                        type="checkbox"
                        id="rememberMe"
                        label="Remember me"
                        className="text-muted"
                      />
                      <a href="#forgot-password" className="text-decoration-none">Forgot password?</a>
                    </div>

                    <Button 
                      variant="primary" 
                      type="submit" 
                      className="w-100 py-2 fw-medium"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Logging in...
                        </>
                      ) : (
                        <>Sign In <i className="bi bi-arrow-right ms-2"></i></>
                      )}
                    </Button>
                  </Form>
                </Card.Body>
              </Card>
              
              <div className="text-center mt-4 text-muted">
                <p>&copy; {new Date().getFullYear()} Arper Inventory Management. All rights reserved.</p>
              </div>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default Login;