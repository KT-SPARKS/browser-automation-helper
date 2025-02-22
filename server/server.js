// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Database setup
let db;

async function initializeDatabase() {
    db = await open({
        filename: 'elements.db',
        driver: sqlite3.Database
    });

    // Create table if it doesn't exist
    await db.exec(`
        CREATE TABLE IF NOT EXISTS elements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tagName TEXT,
            elementId TEXT,
            className TEXT,
            url TEXT,
            xpath TEXT,
            cssSelector TEXT,
            attributes TEXT,
            elementText TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            fullData TEXT
        )
    `);
}

// Initialize database
initializeDatabase().catch(console.error);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store connected clients
const clients = new Set();
let lastSelectedElement = null;

// Database operations
async function saveElement(elementData) {
    try {
        const result = await db.run(`
            INSERT INTO elements (
                tagName, elementId, className, url, xpath, 
                cssSelector, attributes, elementText, fullData
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            elementData.tagName,
            elementData.id || '',
            elementData.className || '',
            elementData.url || '',
            elementData.xpath || '',
            elementData.cssSelector || '',
            JSON.stringify(elementData.attributes || {}),
            elementData.text || '',
            JSON.stringify(elementData)
        ]);
        return result.lastID;
    } catch (error) {
        console.error('Error saving element:', error);
        return null;
    }
}

async function getRecentElements(limit = 10) {
    try {
        return await db.all(`
            SELECT * FROM elements 
            ORDER BY timestamp DESC 
            LIMIT ?
        `, [limit]);
    } catch (error) {
        console.error('Error getting recent elements:', error);
        return [];
    }
}

// WebSocket connection handling
wss.on('connection', async (ws) => {
    console.log('New client connected');
    clients.add(ws);

    // Send recent elements to new client
    try {
        const recentElements = await getRecentElements();
        ws.send(JSON.stringify({
            type: 'initialHistory',
            data: recentElements
        }));
    } catch (error) {
        console.error('Error sending initial history:', error);
    }

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received message:', data.action);

            if (data.action === 'elementSelected') {
                lastSelectedElement = data.data;
                
                // Save to database
                await saveElement(lastSelectedElement);
                
                // Get updated history
                const recentElements = await getRecentElements();
                
                // Broadcast to all clients
                const broadcastMessage = JSON.stringify({
                    type: 'historyUpdate',
                    data: recentElements
                });

                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(broadcastMessage);
                    }
                });
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
    });
});

// REST endpoints
app.get('/api/history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const elements = await getRecentElements(limit);
        res.json(elements);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

app.post('/api/connect', (req, res) => {
    console.log('Extension connected:', req.body);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});