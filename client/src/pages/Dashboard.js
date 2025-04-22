import React, { useState, useEffect, useContext } from 'react';
import { Row, Col, Card, Table, Alert } from 'react-bootstrap';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

// Get API URL from environment variable or use default
const API_URL = process.env.REACT_APP_API_URL || '/api';

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalLocations: 0,
    lowStockItems: 0,
    recentTransactions: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch products count
        const productsRes = await axios.get(`${API_URL}/products`);
        console.log('Products response:', productsRes.data);
        
        // Fetch locations
        const locationsRes = await axios.get(`${API_URL}/locations`);
        console.log('Locations response:', locationsRes.data);
        
        // Fetch low stock items
        let lowStockItems = 0;
        try {
          const lowStockRes = await axios.get(`${API_URL}/inventory?lowStock=true`);
          console.log('Low stock response:', lowStockRes.data);
          if (lowStockRes.data && lowStockRes.data.items) {
            lowStockItems = lowStockRes.data.items.length;
          }
        } catch (err) {
          console.error('Error fetching low stock items:', err);
          // Continue with other data
        }
        
        // Fetch recent transactions
        let recentTransactions = [];
        try {
          const transactionsRes = await axios.get(`${API_URL}/transactions?limit=5`);
          console.log('Transactions response:', transactionsRes.data);
          if (transactionsRes.data && transactionsRes.data.transactions) {
            recentTransactions = transactionsRes.data.transactions;
          }
        } catch (err) {
          console.error('Error fetching recent transactions:', err);
          // Continue with other data
        }
        
        setStats({
          totalProducts: productsRes.data.pagination?.totalProducts || productsRes.data.totalProducts || 0,
          totalLocations: locationsRes.data.locations?.length || 0,
          lowStockItems: lowStockItems,
          recentTransactions: recentTransactions
        });
        
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again later.');
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="fullscreen-page d-flex align-items-center justify-content-center">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fullscreen-page">
      <div className="dashboard-header">
        <h1>DASHBOARD</h1>
        <p className="welcome-message">Welcome back, {user?.firstName || user?.username}</p>
        {error && <Alert variant="danger">{error}</Alert>}
      </div>
      
      <Row className="dashboard-stats g-4">
        <Col md={4}>
          <Card className="stat-card">
            <Card.Body>
              <div className="stat-icon">
                <i className="bi bi-box-seam"></i>
              </div>
              <div className="stat-value">{stats.totalProducts}</div>
              <div className="stat-title">TOTAL PRODUCTS</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="stat-card">
            <Card.Body>
              <div className="stat-icon">
                <i className="bi bi-geo-alt"></i>
              </div>
              <div className="stat-value">{stats.totalLocations}</div>
              <div className="stat-title">LOCATIONS</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="stat-card">
            <Card.Body>
              <div className="stat-icon">
                <i className="bi bi-exclamation-triangle"></i>
              </div>
              <div className="stat-value">{stats.lowStockItems}</div>
              <div className="stat-title">LOW STOCK ITEMS</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      <Row className="mt-5">
        <Col>
          <Card className="recent-activity">
            <Card.Header>RECENT TRANSACTIONS</Card.Header>
            <Card.Body>
              {stats.recentTransactions.length > 0 ? (
                <Table responsive hover>
                  <thead>
                    <tr>
                      <th>DATE</th>
                      <th>PRODUCT</th>
                      <th>LOCATION</th>
                      <th>TYPE</th>
                      <th>QUANTITY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentTransactions.map(transaction => (
                      <tr key={transaction.transaction_id}>
                        <td>{new Date(transaction.created_at).toLocaleDateString()}</td>
                        <td>{transaction.product_name}</td>
                        <td>{transaction.location_name}</td>
                        <td>{transaction.transaction_type}</td>
                        <td className={transaction.quantity > 0 ? 'text-success' : 'text-danger'}>
                          {transaction.quantity > 0 ? '+' : ''}{transaction.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <p className="text-center">No recent transactions found.</p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;