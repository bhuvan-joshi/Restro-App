import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 9016,
    strictPort: true, // This will prevent Vite from trying another port if 9016 is in use
    headers: {
      // Add CORS headers for the widget to work cross-origin
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // Provide fallback values for environment variables
    'import.meta.env.VITE_PAYPAL_CLIENT_ID': JSON.stringify('sb'), // 'sb' is the PayPal sandbox client ID
  },
}));
