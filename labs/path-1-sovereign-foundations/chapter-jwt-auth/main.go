package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	"go.opentelemetry.io/otel/sdk/resource"
	"go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
	oteltrace "go.opentelemetry.io/otel/trace"
)

const (
	defaultPort     = "8080"
	defaultIssuer   = "nexusflow-lab"
	defaultAudience = "nexusflow-user"
	defaultTokenTTL = 1 * time.Hour

	// Rate limiting defaults
	defaultRateLimitBurst  = 5
	defaultRateLimitRefill = 1 * time.Second
)

type appConfig struct {
	port            string
	secretKey       string
	issuer          string
	audience        string
	tokenTTL        time.Duration
	rateLimitBurst  int
	rateLimitRefill time.Duration
}

type failureCause string

const (
	failureCauseCpu    failureCause = "cpu"
	failureCauseMemory failureCause = "memory"
	failureCauseDisk   failureCause = "disk"
)

func parseFailureCause(s string) (failureCause, error) {
	switch strings.ToLower(s) {
	case "cpu":
		return failureCauseCpu, nil
	case "memory":
		return failureCauseMemory, nil
	case "disk":
		return failureCauseDisk, nil
	default:
		return "", fmt.Errorf("invalid failure cause: %s", s)
	}
}

type labState struct {
	LatencyInjectedMs *uint64                 `json:"latency_injected_ms,omitempty"`
	NetworkPartitions []string                `json:"network_partitions"`
	NodeFailures      map[string]failureCause `json:"node_failures"`
}

type runtimeMetricsSnapshot struct {
	AuthRequestsTotal              uint64 `json:"auth_requests_total"`
	AuthSuccessTotal               uint64 `json:"auth_success_total"`
	AuthFailureTotal               uint64 `json:"auth_failure_total"`
	AlertsReceivedTotal            uint64 `json:"alerts_received_total"`
	NarrativeMutationsTotal        uint64 `json:"narrative_mutations_total"`
	NarrativeMutationFailuresTotal uint64 `json:"narrative_mutation_failures_total"`
	RateLimitRejectionsTotal       uint64 `json:"rate_limit_rejections_total"`
	StateReadsTotal                uint64 `json:"state_reads_total"`
	MetricsReadsTotal              uint64 `json:"metrics_reads_total"`
	LastAuthProcessingNs           int64  `json:"last_auth_processing_ns"`
	LastMutationProcessingNs       int64  `json:"last_mutation_processing_ns"`
}

type narrativeMutationRequest struct {
	Type     string   `json:"type"`
	DelayUs  uint32   `json:"delay_us,omitempty"`
	Channels []string `json:"channels,omitempty"`
	NodeID   string   `json:"node_id,omitempty"`
	Cause    string   `json:"cause,omitempty"`
}

type narrativeMutationResponse struct {
	AppliedMutation narrativeMutationRequest `json:"applied_mutation"`
	State           labState                 `json:"state"`
	Metrics         runtimeMetricsSnapshot   `json:"metrics"`
}

type alertmanagerWebhookPayload struct {
	Status string `json:"status"`
	Alerts []struct {
		Status string `json:"status"`
	} `json:"alerts"`
}

type labRuntime struct {
	mu      sync.Mutex
	state   labState
	metrics runtimeMetricsSnapshot
}

func newLabRuntime() *labRuntime {
	return &labRuntime{
		state: labState{
			NetworkPartitions: []string{},
			NodeFailures:      make(map[string]failureCause),
		},
	}
}

func (runtime *labRuntime) recordAuthRequest() {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	runtime.metrics.AuthRequestsTotal++
}

func (runtime *labRuntime) recordAuthSuccess(started time.Time) {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	runtime.metrics.AuthSuccessTotal++
	runtime.metrics.LastAuthProcessingNs = time.Since(started).Nanoseconds()
}

func (runtime *labRuntime) recordAuthFailure() {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	runtime.metrics.AuthFailureTotal++
}

func (runtime *labRuntime) recordNarrativeMutationFailure() {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	runtime.metrics.NarrativeMutationFailuresTotal++
}

func (runtime *labRuntime) recordRateLimitRejection() {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	runtime.metrics.RateLimitRejectionsTotal++
}

func (runtime *labRuntime) recordAlertsReceived(count int) {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	runtime.metrics.AlertsReceivedTotal += uint64(count)
}

func cloneState(s labState) labState {
	partitions := make([]string, len(s.NetworkPartitions))
	copy(partitions, s.NetworkPartitions)

	failures := make(map[string]failureCause)
	for k, v := range s.NodeFailures {
		failures[k] = v
	}

	return labState{
		LatencyInjectedMs: s.LatencyInjectedMs,
		NetworkPartitions: partitions,
		NodeFailures:      failures,
	}
}

