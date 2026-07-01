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

type NotificationHandler struct{}

func NewNotificationHandler() *NotificationHandler {
	return &NotificationHandler{}
}

func (h *NotificationHandler) GetNotifications(c *gin.Context) {
	userIDStr, _ := c.Get("userId")
	userID, _ := bson.ObjectIDFromHex(userIDStr.(string))

	page, limit, _ := middleware.GetPaginationParams(c)
	skip := (page - 1) * limit

	collection := database.GetCollection("notifications")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	total, _ := collection.CountDocuments(ctx, bson.M{"userId": userID})

	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetSkip(int64(skip)).SetLimit(int64(limit))
	cursor, err := collection.Find(ctx, bson.M{"userId": userID}, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch notifications"})
		return
	}
	defer cursor.Close(ctx)

	var notifications []models.Notification = make([]models.Notification, 0)
	if err := cursor.All(ctx, &notifications); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode notifications"})
		return
	}

	totalPages := int(total) / limit
	if int(total)%limit != 0 {
		totalPages++
	}

	c.JSON(http.StatusOK, models.PaginatedResponse{
		Data:       notifications,
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: totalPages,
	})
}

func (h *NotificationHandler) MarkRead(c *gin.Context) {
	userIDStr, _ := c.Get("userId")
	userID, _ := bson.ObjectIDFromHex(userIDStr.(string))

	idStr := c.Param("id")

	collection := database.GetCollection("notifications")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if idStr == "all" {
		_, err := collection.UpdateMany(ctx, bson.M{"userId": userID, "read": false}, bson.M{"$set": bson.M{"read": true}})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark notifications"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "All notifications marked as read"})
		return
	}

	notifID, err := bson.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID"})
		return
	}

	_, err = collection.UpdateOne(ctx, bson.M{"_id": notifID, "userId": userID}, bson.M{"$set": bson.M{"read": true}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark notification"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification marked as read"})
}

func (h *NotificationHandler) GetUnreadCount(c *gin.Context) {
	userIDStr, _ := c.Get("userId")
	userID, _ := bson.ObjectIDFromHex(userIDStr.(string))

	collection := database.GetCollection("notifications")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	count, _ := collection.CountDocuments(ctx, bson.M{"userId": userID, "read": false})
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// CreateNotification is an internal helper - not a route handler
func CreateNotification(userID bson.ObjectID, notifType models.NotificationType, title, message, link string) {
	collection := database.GetCollection("notifications")
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	notif := models.Notification{
		ID:        bson.NewObjectID(),
		UserID:    userID,
		Type:      notifType,
		Title:     title,
		Message:   message,
		Read:      false,
		Link:      link,
		CreatedAt: time.Now(),
	}

	_, _ = collection.InsertOne(ctx, notif)
}
