package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"server/internal/database"
	"server/internal/middleware"
	"server/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type StreamHandler struct{}

func NewStreamHandler() *StreamHandler {
	return &StreamHandler{}
}

type CreateStreamInput struct {
	Title       string    `json:"title" binding:"required"`
	Description string    `json:"description" binding:"required"`
	StartTime   time.Time `json:"startTime" binding:"required"`
}

type BookStreamInput struct {
	PaidAmount float64 `json:"paidAmount" binding:"required,gt=0"`
}

type CreateBookmarkInput struct {
	Timestamp int    `json:"timestamp" binding:"required"` // in seconds
	Notes     string `json:"notes"`
}

func (h *StreamHandler) CreateStream(c *gin.Context) {
	var input CreateStreamInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	expertIDStr, _ := c.Get("userId")
	expertID, err := bson.ObjectIDFromHex(expertIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expert ID"})
		return
	}

	// Generate a secure unique stream key
	keyBytes := make([]byte, 16)
	_, _ = rand.Read(keyBytes)
	streamKey := "live_sk_" + hex.EncodeToString(keyBytes)

	stream := models.Stream{
		ID:          bson.NewObjectID(),
		Title:       input.Title,
		Description: input.Description,
		Status:      models.StreamScheduled,
		StreamKey:   streamKey,
		VideoURL:    "", // to be populated when live or recorded
		StartTime:   input.StartTime,
		ExpertID:    expertID,
		CreatedAt:   time.Now(),
	}

	collection := database.GetCollection("streams")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = collection.InsertOne(ctx, stream)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create stream"})
		return
	}

	c.JSON(http.StatusCreated, stream)
}

func (h *StreamHandler) GetStreams(c *gin.Context) {
	page, limit, search := middleware.GetPaginationParams(c)
	skip := (page - 1) * limit

	filter := bson.M{}
	if search != "" {
		filter["$or"] = bson.A{
			bson.M{"title": bson.M{"$regex": search, "$options": "i"}},
			bson.M{"description": bson.M{"$regex": search, "$options": "i"}},
		}
	}
	if status := c.Query("status"); status != "" {
		filter["status"] = status
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := database.GetCollection("streams")
	total, _ := collection.CountDocuments(ctx, filter)

	opts := options.Find().SetSort(bson.D{{Key: "startTime", Value: -1}}).SetSkip(int64(skip)).SetLimit(int64(limit))
	cursor, err := collection.Find(ctx, filter, opts)
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

func (h *StreamHandler) GetStreamDetails(c *gin.Context) {
	idStr := c.Param("id")
	streamID, err := bson.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid stream ID"})
		return
	}

	collection := database.GetCollection("streams")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var stream models.Stream
	err = collection.FindOne(ctx, bson.M{"_id": streamID}).Decode(&stream)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}

	c.JSON(http.StatusOK, stream)
}

func (h *StreamHandler) StartLiveStream(c *gin.Context) {
	idStr := c.Param("id")
	streamID, err := bson.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid stream ID"})
		return
	}

	expertIDStr, _ := c.Get("userId")
	expertID, _ := bson.ObjectIDFromHex(expertIDStr.(string))

	collection := database.GetCollection("streams")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Locate stream and verify ownership
	var stream models.Stream
	err = collection.FindOne(ctx, bson.M{"_id": streamID, "expertId": expertID}).Decode(&stream)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found or unauthorized"})
		return
	}

	// Update stream status to live
	update := bson.M{
		"$set": bson.M{
			"status":   models.StreamLive,
			"videoUrl": "/streams/" + streamID.Hex() + "/index.m3u8",
		},
	}

	_, err = collection.UpdateOne(ctx, bson.M{"_id": streamID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update stream status"})
		return
	}

	// Notify all learners who booked this stream
	go notifyStreamBookers(streamID, models.NotifStreamLive, "Stream is LIVE! 🔴",
		"'"+stream.Title+"' is now live. Join now!", "/learner")

	c.JSON(http.StatusOK, gin.H{"message": "Stream is now LIVE", "videoUrl": "/streams/" + streamID.Hex() + "/index.m3u8"})
}

func (h *StreamHandler) EndLiveStream(c *gin.Context) {
	idStr := c.Param("id")
	streamID, err := bson.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid stream ID"})
		return
	}

	expertIDStr, _ := c.Get("userId")
	expertID, _ := bson.ObjectIDFromHex(expertIDStr.(string))

	collection := database.GetCollection("streams")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var stream models.Stream
	err = collection.FindOne(ctx, bson.M{"_id": streamID, "expertId": expertID}).Decode(&stream)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found or unauthorized"})
		return
	}

	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"status":  models.StreamRecorded,
			"endTime": now,
		},
	}

	_, err = collection.UpdateOne(ctx, bson.M{"_id": streamID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to end stream"})
		return
	}

	// Notify bookers
	go notifyStreamBookers(streamID, models.NotifStreamEnded, "Stream Ended",
		"'"+stream.Title+"' has ended and is now available as a recording.", "/learner/feed")

	c.JSON(http.StatusOK, gin.H{"message": "Stream has ended and is archived as recorded"})
}

