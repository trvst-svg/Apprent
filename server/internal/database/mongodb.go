package database

import (
	"context"
	"log"
	"time"

	"server/internal/config"

	"go.mongodb.org/mongo-driver/v2/bson"
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

	// Create Indexes for high performance / scalability
	CreateIndexes()

	// Seed database with books and challenges
	SeedDatabase()
}

func GetCollection(name string) *mongo.Collection {
	if DB == nil {
		log.Fatal("Database not initialized. Call ConnectDB first.")
	}
	return DB.Collection(name)
}

func CreateIndexes() {
	if DB == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Users Indexes
	usersColl := GetCollection("users")
	_, _ = usersColl.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "email", Value: 1}},
		Options: options.Index().SetUnique(true),
	})

	// 2. Streams Indexes
	streamsColl := GetCollection("streams")
	_, _ = streamsColl.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "status", Value: 1}},
	})
	_, _ = streamsColl.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "expertId", Value: 1}},
	})

	// 3. Bookings Indexes
	bookingsColl := GetCollection("bookings")
	_, _ = bookingsColl.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "learnerId", Value: 1}, {Key: "streamId", Value: 1}},
	})

	// 4. Sandbox Submissions Indexes
	subsColl := GetCollection("sandbox_submissions")
	_, _ = subsColl.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "learnerId", Value: 1}, {Key: "challengeId", Value: 1}},
	})

	// 5. Books Indexes
	booksColl := GetCollection("books")
	_, _ = booksColl.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "language", Value: 1}, {Key: "difficulty", Value: 1}},
	})

	// 6. Reviews Indexes
	reviewsColl := GetCollection("reviews")
	_, _ = reviewsColl.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "expertId", Value: 1}},
	})
	_, _ = reviewsColl.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "streamId", Value: 1}, {Key: "learnerId", Value: 1}},
	})

	// 7. Notifications Indexes
	notifsColl := GetCollection("notifications")
	_, _ = notifsColl.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "userId", Value: 1}, {Key: "read", Value: 1}},
	})

	// 8. Progress Indexes
	progressColl := GetCollection("progress")
	_, _ = progressColl.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "learnerId", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	_, _ = progressColl.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "xpTotal", Value: -1}},
	})

	// 9. Learning Paths Indexes
	pathsColl := GetCollection("learning_paths")
	_, _ = pathsColl.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "difficulty", Value: 1}},
	})

	// 10. Path Enrollments Indexes
	enrollColl := GetCollection("path_enrollments")
	_, _ = enrollColl.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "learnerId", Value: 1}, {Key: "pathId", Value: 1}},
	})

	// 11. Commentaries Indexes
	commColl := GetCollection("commentaries")
	_, _ = commColl.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "bookmarkId", Value: 1}},
	})
	
	log.Println("Database indexes created successfully")
}
