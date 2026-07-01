package handlers

import (
	"net/http"

	"server/internal/models"
	"server/internal/services"

	"github.com/gin-gonic/gin"
)

type AIHandler struct {
	service *services.AIService
}

func NewAIHandler(geminiAPIKey string) *AIHandler {
	return &AIHandler{
		service: services.NewAIService(geminiAPIKey),
	}
}

func (h *AIHandler) CodeReview(c *gin.Context) {
	var input models.AIReviewRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Code is required"})
		return
	}

	if input.Language == "" {
		input.Language = "go"
	}

	review, err := h.service.CodeReview(input.ChallengeID, input.Code, input.Language)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service unavailable"})
		return
	}

	c.JSON(http.StatusOK, review)
}

func (h *AIHandler) GetHint(c *gin.Context) {
	var input models.AIHintRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Code is required"})
		return
	}

	if input.Language == "" {
		input.Language = "go"
	}

	hint, err := h.service.GetHint(input.ChallengeID, input.Code, input.Language)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service unavailable"})
		return
	}

	c.JSON(http.StatusOK, hint)
}
