package websocket

import (
	"encoding/json"
	"log"
	"sync"
)

type Message struct {
	Type     string `json:"type"`     // "chat", "cursor", "status"
	StreamID string `json:"streamId"` // Room identifier
	Sender   string `json:"sender"`   // User name or ID
	Content  string `json:"content"`  // Text or payload
}

type Hub struct {
	clients    map[*Client]bool
	rooms      map[string]map[*Client]bool // StreamID -> clients
	broadcast  chan Message
	register   chan *Client
	unregister chan *Client
	mu         sync.Mutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		rooms:      make(map[string]map[*Client]bool),
		broadcast:  make(chan Message),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			if h.rooms[client.StreamID] == nil {
				h.rooms[client.StreamID] = make(map[*Client]bool)
			}
			h.rooms[client.StreamID][client] = true
			h.mu.Unlock()
			log.Printf("Client registered to room %s: %s", client.StreamID, client.UserID)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				if h.rooms[client.StreamID] != nil {
					delete(h.rooms[client.StreamID], client)
					if len(h.rooms[client.StreamID]) == 0 {
						delete(h.rooms, client.StreamID)
					}
				}
				log.Printf("Client unregistered: %s", client.UserID)
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.Lock()
			clientsInRoom := h.rooms[message.StreamID]
			msgBytes, err := json.Marshal(message)
			if err == nil {
				for client := range clientsInRoom {
					select {
					case client.send <- msgBytes:
					default:
						close(client.send)
						delete(h.clients, client)
						delete(h.rooms[client.StreamID], client)
					}
				}
			}
			h.mu.Unlock()
		}
	}
}

func (h *Hub) BroadcastToRoom(streamID string, message Message) {
	message.StreamID = streamID
	h.broadcast <- message
}
