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
// make server 0.0.0.0


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
                console.log(`Received message from client ${clientId}:`, parsedMessage);
                handleRegister(ws, parsedMessage, clientId);
                break;
            case 'message':
                console.log(`Received message from client ${clientId}:`, parsedMessage);
                handleMessage(ws, parsedMessage);
                break;
            case 'ready':
                console.log(`Received message from client ${clientId}:`, parsedMessage);
                handleReady(ws, parsedMessage);
                break;
            case 'controls':
                handleControls(ws, parsedMessage);
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
    const clientId = getClientId(ws);
    if (clientId) {
        if (host && host.readyState === WebSocket.OPEN) {
            const readyMessage: ClientMessage = {
                type: 'player_ready',
                message: 'A player is ready',
                data: { clientId, playerName: message.value.playerName, ready: true }
            };
            host.send(JSON.stringify(readyMessage));
        }
    } else {
        console.error('Client ID not found for WebSocket connection');
    }
}

// Helper function to get client ID from WebSocket
function getClientId(ws: WebSocket): string | undefined {
    for (const [clientId, clientWs] of clients.entries()) {
        if (clientWs === ws) {
            return clientId;
        }
    }
    return undefined;
}

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(8080, '0.0.0.0', () => {
    console.log(`Server is listening on http://0.0.0.0:${PORT}`);
});

function handleControls(ws: WebSocket, parsedMessage: any) {
    // send the user controls to the host
    const clientId = getClientId(ws);
    if (clientId) {
      //  if (host && host.readyState === WebSocket.OPEN) {
            const controlsMessage: ClientMessage = {
                type: 'player_controls',
                message: 'Player controls',
                data: { clientId, ...parsedMessage.value }
            };
            host.send(JSON.stringify(controlsMessage));
        }
  //  } else {
    //    console.error('Client ID not found for WebSocket connection');
   // }


}
