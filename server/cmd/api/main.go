package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"server/internal/config"
	"server/internal/database"
	"server/internal/router"
	"server/internal/websocket"
)

func main() {
	log.Println("Starting Apprent backend orchestrator...")

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

	// 5. Run server in goroutine to allow graceful shutdown setup
	go func() {
		log.Printf("Server is running on port %s in %s mode", cfg.Port, cfg.Env)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server listen error: %v", err)
		}
	}()

	// 6. Graceful Shutdown listener
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server gracefully...")

	// Timeout limit 5 seconds to wrap active processes
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	// Close database connection
	if database.MongoClient != nil {
		if err := database.MongoClient.Disconnect(ctx); err != nil {
			log.Printf("Failed to disconnect MongoClient: %v", err)
		} else {
			log.Println("Successfully disconnected database connections")
		}
	}

	log.Println("Server exited cleanly")
}
