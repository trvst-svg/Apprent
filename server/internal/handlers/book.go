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

type BookHandler struct{}

func NewBookHandler() *BookHandler {
	return &BookHandler{}
}

func (h *BookHandler) GetBooks(c *gin.Context) {
	page, limit, search := middleware.GetPaginationParams(c)
	skip := (page - 1) * limit

	filter := bson.M{}

	lang := c.Query("language")
	if lang != "" && lang != "all" {
		filter["language"] = lang
	}

	diff := c.Query("difficulty")
	if diff != "" && diff != "all" {
		filter["difficulty"] = diff
	}

	if search != "" {
		filter["$or"] = bson.A{
			bson.M{"title": bson.M{"$regex": search, "$options": "i"}},
			bson.M{"author": bson.M{"$regex": search, "$options": "i"}},
			bson.M{"description": bson.M{"$regex": search, "$options": "i"}},
		}
	}

	collection := database.GetCollection("books")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	total, _ := collection.CountDocuments(ctx, filter)

	opts := options.Find().SetSkip(int64(skip)).SetLimit(int64(limit))
	cursor, err := collection.Find(ctx, filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch books"})
		return
	}
	defer cursor.Close(ctx)

	var books []models.Book = make([]models.Book, 0)
	if err := cursor.All(ctx, &books); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode books"})
		return
	}

	totalPages := int(total) / limit
	if int(total)%limit != 0 {
		totalPages++
	}

	c.JSON(http.StatusOK, models.PaginatedResponse{
		Data:       books,
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: totalPages,
	})
}

func (h *BookHandler) GetBookDetails(c *gin.Context) {
	idStr := c.Param("id")
	bookID, err := bson.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid book ID"})
		return
	}

	collection := database.GetCollection("books")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var book models.Book
	err = collection.FindOne(ctx, bson.M{"_id": bookID}).Decode(&book)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Book not found"})
		return
	}

	c.JSON(http.StatusOK, book)
}
