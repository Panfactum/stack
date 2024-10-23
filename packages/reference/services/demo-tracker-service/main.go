package main

import (
	"demo-tracker-service/handlers"
	"demo-tracker-service/middleware"
	"demo-tracker-service/models"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"net/http"
	"os"
)

var db *gorm.DB

func init() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	dsn := os.Getenv("DATABASE_URL")
	var errDB error
	db, errDB = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if errDB != nil {
		log.Fatal("failed to connect to database:", errDB)
	}

	// Auto migrate the URL model
	err = db.AutoMigrate(&models.URL{})
	if err != nil {
		log.Fatal("failed to migrate database:", err)
	}
}

func main() {
	r := mux.NewRouter()

	// Add middleware for JWT auth
	r.Use(middleware.AuthMiddleware)

	// Add route to handle tracking
	r.HandleFunc("/track", handlers.TrackURLHandler(db)).Methods("POST")

	log.Println("Server started on :8080")
	http.ListenAndServe(":8080", r)
}