func (runtime *labRuntime) snapshotState() labState {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	runtime.metrics.StateReadsTotal++
	return cloneState(runtime.state)
}

func (runtime *labRuntime) snapshotMetrics() runtimeMetricsSnapshot {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	runtime.metrics.MetricsReadsTotal++
	return runtime.metrics
}

func (runtime *labRuntime) applyMutation(request narrativeMutationRequest, started time.Time) (labState, runtimeMetricsSnapshot, error) {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()

	switch request.Type {
	case "inject_latency":
		if request.DelayUs == 0 {
			return labState{}, runtimeMetricsSnapshot{}, errors.New("delay_us must be > 0")
		}
		if request.DelayUs >= 1000000 {
			return labState{}, runtimeMetricsSnapshot{}, errors.New("delay_us exceeds 1-second cap")
		}
		ms := uint64(request.DelayUs / 1000)
		runtime.state.LatencyInjectedMs = &ms
	case "partition_network":
		channels := slices.DeleteFunc(request.Channels, func(s string) bool {
			return strings.TrimSpace(s) == ""
		})
		if len(channels) == 0 {
			return labState{}, runtimeMetricsSnapshot{}, errors.New("channels must contain at least one value")
		}
		for _, channel := range channels {
			if !slices.Contains(runtime.state.NetworkPartitions, channel) {
				runtime.state.NetworkPartitions = append(runtime.state.NetworkPartitions, channel)
			}
		}
	case "fail_node":
		nodeID := strings.TrimSpace(request.NodeID)
		if nodeID == "" {
			return labState{}, runtimeMetricsSnapshot{}, errors.New("node_id is required")
		}
		cause, err := parseFailureCause(request.Cause)
		if err != nil {
			return labState{}, runtimeMetricsSnapshot{}, err
		}
		runtime.state.NodeFailures[nodeID] = cause
	default:
		return labState{}, runtimeMetricsSnapshot{}, errors.New("type must be one of inject_latency, partition_network, fail_node")
	}

	runtime.metrics.NarrativeMutationsTotal++
	runtime.metrics.LastMutationProcessingNs = time.Since(started).Nanoseconds()
	return cloneState(runtime.state), runtime.metrics, nil
}

// Token bucket rate limiter
type rateLimiter struct {
	mu         sync.Mutex
	tokens     int
	maxTokens  int
	refillRate time.Duration
	lastRefill time.Time
}

func newRateLimiter(burst int, refill time.Duration) *rateLimiter {
	return &rateLimiter{
		tokens:     burst,
		maxTokens:  burst,
		refillRate: refill,
		lastRefill: time.Now(),
	}
}

func (rl *rateLimiter) allow() bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(rl.lastRefill)
	refillCount := int(elapsed / rl.refillRate)

	if refillCount > 0 {
		rl.tokens += refillCount
		if rl.tokens > rl.maxTokens {
			rl.tokens = rl.maxTokens
		}
		// Accurate refill timing to prevent drift
		rl.lastRefill = rl.lastRefill.Add(time.Duration(refillCount) * rl.refillRate)
	}

	if rl.tokens > 0 {
		rl.tokens--
		return true
	}
	return false
}

// JWTAuthHandler issues and validates signed JWTs for the lab service.
type JWTAuthHandler struct {
	config         appConfig
	runtime        *labRuntime
	metricsHandler http.Handler
	limiter        *rateLimiter
	blacklist      map[string]time.Time
	blacklistMu    sync.RWMutex
	mu             sync.RWMutex
	currentSecret  string
	tracer         oteltrace.Tracer
}

type tokenClaims struct {
	Role string `json:"role"`
	jwt.RegisteredClaims
}

