package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// ─── User & Auth ────────────────────────────────────────────

type UserRole string

const (
	RoleLearner UserRole = "learner"
	RoleExpert  UserRole = "expert"
	RoleAdmin   UserRole = "admin"
)

type User struct {
	ID           bson.ObjectID `json:"id" bson:"_id,omitempty"`
	Email        string        `json:"email" bson:"email"`
	PasswordHash string        `json:"-" bson:"passwordHash"`
	Name         string        `json:"name" bson:"name"`
	Role         UserRole      `json:"role" bson:"role"`
	Profile      Profile       `json:"profile" bson:"profile"`
	Banned       bool          `json:"banned" bson:"banned"`
	CreatedAt    time.Time     `json:"createdAt" bson:"createdAt"`
	UpdatedAt    time.Time     `json:"updatedAt" bson:"updatedAt"`
}

type Profile struct {
	Bio              string   `json:"bio" bson:"bio"`
	AvatarURL        string   `json:"avatarUrl" bson:"avatarUrl"`
	Skills           []string `json:"skills" bson:"skills"`
	Title            string   `json:"title" bson:"title"`
	Company          string   `json:"company" bson:"company"`
	HourlyRate       float64  `json:"hourlyRate" bson:"hourlyRate"`
	Rating           float64  `json:"rating" bson:"rating"`
	Hobbies          []string `json:"hobbies" bson:"hobbies"`
	LanguagesKnown   []string `json:"languagesKnown" bson:"languagesKnown"`
	LanguagesToLearn []string `json:"languagesToLearn" bson:"languagesToLearn"`
	Onboarded        bool     `json:"onboarded" bson:"onboarded"`
}

// ─── Streams ────────────────────────────────────────────────

type StreamStatus string

const (
	StreamScheduled StreamStatus = "scheduled"
	StreamLive      StreamStatus = "live"
	StreamEnded     StreamStatus = "ended"
	StreamRecorded  StreamStatus = "recorded"
)

type Stream struct {
	ID          bson.ObjectID `json:"id" bson:"_id,omitempty"`
	Title       string        `json:"title" bson:"title"`
	Description string        `json:"description" bson:"description"`
	Status      StreamStatus  `json:"status" bson:"status"`
	StreamKey   string        `json:"streamKey,omitempty" bson:"streamKey"`
	VideoURL    string        `json:"videoUrl" bson:"videoUrl"`
	StartTime   time.Time     `json:"startTime" bson:"startTime"`
	EndTime     *time.Time    `json:"endTime,omitempty" bson:"endTime,omitempty"`
	ExpertID    bson.ObjectID `json:"expertId" bson:"expertId"`
	CreatedAt   time.Time     `json:"createdAt" bson:"createdAt"`
}

// ─── Bookings ───────────────────────────────────────────────

type BookingStatus string

const (
	BookingPending   BookingStatus = "pending"
	BookingConfirmed BookingStatus = "confirmed"
	BookingCancelled BookingStatus = "cancelled"
)

type Booking struct {
	ID         bson.ObjectID `json:"id" bson:"_id,omitempty"`
	StreamID   bson.ObjectID `json:"streamId" bson:"streamId"`
	LearnerID  bson.ObjectID `json:"learnerId" bson:"learnerId"`
	Status     BookingStatus `json:"status" bson:"status"`
	PaidAmount float64       `json:"paidAmount" bson:"paidAmount"`
	CreatedAt  time.Time     `json:"createdAt" bson:"createdAt"`
}

// ─── Bookmarks ──────────────────────────────────────────────

type Bookmark struct {
	ID        bson.ObjectID `json:"id" bson:"_id,omitempty"`
	LearnerID bson.ObjectID `json:"learnerId" bson:"learnerId"`
	StreamID  bson.ObjectID `json:"streamId" bson:"streamId"`
	Timestamp int           `json:"timestamp" bson:"timestamp"` // seconds mark
	Notes     string        `json:"notes" bson:"notes"`
	CreatedAt time.Time     `json:"createdAt" bson:"createdAt"`
}

// ─── Sandbox Challenges & Submissions ───────────────────────

type SandboxFile struct {
	Path    string `json:"path" bson:"path"`
	Content string `json:"content" bson:"content"`
}

type SandboxChallenge struct {
	ID          bson.ObjectID `json:"id" bson:"_id,omitempty"`
	Title       string        `json:"title" bson:"title"`
	Description string        `json:"description" bson:"description"`
	Difficulty  string        `json:"difficulty" bson:"difficulty"`
	Tags        []string      `json:"tags" bson:"tags"`
	Category    string        `json:"category" bson:"category"`
	Files       []SandboxFile `json:"files" bson:"files"`
	Validation  Validation    `json:"validation" bson:"validation"`
	ExpertID    bson.ObjectID `json:"expertId" bson:"expertId"`
	CreatedAt   time.Time     `json:"createdAt" bson:"createdAt"`
}

