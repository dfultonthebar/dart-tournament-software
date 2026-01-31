import { getWsUrl } from '@shared/lib/api-url';
import { WebSocketMessage, WebSocketSubscribeMessage, WebSocketEventType } from '@shared/types';

type EventHandler = (message: WebSocketMessage) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private subscriptions: Set<string> = new Set();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private playerId: string | null = null;
  private intentionalDisconnect = false;

  setPlayerId(id: string | null) {
    if (this.playerId === id) return;
    this.playerId = id;
    // Reconnect with the new player identity after a brief delay
    // to let any in-flight connection close cleanly
    this.disconnect();
    setTimeout(() => {
      this.connect();
      this.startPing();
    }, 100);
  }

  getPlayerId(): string | null {
    return this.playerId;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.intentionalDisconnect = false;

    let url = getWsUrl();
    if (this.playerId) {
      url += `?player_id=${encodeURIComponent(this.playerId)}`;
    }
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected' + (this.playerId ? ` (player: ${this.playerId.slice(0, 8)}...)` : ''));
      this.reconnectAttempts = 0;

      // Resubscribe to topics
      this.subscriptions.forEach((topic) => {
        this.subscribe(topic);
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      if (!this.intentionalDisconnect) {
        this.attemptReconnect();
      }
    };
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

      console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`);

      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  disconnect() {
    this.intentionalDisconnect = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // Prevent onclose from firing attemptReconnect
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
  }

  subscribe(topic: string) {
    this.subscriptions.add(topic);

    if (this.ws?.readyState === WebSocket.OPEN) {
      const message: WebSocketSubscribeMessage = {
        action: 'subscribe',
        topic,
      };
      this.ws.send(JSON.stringify(message));
    }
  }

  unsubscribe(topic: string) {
    this.subscriptions.delete(topic);

    if (this.ws?.readyState === WebSocket.OPEN) {
      const message: WebSocketSubscribeMessage = {
        action: 'unsubscribe',
        topic,
      };
      this.ws.send(JSON.stringify(message));
    }
  }

  on(eventType: string, handler: EventHandler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
  }

  off(eventType: string, handler: EventHandler) {
    this.eventHandlers.get(eventType)?.delete(handler);
  }

  private handleMessage(message: WebSocketMessage) {
    const handlers = this.eventHandlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => handler(message));
    }

    // Also trigger handlers listening to all events
    const allHandlers = this.eventHandlers.get('*');
    if (allHandlers) {
      allHandlers.forEach((handler) => handler(message));
    }
  }

  ping() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message: WebSocketSubscribeMessage = {
        action: 'ping',
        timestamp: Date.now(),
      };
      this.ws.send(JSON.stringify(message));
    }
  }

  startPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    this.pingInterval = setInterval(() => {
      this.ping();
    }, 30000);
  }
}

export const wsClient = new WebSocketClient();

// Auto-connect when module loads (browser only)
if (typeof window !== 'undefined') {
  wsClient.connect();
  wsClient.startPing();
}