func loadConfig() (appConfig, error) {
	secret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if secret == "" {
		return appConfig{}, errors.New("JWT_SECRET must be set")
	}

	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = "8080"
	}

	issuer := strings.TrimSpace(os.Getenv("JWT_ISSUER"))
	if issuer == "" {
		issuer = defaultIssuer
	}

	audience := strings.TrimSpace(os.Getenv("JWT_AUDIENCE"))
	if audience == "" {
		audience = defaultAudience
	}

	tokenTTL := defaultTokenTTL
	if rawTTL := strings.TrimSpace(os.Getenv("JWT_TTL")); rawTTL != "" {
		parsedTTL, err := time.ParseDuration(rawTTL)
		if err != nil {
			return appConfig{}, errors.New("JWT_TTL must be a valid duration")
		}
		if parsedTTL <= 0 {
			return appConfig{}, errors.New("JWT_TTL must be greater than zero")
		}
		tokenTTL = parsedTTL
	}

	rateBurst := defaultRateLimitBurst
	if rawBurst := strings.TrimSpace(os.Getenv("RATE_LIMIT_BURST")); rawBurst != "" {
		parsedBurst, err := strconv.Atoi(rawBurst)
		if err == nil && parsedBurst > 0 {
			rateBurst = parsedBurst
		}
	}

	rateRefill := defaultRateLimitRefill
	if rawRefill := strings.TrimSpace(os.Getenv("RATE_LIMIT_REFILL")); rawRefill != "" {
		parsedRefill, err := time.ParseDuration(rawRefill)
		if err == nil && parsedRefill > 0 {
			rateRefill = parsedRefill
		}
	}

	return appConfig{
		port:            port,
		secretKey:       secret,
		issuer:          issuer,
		audience:        audience,
		tokenTTL:        tokenTTL,
		rateLimitBurst:  rateBurst,
		rateLimitRefill: rateRefill,
	}, nil
}

func NewJWTAuthHandler(config appConfig) *JWTAuthHandler {
	runtime := newLabRuntime()
	registry := prometheus.NewRegistry()
	registry.MustRegister(newLabRuntimeCollector(runtime))

	return &JWTAuthHandler{
		config:         config,
		runtime:        runtime,
		metricsHandler: promhttp.HandlerFor(registry, promhttp.HandlerOpts{}),
		limiter:        newRateLimiter(config.rateLimitBurst, config.rateLimitRefill),
		blacklist:      make(map[string]time.Time),
		currentSecret:  config.secretKey,
		tracer:         otel.Tracer("jwt-auth-backend"),
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("encode response: %v", err)
	}
}

func (h *JWTAuthHandler) rateLimitMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !h.limiter.allow() {
			h.runtime.recordRateLimitRejection()
			writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "too many requests"})
			return
		}
		next(w, r)
	}
}

// Health check endpoint — required by Docker healthcheck
func (h *JWTAuthHandler) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "healthy"})
}

func (h *JWTAuthHandler) handleReady(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status":    "ready",
		"issuer":    h.config.issuer,
		"audience":  h.config.audience,
		"token_ttl": h.config.tokenTTL.String(),
	})
}

func (h *JWTAuthHandler) handleState(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	writeJSON(w, http.StatusOK, h.runtime.snapshotState())
}

func (h *JWTAuthHandler) handleMetrics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	h.metricsHandler.ServeHTTP(w, r)
}

func (h *JWTAuthHandler) handleMetricsSnapshot(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	writeJSON(w, http.StatusOK, h.runtime.snapshotMetrics())
}

func (h *JWTAuthHandler) handleAlerts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var payload alertmanagerWebhookPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	h.runtime.recordAlertsReceived(len(payload.Alerts))
	log.Printf("Alertmanager webhook received: status=%q count=%d", payload.Status, len(payload.Alerts))
	writeJSON(w, http.StatusOK, map[string]any{"status": "received", "alerts": len(payload.Alerts)})
}

func (h *JWTAuthHandler) handleNarrativeMutation(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	started := time.Now()
	var request narrativeMutationRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		h.runtime.recordNarrativeMutationFailure()
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	state, metrics, err := h.runtime.applyMutation(request, started)
	if err != nil {
		h.runtime.recordNarrativeMutationFailure()
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, narrativeMutationResponse{
		AppliedMutation: request,
		State:           state,
		Metrics:         metrics,
	})
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

func validatePayload(payload JWTPayload) error {
	userID := strings.TrimSpace(payload.UserID)
	role := strings.TrimSpace(payload.Role)

	if userID == "" {
		return errors.New("user_id is required")
	}
	if len(userID) > 128 {
		return errors.New("user_id too long")
	}
	if role == "" {
		return errors.New("role is required")
	}

	switch role {
	case "admin", "operator", "viewer":
		return nil
	default:
		return errors.New("role must be one of admin, operator, viewer")
	}
}

// generateToken produces a signed HS256 JWT for the supplied payload.
func (h *JWTAuthHandler) generateToken(payload JWTPayload) (string, error) {
	now := time.Now().UTC()
	claims := tokenClaims{
		Role: payload.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    h.config.issuer,
			Subject:   payload.UserID,
			Audience:  jwt.ClaimStrings{h.config.audience},
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(h.config.tokenTTL)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.getSecret()))
}

