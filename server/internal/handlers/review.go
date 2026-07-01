package handlers

import (
	"context"
	"net/http"
	"time"

	"server/internal/database"
	"server/internal/middleware"
	"server/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type ReviewHandler struct{}

func NewReviewHandler() *ReviewHandler {
	return &ReviewHandler{}
}

type CreateReviewInput struct {
	Rating  int    `json:"rating" binding:"required,min=1,max=5"`
	Comment string `json:"comment"`
}

func (h *ReviewHandler) CreateReview(c *gin.Context) {
	streamIDStr := c.Param("id")
	streamID, err := bson.ObjectIDFromHex(streamIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid stream ID"})
		return
	}

	var input CreateReviewInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	learnerIDStr, _ := c.Get("userId")
	learnerID, _ := bson.ObjectIDFromHex(learnerIDStr.(string))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Get stream to find expert
	streamsColl := database.GetCollection("streams")
	var stream models.Stream
	err = streamsColl.FindOne(ctx, bson.M{"_id": streamID}).Decode(&stream)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}

	// Check duplicate review
	reviewsColl := database.GetCollection("reviews")
	var existing models.Review
	err = reviewsColl.FindOne(ctx, bson.M{"streamId": streamID, "learnerId": learnerID}).Decode(&existing)
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "You already reviewed this stream"})
		return
	}

	review := models.Review{
		ID:        bson.NewObjectID(),
		StreamID:  streamID,
		LearnerID: learnerID,
		ExpertID:  stream.ExpertID,
		Rating:    input.Rating,
		Comment:   input.Comment,
		CreatedAt: time.Now(),
	}

	_, err = reviewsColl.InsertOne(ctx, review)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create review"})
		return
	}

	// Recalculate expert average rating
	go recalculateExpertRating(stream.ExpertID)

	// Notify expert
	CreateNotification(stream.ExpertID, models.NotifNewReview, "New Review ⭐",
		"A learner rated your stream '"+stream.Title+"' "+string(rune('0'+input.Rating))+"/5",
		"/expert")

	c.JSON(http.StatusCreated, review)
}

func (h *ReviewHandler) GetExpertReviews(c *gin.Context) {
	expertIDStr := c.Param("expertId")
	expertID, err := bson.ObjectIDFromHex(expertIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expert ID"})
		return
	}

	page, limit, _ := middleware.GetPaginationParams(c)
	skip := (page - 1) * limit

	collection := database.GetCollection("reviews")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	total, _ := collection.CountDocuments(ctx, bson.M{"expertId": expertID})

	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetSkip(int64(skip)).SetLimit(int64(limit))
	cursor, err := collection.Find(ctx, bson.M{"expertId": expertID}, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reviews"})
		return
	}
	defer cursor.Close(ctx)

	var reviews []models.Review = make([]models.Review, 0)
	if err := cursor.All(ctx, &reviews); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode reviews"})
		return
	}

	totalPages := int(total) / limit
	if int(total)%limit != 0 {
		totalPages++
	}

	c.JSON(http.StatusOK, models.PaginatedResponse{
		Data:       reviews,
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: totalPages,
	})
}

func recalculateExpertRating(expertID bson.ObjectID) {
	collection := database.GetCollection("reviews")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pipeline := bson.A{
		bson.D{{Key: "$match", Value: bson.D{{Key: "expertId", Value: expertID}}}},
		bson.D{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: nil},
			{Key: "avgRating", Value: bson.D{{Key: "$avg", Value: "$rating"}}},
		}}},
	}

	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		return
	}

	type AvgResult struct {
		AvgRating float64 `bson:"avgRating"`
	}
	var results []AvgResult
	if err := cursor.All(ctx, &results); err != nil || len(results) == 0 {
		return
	}

	// Update user profile rating
	usersColl := database.GetCollection("users")
	_, _ = usersColl.UpdateOne(ctx, bson.M{"_id": expertID}, bson.M{
		"$set": bson.M{"profile.rating": results[0].AvgRating},
	})
}
