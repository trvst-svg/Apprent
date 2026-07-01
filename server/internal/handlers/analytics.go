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

type AnalyticsHandler struct{}

func NewAnalyticsHandler() *AnalyticsHandler {
	return &AnalyticsHandler{}
}

type LogEventInput struct {
	EventType  string                 `json:"eventType" binding:"required"`
	TargetID   string                 `json:"targetId"`
	TargetType string                 `json:"targetType"`
	Metadata   map[string]interface{} `json:"metadata"`
}

func (h *AnalyticsHandler) LogEvent(c *gin.Context) {
	var input LogEventInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	event := models.AnalyticsEvent{
		ID:         bson.NewObjectID(),
		EventType:  input.EventType,
		TargetID:   input.TargetID,
		TargetType: input.TargetType,
		Metadata:   input.Metadata,
		CreatedAt:  time.Now(),
	}

	// Capture user if logged in
	if uIDStr, exists := c.Get("userId"); exists {
		if objID, err := bson.ObjectIDFromHex(uIDStr.(string)); err == nil {
			event.UserID = &objID
		}
	}

	// Inject IP address to track unique visits if not logged in
	if event.Metadata == nil {
		event.Metadata = make(map[string]interface{})
	}
	event.Metadata["ip"] = c.ClientIP()
	event.Metadata["userAgent"] = c.GetHeader("User-Agent")

	collection := database.GetCollection("analytics_events")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := collection.InsertOne(ctx, event)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to log analytics event"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"status": "logged"})
}

func (h *AnalyticsHandler) GetAnalyticsMetrics(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	usersColl := database.GetCollection("users")
	eventsColl := database.GetCollection("analytics_events")

	// 1. Total registrations
	totalUsers, _ := usersColl.CountDocuments(ctx, bson.M{})

	// 2. Unique Page Views / Visits count (aggregating by distinct IP or UserID)
	pipelineVisits := bson.A{
		bson.M{"$match": bson.M{"eventType": "page_view"}},
		bson.M{"$group": bson.M{
			"_id": "$metadata.ip",
		}},
		bson.M{"$count": "total"},
	}
	var visitsCount int64 = 0
	cursorVisits, err := eventsColl.Aggregate(ctx, pipelineVisits)
	if err == nil && cursorVisits.Next(ctx) {
		var res struct {
			Total int64 `bson:"total"`
		}
		if err := cursorVisits.Decode(&res); err == nil {
			visitsCount = res.Total
		}
		cursorVisits.Close(ctx)
	}

	// 3. Path interest counts (aggregated by targetId where eventType = click/enroll)
	pipelinePaths := bson.A{
		bson.M{"$match": bson.M{"targetType": "learning_path"}},
		bson.M{"$group": bson.M{
			"_id":   "$targetId",
			"count": bson.M{"$sum": 1},
		}},
		bson.M{"$sort": bson.M{"count": -1}},
		bson.M{"$limit": 5},
	}
	var pathInterests []gin.H = make([]gin.H, 0)
	cursorPaths, err := eventsColl.Aggregate(ctx, pipelinePaths)
	if err == nil {
		var results []struct {
			ID    string `bson:"_id"`
			Count int    `bson:"count"`
		}
		if err := cursorPaths.All(ctx, &results); err == nil {
			for _, r := range results {
				pathInterests = append(pathInterests, gin.H{"pathId": r.ID, "clicks": r.Count})
			}
		}
		cursorPaths.Close(ctx)
	}

	// 4. Onboarding profile analysis: Top languages to learn & top hobbies
	pipelineLangToLearn := bson.A{
		bson.M{"$unwind": "$profile.languagesToLearn"},
		bson.M{"$group": bson.M{
			"_id":   "$profile.languagesToLearn",
			"count": bson.M{"$sum": 1},
		}},
		bson.M{"$sort": bson.M{"count": -1}},
		bson.M{"$limit": 5},
	}
	var topLanguagesToLearn []gin.H = make([]gin.H, 0)
	cursorLang, err := usersColl.Aggregate(ctx, pipelineLangToLearn)
	if err == nil {
		var results []struct {
			ID    string `bson:"_id"`
			Count int    `bson:"count"`
		}
		if err := cursorLang.All(ctx, &results); err == nil {
			for _, r := range results {
				topLanguagesToLearn = append(topLanguagesToLearn, gin.H{"language": r.ID, "count": r.Count})
			}
		}
		cursorLang.Close(ctx)
	}

	c.JSON(http.StatusOK, gin.H{
		"totalRegistrations": totalUsers,
		"uniqueVisits":       visitsCount,
		"pathInterests":      pathInterests,
		"languagesToLearn":   topLanguagesToLearn,
		"timestamp":          time.Now(),
	})
}
