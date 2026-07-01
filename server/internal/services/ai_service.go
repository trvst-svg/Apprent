package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"time"

	"server/internal/database"
	"server/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// ─── RAG Pipeline Service ───────────────────────────────────

type AIService struct {
	apiKey  string
	baseURL string
}

func NewAIService(apiKey string) *AIService {
	return &AIService{
		apiKey:  apiKey,
		baseURL: "https://generativelanguage.googleapis.com/v1beta",
	}
}

// RAG Document for in-memory retrieval
type RAGDocument struct {
	ID       string
	Type     string // "challenge", "book"
	Title    string
	Content  string
	Language string
	Keywords []string
}

// BuildRAGContext retrieves relevant documents for a given code submission
func (s *AIService) BuildRAGContext(challengeID, language, code string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var contextParts []string

	// 1. Get the challenge details
	if challengeID != "" {
		challengesColl := database.GetCollection("sandbox_challenges")
		objID, err := bson.ObjectIDFromHex(challengeID)
		if err == nil {
			var challenge models.SandboxChallenge
			if err := challengesColl.FindOne(ctx, bson.M{"_id": objID}).Decode(&challenge); err == nil {
				contextParts = append(contextParts,
					fmt.Sprintf("## Challenge: %s\nDifficulty: %s\nDescription: %s",
						challenge.Title, challenge.Difficulty, challenge.Description))
			}
		}
	}

	// 2. Find related books
	booksColl := database.GetCollection("books")
	if language != "" {
		cursor, err := booksColl.Find(ctx, bson.M{"language": language})
		if err == nil {
			var books []models.Book
			if err := cursor.All(ctx, &books); err == nil {
				for _, book := range books {
					contextParts = append(contextParts,
						fmt.Sprintf("## Reference Book: %s by %s\nLevel: %s\nTopics: %s",
							book.Title, book.Author, book.Difficulty, book.Description))
				}
			}
			cursor.Close(ctx)
		}
	}

	// 3. Find similar challenges by keyword matching (simple TF-IDF-like scoring)
	challengesColl := database.GetCollection("sandbox_challenges")
	codeWords := strings.Fields(strings.ToLower(code))
	if len(codeWords) > 0 {
		cursor, err := challengesColl.Find(ctx, bson.M{"validation.type": language})
		if err == nil {
			var challenges []models.SandboxChallenge
			if err := cursor.All(ctx, &challenges); err == nil {
				type scored struct {
					challenge models.SandboxChallenge
					score     float64
				}
				var scored_results []scored
				for _, ch := range challenges {
					if ch.ID.Hex() == challengeID {
						continue
					}
					score := computeRelevance(codeWords, ch.Title+" "+ch.Description)
					if score > 0.1 {
						scored_results = append(scored_results, scored{challenge: ch, score: score})
					}
				}
				// Take top 2 most relevant
				for i := 0; i < len(scored_results) && i < 2; i++ {
					best := 0
					for j := range scored_results {
						if scored_results[j].score > scored_results[best].score {
							best = j
						}
					}
					ch := scored_results[best].challenge
					contextParts = append(contextParts,
						fmt.Sprintf("## Related Challenge: %s (%s)\n%s",
							ch.Title, ch.Difficulty, ch.Description))
					scored_results[best].score = -1 // mark as used
				}
			}
			cursor.Close(ctx)
		}
	}

	if len(contextParts) == 0 {
		return "No additional context available."
	}

	return strings.Join(contextParts, "\n\n---\n\n")
}

// computeRelevance computes a simple keyword overlap score
func computeRelevance(queryWords []string, docText string) float64 {
	docLower := strings.ToLower(docText)
	docWords := strings.Fields(docLower)
	docSet := make(map[string]bool)
	for _, w := range docWords {
		docSet[w] = true
	}

	matches := 0
	for _, w := range queryWords {
		if len(w) > 3 && docSet[w] {
			matches++
		}
	}

	if len(queryWords) == 0 {
		return 0
	}
	return float64(matches) / math.Sqrt(float64(len(queryWords)))
}

// ─── Gemini API Calls ───────────────────────────────────────

type geminiRequest struct {
	Contents []geminiContent `json:"contents"`
}

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

func (s *AIService) callGemini(prompt string) (string, error) {
	if s.apiKey == "" {
		return s.generateMockResponse(prompt), nil
	}

	url := fmt.Sprintf("%s/models/gemini-2.0-flash:generateContent?key=%s", s.baseURL, s.apiKey)

	reqBody := geminiRequest{
		Contents: []geminiContent{{
			Parts: []geminiPart{{Text: prompt}},
		}},
	}

	body, _ := json.Marshal(reqBody)
	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return s.generateMockResponse(prompt), nil
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	var geminiResp geminiResponse
	if err := json.Unmarshal(respBody, &geminiResp); err != nil || len(geminiResp.Candidates) == 0 {
		return s.generateMockResponse(prompt), nil
	}

	if len(geminiResp.Candidates[0].Content.Parts) > 0 {
		return geminiResp.Candidates[0].Content.Parts[0].Text, nil
	}

	return s.generateMockResponse(prompt), nil
}

