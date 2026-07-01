package websocket

import (
	"encoding/json"
	"log"
	"sync"
)

// Message types
const (
	MsgChat     = "chat"
	MsgCodeSync = "code_sync"
	MsgPresence = "presence"
	MsgTyping   = "typing"
	MsgSystem   = "system"
)

type Message struct {
	Type       string `json:"type"`       // "chat", "code_sync", "presence", "typing", "system"
	StreamID   string `json:"streamId"`   // Room identifier
	Sender     string `json:"sender"`     // User ID
	SenderName string `json:"senderName"` // Display name
	Content    string `json:"content"`    // Text or payload
	Timestamp  int64  `json:"timestamp"`  // Unix ms
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

			// Broadcast presence join to room
			count := len(h.rooms[client.StreamID])
			h.mu.Unlock()

			log.Printf("Client registered to room %s: %s (%s)", client.StreamID, client.UserID, client.UserName)

			joinMsg := Message{
				Type:       MsgPresence,
				StreamID:   client.StreamID,
				Sender:     client.UserID,
				SenderName: client.UserName,
				Content:    `{"action":"join","count":` + itoa(count) + `}`,
			}
			h.broadcastToRoomInternal(client.StreamID, joinMsg)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				if h.rooms[client.StreamID] != nil {
					delete(h.rooms[client.StreamID], client)
					count := len(h.rooms[client.StreamID])
					if count == 0 {
						delete(h.rooms, client.StreamID)
					}
					h.mu.Unlock()

					// Broadcast presence leave
					leaveMsg := Message{
						Type:       MsgPresence,
						StreamID:   client.StreamID,
						Sender:     client.UserID,
						SenderName: client.UserName,
						Content:    `{"action":"leave","count":` + itoa(count) + `}`,
					}
					h.broadcastToRoomInternal(client.StreamID, leaveMsg)
				} else {
					h.mu.Unlock()
				}
				log.Printf("Client unregistered: %s", client.UserID)
			} else {
				h.mu.Unlock()
			}

		case message := <-h.broadcast:
			h.broadcastToRoomInternal(message.StreamID, message)
		}
	}
}

func (h *Hub) broadcastToRoomInternal(streamID string, message Message) {
	h.mu.Lock()
	clientsInRoom := h.rooms[streamID]
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

func (h *Hub) BroadcastToRoom(streamID string, message Message) {
	message.StreamID = streamID
	h.broadcast <- message
}

// GetRoomUserCount returns the number of connected clients in a room
func (h *Hub) GetRoomUserCount(streamID string) int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.rooms[streamID])
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	s := ""
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	return s
}
