import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import path from 'path';
import { v4 as uuidv4 } from 'uuid'; // Import UUID library

// Create an Express application
const app = express();

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// Create an HTTP server
const server = http.createServer(app);

// Attach WebSocket server to the HTTP server
const wss = new WebSocketServer({ server });

let host: WebSocket | null = null;
const clients: Map<string, WebSocket> = new Map(); // Map to store clients with their IDs

interface ClientMessage {
    type: string;
    message: string;
    data: {
        clientId: string;
        playerName?: string;
        ready?: boolean;
    };
}

// Handle WebSocket connections
wss.on('connection', (ws: WebSocket) => {
    const clientId = uuidv4(); // Generate a unique ID for the client
    clients.set(clientId, ws);
    console.log(`New client connected with ID: ${clientId}`);

    ws.on('message', (message: string) => {
        const parsedMessage = JSON.parse(message);

        switch (parsedMessage.type) {
            case 'register':
                handleRegister(ws, parsedMessage, clientId);
                break;
            case 'message':
                handleMessage(ws, parsedMessage);
                break;
            case 'ready':
                handleReady(ws, parsedMessage);
                break;
            default:
                console.log('Unknown message type:', parsedMessage.type);
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected with ID: ${clientId}`);
        clients.delete(clientId);
        // Notify the host about the disconnection
        if (host && host.readyState === WebSocket.OPEN) {
            const disconnectMessage: ClientMessage = {
                type: 'client_disconnected',
                message: `Client with ID ${clientId} has disconnected`,
                data: { clientId }
            };
            host.send(JSON.stringify(disconnectMessage));
        }
    });
});

// Handle registration messages
function handleRegister(ws: WebSocket, message: {type: 'register' | 'message', role: 'host' | 'client', value: {playerName?: string}}, clientId: string) {
    if (message.role === 'host') {
        host = ws;
        console.log('Host registered');
    } else if (message.role === 'client') {
        console.log('Client registered');
        // Notify the host about the new client
        if (host && host.readyState === WebSocket.OPEN) {
            const registerMessage: ClientMessage = {
                type: 'new_client',
                message: 'A new client has connected',
                data: { ...message.value, clientId, ready: false }
            };
            host.send(JSON.stringify(registerMessage));
        }
    }
}

// Handle regular messages
function handleMessage(ws: WebSocket, message: any) {
    console.log('Received:', message.message);
    // Broadcast the message to all clients
    wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(message.message);
        }
    });
}

// Handle ready messages
function handleReady(ws: WebSocket, message: { type: 'ready', value: { playerName: string } }) {
    console.log('Player ready:', message.value.playerName);
    // Notify the host about the player ready event
    if (host && host.readyState === WebSocket.OPEN) {
        host.send(JSON.stringify({ type: 'player_ready', message: 'A player is ready', data: message.value }));
    }
}

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});