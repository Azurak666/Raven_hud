// Simple static server for local testing
const express = require('express');
const path = require('path');

const app = express();
const PORT = 8080;

// Serve the docs/ directory
app.use(express.static(path.join(__dirname, 'docs')));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
