package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port         string
	MongoURI     string
	DBName       string
	JWTSecret    string
	AIBackendURL string
	GeminiAPIKey string
	Env          string
}

func LoadConfig() *Config {
	// Load .env file if it exists, otherwise rely on system env
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	return &Config{
		Port:         getEnv("PORT", "8080"),
		MongoURI:     getEnv("MONGO_URI", "mongodb://localhost:27017"),
		DBName:       getEnv("DB_NAME", "apprent"),
		JWTSecret:    getEnv("JWT_SECRET", "super_secret_apprent_jwt_key_2026"),
		AIBackendURL: getEnv("AI_BACKEND_URL", "http://localhost:8000"),
		GeminiAPIKey: getEnv("GEMINI_API_KEY", ""),
		Env:          getEnv("ENV", "development"),
	}
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}
