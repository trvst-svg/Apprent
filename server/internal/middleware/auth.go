package middleware

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"server/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// ─── JWT Auth ───────────────────────────────────────────────

func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header must be Bearer token"})
			c.Abort()
			return
		}

		tokenString := parts[1]
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
			return
		}

		userID, ok := claims["userId"].(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "userId not found in token"})
			c.Abort()
			return
		}

		role, ok := claims["role"].(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "role not found in token"})
			c.Abort()
			return
		}

		c.Set("userId", userID)
		c.Set("role", models.UserRole(role))
		c.Next()
	}
}

// ─── Role Middleware ────────────────────────────────────────

func RoleMiddleware(allowedRoles ...models.UserRole) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRoleVal, exists := c.Get("role")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "User role not resolved"})
			c.Abort()
			return
		}

		userRole := userRoleVal.(models.UserRole)
		isAllowed := false
		for _, role := range allowedRoles {
			if userRole == role {
				isAllowed = true
				break
			}
		}

		if !isAllowed {
			c.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized access for this user role"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// ─── Rate Limiter ───────────────────────────────────────────

type rateBucket struct {
	tokens    float64
	lastCheck time.Time
}

var (
	rateLimitMap sync.Map
	rateLimit    = 100.0 // requests per minute
	rateBurst    = 20.0  // burst size
)

func RateLimitMiddleware() gin.HandlerFunc {
	// Cleanup old entries every 5 minutes
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			now := time.Now()
			rateLimitMap.Range(func(key, value interface{}) bool {
				bucket := value.(*rateBucket)
				if now.Sub(bucket.lastCheck) > 5*time.Minute {
					rateLimitMap.Delete(key)
				}
				return true
			})
		}
	}()

	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()

		val, _ := rateLimitMap.LoadOrStore(ip, &rateBucket{
			tokens:    rateBurst,
			lastCheck: now,
		})

		bucket := val.(*rateBucket)
		elapsed := now.Sub(bucket.lastCheck).Seconds()
		bucket.lastCheck = now

		// Refill tokens
		bucket.tokens += elapsed * (rateLimit / 60.0)
		if bucket.tokens > rateBurst {
			bucket.tokens = rateBurst
		}

		if bucket.tokens < 1 {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Rate limit exceeded. Please slow down."})
			c.Abort()
			return
		}

		bucket.tokens -= 1
		c.Next()
	}
}

// ─── Pagination Helper ─────────────────────────────────────

func GetPaginationParams(c *gin.Context) (page int, limit int, search string) {
	page = 1
	limit = 20
	search = c.Query("search")

	if p, err := strconv.Atoi(c.Query("page")); err == nil && p > 0 {
		page = p
	}
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 && l <= 100 {
		limit = l
	}

	return page, limit, search
}
