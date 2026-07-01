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

type LearningPathHandler struct{}

func NewLearningPathHandler() *LearningPathHandler {
	return &LearningPathHandler{}
}

type CreatePathInput struct {
	Title       string             `json:"title" binding:"required"`
	Description string             `json:"description" binding:"required"`
	Difficulty  string             `json:"difficulty" binding:"required,oneof=beginner intermediate advanced"`
	Tags        []string           `json:"tags"`
	Steps       []models.PathStep  `json:"steps" binding:"required,min=1"`
}

func (h *LearningPathHandler) CreatePath(c *gin.Context) {
	var input CreatePathInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	expertIDStr, _ := c.Get("userId")
	expertID, _ := bson.ObjectIDFromHex(expertIDStr.(string))

	tags := input.Tags
	if tags == nil {
		tags = []string{}
	}

	path := models.LearningPath{
		ID:          bson.NewObjectID(),
		Title:       input.Title,
		Description: input.Description,
		Difficulty:  input.Difficulty,
		Tags:        tags,
		Steps:       input.Steps,
		ExpertID:    expertID,
		CreatedAt:   time.Now(),
	}

	collection := database.GetCollection("learning_paths")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := collection.InsertOne(ctx, path)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create learning path"})
		return
	}

	c.JSON(http.StatusCreated, path)
}

func (h *LearningPathHandler) GetPaths(c *gin.Context) {
	page, limit, search := middleware.GetPaginationParams(c)
	skip := (page - 1) * limit

	filter := bson.M{}
	if search != "" {
		filter["$or"] = bson.A{
			bson.M{"title": bson.M{"$regex": search, "$options": "i"}},
			bson.M{"description": bson.M{"$regex": search, "$options": "i"}},
		}
	}
	if diff := c.Query("difficulty"); diff != "" {
		filter["difficulty"] = diff
	}

	collection := database.GetCollection("learning_paths")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	total, _ := collection.CountDocuments(ctx, filter)

	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetSkip(int64(skip)).SetLimit(int64(limit))
	cursor, err := collection.Find(ctx, filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch learning paths"})
		return
	}
	defer cursor.Close(ctx)

	var paths []models.LearningPath = make([]models.LearningPath, 0)
	if err := cursor.All(ctx, &paths); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode learning paths"})
		return
	}

	totalPages := int(total) / limit
	if int(total)%limit != 0 {
		totalPages++
	}

	c.JSON(http.StatusOK, models.PaginatedResponse{
		Data:       paths,
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: totalPages,
	})
}

func (h *LearningPathHandler) GetPathDetails(c *gin.Context) {
	idStr := c.Param("id")
	pathID, err := bson.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid path ID"})
		return
	}

	collection := database.GetCollection("learning_paths")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var path models.LearningPath
	err = collection.FindOne(ctx, bson.M{"_id": pathID}).Decode(&path)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Learning path not found"})
		return
	}

	c.JSON(http.StatusOK, path)
}

func (h *LearningPathHandler) EnrollPath(c *gin.Context) {
	idStr := c.Param("id")
	pathID, err := bson.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid path ID"})
		return
	}

	learnerIDStr, _ := c.Get("userId")
	learnerID, _ := bson.ObjectIDFromHex(learnerIDStr.(string))

	enrollColl := database.GetCollection("path_enrollments")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Check duplicate
	var existing models.PathEnrollment
	err = enrollColl.FindOne(ctx, bson.M{"learnerId": learnerID, "pathId": pathID}).Decode(&existing)
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Already enrolled in this path"})
		return
	}

	enrollment := models.PathEnrollment{
		ID:             bson.NewObjectID(),
		LearnerID:      learnerID,
		PathID:         pathID,
		CompletedSteps: []int{},
		CreatedAt:      time.Now(),
	}

	_, err = enrollColl.InsertOne(ctx, enrollment)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to enroll"})
		return
	}

	c.JSON(http.StatusCreated, enrollment)
}

func (h *LearningPathHandler) CompleteStep(c *gin.Context) {
	idStr := c.Param("id")
	pathID, err := bson.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid path ID"})
		return
	}

	var input struct {
		StepOrder int `json:"stepOrder" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	learnerIDStr, _ := c.Get("userId")
	learnerID, _ := bson.ObjectIDFromHex(learnerIDStr.(string))

	enrollColl := database.GetCollection("path_enrollments")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = enrollColl.UpdateOne(ctx,
		bson.M{"learnerId": learnerID, "pathId": pathID},
		bson.M{"$addToSet": bson.M{"completedSteps": input.StepOrder}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update progress"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Step completed"})
}

func (h *LearningPathHandler) GetMyEnrollments(c *gin.Context) {
	learnerIDStr, _ := c.Get("userId")
	learnerID, _ := bson.ObjectIDFromHex(learnerIDStr.(string))

	enrollColl := database.GetCollection("path_enrollments")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := enrollColl.Find(ctx, bson.M{"learnerId": learnerID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch enrollments"})
		return
	}
	defer cursor.Close(ctx)

	var enrollments []models.PathEnrollment = make([]models.PathEnrollment, 0)
	if err := cursor.All(ctx, &enrollments); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode enrollments"})
		return
	}

	// Enrich with path data
	pathsColl := database.GetCollection("learning_paths")
	type EnrolledPath struct {
		Enrollment models.PathEnrollment `json:"enrollment"`
		Path       models.LearningPath   `json:"path"`
	}
	var result []EnrolledPath
	for _, e := range enrollments {
		var path models.LearningPath
		_ = pathsColl.FindOne(ctx, bson.M{"_id": e.PathID}).Decode(&path)
		result = append(result, EnrolledPath{Enrollment: e, Path: path})
	}

	if result == nil {
		result = []EnrolledPath{}
	}

	c.JSON(http.StatusOK, result)
}
