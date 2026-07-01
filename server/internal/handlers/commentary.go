package handlers

import (
	"context"
	"net/http"
	"time"

	"server/internal/database"
	"server/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
)

type CommentaryHandler struct{}

func NewCommentaryHandler() *CommentaryHandler {
	return &CommentaryHandler{}
}

type CreateCommentaryInput struct {
	BookmarkID string `json:"bookmarkId" binding:"required"`
	Text       string `json:"text" binding:"required"`
	AudioURL   string `json:"audioUrl"`
}

func (h *CommentaryHandler) CreateCommentary(c *gin.Context) {
	streamIDStr := c.Param("id")
	streamID, err := bson.ObjectIDFromHex(streamIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid stream ID"})
		return
	}

	var input CreateCommentaryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	bookmarkID, err := bson.ObjectIDFromHex(input.BookmarkID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid bookmark ID"})
		return
	}

	expertIDStr, _ := c.Get("userId")
	expertID, _ := bson.ObjectIDFromHex(expertIDStr.(string))

	commentary := models.Commentary{
		ID:         bson.NewObjectID(),
		StreamID:   streamID,
		ExpertID:   expertID,
		BookmarkID: bookmarkID,
		Text:       input.Text,
		AudioURL:   input.AudioURL,
		CreatedAt:  time.Now(),
	}

	collection := database.GetCollection("commentaries")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = collection.InsertOne(ctx, commentary)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create commentary"})
		return
	}

	// Find the bookmark's learner to notify
	bookmarksColl := database.GetCollection("bookmarks")
	var bookmark models.Bookmark
	if err := bookmarksColl.FindOne(ctx, bson.M{"_id": bookmarkID}).Decode(&bookmark); err == nil {
		CreateNotification(bookmark.LearnerID, models.NotifNewCommentary,
			"New Expert Commentary 🎙️",
			"An expert has responded to your bookmark",
			"/learner/feed")
	}

	c.JSON(http.StatusCreated, commentary)
}

func (h *CommentaryHandler) GetCommentaries(c *gin.Context) {
	streamIDStr := c.Param("id")
	streamID, err := bson.ObjectIDFromHex(streamIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid stream ID"})
		return
	}

	collection := database.GetCollection("commentaries")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := collection.Find(ctx, bson.M{"streamId": streamID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch commentaries"})
		return
	}
	defer cursor.Close(ctx)

	var commentaries []models.Commentary = make([]models.Commentary, 0)
	if err := cursor.All(ctx, &commentaries); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode commentaries"})
		return
	}

	c.JSON(http.StatusOK, commentaries)
}
