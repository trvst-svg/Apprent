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
		DBName:       getEnv("DB_NAME", "shadowme"),
		JWTSecret:    getEnv("JWT_SECRET", "super_secret_shadowme_jwt_key_2026"),
		AIBackendURL: getEnv("AI_BACKEND_URL", "http://localhost:8000"),
		Env:          getEnv("ENV", "development"),
	}
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}
