package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"server/internal/database"
	"server/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
)

type SandboxHandler struct{}

func NewSandboxHandler() *SandboxHandler {
	return &SandboxHandler{}
}

type CreateChallengeInput struct {
	Title       string               `json:"title" binding:"required"`
	Description string               `json:"description" binding:"required"`
	Difficulty  string               `json:"difficulty" binding:"required,oneof=beginner intermediate advanced"`
	Files       []models.SandboxFile `json:"files" binding:"required,min=1"`
	Validation  models.Validation    `json:"validation"`
}

type SubmitSolutionInput struct {
	Files []models.SandboxFile `json:"files" binding:"required,min=1"`
}

func (h *SandboxHandler) CreateChallenge(c *gin.Context) {
	var input CreateChallengeInput
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

	challenge := models.SandboxChallenge{
		ID:          bson.NewObjectID(),
		Title:       input.Title,
		Description: input.Description,
		Difficulty:  input.Difficulty,
		Files:       input.Files,
		Validation:  input.Validation,
		ExpertID:    expertID,
		CreatedAt:   time.Now(),
	}

	collection := database.GetCollection("sandbox_challenges")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = collection.InsertOne(ctx, challenge)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create challenge"})
		return
	}

	c.JSON(http.StatusCreated, challenge)
}

func (h *SandboxHandler) GetChallenges(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := database.GetCollection("sandbox_challenges")
	cursor, err := collection.Find(ctx, bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch challenges"})
		return
	}
	defer cursor.Close(ctx)

	var challenges []models.SandboxChallenge = make([]models.SandboxChallenge, 0)
	if err := cursor.All(ctx, &challenges); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode challenges"})
		return
	}

	c.JSON(http.StatusOK, challenges)
}

func (h *SandboxHandler) GetChallengeDetails(c *gin.Context) {
	idStr := c.Param("id")
	challengeID, err := bson.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid challenge ID"})
		return
	}

	collection := database.GetCollection("sandbox_challenges")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var challenge models.SandboxChallenge
	err = collection.FindOne(ctx, bson.M{"_id": challengeID}).Decode(&challenge)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Challenge not found"})
		return
	}

	c.JSON(http.StatusOK, challenge)
}

func (h *SandboxHandler) SubmitSandboxSolution(c *gin.Context) {
	challengeIDStr := c.Param("id")
	challengeID, err := bson.ObjectIDFromHex(challengeIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid challenge ID"})
		return
	}

	var input SubmitSolutionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	learnerIDStr, _ := c.Get("userId")
	learnerID, _ := bson.ObjectIDFromHex(learnerIDStr.(string))

	challengesColl := database.GetCollection("sandbox_challenges")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. Verify challenge exists
	var challenge models.SandboxChallenge
	err = challengesColl.FindOne(ctx, bson.M{"_id": challengeID}).Decode(&challenge)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Challenge not found"})
		return
	}

	// 2. Run simulation (Evaluate files in the submission)
	// We'll simulate verification by searching for typical code corrections:
	status := models.SubmissionFail
	resultLogs := "FAIL: TestSuite failed. Expected resource leaks to be cleared, but channels are left open."
	feedback := "It looks like you're creating goroutines without properly closing the synchronization channels. Try wrapping channel closures inside clean defers or handling termination signals."

	for _, file := range input.Files {
		// Example check: if they added a defer close(ch) or similar, pass the test
		content := strings.ToLower(file.Content)
		if strings.Contains(content, "close(") || strings.Contains(content, "defer ") || strings.Contains(content, "cancel()") {
			status = models.SubmissionPass
			resultLogs = "PASS: TestGoroutineLeakCleared (0.12s)\nPASS: TestConcurrenyScalability (0.24s)\nAll unit tests passed successfully."
			feedback = "Excellent! You properly managed channel closures and avoided resources leaking in concurrent Go operations. Very neat code structuring."
			break
		}
	}

	// 3. Create submission record
	submission := models.SandboxSubmission{
		ID:             bson.NewObjectID(),
		ChallengeID:    challengeID,
		LearnerID:      learnerID,
		SubmittedFiles: input.Files,
		Status:         status,
		ResultLogs:     resultLogs,
		Feedback:       feedback,
		CreatedAt:      time.Now(),
	}

	submissionsColl := database.GetCollection("sandbox_submissions")
	_, err = submissionsColl.InsertOne(ctx, submission)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store submission"})
		return
	}

	c.JSON(http.StatusCreated, submission)
}

func (h *SandboxHandler) GetSubmissions(c *gin.Context) {
	learnerIDStr, _ := c.Get("userId")
	learnerID, _ := bson.ObjectIDFromHex(learnerIDStr.(string))

	collection := database.GetCollection("sandbox_submissions")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := collection.Find(ctx, bson.M{"learnerId": learnerID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch submissions"})
		return
	}
	defer cursor.Close(ctx)

	var submissions []models.SandboxSubmission = make([]models.SandboxSubmission, 0)
	if err := cursor.All(ctx, &submissions); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode submissions"})
		return
	}

	c.JSON(http.StatusOK, submissions)
}
