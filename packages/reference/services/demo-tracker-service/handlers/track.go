package handlers

import (
	"encoding/json"

	"net/http"

	"demo-tracker-service/models"
	"gorm.io/gorm"
)

type TrackRequest struct {
	TargetURL string `json:"target_url"`
}

func TrackURLHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.Context().Value("user_id").(string)

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
			UserID:    userID,
			TargetURL: req.TargetURL,
		}

		// Check if URL already exists for the user
		var existingURL models.URL
		if err := db.Where("user_id = ? AND target_url = ?", userID, req.TargetURL).First(&existingURL).Error; err == nil {
			http.Error(w, "URL already exists for this user", http.StatusConflict)
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
