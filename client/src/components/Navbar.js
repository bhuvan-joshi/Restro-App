import React, { useContext, useState } from 'react';
import { Navbar, Nav, NavDropdown, Badge } from 'react-bootstrap';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const AppNavbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);

  // Don't show navbar on login page
  if (location.pathname === '/login') {
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const closeNavbar = () => {
    if (expanded) setExpanded(false);
  };

  return (
    <Navbar 
      bg="white" 
      variant="light" 
      expand="lg" 
      fixed="top" 
      className="arper-navbar"
      expanded={expanded}
      onToggle={setExpanded}
    >
      <div className="navbar-container">
        <Navbar.Brand as={Link} to="/" className="d-flex align-items-center">
          <span className="brand-text">ARPER</span>
          <span className="brand-subtitle">INVENTORY</span>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          {user ? (
            <>
              <Nav className="me-auto">
                <li className="nav-item">
                  <Nav.Link 
                    as={Link} 
                    to="/dashboard" 
                    className={isActive('/dashboard') ? 'active' : ''}
                    onClick={closeNavbar}
                  >
                    <i className="bi bi-speedometer2 me-1"></i> DASHBOARD
                  </Nav.Link>
                </li>
                <li className="nav-item">
                  <Nav.Link 
                    as={Link} 
                    to="/inventory" 
                    className={isActive('/inventory') ? 'active' : ''}
                    onClick={closeNavbar}
                  >
                    <i className="bi bi-box me-1"></i> INVENTORY
                  </Nav.Link>
                </li>
                <li className="nav-item">
                  <Nav.Link 
                    as={Link} 
                    to="/products" 
                    className={isActive('/products') ? 'active' : ''}
                    onClick={closeNavbar}
                  >
                    <i className="bi bi-grid me-1"></i> PRODUCTS
                  </Nav.Link>
                </li>
                <li className="nav-item">
                  <Nav.Link 
                    as={Link} 
                    to="/barcodes" 
                    className={isActive('/barcodes') ? 'active' : ''}
                    onClick={closeNavbar}
                  >
                    <i className="bi bi-upc-scan me-1"></i> BARCODES
                  </Nav.Link>
                </li>
                <li className="nav-item">
                  <Nav.Link 
                    as={Link} 
                    to="/categories" 
                    className={isActive('/categories') ? 'active' : ''}
                    onClick={closeNavbar}
                  >
                    <i className="bi bi-tags me-1"></i> CATEGORIES
                  </Nav.Link>
                </li>
                <li className="nav-item">
                  <Nav.Link 
                    as={Link} 
                    to="/locations" 
                    className={isActive('/locations') ? 'active' : ''}
                    onClick={closeNavbar}
                  >
                    <i className="bi bi-geo-alt me-1"></i> LOCATIONS
                  </Nav.Link>
                </li>
                <li className="nav-item">
                  <Nav.Link 
                    as={Link} 
                    to="/transactions" 
                    className={isActive('/transactions') ? 'active' : ''}
                    onClick={closeNavbar}
                  >
                    <i className="bi bi-arrow-left-right me-1"></i> TRANSACTIONS
                  </Nav.Link>
                </li>
                {(user.role === 'admin' || user.role === 'manager') && (
                  <li className="nav-item">
                    <Nav.Link 
                      as={Link} 
                      to="/reports" 
                      className={isActive('/reports') ? 'active' : ''}
                      onClick={closeNavbar}
                    >
                      <i className="bi bi-bar-chart me-1"></i> REPORTS
                    </Nav.Link>
                  </li>
                )}
                {user.role === 'admin' && (
                  <li className="nav-item">
                    <Nav.Link 
                      as={Link} 
                      to="/users" 
                      className={isActive('/users') ? 'active' : ''}
                      onClick={closeNavbar}
                    >
                      <i className="bi bi-people me-1"></i> USERS
                    </Nav.Link>
                  </li>
                )}
              </Nav>
              <Nav>
                <NavDropdown 
                  title={
                    <div className="d-inline-block">
                      <i className="bi bi-person-circle me-1"></i>
                      <span>{user.username}</span>
                      {user.role === 'admin' && (
                        <Badge bg="dark" className="ms-2 arper-badge">ADMIN</Badge>
                      )}
                      {user.role === 'manager' && (
                        <Badge bg="dark" className="ms-2 arper-badge">MANAGER</Badge>
                      )}
                    </div>
                  } 
                  id="user-dropdown"
                  align="end"
                >
                  <li className="nav-item">
                    <NavDropdown.Item as={Link} to="/profile" onClick={closeNavbar}>
                      <i className="bi bi-person me-2"></i>
                      Profile
                    </NavDropdown.Item>
                  </li>
                  <li className="nav-item">
                    <NavDropdown.Item as={Link} to="/settings" onClick={closeNavbar}>
                      <i className="bi bi-gear me-2"></i>
                      Settings
                    </NavDropdown.Item>
                  </li>
                  <NavDropdown.Divider />
                  <li className="nav-item">
                    <NavDropdown.Item onClick={() => { closeNavbar(); handleLogout(); }}>
                      <i className="bi bi-box-arrow-right me-2"></i>
                      Logout
                    </NavDropdown.Item>
                  </li>
                </NavDropdown>
              </Nav>
            </>
          ) : (
            <Nav className="ms-auto">
              <li className="nav-item">
                <Nav.Link 
                  as={Link} 
                  to="/login" 
                  className="arper-button"
                  onClick={closeNavbar}
                >
                  <i className="bi bi-box-arrow-in-right me-2"></i>
                  LOGIN
                </Nav.Link>
              </li>
            </Nav>
          )}
        </Navbar.Collapse>
      </div>
    </Navbar>
  );
};

export default AppNavbar;