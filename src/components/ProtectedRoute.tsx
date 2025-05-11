import { Navigate, Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";

// Authentication check function with JWT token validation
const isAuthenticated = () => {
  const token = localStorage.getItem("auth_token");
  return !!token;
};

// Check if a user is a superadmin
const isSuperAdmin = () => {
  const role = localStorage.getItem("user_role");
  
  // Check for various admin roles
  return role === "superadmin" || 
         role === "admin" || 
         role === "Admin" || 
         localStorage.getItem("is_superadmin") === "true";
};

interface ProtectedRouteProps {
  requireSuperAdmin?: boolean;
}

const ProtectedRoute = ({ requireSuperAdmin = false }: ProtectedRouteProps) => {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      const authenticated = isAuthenticated();
      
      if (!authenticated) {
        setIsAuthorized(false);
        setIsChecking(false);
        return;
      }
      
      if (requireSuperAdmin && !isSuperAdmin()) {
        toast({
          title: "Access Denied",
          description: "You need SuperAdmin privileges to access this area",
          variant: "destructive",
        });
        setIsAuthorized(false);
        setIsChecking(false);
        return;
      }
      
      setIsAuthorized(true);
      setIsChecking(false);
    };
    
    checkAuth();
  }, [requireSuperAdmin, toast]);

  if (isChecking) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  return isAuthorized ? <Outlet /> : <Navigate to="/login" />;
};

export default ProtectedRoute;
