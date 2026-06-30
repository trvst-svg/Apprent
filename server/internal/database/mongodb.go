package database

import (
	"context"
	"log"
	"time"

	"server/internal/config"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

var (
	MongoClient *mongo.Client
	DB          *mongo.Database
)

func ConnectDB(cfg *config.Config) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOpts := options.Client().ApplyURI(cfg.MongoURI)
	client, err := mongo.Connect(clientOpts)
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}

	// Ping database to confirm connection
	err = client.Ping(ctx, nil)
	if err != nil {
		log.Fatalf("Failed to ping MongoDB: %v", err)
	}

	log.Printf("Successfully connected to MongoDB at %s", cfg.MongoURI)

	MongoClient = client
	DB = client.Database(cfg.DBName)
}

func GetCollection(name string) *mongo.Collection {
	if DB == nil {
		log.Fatal("Database not initialized. Call ConnectDB first.")
	}
	return DB.Collection(name)
}
