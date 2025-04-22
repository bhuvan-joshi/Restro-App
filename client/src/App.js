import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Components
import AppNavbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Inventory from './pages/Inventory';
import Locations from './pages/Locations';
import Transactions from './pages/Transactions';
import Reports from './pages/Reports';
import Users from './pages/Users';
import BarcodePrinting from './pages/BarcodePrinting';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-container">
          <AppNavbar />
          <div className="content-wrapper">
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              
              {/* Private Routes */}
              <Route element={<PrivateRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/products" element={<Products />} />
                <Route path="/barcodes" element={<BarcodePrinting />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/locations" element={<Locations />} />
                <Route path="/transactions" element={<Transactions />} />
                
                {/* Admin/Manager Routes */}
                <Route element={<PrivateRoute requiredRole="manager" />}>
                  <Route path="/reports" element={<Reports />} />
                </Route>
                
                {/* Admin Only Routes */}
                <Route element={<PrivateRoute requiredRole="admin" />}>
                  <Route path="/users" element={<Users />} />
                </Route>
              </Route>
              
              {/* Default Route */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
          <ToastContainer 
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;