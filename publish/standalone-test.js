// Simple standalone test file
const http = require('http');
const fs = require('fs');
const path = require('path');

// Create a log directory if it doesn't exist
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Log startup information
const logFile = path.join(logDir, 'standalone-test.log');
fs.writeFileSync(logFile, `Server started at ${new Date().toString()}\n`);
fs.appendFileSync(logFile, `Node version: ${process.version}\n`);
fs.appendFileSync(logFile, `Working directory: ${process.cwd()}\n`);
fs.appendFileSync(logFile, `Environment: ${JSON.stringify(process.env)}\n`);

// Create HTTP server
const server = http.createServer((req, res) => {
  fs.appendFileSync(logFile, `Request received: ${req.url}\n`);
  
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Standalone Node.js is working! Check logs folder for details.');
});

// Listen on the port specified in environment or default to 3000
const port = process.env.PORT || 3000;
server.listen(port, () => {
  fs.appendFileSync(logFile, `Server listening on port ${port}\n`);
});

console.log(`Server running on port ${port}`); 