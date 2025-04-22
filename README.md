# Arper Inventory Management System

A comprehensive inventory management system for Arper, designed to track products, inventory levels, and transactions across multiple locations.

## Features

- **Product Management**: Create, update, and delete products with details like SKU, price, cost, and category
- **Category Management**: Organize products with hierarchical categories
- **Location Management**: Manage multiple warehouses and storage locations
- **Inventory Tracking**: Track inventory levels across locations with min/max quantities
- **Transaction History**: Record all inventory movements with detailed audit trail
- **User Management**: Role-based access control (Admin, Manager, Staff)
- **Reporting**: Generate reports on inventory status, value, and movement

## Technology Stack

- **Backend**: Node.js with Express
- **Database**: SQLite (easy to set up, can be migrated to PostgreSQL/MySQL for production)
- **Authentication**: JWT (JSON Web Tokens)
- **Frontend**: React (to be implemented)

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository
   ```
   git clone https://github.com/arper/inventory-management.git
   cd inventory-management
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Initialize the database with sample data
   ```
   npm run init-db
   ```

4. Start the server
   ```
   npm start
   ```

The server will start on port 5000 by default. You can change this by setting the PORT environment variable.

### Default Admin User

After initializing the database, a default admin user will be created:

- Username: `admin`
- Password: `admin123`

**Important**: Change the default password after first login in a production environment.

## API Endpoints

### Authentication

- `POST /api/users/login` - Login and get JWT token
- `GET /api/users/me` - Get current user info

### Users

- `POST /api/users/register` - Register a new user (Admin only)
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `PUT /api/users/:id/password` - Change user password

### Categories

- `GET /api/categories` - Get all categories
- `GET /api/categories/:id` - Get category by ID
- `POST /api/categories` - Create a new category
- `PUT /api/categories/:id` - Update a category
- `DELETE /api/categories/:id` - Delete a category

### Products

- `GET /api/products` - Get all products with pagination
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create a new product
- `PUT /api/products/:id` - Update a product
- `DELETE /api/products/:id` - Delete a product

### Locations

- `GET /api/locations` - Get all locations
- `GET /api/locations/:id` - Get location by ID
- `POST /api/locations` - Create a new location
- `PUT /api/locations/:id` - Update a location
- `DELETE /api/locations/:id` - Delete a location

### Inventory

- `GET /api/inventory` - Get inventory levels
- `GET /api/inventory/:id` - Get inventory item by ID
- `POST /api/inventory` - Create a new inventory record
- `PUT /api/inventory/:id` - Update inventory settings
- `POST /api/inventory/adjust` - Adjust inventory quantity
- `POST /api/inventory/transfer` - Transfer inventory between locations

### Transactions

- `GET /api/transactions` - Get all transactions
- `GET /api/transactions/:id` - Get transaction by ID
- `GET /api/transactions/summary/daily` - Get daily transaction summary
- `GET /api/transactions/summary/product` - Get product transaction summary
- `GET /api/transactions/summary/user` - Get user transaction summary

### Reports

- `GET /api/reports/inventory/status` - Get inventory status report
- `GET /api/reports/inventory/value` - Get inventory value report
- `GET /api/reports/inventory/movement` - Get inventory movement report
- `GET /api/reports/activity/user` - Get user activity report

## Environment Variables

The application can be configured using the following environment variables:

- `PORT` - Server port (default: 5000)
- `JWT_SECRET` - Secret key for JWT signing (default: 'arper_inventory_secret_key')
- `DB_FILENAME` - SQLite database file path (default: './data/inventory.db')
- `NODE_ENV` - Environment mode ('development' or 'production')

## License

This project is licensed under the MIT License - see the LICENSE file for details. 