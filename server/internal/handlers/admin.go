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

type AdminHandler struct{}

func NewAdminHandler() *AdminHandler {
	return &AdminHandler{}
}

type MetricSummary struct {
	TotalUsers     int64            `json:"totalUsers"`
	UsersByRole    map[string]int64 `json:"usersByRole"`
	TotalStreams   int64            `json:"totalStreams"`
	StreamsByStatus map[string]int64 `json:"streamsByStatus"`
	TotalRevenue   float64          `json:"totalRevenue"`
	TotalBookings  int64            `json:"totalBookings"`
	TotalChallenges int64           `json:"totalChallenges"`
}

func (h *AdminHandler) GetSystemMetrics(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	usersColl := database.GetCollection("users")
	streamsColl := database.GetCollection("streams")
	bookingsColl := database.GetCollection("bookings")
	challengesColl := database.GetCollection("sandbox_challenges")

	// 1. Total Users
	totalUsers, err := usersColl.CountDocuments(ctx, bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count users"})
		return
	}

	// 2. Users by Role
	usersByRole := make(map[string]int64)
	for _, role := range []models.UserRole{models.RoleLearner, models.RoleExpert, models.RoleAdmin} {
		count, _ := usersColl.CountDocuments(ctx, bson.M{"role": role})
		usersByRole[string(role)] = count
	}

	// 3. Total Streams
	totalStreams, err := streamsColl.CountDocuments(ctx, bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count streams"})
		return
	}

	// 4. Streams by Status
	streamsByStatus := make(map[string]int64)
	for _, status := range []models.StreamStatus{models.StreamScheduled, models.StreamLive, models.StreamEnded, models.StreamRecorded} {
		count, _ := streamsColl.CountDocuments(ctx, bson.M{"status": status})
		streamsByStatus[string(status)] = count
	}

	// 5. Total Bookings
	totalBookings, err := bookingsColl.CountDocuments(ctx, bson.M{})
	if err != nil {
		totalBookings = 0
	}

	// 6. Total Revenue (Aggregate Sum of paidAmount from bookings)
	pipeline := bson.A{
		bson.D{{Key: "$match", Value: bson.D{{Key: "status", Value: "confirmed"}}}},
		bson.D{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: nil},
			{Key: "total", Value: bson.D{{Key: "$sum", Value: "$paidAmount"}}},
		}}},
	}
	cursor, err := bookingsColl.Aggregate(ctx, pipeline)
	var totalRevenue float64 = 0
	if err == nil {
		type RevenueResult struct {
			Total float64 `bson:"total"`
		}
		var results []RevenueResult
		if err := cursor.All(ctx, &results); err == nil && len(results) > 0 {
			totalRevenue = results[0].Total
		}
	}

	// 7. Total Sandbox Challenges
	totalChallenges, _ := challengesColl.CountDocuments(ctx, bson.M{})

	summary := MetricSummary{
		TotalUsers:      totalUsers,
		UsersByRole:     usersByRole,
		TotalStreams:    totalStreams,
		StreamsByStatus: streamsByStatus,
		TotalRevenue:    totalRevenue,
		TotalBookings:   totalBookings,
		TotalChallenges: totalChallenges,
	}

	c.JSON(http.StatusOK, summary)
}

func (h *AdminHandler) GetUsersList(c *gin.Context) {
	page, limit, search := middleware.GetPaginationParams(c)
	skip := (page - 1) * limit

	filter := bson.M{}
	if search != "" {
		filter["$or"] = bson.A{
			bson.M{"name": bson.M{"$regex": search, "$options": "i"}},
			bson.M{"email": bson.M{"$regex": search, "$options": "i"}},
		}
	}
	if role := c.Query("role"); role != "" {
		filter["role"] = role
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	usersColl := database.GetCollection("users")
	total, _ := usersColl.CountDocuments(ctx, filter)

	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetSkip(int64(skip)).SetLimit(int64(limit))
	cursor, err := usersColl.Find(ctx, filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}
	defer cursor.Close(ctx)

	var users []models.User = make([]models.User, 0)
	if err := cursor.All(ctx, &users); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode users"})
		return
	}

	totalPages := int(total) / limit
	if int(total)%limit != 0 {
		totalPages++
	}

	c.JSON(http.StatusOK, models.PaginatedResponse{
		Data:       users,
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: totalPages,
	})
}

func (h *AdminHandler) GetStreamsList(c *gin.Context) {
	page, limit, search := middleware.GetPaginationParams(c)
	skip := (page - 1) * limit

	filter := bson.M{}
	if search != "" {
		filter["$or"] = bson.A{
			bson.M{"title": bson.M{"$regex": search, "$options": "i"}},
			bson.M{"description": bson.M{"$regex": search, "$options": "i"}},
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	streamsColl := database.GetCollection("streams")
	total, _ := streamsColl.CountDocuments(ctx, filter)

	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetSkip(int64(skip)).SetLimit(int64(limit))
	cursor, err := streamsColl.Find(ctx, filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch streams"})
		return
	}
	defer cursor.Close(ctx)

	var streams []models.Stream = make([]models.Stream, 0)
	if err := cursor.All(ctx, &streams); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode streams"})
		return
	}

	totalPages := int(total) / limit
	if int(total)%limit != 0 {
		totalPages++
	}

	c.JSON(http.StatusOK, models.PaginatedResponse{
		Data:       streams,
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: totalPages,
	})
}

func (h *AdminHandler) BanUser(c *gin.Context) {
	idStr := c.Param("id")
	userID, err := bson.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var input struct {
		Banned bool `json:"banned"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	usersColl := database.GetCollection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = usersColl.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{"$set": bson.M{"banned": input.Banned}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user ban status"})
		return
	}

	message := "User banned successfully"
	if !input.Banned {
		message = "User unbanned successfully"
	}

	c.JSON(http.StatusOK, gin.H{"message": message})
}

func (h *AdminHandler) DeleteStream(c *gin.Context) {
	idStr := c.Param("id")
	streamID, err := bson.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid stream ID"})
		return
	}

	streamsColl := database.GetCollection("streams")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = streamsColl.DeleteOne(ctx, bson.M{"_id": streamID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete stream"})
		return
	}

	// Delete bookings & bookmarks for this stream
	bookingsColl := database.GetCollection("bookings")
	bookmarksColl := database.GetCollection("bookmarks")
	_, _ = bookingsColl.DeleteMany(ctx, bson.M{"streamId": streamID})
	_, _ = bookmarksColl.DeleteMany(ctx, bson.M{"streamId": streamID})

	c.JSON(http.StatusOK, gin.H{"message": "Stream and related data deleted successfully"})
}

func (h *AdminHandler) DeleteChallenge(c *gin.Context) {
	idStr := c.Param("id")
	challengeID, err := bson.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid challenge ID"})
		return
	}

	challengesColl := database.GetCollection("sandbox_challenges")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = challengesColl.DeleteOne(ctx, bson.M{"_id": challengeID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete challenge"})
		return
	}

	// Delete submissions
	submissionsColl := database.GetCollection("sandbox_submissions")
	_, _ = submissionsColl.DeleteMany(ctx, bson.M{"challengeId": challengeID})

	c.JSON(http.StatusOK, gin.H{"message": "Challenge deleted successfully"})
}
