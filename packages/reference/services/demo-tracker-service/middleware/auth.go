package middleware

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get the Authorization header from the request
		authHeader := r.Header.Get("Authorization")

		// Check if the Authorization header is present and properly formatted
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, "Missing or invalid Authorization header", http.StatusUnauthorized)
			return
		}

		// Extract the token from the Authorization header (after "Bearer ")
		token := strings.TrimPrefix(authHeader, "Bearer ")

		// Define the external API URL for token validation (set via environment variable)
		validationURL := os.Getenv("TOKEN_VALIDATION_URL")
		if validationURL == "" {
			log.Fatal("TOKEN_VALIDATION_URL is not set")
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		fmt.Println(validationURL)
		// Create a new HTTP request to validate the token
		req, err := http.NewRequest("GET", validationURL, nil)
		if err != nil {
			http.Error(w, "Failed to create validation request", http.StatusInternalServerError)
			return
		}

		// Set the Authorization header with the Bearer token for the API call
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

		// Set a timeout for the API call
		client := &http.Client{Timeout: 5 * time.Second}
		fmt.Println(validationURL)
		// Make the API request to validate the token
		resp, err := client.Do(req)
		if err != nil {
			http.Error(w, "Failed to validate token", http.StatusUnauthorized)
			return
		}
		defer resp.Body.Close()

		// Check if the response status is 200 OK (valid token)
		if resp.StatusCode != http.StatusOK {
			http.Error(w, "Unauthorized: Invalid token", http.StatusUnauthorized)
			return
		}
		fmt.Println("token is valid")
		// Token is valid, call the next handler in the chain
		next.ServeHTTP(w, r)
	})
}
