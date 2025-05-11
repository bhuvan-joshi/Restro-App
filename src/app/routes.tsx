import { createBrowserRouter, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Documents from "@/pages/Documents";
import ChatHistory from "@/pages/ChatHistory";
import ChatSettings from "@/pages/ChatSettings";
import KnowledgeBase from "@/pages/KnowledgeBase";
import AgentTesting from "@/pages/AgentTesting";
import AdminSettings from "@/pages/AdminSettings";

// Auth guard for protected routes
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem("auth_token") !== null;
  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Admin guard for admin-only routes
const AdminRoute = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch('/api/auth/user-info');
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.roles?.includes('Admin') || false);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return isAdmin ? children : <Navigate to="/dashboard" />;
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/register",
    element: <Register />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: "dashboard",
        element: <Dashboard />,
      },
      {
        path: "chat-settings",
        element: <ChatSettings />,
      },
      {
        path: "chat-history",
        element: <ChatHistory />,
      },
      {
        path: "documents",
        element: <Documents />,
      },
      {
        path: "knowledge-base",
        element: <KnowledgeBase />,
      },
      {
        path: "agent-testing",
        element: <AgentTesting />,
      },
      {
        path: "admin/settings",
        element: (
          <AdminRoute>
            <AdminSettings />
          </AdminRoute>
        ),
      },
    ],
  },
]);

export default router; 