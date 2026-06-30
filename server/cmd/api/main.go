package main

import (
	"log"
	"net/http"

	"server/internal/config"
	"server/internal/database"
	"server/internal/router"
	"server/internal/websocket"
)

func main() {
	log.Println("Starting ShadowMe backend orchestrator...")

	// 1. Load application config
	cfg := config.LoadConfig()

	// 2. Initialize database connection pool
	database.ConnectDB(cfg)

	// 3. Initialize and start WebSocket Hub
	hub := websocket.NewHub()
	go hub.Run()
	log.Println("WebSocket Hub initialized and running")

	// 4. Setup and run Gin server
	r := router.SetupRouter(cfg, hub)

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
	}

	log.Printf("Server is running on port %s in %s mode", cfg.Port, cfg.Env)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server listen error: %v", err)
	}
}
