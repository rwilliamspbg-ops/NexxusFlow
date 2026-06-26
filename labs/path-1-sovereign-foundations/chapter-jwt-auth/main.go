package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
)

// JWTAuthHandler simulates JWT authentication for NexusFlow lab demo
type JWTAuthHandler struct {
	secretKey string
}

func NewJWTAuthHandler(secretKey string) *JWTAuthHandler {
	return &JWTAuthHandler{secretKey: secretKey}
}

// Health check endpoint — required by Docker healthcheck
func (h *JWTAuthHandler) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
}

// JWTPayload holds the fields decoded from an auth request body
type JWTPayload struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
}

// AuthResponse is the JSON body returned by /auth
type AuthResponse struct {
	Token   string     `json:"token"`
	Payload JWTPayload `json:"payload"`
}

// generateToken produces a deterministic demo token.
// Production use: replace with a proper HMAC-SHA256 / RS256 signed JWT.
func (h *JWTAuthHandler) generateToken(payload JWTPayload) (string, error) {
	raw := fmt.Sprintf("jwt-%s:%s", payload.UserID, h.secretKey)
	if len(raw) > 32 {
		raw = raw[:32]
	}
	return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." + raw, nil
}

// handleAuth processes an authentication request and returns a JWT token
func (h *JWTAuthHandler) handleAuth(w http.ResponseWriter, r *http.Request) {
	var payload JWTPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid request body"})
		return
	}

	log.Printf("✅ JWT Auth Backend: Processing authentication request for user=%q role=%q",
		payload.UserID, payload.Role)

	token, err := h.generateToken(payload)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "token generation failed"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AuthResponse{Token: token, Payload: payload})
}

func main() {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "dev-secret-change-in-production"
		log.Println("⚠️  JWT_SECRET not set — using insecure default (dev only)")
	}

	handler := NewJWTAuthHandler(secret)

	http.HandleFunc("/health", handler.handleHealth)
	http.HandleFunc("/auth", handler.handleAuth)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("✅ JWT Auth Backend: Listening on :%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
