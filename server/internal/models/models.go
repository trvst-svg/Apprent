package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

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
	CreatedAt    time.Time     `json:"createdAt" bson:"createdAt"`
	UpdatedAt    time.Time     `json:"updatedAt" bson:"updatedAt"`
}

type Profile struct {
	Bio        string   `json:"bio" bson:"bio"`
	AvatarURL  string   `json:"avatarUrl" bson:"avatarUrl"`
	Skills     []string `json:"skills" bson:"skills"`
	Title      string   `json:"title" bson:"title"`
	Company    string   `json:"company" bson:"company"`
	HourlyRate float64  `json:"hourlyRate" bson:"hourlyRate"`
	Rating     float64  `json:"rating" bson:"rating"`
}

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

type Bookmark struct {
	ID        bson.ObjectID `json:"id" bson:"_id,omitempty"`
	LearnerID bson.ObjectID `json:"learnerId" bson:"learnerId"`
	StreamID  bson.ObjectID `json:"streamId" bson:"streamId"`
	Timestamp int           `json:"timestamp" bson:"timestamp"` // seconds mark
	Notes     string        `json:"notes" bson:"notes"`
	CreatedAt time.Time     `json:"createdAt" bson:"createdAt"`
}

type SandboxFile struct {
	Path    string `json:"path" bson:"path"`
	Content string `json:"content" bson:"content"`
}

type SandboxChallenge struct {
	ID          bson.ObjectID `json:"id" bson:"_id,omitempty"`
	Title       string        `json:"title" bson:"title"`
	Description string        `json:"description" bson:"description"`
	Difficulty  string        `json:"difficulty" bson:"difficulty"` // e.g. "beginner", "intermediate", "advanced"
	Files       []SandboxFile `json:"files" bson:"files"`
	Validation  Validation    `json:"validation" bson:"validation"`
	ExpertID    bson.ObjectID `json:"expertId" bson:"expertId"`
	CreatedAt   time.Time     `json:"createdAt" bson:"createdAt"`
}

type Validation struct {
	Type    string   `json:"type" bson:"type"` // e.g. "unit_test"
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