func (h *StreamHandler) BookStream(c *gin.Context) {
	idStr := c.Param("id")
	streamID, err := bson.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid stream ID"})
		return
	}

	var input BookStreamInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	learnerIDStr, _ := c.Get("userId")
	learnerID, _ := bson.ObjectIDFromHex(learnerIDStr.(string))

	bookingsColl := database.GetCollection("bookings")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Check if already booked
	var existingBooking models.Booking
	err = bookingsColl.FindOne(ctx, bson.M{"streamId": streamID, "learnerId": learnerID, "status": bson.M{"$ne": "cancelled"}}).Decode(&existingBooking)
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "You have already booked this stream"})
		return
	}

	booking := models.Booking{
		ID:         bson.NewObjectID(),
		StreamID:   streamID,
		LearnerID:  learnerID,
		Status:     models.BookingConfirmed,
		PaidAmount: input.PaidAmount,
		CreatedAt:  time.Now(),
	}

	_, err = bookingsColl.InsertOne(ctx, booking)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to place booking"})
		return
	}

	// Notify learner
	CreateNotification(learnerID, models.NotifBookingConfirmed, "Booking Confirmed ✅",
		"Your booking has been confirmed.", "/learner")

	c.JSON(http.StatusCreated, booking)
}

func (h *StreamHandler) CancelBooking(c *gin.Context) {
	idStr := c.Param("id")
	streamID, err := bson.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid stream ID"})
		return
	}

	learnerIDStr, _ := c.Get("userId")
	learnerID, _ := bson.ObjectIDFromHex(learnerIDStr.(string))

	bookingsColl := database.GetCollection("bookings")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := bookingsColl.UpdateOne(ctx,
		bson.M{"streamId": streamID, "learnerId": learnerID, "status": "confirmed"},
		bson.M{"$set": bson.M{"status": models.BookingCancelled}},
	)
	if err != nil || result.ModifiedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "No active booking found to cancel"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Booking cancelled successfully"})
}

func (h *StreamHandler) CreateBookmark(c *gin.Context) {
	idStr := c.Param("id")
	streamID, err := bson.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid stream ID"})
		return
	}

	var input CreateBookmarkInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	learnerIDStr, _ := c.Get("userId")
	learnerID, _ := bson.ObjectIDFromHex(learnerIDStr.(string))

	bookmark := models.Bookmark{
		ID:        bson.NewObjectID(),
		LearnerID: learnerID,
		StreamID:  streamID,
		Timestamp: input.Timestamp,
		Notes:     input.Notes,
		CreatedAt: time.Now(),
	}

	collection := database.GetCollection("bookmarks")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = collection.InsertOne(ctx, bookmark)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add bookmark"})
		return
	}

	c.JSON(http.StatusCreated, bookmark)
}

func (h *StreamHandler) GetBookmarks(c *gin.Context) {
	learnerIDStr, _ := c.Get("userId")
	learnerID, _ := bson.ObjectIDFromHex(learnerIDStr.(string))

	collection := database.GetCollection("bookmarks")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := collection.Find(ctx, bson.M{"learnerId": learnerID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch bookmarks"})
		return
	}
	defer cursor.Close(ctx)

	var bookmarks []models.Bookmark = make([]models.Bookmark, 0)
	if err := cursor.All(ctx, &bookmarks); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode bookmarks"})
		return
	}

	c.JSON(http.StatusOK, bookmarks)
}

func (h *StreamHandler) GetExpertPendingCommentaries(c *gin.Context) {
	expertIDStr, _ := c.Get("userId")
	expertID, _ := bson.ObjectIDFromHex(expertIDStr.(string))

	streamsColl := database.GetCollection("streams")
	bookmarksColl := database.GetCollection("bookmarks")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Find all streams by this expert
	cursor, err := streamsColl.Find(ctx, bson.M{"expertId": expertID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch expert streams"})
		return
	}
	defer cursor.Close(ctx)

	var streams []models.Stream
	if err := cursor.All(ctx, &streams); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode streams"})
		return
	}

	type PendingCommentary struct {
		StreamID  string            `json:"streamId"`
		Title     string            `json:"title"`
		Bookmarks []models.Bookmark `json:"bookmarks"`
	}

	var pendingList []PendingCommentary = make([]PendingCommentary, 0)

	for _, stream := range streams {
		bCursor, err := bookmarksColl.Find(ctx, bson.M{"streamId": stream.ID})
		if err == nil {
			var bMarks []models.Bookmark
			if err := bCursor.All(ctx, &bMarks); err == nil && len(bMarks) > 0 {
				pendingList = append(pendingList, PendingCommentary{
					StreamID:  stream.ID.Hex(),
					Title:     stream.Title,
					Bookmarks: bMarks,
				})
			}
			bCursor.Close(ctx)
		}
	}

	c.JSON(http.StatusOK, pendingList)
}

// notifyStreamBookers sends notifications to all learners who booked a stream
func notifyStreamBookers(streamID bson.ObjectID, notifType models.NotificationType, title, message, link string) {
	bookingsColl := database.GetCollection("bookings")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := bookingsColl.Find(ctx, bson.M{"streamId": streamID, "status": "confirmed"})
	if err != nil {
		return
	}
	defer cursor.Close(ctx)

	var bookings []models.Booking
	if err := cursor.All(ctx, &bookings); err != nil {
		return
	}

	for _, b := range bookings {
		CreateNotification(b.LearnerID, notifType, title, message, link)
	}
}