func (h *JWTAuthHandler) validateToken(tokenString string) (*tokenClaims, error) {
	parsedToken, err := jwt.ParseWithClaims(tokenString, &tokenClaims{}, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(h.getSecret()), nil
	}, jwt.WithAudience(h.config.audience), jwt.WithIssuer(h.config.issuer))
	if err != nil {
		return nil, err
	}

	claims, ok := parsedToken.Claims.(*tokenClaims)
	if !ok || !parsedToken.Valid {
		return nil, errors.New("invalid token")
	}

	if h.isRevoked(tokenString) {
		return nil, errors.New("token has been revoked")
	}

	return claims, nil
}

// handleAuth processes an authentication request and returns a JWT token
func (h *JWTAuthHandler) handleAuth(w http.ResponseWriter, r *http.Request) {
	ctx, span := h.tracer.Start(r.Context(), "handleAuth")
	defer span.End()
	r = r.WithContext(ctx)

	started := time.Now()
	h.runtime.recordAuthRequest()

	if r.Method != http.MethodPost {
		h.runtime.recordAuthFailure()
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var payload JWTPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		h.runtime.recordAuthFailure()
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if err := validatePayload(payload); err != nil {
		h.runtime.recordAuthFailure()
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	log.Printf("✅ JWT Auth Backend: Processing authentication request for user=%q role=%q",
		payload.UserID, payload.Role)

	token, err := h.generateToken(payload)
	if err != nil {
		h.runtime.recordAuthFailure()
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "token generation failed"})
		return
	}

	h.runtime.recordAuthSuccess(started)

	writeJSON(w, http.StatusOK, AuthResponse{Token: token, Payload: payload})
}

func (h *JWTAuthHandler) getSecret() string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.currentSecret
}

func (h *JWTAuthHandler) rotateSecret(newSecret string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	log.Printf("Rotating JWT signing secret...")
	h.currentSecret = newSecret
}

