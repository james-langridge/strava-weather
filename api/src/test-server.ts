import express from 'express';

const app = express();
const PORT = 3001;

// Minimal middleware
app.use(express.json());

// Simple test route
app.get('/', (req, res) => {
    res.json({
        message: 'Minimal server working!',
        timestamp: new Date().toISOString()
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Test server running on http://localhost:${PORT}`);
    console.log(`🔍 Test: curl http://localhost:${PORT}/api/health`);
});

export default app;