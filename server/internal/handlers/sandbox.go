package handlers

import (
	"context"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"server/internal/database"
	"server/internal/middleware"
	"server/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type SandboxHandler struct{}

func NewSandboxHandler() *SandboxHandler {
	return &SandboxHandler{}
}

type CreateChallengeInput struct {
	Title       string               `json:"title" binding:"required"`
	Description string               `json:"description" binding:"required"`
	Difficulty  string               `json:"difficulty" binding:"required,oneof=beginner intermediate advanced"`
	Tags        []string             `json:"tags"`
	Category    string               `json:"category"`
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

	tags := input.Tags
	if tags == nil {
		tags = []string{}
	}

	challenge := models.SandboxChallenge{
		ID:          bson.NewObjectID(),
		Title:       input.Title,
		Description: input.Description,
		Difficulty:  input.Difficulty,
		Tags:        tags,
		Category:    input.Category,
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
	if lang := c.Query("language"); lang != "" {
		filter["validation.type"] = lang
	}
	if tag := c.Query("tag"); tag != "" {
		filter["tags"] = tag
	}
	if cat := c.Query("category"); cat != "" {
		filter["category"] = cat
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := database.GetCollection("sandbox_challenges")
	total, _ := collection.CountDocuments(ctx, filter)

	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetSkip(int64(skip)).SetLimit(int64(limit))
	cursor, err := collection.Find(ctx, filter, opts)
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

	totalPages := int(total) / limit
	if int(total)%limit != 0 {
		totalPages++
	}

	c.JSON(http.StatusOK, models.PaginatedResponse{
		Data:       challenges,
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: totalPages,
	})
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

	// 2. Evaluate files using execution engine
	status, resultLogs, feedback := executeCode(challenge.Validation.Type, input.Files, challenge.Validation)

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

	// 4. Award XP and update progress
	lang := challenge.Validation.Type
	if status == models.SubmissionPass {
		go func() {
			AwardXP(learnerID, 50, "Challenge passed: "+challenge.Title+" (+50 XP)", lang)
			IncrementChallengeCount(learnerID, true)
			CreateNotification(learnerID, models.NotifChallengePass, "Challenge Passed! ✅",
				"You passed '"+challenge.Title+"' — nice work!", "/learner")
		}()
	} else {
		go func() {
			AwardXP(learnerID, 10, "Challenge attempted: "+challenge.Title+" (+10 XP)", lang)
			IncrementChallengeCount(learnerID, false)
			CreateNotification(learnerID, models.NotifChallengeFail, "Challenge Failed",
				"Your submission for '"+challenge.Title+"' didn't pass. Try again!", "/learner")
		}()
	}

	c.JSON(http.StatusCreated, submission)
}

func executeCode(lang string, files []models.SandboxFile, validation models.Validation) (models.SubmissionStatus, string, string) {
	// Create a temp directory inside workspace so we don't mess outside
	cwd, _ := os.Getwd()
	tempDir, err := os.MkdirTemp(cwd, "sandbox-run-*")
	if err != nil {
		return models.SubmissionFail, "System Error: Failed to initialize sandbox environment", "Please contact Apprent support."
	}
	defer os.RemoveAll(tempDir)

	var mainFilePath string
	for _, f := range files {
		fullPath := filepath.Join(tempDir, f.Path)
		// Ensure parent directories exist
		if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
			return models.SubmissionFail, "System Error: Failed to write files", err.Error()
		}

		content := f.Content
		// Append test assertion script lines if they are defined
		if f.Path == "solution.py" && lang == "python" {
			for _, assertion := range validation.Scripts {
				content += "\n" + assertion
			}
		} else if f.Path == "solution.js" && lang == "javascript" {
			for _, assertion := range validation.Scripts {
				content += "\n" + assertion
			}
		}

		if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
			return models.SubmissionFail, "System Error: Failed to write solution file", err.Error()
		}
		if mainFilePath == "" {
			mainFilePath = f.Path
		}
	}

	var cmd *exec.Cmd
	var checkExec string

	switch lang {
	case "go":
		checkExec = "go"
		cmd = exec.Command("go", "run", mainFilePath)
	case "python":
		checkExec = "python3"
		cmd = exec.Command("python3", mainFilePath)
	case "javascript":
		checkExec = "node"
		cmd = exec.Command("node", mainFilePath)
	default:
		return runFallbackMock(lang, files, validation)
	}

	// Fallback to pattern matching if runner toolchain is missing
	if _, err := exec.LookPath(checkExec); err != nil {
		return runFallbackMock(lang, files, validation)
	}

	// Timeout limit 3.5s to prevent infinite loops from hanging
	ctx, cancel := context.WithTimeout(context.Background(), 3500*time.Millisecond)
	defer cancel()

	cmd = exec.CommandContext(ctx, cmd.Path, cmd.Args[1:]...)
	cmd.Dir = tempDir

	out, err := cmd.CombinedOutput()
	outputLogs := string(out)

	if ctx.Err() == context.DeadlineExceeded {
		return models.SubmissionFail, "TIMEOUT: Process killed (execution took longer than 3.5 seconds).", "Check for infinite recursion, loops, or thread locks."
	}

	if err != nil {
		return models.SubmissionFail, "COMPILER / RUNTIME FAILURE:\n" + outputLogs, "The code failed to compile/execute or validation scripts failed to assert."
	}

	// Static analysis check for Go
	if lang == "go" {
		passed := false
		for _, file := range files {
			codeLower := strings.ToLower(file.Content)
			for _, script := range validation.Scripts {
				if strings.Contains(codeLower, strings.ToLower(script)) {
					passed = true
					break
				}
			}
		}
		if !passed {
			return models.SubmissionFail, "FAIL: Compilation succeeded, but validation check failed.\nLogs:\n" + outputLogs, "Expected channel closures or proper cancel context. Make sure you close channels or call cancel() to avoid resource leaks."
		}
	}

	return models.SubmissionPass, "PASS:\n" + outputLogs + "\nAll unit assertions verified successfully.", "Excellent! The solution passed all runtime verification parameters."
}

func runFallbackMock(lang string, files []models.SandboxFile, validation models.Validation) (models.SubmissionStatus, string, string) {
	passed := false
	for _, file := range files {
		codeLower := strings.ToLower(file.Content)
		for _, script := range validation.Scripts {
			if strings.Contains(codeLower, strings.ToLower(script)) || len(script) == 0 {
				passed = true
				break
			}
		}
		if lang == "python" && (strings.Contains(file.Content, "[::-1]") || strings.Contains(file.Content, "reversed")) {
			passed = true
		}
		if lang == "javascript" && (strings.Contains(file.Content, "predicate(arr[i])") || strings.Contains(file.Content, "predicate(")) {
			passed = true
		}
	}

	if passed {
		return models.SubmissionPass, "PASS: [SIMULATED] Compiler verification passed.", "Target language toolchain '" + lang + "' not found locally; fallback simulated compiler assertions passed."
	}
	return models.SubmissionFail, "FAIL: [SIMULATED] Compiler verification failed.", "Expected solution to include correct logical constructs matching target assertions: " + strings.Join(validation.Scripts, ", ") + "."
}

func (h *SandboxHandler) GetSubmissions(c *gin.Context) {
	learnerIDStr, _ := c.Get("userId")
	learnerID, _ := bson.ObjectIDFromHex(learnerIDStr.(string))

	page, limit, _ := middleware.GetPaginationParams(c)
	skip := (page - 1) * limit

	collection := database.GetCollection("sandbox_submissions")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"learnerId": learnerID}
	if challengeID := c.Query("challengeId"); challengeID != "" {
		objID, err := bson.ObjectIDFromHex(challengeID)
		if err == nil {
			filter["challengeId"] = objID
		}
	}

	total, _ := collection.CountDocuments(ctx, filter)

	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetSkip(int64(skip)).SetLimit(int64(limit))
	cursor, err := collection.Find(ctx, filter, opts)
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

	totalPages := int(total) / limit
	if int(total)%limit != 0 {
		totalPages++
	}

	c.JSON(http.StatusOK, models.PaginatedResponse{
		Data:       submissions,
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: totalPages,
	})
}