type Validation struct {
	Type    string   `json:"type" bson:"type"`
	Scripts []string `json:"scripts" bson:"scripts"`
}

type SubmissionStatus string

const (
	SubmissionRunning SubmissionStatus = "running"
	SubmissionPass    SubmissionStatus = "pass"
	SubmissionFail    SubmissionStatus = "fail"
)

type SandboxSubmission struct {
	ID             bson.ObjectID    `json:"id" bson:"_id,omitempty"`
	ChallengeID    bson.ObjectID    `json:"challengeId" bson:"challengeId"`
	LearnerID      bson.ObjectID    `json:"learnerId" bson:"learnerId"`
	SubmittedFiles []SandboxFile    `json:"submittedFiles" bson:"submittedFiles"`
	Status         SubmissionStatus `json:"status" bson:"status"`
	ResultLogs     string           `json:"resultLogs" bson:"resultLogs"`
	Feedback       string           `json:"feedback" bson:"feedback"`
	CreatedAt      time.Time        `json:"createdAt" bson:"createdAt"`
}

// ─── Books ──────────────────────────────────────────────────

type Book struct {
	ID          bson.ObjectID `json:"id" bson:"_id,omitempty"`
	Title       string        `json:"title" bson:"title"`
	Author      string        `json:"author" bson:"author"`
	Language    string        `json:"language" bson:"language"`
	Difficulty  string        `json:"difficulty" bson:"difficulty"`
	URL         string        `json:"url" bson:"url"`
	Description string        `json:"description" bson:"description"`
	CoverURL    string        `json:"coverUrl" bson:"coverUrl"`
}

// ─── Reviews ────────────────────────────────────────────────

type Review struct {
	ID        bson.ObjectID `json:"id" bson:"_id,omitempty"`
	StreamID  bson.ObjectID `json:"streamId" bson:"streamId"`
	LearnerID bson.ObjectID `json:"learnerId" bson:"learnerId"`
	ExpertID  bson.ObjectID `json:"expertId" bson:"expertId"`
	Rating    int           `json:"rating" bson:"rating"` // 1-5
	Comment   string        `json:"comment" bson:"comment"`
	CreatedAt time.Time     `json:"createdAt" bson:"createdAt"`
}

// ─── Notifications ──────────────────────────────────────────

type NotificationType string

const (
	NotifStreamLive      NotificationType = "stream_live"
	NotifStreamEnded     NotificationType = "stream_ended"
	NotifBookingConfirmed NotificationType = "booking_confirmed"
	NotifChallengePass   NotificationType = "challenge_pass"
	NotifChallengeFail   NotificationType = "challenge_fail"
	NotifNewReview       NotificationType = "new_review"
	NotifXPAwarded       NotificationType = "xp_awarded"
	NotifBadgeEarned     NotificationType = "badge_earned"
	NotifNewCommentary   NotificationType = "new_commentary"
)

type Notification struct {
	ID        bson.ObjectID    `json:"id" bson:"_id,omitempty"`
	UserID    bson.ObjectID    `json:"userId" bson:"userId"`
	Type      NotificationType `json:"type" bson:"type"`
	Title     string           `json:"title" bson:"title"`
	Message   string           `json:"message" bson:"message"`
	Read      bool             `json:"read" bson:"read"`
	Link      string           `json:"link" bson:"link"`
	CreatedAt time.Time        `json:"createdAt" bson:"createdAt"`
}

// ─── Learner Progress & Gamification ────────────────────────

type BadgeName string

const (
	BadgeFirstSubmit   BadgeName = "first_submit"
	BadgeTenPasses     BadgeName = "ten_passes"
	BadgeFiftyPasses   BadgeName = "fifty_passes"
	BadgeStreakWeek    BadgeName = "streak_week"
	BadgeStreakMonth   BadgeName = "streak_month"
	BadgePolyglot     BadgeName = "polyglot"      // pass challenges in 3+ languages
	BadgeBookworm     BadgeName = "bookworm"       // complete a learning path
	BadgeReviewer     BadgeName = "reviewer"       // leave 5+ reviews
)

type Badge struct {
	Name     BadgeName `json:"name" bson:"name"`
	EarnedAt time.Time `json:"earnedAt" bson:"earnedAt"`
}

