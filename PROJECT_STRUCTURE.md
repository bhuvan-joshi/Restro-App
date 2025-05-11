# Project Structure

This document outlines the organization of the Chatty Widget AI Pal project after consolidation.

## Main Directories

- `/src` - Main React frontend application
  - `/components` - React components
    - `/ui` - UI components using ShadCN
    - `/payments` - Payment-related components (Stripe, PayPal)
    - `/widget` - Chat widget components for embedding
  - `/pages` - Page components for routing
  - `/services` - Services for API communication
  - `/utils` - Utility functions
  - `/hooks` - Custom React hooks
  - `/lib` - Library code and configurations
  - `/types` - TypeScript type definitions

- `/public` - Static assets and widget embed code

- `/ChattyWidgetBackend` - .NET Core backend
  - `/ChattyWidget.API` - API controllers and endpoints
  - `/ChattyWidget.Core` - Business logic
  - `/ChattyWidget.Data` - Data access layer
  - `/ChattyWidget.Models` - Shared models

## Archived Code

- `/_archive` - Previous code that has been refactored or replaced
  - `/backend` - Previous Node.js backend implementation
  - `/frontend` - Previous frontend implementation

## Communication Between Frontend and Backend

The frontend communicates with the .NET backend through the API service defined in `/src/services/api.js`. This service uses Axios to make HTTP requests to the backend endpoints hosted at `http://localhost:5122/api`.

## Widget Embedding

The chat widget can be embedded on external websites using the code in `/public/widget.js`. The widget communicates with the backend through the public API endpoints.

## Build and Development

- Development: `npm run dev` - Starts the frontend development server
- Build: `npm run build` - Builds the frontend for production
- Backend: Run the .NET Core backend from Visual Studio or using `dotnet run` 