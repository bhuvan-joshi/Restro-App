import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { MessageSquare, Settings, History, FileText, LogOut, Menu, X, Database, Bot, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is admin
    const checkAdminStatus = async () => {
      try {
        // First check localStorage
        const userRole = localStorage.getItem("user_role");
        console.log("User role from localStorage:", userRole);
        
        if (userRole === "superadmin" || userRole === "Admin" || userRole === "admin") {
          console.log("Admin status confirmed from localStorage");
          setIsAdmin(true);
          return;
        }
        
        // If not in localStorage, check with API
        const response = await fetch('/api/auth/user-info');
        console.log("API response status:", response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log("User info from API:", data);
          
          const isAdminUser = 
            data.roles?.includes('Admin') || 
            data.roles?.includes('admin') || 
            data.roles?.includes('superadmin') || 
            data.role === "superadmin" || 
            data.role === "Admin" || 
            data.role === "admin";
          
          console.log("Is admin user:", isAdminUser);
          setIsAdmin(isAdminUser);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };

    checkAdminStatus();
  }, []);

  const sidebarItems = [
    {
      title: "Dashboard",
      icon: <MessageSquare className="w-5 h-5 mr-2" />,
      path: "/dashboard",
    },
    {
      title: "Chat Settings",
      icon: <Settings className="w-5 h-5 mr-2" />,
      path: "/chat-settings",
    },
    {
      title: "Chat History",
      icon: <History className="w-5 h-5 mr-2" />,
      path: "/chat-history",
    },
    {
      title: "Documents",
      icon: <FileText className="w-5 h-5 mr-2" />,
      path: "/documents",
    },
    {
      title: "Knowledge Base",
      icon: <Database className="w-5 h-5 mr-2" />,
      path: "/knowledge-base",
    },
    {
      title: "Agent Testing",
      icon: <Bot className="w-5 h-5 mr-2" />,
      path: "/agent-testing",
    },
  ];

  // Admin-only menu items
  const adminItems = [
    {
      title: "System Prompt",
      icon: <Terminal className="w-5 h-5 mr-2" />,
      path: "/admin/settings",
    },
  ];

  const handleLogout = () => {
    // Clear auth token from localStorage
    localStorage.removeItem("auth_token");
    // Navigate to login page
    navigate("/login");
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile sidebar toggle */}
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50"
        >
          {isSidebarOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </Button>
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "w-64 bg-white border-r border-gray-200 p-6 flex flex-col transition-all duration-300 ease-in-out",
          isMobile && !isSidebarOpen && "-translate-x-full",
          isMobile && "fixed inset-y-0 left-0 z-40"
        )}
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-bold">AI Chat Widget</h1>
          </div>
        </div>

        <nav className="flex-1">
          <ul className="space-y-2">
            {sidebarItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center px-4 py-2 rounded-md text-gray-700 hover:bg-gray-100 transition-colors",
                      isActive && "bg-primary/10 text-primary font-medium"
                    )
                  }
                  onClick={() => isMobile && setIsSidebarOpen(false)}
                >
                  {item.icon}
                  {item.title}
                </NavLink>
              </li>
            ))}
            
            {isAdmin && (
              <>
                <li className="pt-4">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Admin Settings
                  </div>
                </li>
                {adminItems.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center px-4 py-2 rounded-md text-gray-700 hover:bg-gray-100 transition-colors",
                          isActive && "bg-primary/10 text-primary font-medium"
                        )
                      }
                      onClick={() => isMobile && setIsSidebarOpen(false)}
                    >
                      {item.icon}
                      {item.title}
                    </NavLink>
                  </li>
                ))}
              </>
            )}
          </ul>
        </nav>

        <Button
          variant="outline"
          className="mt-auto flex items-center"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </aside>

      {/* Main content */}
      <main className={cn(
        "flex-1 p-6",
        isMobile && isSidebarOpen && "ml-64",
      )}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
