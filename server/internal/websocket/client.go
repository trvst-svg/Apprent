package websocket

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow cross-origin for dev, lock down for production
	},
}

type Client struct {
	Hub      *Hub
	Conn     *websocket.Conn
	UserID   string
	UserName string
	StreamID string
	send     chan []byte
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()
	c.Conn.SetReadLimit(maxMessageSize)
	_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error { _ = c.Conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })

	for {
		_, messageBytes, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}

		var msg Message
		if err := json.Unmarshal(messageBytes, &msg); err == nil {
			msg.Sender = c.UserID
			msg.SenderName = c.UserName
			msg.StreamID = c.StreamID
			msg.Timestamp = time.Now().UnixMilli()
			c.Hub.broadcast <- msg
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			_, _ = w.Write(message)

			// Add queued chat messages to the current websocket message.
			n := len(c.send)
			for i := 0; i < n; i++ {
				_, _ = w.Write([]byte{'\n'})
				_, _ = w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ServeWs upgrades the connection and authenticates via JWT token
func ServeWs(hub *Hub, jwtSecret string, c *gin.Context) {
	streamID := c.Query("streamId")
	tokenString := c.Query("token")

	if streamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "streamId parameter is required"})
		return
	}

	// Authenticate via JWT token query parameter
	var userID, userName string
	if tokenString != "" {
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(jwtSecret), nil
		})

		if err == nil && token.Valid {
			if claims, ok := token.Claims.(jwt.MapClaims); ok {
				if uid, ok := claims["userId"].(string); ok {
					userID = uid
				}
			}
		}
	}

	// Fallback to query param userId if no valid token (backward compat for dev)
	if userID == "" {
		userID = c.Query("userId")
	}
	userName = c.Query("userName")
	if userName == "" {
		userName = "Anonymous"
	}

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required for WebSocket"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}

	client := &Client{
		Hub:      hub,
		Conn:     conn,
		UserID:   userID,
		UserName: userName,
		StreamID: streamID,
		send:     make(chan []byte, 256),
	}
	client.Hub.register <- client

	go client.WritePump()
	go client.ReadPump()
}
