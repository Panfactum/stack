package handlers

import (
	"demo-tracker-service/models"
	"encoding/json"
	"gorm.io/gorm"
	"net/http"
)

type TrackRequest struct {
	TargetURL string `json:"target_url"`
}

func TrackURLHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req TrackRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request payload", http.StatusBadRequest)
			return
		}

		if req.TargetURL == "" {
			http.Error(w, "Target URL is required", http.StatusBadRequest)
			return
		}

		url := models.URL{
			TargetURL: req.TargetURL,
		}

		// Check if URL already exists
		var existingURL models.URL
		if db == nil {
			http.Error(w, "Database connection is not available", http.StatusInternalServerError)
			return
		}
		if err := db.Where("target_url = ?", req.TargetURL).First(&existingURL).Error; err == nil {
			http.Error(w, "URL already exists", http.StatusConflict)
			return
		}

		// Save the new URL
		if err := db.Create(&url).Error; err != nil {
			http.Error(w, "Failed to save target URL", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"message": "URL tracked successfully"})
	}
}
