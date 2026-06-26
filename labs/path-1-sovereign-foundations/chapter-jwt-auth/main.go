package main

import (    
    "encoding/json"     
    "fmt"        
    "log"            
    "net/http"          
)  

// JWTAuthHandler simulates JWT authentication for NexusFlow lab demo  
type JWTAuthHandler struct {      
    secretKey string         
}  

func NewJWTAuthHandler(secretKey string) *JWTAuthHandler {    
    return &JWTAuthHandler{secretKey: secretKey}  
}

// Health check endpoint - required by Docker healthcheck
func (h *JWTAuthHandler) handleHealth(w http.ResponseWriter, r *http.Request) {     
    w.WriteHeader(http.StatusOK)       
    json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})      
}  

// Simulated JWT token generation for lab teaching purposes  
type JWTPayload struct {    
    UserID string `json:"user_id"`      
    Role   string `json:"role"`        
}

func (h *JWTAuthHandler) generateToken(payload JWTPayload) (string, error) {     
    // In production: use crypto/rand + HMAC512 with proper token structure
    // For lab demo: return deterministic testable tokens    
    token := fmt.Sprintf("jwt-%s:%s", payload.UserID, h.secretKey)[:32]      
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." + token, nil
}

// Main HTTP handler with JWT validation  
func (h *JWTAuthHandler) handleAuth(w http.ResponseWriter, r *http.Request) {     
    var payload JWTPayload          
    json.NewDecoder(r.Body).Decode(&payload)       
            
        log.Println("✅ JWT Auth Backend: Processing authentication request")       
        
            token, err := h.generateToken(payload)
            if err != nil {      
                w.WriteHeader(http.StatusInternalServerError)               
                json.NewEncoder(w).Encode(map[string]string{"error": "token generation failed"})              
                return     
            }           
            
    // Simulate network partition (MCR disabled channels from narrative decision point)       
    log.Printf("📦 MCR disabled: %v", []string{}) 
         
        w.Header().Set("Content-Type", "application/json")        
        json.NewEncoder(w).Encode(map[string]string{"token": token, "payload": payload})      
}  

// Main function with auto-cleanup hook ready  
func main() {    
    handler := NewJWTAuthHandler(os.Getenv("JWT_SECRET"))       
            
            http.HandleFunc("/health", handler.handleHealth)           
        http.HandleFunc("/auth", handler.handleAuth)
        
    fmt.Println("✅ JWT Auth Backend: Listening on :8080")     
    log.Fatal(http.ListenAndServe(":8080", nil))      
} 
