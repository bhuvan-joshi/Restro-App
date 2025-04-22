// Simple test file for iisnode
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Node.js is working!');
});

server.listen(process.env.PORT || 8000);
console.log('Test server running'); 