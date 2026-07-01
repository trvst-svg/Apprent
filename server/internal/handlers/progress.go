package handlers

import (
	"context"
	"net/http"
	"time"

	"server/internal/database"
	"server/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type ProgressHandler struct{}

func NewProgressHandler() *ProgressHandler {
	return &ProgressHandler{}
}

func (h *ProgressHandler) GetProgress(c *gin.Context) {
	userIDStr, _ := c.Get("userId")
	userID, _ := bson.ObjectIDFromHex(userIDStr.(string))

	progress := getOrCreateProgress(userID)
	c.JSON(http.StatusOK, progress)
}

func (h *ProgressHandler) GetLeaderboard(c *gin.Context) {
	collection := database.GetCollection("progress")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	opts := options.Find().SetSort(bson.D{{Key: "xpTotal", Value: -1}}).SetLimit(20)
	cursor, err := collection.Find(ctx, bson.M{}, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch leaderboard"})
		return
	}
	defer cursor.Close(ctx)

	var entries []models.Progress = make([]models.Progress, 0)
	if err := cursor.All(ctx, &entries); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode leaderboard"})
		return
	}

	// Enrich with user names
	type LeaderboardEntry struct {
		models.Progress
		Name string `json:"name"`
	}

	usersColl := database.GetCollection("users")
	var leaderboard []LeaderboardEntry
	for _, e := range entries {
		var user models.User
		_ = usersColl.FindOne(ctx, bson.M{"_id": e.LearnerID}).Decode(&user)
		leaderboard = append(leaderboard, LeaderboardEntry{
			Progress: e,
			Name:     user.Name,
		})
	}

	c.JSON(http.StatusOK, leaderboard)
}

// ─── Internal helpers ───────────────────────────────────────

func getOrCreateProgress(learnerID bson.ObjectID) models.Progress {
	collection := database.GetCollection("progress")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var progress models.Progress
	err := collection.FindOne(ctx, bson.M{"learnerId": learnerID}).Decode(&progress)
	if err != nil {
		// Create new progress record
		progress = models.Progress{
			ID:                  bson.NewObjectID(),
			LearnerID:           learnerID,
			ChallengesCompleted: 0,
			ChallengesFailed:    0,
			StreakDays:           0,
			XPTotal:             0,
			Badges:              []models.Badge{},
			LanguagesUsed:       []string{},
			LastActiveDate:      time.Now(),
			CreatedAt:           time.Now(),
		}
		_, _ = collection.InsertOne(ctx, progress)
	}
	return progress
}

// AwardXP adds XP and updates streak, then checks for badge eligibility
func AwardXP(learnerID bson.ObjectID, xp int, reason string, lang string) {
	collection := database.GetCollection("progress")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	progress := getOrCreateProgress(learnerID)

	// Update streak
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	lastActive := time.Date(progress.LastActiveDate.Year(), progress.LastActiveDate.Month(), progress.LastActiveDate.Day(), 0, 0, 0, 0, time.UTC)

	daysSince := int(today.Sub(lastActive).Hours() / 24)
	newStreak := progress.StreakDays
	if daysSince == 1 {
		newStreak++
	} else if daysSince > 1 {
		newStreak = 1
	}
	// daysSince == 0 means same day, keep streak

	// Track language
	langSet := make(map[string]bool)
	for _, l := range progress.LanguagesUsed {
		langSet[l] = true
	}
	if lang != "" {
		langSet[lang] = true
	}
	var languages []string
	for l := range langSet {
		languages = append(languages, l)
	}

	update := bson.M{
		"$set": bson.M{
			"streakDays":     newStreak,
			"lastActiveDate": now,
			"languagesUsed":  languages,
		},
		"$inc": bson.M{
			"xpTotal": xp,
		},
	}

	_, _ = collection.UpdateOne(ctx, bson.M{"learnerId": learnerID}, update)

	// Check for new badges
	updatedProgress := getOrCreateProgress(learnerID)
	checkAndAwardBadges(learnerID, updatedProgress)

	// Notify
	CreateNotification(learnerID, models.NotifXPAwarded, "XP Earned!", reason, "/learner")
}

// IncrementChallengeCount increments completed or failed challenges count
func IncrementChallengeCount(learnerID bson.ObjectID, passed bool) {
	collection := database.GetCollection("progress")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = getOrCreateProgress(learnerID) // ensure exists

	field := "challengesFailed"
	if passed {
		field = "challengesCompleted"
	}

	_, _ = collection.UpdateOne(ctx, bson.M{"learnerId": learnerID}, bson.M{
		"$inc": bson.M{field: 1},
	})
}

func checkAndAwardBadges(learnerID bson.ObjectID, p models.Progress) {
	collection := database.GetCollection("progress")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	existingBadges := make(map[models.BadgeName]bool)
	for _, b := range p.Badges {
		existingBadges[b.Name] = true
	}

	var newBadges []models.Badge

	// First submission
	if (p.ChallengesCompleted+p.ChallengesFailed) >= 1 && !existingBadges[models.BadgeFirstSubmit] {
		newBadges = append(newBadges, models.Badge{Name: models.BadgeFirstSubmit, EarnedAt: time.Now()})
	}
	// 10 passes
	if p.ChallengesCompleted >= 10 && !existingBadges[models.BadgeTenPasses] {
		newBadges = append(newBadges, models.Badge{Name: models.BadgeTenPasses, EarnedAt: time.Now()})
	}
	// 50 passes
	if p.ChallengesCompleted >= 50 && !existingBadges[models.BadgeFiftyPasses] {
		newBadges = append(newBadges, models.Badge{Name: models.BadgeFiftyPasses, EarnedAt: time.Now()})
	}
	// Week streak
	if p.StreakDays >= 7 && !existingBadges[models.BadgeStreakWeek] {
		newBadges = append(newBadges, models.Badge{Name: models.BadgeStreakWeek, EarnedAt: time.Now()})
	}
	// Month streak
	if p.StreakDays >= 30 && !existingBadges[models.BadgeStreakMonth] {
		newBadges = append(newBadges, models.Badge{Name: models.BadgeStreakMonth, EarnedAt: time.Now()})
	}
	// Polyglot (3+ languages)
	if len(p.LanguagesUsed) >= 3 && !existingBadges[models.BadgePolyglot] {
		newBadges = append(newBadges, models.Badge{Name: models.BadgePolyglot, EarnedAt: time.Now()})
	}

	if len(newBadges) > 0 {
		_, _ = collection.UpdateOne(ctx, bson.M{"learnerId": learnerID}, bson.M{
			"$push": bson.M{"badges": bson.M{"$each": newBadges}},
		})

		for _, b := range newBadges {
			CreateNotification(learnerID, models.NotifBadgeEarned, "Badge Earned! 🏆", "You earned the '"+string(b.Name)+"' badge!", "/learner")
		}
	}
}
