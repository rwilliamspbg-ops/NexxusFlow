module github.com/nexxusflow/jwt-auth-stack/backend

// JWT Auth Backend Dependencies for NexusFlow Lab Prototype (Phase 0 MVP)
go 1.22  

require golang.org/x/crypto v0.19.0 

// Side-channel resistance verification from upgrade docs v1.2: 
// AES-GCM + ChaCha20-Poly1305 via safe Rust crates for enterprise tier  