package main

import (
	"demo-tracker-service/handlers"
	"demo-tracker-service/middleware"
	"demo-tracker-service/models"
	"fmt"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
	"log"
	"net/http"
	"os"
)

var db *gorm.DB

func init() {
	// Load environment variables from the .env file only if it exists (development)
	if _, err := os.Stat(".env"); err == nil {
		err := godotenv.Load()
		if err != nil {
			log.Fatal("Error loading .env file")
		}
	}

	// Read database configuration from environment variables
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbName := os.Getenv("DB_NAME")
	dbSchema := os.Getenv("DB_SCHEMA")
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")

	// Construct the connection string (DSN) for PostgreSQL
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s",
		dbHost, dbPort, dbUser, dbPassword, dbName)

	// Connect to the database
	var err error
	db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{
			SingularTable: false,
			TablePrefix:   dbSchema + ".",
		},
	})
	if err != nil {
		log.Fatal("failed to connect to database:", err)
	}

	err = db.AutoMigrate(&models.URL{})
	if err != nil {
		log.Fatal("failed to migrate database:", err)
	}
}

func main() {
	r := mux.NewRouter()

	r.HandleFunc("/health", handlers.HealthCheckHandler).Methods("GET")

	trackRouter := r.PathPrefix("/track").Subrouter()
	trackRouter.Use(middleware.AuthMiddleware)
	trackRouter.HandleFunc("/", handlers.TrackURLHandler(db)).Methods("POST")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // Default port if not set
	}

	log.Printf("Server starting on port %s", port)
	err := http.ListenAndServe(fmt.Sprintf(":%s", port), r)
	if err != nil {
		log.Fatal("Server failed to start:", err)
	}
	log.Printf("Server started on port %s", port)
}
