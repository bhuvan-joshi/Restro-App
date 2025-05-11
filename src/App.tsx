import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ChatSettings from "./pages/ChatSettings";
import ChatHistory from "./pages/ChatHistory";
import DocumentsManager from "./pages/DocumentsManager";
import NotFound from "./pages/NotFound";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminSettings from "./pages/AdminSettings";
import KnowledgeBase from "./pages/KnowledgeBase";
import AgentTesting from "./pages/AgentTesting";
import Widget from "./pages/Widget";
import TestDocumentUpload from "./services/TestDocumentUpload";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Router>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/widget" element={<Widget />} />
            <Route path="/test-documents" element={<TestDocumentUpload />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/chat-settings" element={<ChatSettings />} />
                <Route path="/chat-history" element={<ChatHistory />} />
                <Route path="/documents" element={<DocumentsManager />} />
                <Route path="/knowledge-base" element={<KnowledgeBase />} />
                <Route path="/agent-testing" element={<AgentTesting />} />
              </Route>
            </Route>
            <Route element={<ProtectedRoute requireSuperAdmin={true} />}>
              <Route element={<Layout />}>
                <Route path="/admin/settings" element={<AdminSettings />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
