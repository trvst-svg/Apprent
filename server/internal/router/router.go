package router

import (
	"net/http"

	"server/internal/config"
	"server/internal/handlers"
	"server/internal/middleware"
	"server/internal/models"
	"server/internal/websocket"

	"github.com/gin-gonic/gin"
)

func SetupRouter(cfg *config.Config, hub *websocket.Hub) *gin.Engine {
	r := gin.New()

	// Standard middlewares
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// Custom CORS Middleware
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	// Handlers initialization
	authH := handlers.NewAuthHandler(cfg)
	streamH := handlers.NewStreamHandler()
	sandboxH := handlers.NewSandboxHandler()
	adminH := handlers.NewAdminHandler()

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "timestamp": "2026-06-30T07:30:44+05:45"})
	})

	// WebSocket Upgrader Endpoint
	r.GET("/ws", func(c *gin.Context) {
		websocket.ServeWs(hub, c)
	})

	api := r.Group("/api/v1")
	{
		// Public Auth Routes
		auth := api.Group("/auth")
		{
			auth.POST("/register", authH.Register)
			auth.POST("/login", authH.Login)
		}

		// Authenticated Routes
		authRequired := api.Group("/")
		authRequired.Use(middleware.AuthMiddleware(cfg.JWTSecret))
		{
			// User Profile
			authRequired.GET("/auth/profile", authH.GetProfile)

			// Stream Routes (Learner & Expert view lists)
			authRequired.GET("/streams", streamH.GetStreams)
			authRequired.GET("/streams/:id", streamH.GetStreamDetails)

			// Learner only stream interaction routes
			learnerOnly := authRequired.Group("/")
			learnerOnly.Use(middleware.RoleMiddleware(models.RoleLearner))
			{
				learnerOnly.POST("/streams/:id/book", streamH.BookStream)
				learnerOnly.POST("/streams/:id/bookmarks", streamH.CreateBookmark)
				learnerOnly.GET("/bookmarks", streamH.GetBookmarks)

				// Sandbox Solutions
				learnerOnly.POST("/challenges/:id/submit", sandboxH.SubmitSandboxSolution)
				learnerOnly.GET("/submissions", sandboxH.GetSubmissions)
			}

			// Sandbox Challenge Access (All authenticated users can list/read)
			authRequired.GET("/challenges", sandboxH.GetChallenges)
			authRequired.GET("/challenges/:id", sandboxH.GetChallengeDetails)

			// Expert only management routes
			expertOnly := authRequired.Group("/")
			expertOnly.Use(middleware.RoleMiddleware(models.RoleExpert))
			{
				expertOnly.POST("/streams", streamH.CreateStream)
				expertOnly.POST("/streams/:id/start", streamH.StartLiveStream)
				expertOnly.POST("/streams/:id/end", streamH.EndLiveStream)
				expertOnly.GET("/expert/pending-commentaries", streamH.GetExpertPendingCommentaries)

				// Create Challenges
				expertOnly.POST("/challenges", sandboxH.CreateChallenge)
			}

			// Admin only routes
			adminOnly := authRequired.Group("/admin")
			adminOnly.Use(middleware.RoleMiddleware(models.RoleAdmin))
			{
				adminOnly.GET("/metrics", adminH.GetSystemMetrics)
				adminOnly.GET("/users", adminH.GetUsersList)
				adminOnly.GET("/streams", adminH.GetStreamsList)
			}
		}
	}

	return r
}