// CodeReview performs AI-powered code review with RAG context
func (s *AIService) CodeReview(challengeID, code, language string) (*models.AIReviewResponse, error) {
	ragContext := s.BuildRAGContext(challengeID, language, code)

	prompt := fmt.Sprintf(`You are an expert code reviewer for the Apprent learning platform.

## Context from our knowledge base:
%s

## Code to Review (%s):
%s

Please provide a structured code review in the following JSON format:
{
  "summary": "Brief overall assessment",
  "issues": ["List of bugs, anti-patterns, or errors found"],
  "suggestions": ["List of improvements and best practices"],
  "praise": ["What the code does well"],
  "score": 0-100
}

Respond with ONLY the JSON object, no markdown fences.`, ragContext, language, code)

	responseText, err := s.callGemini(prompt)
	if err != nil {
		return nil, err
	}

	// Clean response
	responseText = strings.TrimSpace(responseText)
	responseText = strings.TrimPrefix(responseText, "```json")
	responseText = strings.TrimPrefix(responseText, "```")
	responseText = strings.TrimSuffix(responseText, "```")
	responseText = strings.TrimSpace(responseText)

	var review models.AIReviewResponse
	if err := json.Unmarshal([]byte(responseText), &review); err != nil {
		// If parsing fails, wrap raw text
		review = models.AIReviewResponse{
			Summary:     responseText,
			Issues:      []string{},
			Suggestions: []string{"Could not parse structured response"},
			Praise:      []string{},
			Score:       50,
		}
	}

	if review.Issues == nil {
		review.Issues = []string{}
	}
	if review.Suggestions == nil {
		review.Suggestions = []string{}
	}
	if review.Praise == nil {
		review.Praise = []string{}
	}

	return &review, nil
}

// GetHint provides a contextual hint for a challenge
func (s *AIService) GetHint(challengeID, code, language string) (*models.AIHintResponse, error) {
	ragContext := s.BuildRAGContext(challengeID, language, code)

	prompt := fmt.Sprintf(`You are a helpful coding mentor on the Apprent learning platform.

## Context from our knowledge base:
%s

## Student's Current Code (%s):
%s

The student is stuck and needs a hint. Do NOT give the full solution.
Respond in the following JSON format:
{
  "hint": "A helpful nudge in the right direction without revealing the answer",
  "concept": "The key programming concept they should study",
  "resourceUrl": "A relevant documentation URL or empty string"
}

Respond with ONLY the JSON object, no markdown fences.`, ragContext, language, code)

	responseText, err := s.callGemini(prompt)
	if err != nil {
		return nil, err
	}

	responseText = strings.TrimSpace(responseText)
	responseText = strings.TrimPrefix(responseText, "```json")
	responseText = strings.TrimPrefix(responseText, "```")
	responseText = strings.TrimSuffix(responseText, "```")
	responseText = strings.TrimSpace(responseText)

	var hint models.AIHintResponse
	if err := json.Unmarshal([]byte(responseText), &hint); err != nil {
		hint = models.AIHintResponse{
			Hint:    responseText,
			Concept: "General programming",
		}
	}

	return &hint, nil
}

// ─── Mock Responses (when no API key) ───────────────────────

func (s *AIService) generateMockResponse(prompt string) string {
	if strings.Contains(prompt, "code review") || strings.Contains(prompt, "Code to Review") {
		return `{
  "summary": "The code demonstrates a solid understanding of the core concepts. There are a few areas for improvement around error handling and code organization.",
  "issues": [
    "Missing error handling for edge cases",
    "Variable naming could be more descriptive",
    "No input validation for boundary conditions"
  ],
  "suggestions": [
    "Add guard clauses for nil/empty inputs",
    "Use more descriptive variable names (e.g., 'result' instead of 'r')",
    "Consider adding comments for complex logic blocks",
    "Extract repeated logic into helper functions"
  ],
  "praise": [
    "Good use of the language's standard library",
    "Clean code structure and logical flow",
    "Correct implementation of the core algorithm"
  ],
  "score": 72
}`
	}

	return `{
  "hint": "Think about what data structure would let you efficiently look up whether you've seen a value before. Consider the time complexity of your current approach vs. using a hash-based structure.",
  "concept": "Hash Maps / Dictionaries for O(1) lookups",
  "resourceUrl": ""
}`
}
