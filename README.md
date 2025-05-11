# Chatty Widget AI Pal

<p align="center">
  <img src="./src/assets/chatty-logo.png" alt="Chatty Widget AI Pal Logo" width="200"/>
</p>

## Overview

Chatty Widget AI Pal is an enterprise-grade AI-powered chat widget solution developed by Creatrix Technologies. This system integrates advanced language models with document processing capabilities to provide intelligent, context-aware responses to user queries.

## Key Features

- **Advanced AI Integration**: Seamless integration with DeepSeek and other LLM providers
- **Document Intelligence**: Process and analyze Excel files, PDFs, and other document formats
- **Streaming Responses**: Real-time typewriter-style response rendering
- **Markdown Support**: Rich text formatting with tables, code blocks, and more
- **Customizable Widget**: Easily embed and style the widget for any website
- **Secure Authentication**: Role-based access control system
- **Document Management**: Upload, organize, and process training documents
- **Subscription Management**: Integrated payment processing with Stripe and PayPal

## Architecture

### Frontend
- **React 18** with TypeScript for type-safe component development
- **Vite** for optimized build and development experience
- **Tailwind CSS** with shadcn-ui for consistent, responsive design
- **React Query** for efficient data fetching and state management
- **React Markdown** with remark-gfm for rich content rendering
- **Axios** for streamlined API communication

### Backend
- **.NET 7** Web API with clean architecture principles
- **Entity Framework Core** for database operations
- **SQL Server** for reliable data persistence
- **DeepSeek API Integration** for advanced language processing
- **JWT Authentication** for secure API access

## Getting Started

### Prerequisites
- Node.js 16+ and npm
- .NET 7 SDK
- SQL Server (or SQL Server Express)
- API keys for DeepSeek (optional for AI features)

### Installation

```bash
# Clone the repository
git clone https://github.com/creatrix-technologies/chatty-widget-ai-pal.git

# Navigate to project directory
cd chatty-widget-ai-pal

# Install frontend dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your configuration

# Start frontend development server
npm run dev

# In a separate terminal, start the backend
cd ChattyWidgetBackend
dotnet restore
dotnet run --project ChattyWidget.API
```

The frontend will be available at http://localhost:5173 and the backend API at http://localhost:5122. All API URLs and ports are now configured through environment variables in the `.env` files.

## Widget Integration

Embed the Chatty Widget into any website with a single script tag:

```html
<script 
  src="https://widget.creatrix-tech.com/chatty-widget.js" 
  id="chatty-widget" 
  data-widget-id="YOUR_WIDGET_ID"
  data-theme="light"
  data-position="bottom-right">
</script>
```

### Configuration Options

| Attribute | Description | Default |
|-----------|-------------|--------|
| `data-widget-id` | Your unique widget identifier | *Required* |
| `data-theme` | Widget theme (light/dark/custom) | `"light"` |
| `data-position` | Widget position on page | `"bottom-right"` |
| `data-initial-message` | First message shown to users | `"How can I help you today?"` |
| `data-custom-css` | URL to custom CSS file | `null` |

## Documentation

### API Documentation

API documentation is available at `/swagger` when running the backend server. This provides a comprehensive interface for testing and exploring the available endpoints.

### Configuration

The system can be configured through:

- Frontend: `.env` file for environment variables
- Backend: `appsettings.json` for application settings including:
  - Database connection strings
  - API keys for LLM providers
  - Authentication settings
  - System prompts for AI models

## Deployment

### Frontend Deployment

```bash
# Build the production-ready frontend
npm run build

# The build output will be in the 'dist' directory
# Deploy these files to your web server or CDN
```

### Backend Deployment

```bash
# Publish the .NET application
cd ChattyWidgetBackend
dotnet publish -c Release -o ./publish

# Deploy the published files to your server
```

## Project Structure

The project follows a clean architecture approach:

```
├── src/                  # Frontend React application
│   ├── components/       # Reusable UI components
│   ├── hooks/            # Custom React hooks
│   ├── pages/            # Page components
│   ├── styles/           # CSS and styling
│   └── utils/            # Utility functions
│
├── ChattyWidgetBackend/  # .NET backend
│   ├── ChattyWidget.API/       # API controllers and endpoints
│   ├── ChattyWidget.Core/      # Business logic and services
│   ├── ChattyWidget.Data/      # Data access and repositories
│   └── ChattyWidget.Models/    # Shared data models
```

## License

Copyright © 2025 Creatrix Technologies. All rights reserved.

## Contact

For inquiries about this project, please contact Creatrix Technologies at info@creatrix-tech.com.
