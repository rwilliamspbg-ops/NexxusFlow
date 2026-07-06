package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const (
	defaultPort     = "8080"
	defaultIssuer   = "nexusflow-lab"
	defaultAudience = "nexusflow-user"
	defaultTokenTTL = 1 * time.Hour
)

type appConfig struct {
	port      string
	secretKey string
	issuer    string
	audience  string
	tokenTTL  time.Duration
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
	StateReadsTotal                uint64 `json:"state_reads_total"`
	MetricsReadsTotal              uint64 `json:"metrics_reads_total"`
	LastAuthProcessingNs           int64  `json:"last_auth_processing_ns"`
	LastMutationProcessingNs       int64  `json:"last_mutation_processing_ns"`
}

type narrativeMutationRequest struct {
	Type    string   `json:"type"`
	DelayUs uint32   `json:"delay_us,omitempty"`
	Channels []string `json:"channels,omitempty"`
	NodeID  string   `json:"node_id,omitempty"`
	Cause   string   `json:"cause,omitempty"`
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

// JWTAuthHandler issues and validates signed JWTs for the lab service.
type JWTAuthHandler struct {
	config         appConfig
	runtime        *labRuntime
	metricsHandler http.Handler
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

	return appConfig{
		port:      port,
		secretKey: secret,
		issuer:    issuer,
		audience:  audience,
		tokenTTL:  tokenTTL,
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
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("encode response: %v", err)
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
	payload.UserID = strings.TrimSpace(payload.UserID)
	payload.Role = strings.TrimSpace(payload.Role)

	if payload.UserID == "" {
		return errors.New("user_id is required")
	}
	if payload.Role == "" {
		return errors.New("role is required")
	}

	switch payload.Role {
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
	return token.SignedString([]byte(h.config.secretKey))
}

func (h *JWTAuthHandler) validateToken(tokenString string) (*tokenClaims, error) {
	parsedToken, err := jwt.ParseWithClaims(tokenString, &tokenClaims{}, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(h.config.secretKey), nil
	}, jwt.WithAudience(h.config.audience), jwt.WithIssuer(h.config.issuer))
	if err != nil {
		return nil, err
	}

	claims, ok := parsedToken.Claims.(*tokenClaims)
	if !ok || !parsedToken.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}

// handleAuth processes an authentication request and returns a JWT token
func (h *JWTAuthHandler) handleAuth(w http.ResponseWriter, r *http.Request) {
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

func main() {
	config, err := loadConfig()
	if err != nil {
		log.Fatalf("invalid configuration: %v", err)
	}

	handler := NewJWTAuthHandler(config)

	http.HandleFunc("/health", handler.handleHealth)
	http.HandleFunc("/readyz", handler.handleReady)
	http.HandleFunc("/auth", handler.handleAuth)
	http.HandleFunc("/state", handler.handleState)
	http.HandleFunc("/metrics", handler.handleMetrics)
	http.HandleFunc("/metrics/snapshot", handler.handleMetricsSnapshot)
	http.HandleFunc("/alerts", handler.handleAlerts)
	http.HandleFunc("/narrative/apply", handler.handleNarrativeMutation)

	log.Printf("JWT auth backend listening on :%s issuer=%q audience=%q ttl=%s", config.port, config.issuer, config.audience, config.tokenTTL)
	log.Fatal(http.ListenAndServe(":"+config.port, nil))
}

type labRuntimeCollector struct {
	runtime               *labRuntime
	authRequestsTotal     *prometheus.Desc
	authSuccessTotal      *prometheus.Desc
	authFailureTotal      *prometheus.Desc
	alertsReceivedTotal   *prometheus.Desc
	mutationsTotal        *prometheus.Desc
	mutationFailuresTotal *prometheus.Desc
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

	if state.LatencyInjectedMs != nil {
		ch <- prometheus.MustNewConstMetric(c.latencyInjectedMs, prometheus.GaugeValue, float64(*state.LatencyInjectedMs))
	} else {
		ch <- prometheus.MustNewConstMetric(c.latencyInjectedMs, prometheus.GaugeValue, 0)
	}
}
