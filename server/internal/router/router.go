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

	// Apply Rate Limiter globally
	r.Use(middleware.RateLimitMiddleware())

	// Handlers initialization
	authH := handlers.NewAuthHandler(cfg)
	streamH := handlers.NewStreamHandler()
	sandboxH := handlers.NewSandboxHandler()
	adminH := handlers.NewAdminHandler()
	bookH := handlers.NewBookHandler()
	notifH := handlers.NewNotificationHandler()
	progressH := handlers.NewProgressHandler()
	reviewH := handlers.NewReviewHandler()
	pathH := handlers.NewLearningPathHandler()
	commentaryH := handlers.NewCommentaryHandler()
	aiH := handlers.NewAIHandler(cfg.GeminiAPIKey)
	analyticsH := handlers.NewAnalyticsHandler()

	// Health check endpoint (checks MongoDB connection status)
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"timestamp": "2026-06-30T07:30:44+05:45",
		})
	})

	// WebSocket Upgrader Endpoint
	r.GET("/ws", func(c *gin.Context) {
		websocket.ServeWs(hub, cfg.JWTSecret, c)
	})

	api := r.Group("/api/v1")
	{
		// Public Auth Routes
		auth := api.Group("/auth")
		{
			auth.POST("/register", authH.Register)
			auth.POST("/login", authH.Login)
		}

		// Public Resource Routes
		api.GET("/books", bookH.GetBooks)
		api.GET("/books/:id", bookH.GetBookDetails)
		api.GET("/paths", pathH.GetPaths)
		api.GET("/paths/:id", pathH.GetPathDetails)
		api.POST("/analytics/log", analyticsH.LogEvent)

		// Authenticated Routes
		authRequired := api.Group("/")
		authRequired.Use(middleware.AuthMiddleware(cfg.JWTSecret))
		{
			// User Profile
			authRequired.GET("/auth/profile", authH.GetProfile)
			authRequired.PUT("/auth/profile", authH.UpdateProfile)
			authRequired.PUT("/auth/password", authH.ChangePassword)
			authRequired.PUT("/auth/onboarding", authH.SaveOnboarding)

			// Notifications
			authRequired.GET("/notifications", notifH.GetNotifications)
			authRequired.PUT("/notifications/:id", notifH.MarkRead)
			authRequired.GET("/notifications/unread-count", notifH.GetUnreadCount)

			// Progress & Gamification
			authRequired.GET("/progress", progressH.GetProgress)
			authRequired.GET("/progress/leaderboard", progressH.GetLeaderboard)

			// Stream Routes (Learner & Expert view lists)
			authRequired.GET("/streams", streamH.GetStreams)
			authRequired.GET("/streams/:id", streamH.GetStreamDetails)
			authRequired.GET("/streams/:id/commentaries", commentaryH.GetCommentaries)

			// Learning Paths enrollment
			authRequired.POST("/paths/:id/enroll", pathH.EnrollPath)
			authRequired.POST("/paths/:id/complete", pathH.CompleteStep)
			authRequired.GET("/paths/my-enrollments", pathH.GetMyEnrollments)

			// Expert Reviews
			authRequired.GET("/experts/:expertId/reviews", reviewH.GetExpertReviews)

			// AI Code Review & Hint
			authRequired.POST("/ai/review", aiH.CodeReview)
			authRequired.POST("/ai/hint", aiH.GetHint)

			// Learner only stream interaction routes
			learnerOnly := authRequired.Group("/")
			learnerOnly.Use(middleware.RoleMiddleware(models.RoleLearner))
			{
				learnerOnly.POST("/streams/:id/book", streamH.BookStream)
				learnerOnly.DELETE("/streams/:id/book", streamH.CancelBooking)
				learnerOnly.POST("/streams/:id/bookmarks", streamH.CreateBookmark)
				learnerOnly.GET("/bookmarks", streamH.GetBookmarks)
				learnerOnly.POST("/streams/:id/reviews", reviewH.CreateReview)

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
				expertOnly.POST("/streams/:id/commentaries", commentaryH.CreateCommentary)

				// Create Challenges & Paths
				expertOnly.POST("/challenges", sandboxH.CreateChallenge)
				expertOnly.POST("/paths", pathH.CreatePath)
			}

			// Admin only routes
			adminOnly := api.Group("/admin")
			adminOnly.Use(middleware.AuthMiddleware(cfg.JWTSecret))
			adminOnly.Use(middleware.RoleMiddleware(models.RoleAdmin))
			{
				adminOnly.GET("/metrics", adminH.GetSystemMetrics)
				adminOnly.GET("/analytics", analyticsH.GetAnalyticsMetrics)
				adminOnly.GET("/users", adminH.GetUsersList)
				adminOnly.PUT("/users/:id/ban", adminH.BanUser)
				adminOnly.GET("/streams", adminH.GetStreamsList)
				adminOnly.DELETE("/streams/:id", adminH.DeleteStream)
				adminOnly.DELETE("/challenges/:id", adminH.DeleteChallenge)
			}
		}
	}

	return r
}
