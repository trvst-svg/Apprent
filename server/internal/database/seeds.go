package database

import (
	"context"
	"log"
	"time"

	"server/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func SeedDatabase() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Seed Books
	booksColl := GetCollection("books")
	count, err := booksColl.CountDocuments(ctx, bson.M{})
	if err == nil && count == 0 {
		log.Println("Seeding books collection...")
		books := []interface{}{
			models.Book{
				ID:          bson.NewObjectID(),
				Title:       "Eloquent JavaScript, 3rd Edition",
				Author:      "Marijn Haverbeke",
				Language:    "javascript",
				Difficulty:  "intermediate",
				URL:         "https://eloquentjavascript.net/",
				Description: "A modern introduction to programming, JavaScript, and the wonders of the digital world.",
				CoverURL:    "https://eloquentjavascript.net/img/cover.jpg",
			},
			models.Book{
				ID:          bson.NewObjectID(),
				Title:       "Automate the Boring Stuff with Python",
				Author:      "Al Sweigart",
				Language:    "python",
				Difficulty:  "beginner",
				URL:         "https://automatetheboringstuff.com/",
				Description: "Learn how to use Python to write programs that do in minutes what would take you hours to do by hand.",
				CoverURL:    "https://automatetheboringstuff.com/images/automate_cover_medium.png",
			},
			models.Book{
				ID:          bson.NewObjectID(),
				Title:       "The Rust Programming Language",
				Author:      "Steve Klabnik, Carol Nichols",
				Language:    "rust",
				Difficulty:  "intermediate",
				URL:         "https://doc.rust-lang.org/book/",
				Description: "The official guide to using Rust, covering safety, concurrency, speed, and toolchains.",
				CoverURL:    "https://doc.rust-lang.org/book/img/rust-logo-blk.svg",
			},
			models.Book{
				ID:          bson.NewObjectID(),
				Title:       "An Introduction to Programming in Go",
				Author:      "Caleb Doxsey",
				Language:    "go",
				Difficulty:  "beginner",
				URL:         "http://www.golang-book.com/",
				Description: "A short, concise introduction to computer programming using the Go programming language.",
				CoverURL:    "http://www.golang-book.com/assets/img/book-cover.png",
			},
			models.Book{
				ID:          bson.NewObjectID(),
				Title:       "How to Code in Go",
				Author:      "Mark Bates, Cory LaNou",
				Language:    "go",
				Difficulty:  "intermediate",
				URL:         "https://www.digitalocean.com/community/books/how-to-code-in-go",
				Description: "A comprehensive guide to understanding package imports, variables, interfaces, concurrency, and web development in Go.",
				CoverURL:    "https://images.prismic.io/digitalocean/a9f02901-b20f-488b-a4be-b33ec81387d8_go-book-cover.png",
			},
			models.Book{
				ID:          bson.NewObjectID(),
				Title:       "Learn C++",
				Author:      "Alex (learncpp.com)",
				Language:    "cpp",
				Difficulty:  "beginner",
				URL:         "https://www.learncpp.com/",
				Description: "A free, high-quality reference website dedicated to teaching you how to program in C++.",
				CoverURL:    "https://www.learncpp.com/images/cpp-logo.png",
			},
			models.Book{
				ID:          bson.NewObjectID(),
				Title:       "Introduction to Programming Using Java",
				Author:      "David J. Eck",
				Language:    "java",
				Difficulty:  "beginner",
				URL:         "https://math.hws.edu/javanotes/",
				Description: "A free online textbook on introductory programming, which uses Java as the language of instruction.",
				CoverURL:    "https://math.hws.edu/javanotes/c1/java-cup.gif",
			},
			models.Book{
				ID:          bson.NewObjectID(),
				Title:       "TypeScript Deep Dive",
				Author:      "Basarat Ali Syed",
				Language:    "typescript",
				Difficulty:  "advanced",
				URL:         "https://basarat.gitbook.io/typescript/",
				Description: "The definitive guide to TypeScript. Learn type safety, decorators, compiler options, and structural subtyping.",
				CoverURL:    "https://raw.githubusercontent.com/basarat/typescript-book/master/images/cover.png",
			},
			models.Book{
				ID:          bson.NewObjectID(),
				Title:       "Learn to Code HTML & CSS",
				Author:      "Shay Howe",
				Language:    "html-css",
				Difficulty:  "beginner",
				URL:         "https://learn.shayhowe.com/html-css/",
				Description: "A simple and comprehensive guide dedicated to helping beginner to intermediate developers build beautiful websites.",
				CoverURL:    "https://learn.shayhowe.com/assets/images/shayhowe-square.png",
			},
		}
		_, err = booksColl.InsertMany(ctx, books)
		if err != nil {
			log.Printf("Failed to seed books: %v", err)
		}
	}

	// 2. Seed Challenges (if empty)
	challengesColl := GetCollection("sandbox_challenges")
	chCount, err := challengesColl.CountDocuments(ctx, bson.M{})
	if err == nil && chCount == 0 {
		log.Println("Seeding sandbox challenges collection...")
		challenges := []interface{}{
			models.SandboxChallenge{
				ID:          bson.NewObjectID(),
				Title:       "Reverse a String (Python)",
				Description: "Write a function `reverse_string(s: str) -> str` that returns the input string reversed. Ensure it works on empty strings and special characters.",
				Difficulty:  "beginner",
				Files: []models.SandboxFile{
					{
						Path:    "solution.py",
						Content: "def reverse_string(s: str) -> str:\n    # TODO: Implement string reversal\n    return s[::-1]\n",
					},
				},
				Validation: models.Validation{
					Type:    "python",
					Scripts: []string{"reverse_string"},
				},
				ExpertID:  bson.NewObjectID(),
				CreatedAt: time.Now(),
			},
			models.SandboxChallenge{
				ID:          bson.NewObjectID(),
				Title:       "Filter Array Elements (JavaScript)",
				Description: "Implement a function `filterArray(arr, predicate)` that returns a new array containing only elements that satisfy the predicate. Do not use the built-in Array.prototype.filter.",
				Difficulty:  "beginner",
				Files: []models.SandboxFile{
					{
						Path:    "solution.js",
						Content: "function filterArray(arr, predicate) {\n  // TODO: Implement custom filter\n  const result = [];\n  for (let i = 0; i < arr.length; i++) {\n    if (predicate(arr[i])) {\n      result.push(arr[i]);\n    }\n  }\n  return result;\n}\n",
					},
				},
				Validation: models.Validation{
					Type:    "javascript",
					Scripts: []string{"filterArray"},
				},
				ExpertID:  bson.NewObjectID(),
				CreatedAt: time.Now(),
			},
			models.SandboxChallenge{
				ID:          bson.NewObjectID(),
				Title:       "Safe Goroutine Cleanup (Go)",
				Description: "Refactor the template to close the Go channel properly and prevent routine leaks. Compiles and executes under Go 1.26.",
				Difficulty:  "intermediate",
				Files: []models.SandboxFile{
					{
						Path:    "main.go",
						Content: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n)\n\nfunc main() {\n\t// TODO: Implement safe channel cleanup without leaks\n\tch := make(chan bool)\n\tgo func() {\n\t\tch <- true\n\t}()\n\tfmt.Println(<-ch)\n}\n",
					},
				},
				Validation: models.Validation{
					Type:    "go",
					Scripts: []string{"close("},
				},
				ExpertID:  bson.NewObjectID(),
				CreatedAt: time.Now(),
			},
		}
		_, err = challengesColl.InsertMany(ctx, challenges)
		if err != nil {
			log.Printf("Failed to seed challenges: %v", err)
		}
	}
}