func (h *JWTAuthHandler) handleRotateSecret(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var payload struct {
		NewSecret string `json:"new_secret"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if len(payload.NewSecret) < 32 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "secret too short (min 32 chars)"})
		return
	}

	h.rotateSecret(payload.NewSecret)
	writeJSON(w, http.StatusOK, map[string]string{"status": "secret rotated"})
}

func (h *JWTAuthHandler) revokeToken(tokenString string) {
	h.blacklistMu.Lock()
	defer h.blacklistMu.Unlock()
	h.blacklist[tokenString] = time.Now().Add(h.config.tokenTTL)
}

func (h *JWTAuthHandler) isRevoked(tokenString string) bool {
	h.blacklistMu.RLock()
	defer h.blacklistMu.RUnlock()
	expiry, found := h.blacklist[tokenString]
	if !found {
		return false
	}
	return time.Now().Before(expiry)
}

func (h *JWTAuthHandler) handleRevoke(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid or missing token"})
		return
	}

	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	_, err := h.validateToken(tokenString)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid token"})
		return
	}

	h.revokeToken(tokenString)
	writeJSON(w, http.StatusOK, map[string]string{"status": "token revoked"})
}

func securityMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none';")

		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func initTracer() (*trace.TracerProvider, error) {
	exporter, err := stdouttrace.New(stdouttrace.WithPrettyPrint())
	if err != nil {
		return nil, err
	}
	tp := trace.NewTracerProvider(
		trace.WithSampler(trace.AlwaysSample()),
		trace.WithBatcher(exporter),
		trace.WithResource(resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName("jwt-auth-backend"),
			attribute.String("environment", "lab"),
		)),
	)
	otel.SetTracerProvider(tp)
	return tp, nil
}
func main() {
	tp, err := initTracer()
	if err != nil {
		log.Fatal(err)
	}
	defer func() {
		if err := tp.Shutdown(context.Background()); err != nil {
			log.Printf("Error shutting down tracer provider: %v", err)
		}
	}()

	config, err := loadConfig()
	if err != nil {
		log.Fatalf("invalid configuration: %v", err)
	}

	handler := NewJWTAuthHandler(config)

	mux := http.NewServeMux()
	mux.HandleFunc("/health", handler.handleHealth)
	mux.HandleFunc("/readyz", handler.handleReady)
	mux.HandleFunc("/auth", handler.rateLimitMiddleware(handler.handleAuth))
	mux.HandleFunc("/revoke", handler.handleRevoke)
	mux.HandleFunc("/rotate-secret", handler.handleRotateSecret)
	mux.HandleFunc("/state", handler.handleState)
	mux.HandleFunc("/metrics", handler.handleMetrics)
	mux.HandleFunc("/metrics/snapshot", handler.handleMetricsSnapshot)
	mux.HandleFunc("/alerts", handler.handleAlerts)
	mux.HandleFunc("/narrative/apply", handler.rateLimitMiddleware(handler.handleNarrativeMutation))

	log.Printf("JWT auth backend listening on :%s issuer=%q audience=%q ttl=%s", config.port, config.issuer, config.audience, config.tokenTTL)
	log.Fatal(http.ListenAndServe(":"+config.port, securityMiddleware(mux)))
}

type labRuntimeCollector struct {
	runtime               *labRuntime
	authRequestsTotal     *prometheus.Desc
	authSuccessTotal      *prometheus.Desc
	authFailureTotal      *prometheus.Desc
	alertsReceivedTotal   *prometheus.Desc
	mutationsTotal        *prometheus.Desc
	mutationFailuresTotal *prometheus.Desc
	rateLimitRejections   *prometheus.Desc
	latencyInjectedMs     *prometheus.Desc
}

func newLabRuntimeCollector(runtime *labRuntime) *labRuntimeCollector {
	return &labRuntimeCollector{
		runtime: runtime,
		authRequestsTotal: prometheus.NewDesc(
			"jwt_lab_auth_requests_total",
			"Total number of authentication requests processed.",
			nil, nil,
		),
		authSuccessTotal: prometheus.NewDesc(
			"jwt_lab_auth_success_total",
			"Total number of successful authentication requests.",
			nil, nil,
		),
		authFailureTotal: prometheus.NewDesc(
			"jwt_lab_auth_failure_total",
			"Total number of failed authentication requests.",
			nil, nil,
		),
		alertsReceivedTotal: prometheus.NewDesc(
			"jwt_lab_alerts_received_total",
			"Total number of alerts received via the webhook endpoint.",
			nil, nil,
		),
		mutationsTotal: prometheus.NewDesc(
			"jwt_lab_narrative_mutations_total",
			"Total number of narrative state mutations applied.",
			nil, nil,
		),
		mutationFailuresTotal: prometheus.NewDesc(
			"jwt_lab_narrative_mutation_failures_total",
			"Total number of failed narrative state mutations.",
			nil, nil,
		),
		rateLimitRejections: prometheus.NewDesc(
			"jwt_lab_rate_limit_rejections_total",
			"Total number of requests rejected due to rate limiting.",
			nil, nil,
		),
		latencyInjectedMs: prometheus.NewDesc(
			"jwt_lab_latency_injected_milliseconds",
			"Currently injected artificial latency in milliseconds.",
			nil, nil,
		),
	}
}

func (c *labRuntimeCollector) Describe(ch chan<- *prometheus.Desc) {
	ch <- c.authRequestsTotal
	ch <- c.authSuccessTotal
	ch <- c.authFailureTotal
	ch <- c.alertsReceivedTotal
	ch <- c.mutationsTotal
	ch <- c.mutationFailuresTotal
	ch <- c.rateLimitRejections
	ch <- c.latencyInjectedMs
}

func (c *labRuntimeCollector) Collect(ch chan<- prometheus.Metric) {
	c.runtime.mu.Lock()
	state := cloneState(c.runtime.state)
	metrics := c.runtime.metrics
	c.runtime.mu.Unlock()

	ch <- prometheus.MustNewConstMetric(c.authRequestsTotal, prometheus.CounterValue, float64(metrics.AuthRequestsTotal))
	ch <- prometheus.MustNewConstMetric(c.authSuccessTotal, prometheus.CounterValue, float64(metrics.AuthSuccessTotal))
	ch <- prometheus.MustNewConstMetric(c.authFailureTotal, prometheus.CounterValue, float64(metrics.AuthFailureTotal))
	ch <- prometheus.MustNewConstMetric(c.alertsReceivedTotal, prometheus.CounterValue, float64(metrics.AlertsReceivedTotal))
	ch <- prometheus.MustNewConstMetric(c.mutationsTotal, prometheus.CounterValue, float64(metrics.NarrativeMutationsTotal))
	ch <- prometheus.MustNewConstMetric(c.mutationFailuresTotal, prometheus.CounterValue, float64(metrics.NarrativeMutationFailuresTotal))
	ch <- prometheus.MustNewConstMetric(c.rateLimitRejections, prometheus.CounterValue, float64(metrics.RateLimitRejectionsTotal))

	if state.LatencyInjectedMs != nil {
		ch <- prometheus.MustNewConstMetric(c.latencyInjectedMs, prometheus.GaugeValue, float64(*state.LatencyInjectedMs))
	} else {
		ch <- prometheus.MustNewConstMetric(c.latencyInjectedMs, prometheus.GaugeValue, 0)
	}
}