type Progress struct {
	ID                  bson.ObjectID `json:"id" bson:"_id,omitempty"`
	LearnerID           bson.ObjectID `json:"learnerId" bson:"learnerId"`
	ChallengesCompleted int           `json:"challengesCompleted" bson:"challengesCompleted"`
	ChallengesFailed    int           `json:"challengesFailed" bson:"challengesFailed"`
	StreakDays           int           `json:"streakDays" bson:"streakDays"`
	XPTotal             int           `json:"xpTotal" bson:"xpTotal"`
	Badges              []Badge       `json:"badges" bson:"badges"`
	LanguagesUsed       []string      `json:"languagesUsed" bson:"languagesUsed"`
	LastActiveDate      time.Time     `json:"lastActiveDate" bson:"lastActiveDate"`
	CreatedAt           time.Time     `json:"createdAt" bson:"createdAt"`
}

// ─── Learning Paths ─────────────────────────────────────────

type PathStepType string

const (
	PathStepChallenge PathStepType = "challenge"
	PathStepStream    PathStepType = "stream"
	PathStepBook      PathStepType = "book"
)

type PathStep struct {
	Type       PathStepType  `json:"type" bson:"type"`
	ResourceID bson.ObjectID `json:"resourceId" bson:"resourceId"`
	Title      string        `json:"title" bson:"title"`
	Order      int           `json:"order" bson:"order"`
}

type LearningPath struct {
	ID          bson.ObjectID `json:"id" bson:"_id,omitempty"`
	Title       string        `json:"title" bson:"title"`
	Description string        `json:"description" bson:"description"`
	Difficulty  string        `json:"difficulty" bson:"difficulty"`
	Tags        []string      `json:"tags" bson:"tags"`
	Steps       []PathStep    `json:"steps" bson:"steps"`
	ExpertID    bson.ObjectID `json:"expertId" bson:"expertId"`
	CreatedAt   time.Time     `json:"createdAt" bson:"createdAt"`
}

type PathEnrollment struct {
	ID              bson.ObjectID `json:"id" bson:"_id,omitempty"`
	LearnerID       bson.ObjectID `json:"learnerId" bson:"learnerId"`
	PathID          bson.ObjectID `json:"pathId" bson:"pathId"`
	CompletedSteps  []int         `json:"completedSteps" bson:"completedSteps"` // step order indexes
	CreatedAt       time.Time     `json:"createdAt" bson:"createdAt"`
}

// ─── Expert Commentaries ────────────────────────────────────

type Commentary struct {
	ID         bson.ObjectID `json:"id" bson:"_id,omitempty"`
	StreamID   bson.ObjectID `json:"streamId" bson:"streamId"`
	ExpertID   bson.ObjectID `json:"expertId" bson:"expertId"`
	BookmarkID bson.ObjectID `json:"bookmarkId" bson:"bookmarkId"`
	Text       string        `json:"text" bson:"text"`
	AudioURL   string        `json:"audioUrl" bson:"audioUrl"`
	CreatedAt  time.Time     `json:"createdAt" bson:"createdAt"`
}

// ─── AI / RAG ───────────────────────────────────────────────

type AIReviewRequest struct {
	ChallengeID string `json:"challengeId"`
	Code        string `json:"code"`
	Language    string `json:"language"`
}

type AIReviewResponse struct {
	Summary     string   `json:"summary"`
	Issues      []string `json:"issues"`
	Suggestions []string `json:"suggestions"`
	Praise      []string `json:"praise"`
	Score       int      `json:"score"` // 0-100
}

type AIHintRequest struct {
	ChallengeID string `json:"challengeId"`
	Code        string `json:"code"`
	Language    string `json:"language"`
}

type AIHintResponse struct {
	Hint       string `json:"hint"`
	Concept    string `json:"concept"`
	ResourceURL string `json:"resourceUrl"`
}

// ─── Pagination ─────────────────────────────────────────────

type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Page       int         `json:"page"`
	Limit      int         `json:"limit"`
	Total      int64       `json:"total"`
	TotalPages int         `json:"totalPages"`
}

// ─── Analytics & Onboarding ──────────────────────────────────

type AnalyticsEvent struct {
	ID         bson.ObjectID          `json:"id" bson:"_id,omitempty"`
	UserID     *bson.ObjectID         `json:"userId,omitempty" bson:"userId,omitempty"`
	EventType  string                 `json:"eventType" bson:"eventType"`
	TargetID   string                 `json:"targetId" bson:"targetId"`
	TargetType string                 `json:"targetType" bson:"targetType"`
	Metadata   map[string]interface{} `json:"metadata" bson:"metadata"`
	CreatedAt  time.Time              `json:"createdAt" bson:"createdAt"`
}
