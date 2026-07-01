package main

import (
	"encoding/json"
	"errors"
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
	defaultTokenTTL = 15 * time.Minute
	defaultIssuer   = "nexusflow-jwt-lab"
	defaultAudience = "nexusflow-lab-clients"
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
	failureCauseCPU    failureCause = "cpu"
	failureCauseMemory failureCause = "memory"
	failureCauseDisk   failureCause = "disk"
)

type labState struct {
	LatencyInjectedMs *uint64                 `json:"latency_injected_ms,omitempty"`
	NetworkPartitions []string                `json:"network_partitions"`
	NodeFailures      map[string]failureCause `json:"node_failures"`
}

type runtimeMetricsSnapshot struct {
	AuthRequestsTotal              uint64 `json:"auth_requests_total"`
	AuthSuccessTotal               uint64 `json:"auth_success_total"`
	AuthFailureTotal               uint64 `json:"auth_failure_total"`
	NarrativeMutationsTotal        uint64 `json:"narrative_mutations_total"`
	NarrativeMutationFailuresTotal uint64 `json:"narrative_mutation_failures_total"`
	StateReadsTotal                uint64 `json:"state_reads_total"`
	MetricsReadsTotal              uint64 `json:"metrics_reads_total"`
	LastAuthProcessingNs           int64  `json:"last_auth_processing_ns"`
	LastMutationProcessingNs       int64  `json:"last_mutation_processing_ns"`
}

type narrativeMutationRequest struct {
	Type     string   `json:"type"`
	DelayUS  uint32   `json:"delay_us,omitempty"`
	Channels []string `json:"channels,omitempty"`
	NodeID   string   `json:"node_id,omitempty"`
	Cause    string   `json:"cause,omitempty"`
}

type narrativeMutationResponse struct {
	AppliedMutation narrativeMutationRequest `json:"applied_mutation"`
	State           labState                 `json:"state"`
	Metrics         runtimeMetricsSnapshot   `json:"metrics"`
}

type labRuntime struct {
	mu      sync.Mutex
	state   labState
	metrics runtimeMetricsSnapshot
}

type runtimeSnapshot struct {
	state   labState
	metrics runtimeMetricsSnapshot
}

type labRuntimeCollector struct {
	runtime *labRuntime
	descs   map[string]*prometheus.Desc
}

func newLabRuntimeCollector(runtime *labRuntime) *labRuntimeCollector {
	return &labRuntimeCollector{
		runtime: runtime,
		descs: map[string]*prometheus.Desc{
			"auth_requests_total":                  prometheus.NewDesc("jwt_lab_auth_requests_total", "Total JWT auth requests received.", nil, nil),
			"auth_success_total":                   prometheus.NewDesc("jwt_lab_auth_success_total", "Total successful JWT auth responses.", nil, nil),
			"auth_failure_total":                   prometheus.NewDesc("jwt_lab_auth_failure_total", "Total failed JWT auth responses.", nil, nil),
			"narrative_mutations_total":            prometheus.NewDesc("jwt_lab_narrative_mutations_total", "Total successful narrative mutations applied.", nil, nil),
			"narrative_mutation_failures_total":    prometheus.NewDesc("jwt_lab_narrative_mutation_failures_total", "Total failed narrative mutation requests.", nil, nil),
			"state_reads_total":                    prometheus.NewDesc("jwt_lab_state_reads_total", "Total runtime state snapshot reads.", nil, nil),
			"metrics_reads_total":                  prometheus.NewDesc("jwt_lab_metrics_reads_total", "Total runtime metrics scrapes and snapshot reads.", nil, nil),
			"last_auth_processing_nanoseconds":     prometheus.NewDesc("jwt_lab_last_auth_processing_nanoseconds", "Duration in nanoseconds of the last successful auth request.", nil, nil),
			"last_mutation_processing_nanoseconds": prometheus.NewDesc("jwt_lab_last_mutation_processing_nanoseconds", "Duration in nanoseconds of the last successful narrative mutation.", nil, nil),
			"latency_injected_milliseconds":        prometheus.NewDesc("jwt_lab_latency_injected_milliseconds", "Current injected latency in milliseconds.", nil, nil),
			"network_partitions":                   prometheus.NewDesc("jwt_lab_network_partitions", "Current number of active network partitions.", nil, nil),
			"node_failures":                        prometheus.NewDesc("jwt_lab_node_failures", "Current number of tracked node failures.", nil, nil),
		},
	}
}

func (collector *labRuntimeCollector) Describe(ch chan<- *prometheus.Desc) {
	for _, desc := range collector.descs {
		ch <- desc
	}
}

func (collector *labRuntimeCollector) Collect(ch chan<- prometheus.Metric) {
	snapshot := collector.runtime.snapshotForMetrics()
	latencyMs := float64(0)
	if snapshot.state.LatencyInjectedMs != nil {
		latencyMs = float64(*snapshot.state.LatencyInjectedMs)
	}

	ch <- prometheus.MustNewConstMetric(collector.descs["auth_requests_total"], prometheus.CounterValue, float64(snapshot.metrics.AuthRequestsTotal))
	ch <- prometheus.MustNewConstMetric(collector.descs["auth_success_total"], prometheus.CounterValue, float64(snapshot.metrics.AuthSuccessTotal))
	ch <- prometheus.MustNewConstMetric(collector.descs["auth_failure_total"], prometheus.CounterValue, float64(snapshot.metrics.AuthFailureTotal))
	ch <- prometheus.MustNewConstMetric(collector.descs["narrative_mutations_total"], prometheus.CounterValue, float64(snapshot.metrics.NarrativeMutationsTotal))
	ch <- prometheus.MustNewConstMetric(collector.descs["narrative_mutation_failures_total"], prometheus.CounterValue, float64(snapshot.metrics.NarrativeMutationFailuresTotal))
	ch <- prometheus.MustNewConstMetric(collector.descs["state_reads_total"], prometheus.CounterValue, float64(snapshot.metrics.StateReadsTotal))
	ch <- prometheus.MustNewConstMetric(collector.descs["metrics_reads_total"], prometheus.CounterValue, float64(snapshot.metrics.MetricsReadsTotal))
	ch <- prometheus.MustNewConstMetric(collector.descs["last_auth_processing_nanoseconds"], prometheus.GaugeValue, float64(snapshot.metrics.LastAuthProcessingNs))
	ch <- prometheus.MustNewConstMetric(collector.descs["last_mutation_processing_nanoseconds"], prometheus.GaugeValue, float64(snapshot.metrics.LastMutationProcessingNs))
	ch <- prometheus.MustNewConstMetric(collector.descs["latency_injected_milliseconds"], prometheus.GaugeValue, latencyMs)
	ch <- prometheus.MustNewConstMetric(collector.descs["network_partitions"], prometheus.GaugeValue, float64(len(snapshot.state.NetworkPartitions)))
	ch <- prometheus.MustNewConstMetric(collector.descs["node_failures"], prometheus.GaugeValue, float64(len(snapshot.state.NodeFailures)))
}

func newLabRuntime() *labRuntime {
	return &labRuntime{
		state: labState{
			NetworkPartitions: []string{},
			NodeFailures:      map[string]failureCause{},
		},
	}
}

func cloneState(input labState) labState {
	cloned := labState{
		NetworkPartitions: append([]string(nil), input.NetworkPartitions...),
		NodeFailures:      make(map[string]failureCause, len(input.NodeFailures)),
	}
	if input.LatencyInjectedMs != nil {
		value := *input.LatencyInjectedMs
		cloned.LatencyInjectedMs = &value
	}
	for nodeID, cause := range input.NodeFailures {
		cloned.NodeFailures[nodeID] = cause
	}
	return cloned
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

func (runtime *labRuntime) snapshotForMetrics() runtimeSnapshot {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	runtime.metrics.MetricsReadsTotal++
	return runtimeSnapshot{state: cloneState(runtime.state), metrics: runtime.metrics}
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

func normalizeChannels(channels []string) []string {
	unique := make([]string, 0, len(channels))
	for _, channel := range channels {
		trimmed := strings.TrimSpace(channel)
		if trimmed == "" || slices.Contains(unique, trimmed) {
			continue
		}
		unique = append(unique, trimmed)
	}
	return unique
}

func parseFailureCause(raw string) (failureCause, error) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case string(failureCauseCPU):
		return failureCauseCPU, nil
	case string(failureCauseMemory):
		return failureCauseMemory, nil
	case string(failureCauseDisk):
		return failureCauseDisk, nil
	default:
		return "", errors.New("cause must be one of cpu, memory, disk")
	}
}

func (runtime *labRuntime) applyMutation(request narrativeMutationRequest, started time.Time) (labState, runtimeMetricsSnapshot, error) {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()

	switch request.Type {
	case "inject_latency":
		if request.DelayUS == 0 {
			return labState{}, runtimeMetricsSnapshot{}, errors.New("delay_us must be greater than zero")
		}
		latencyMs := uint64(request.DelayUS / 1_000)
		runtime.state.LatencyInjectedMs = &latencyMs
	case "partition_network":
		channels := normalizeChannels(request.Channels)
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
	http.HandleFunc("/narrative/apply", handler.handleNarrativeMutation)

	log.Printf("JWT auth backend listening on :%s issuer=%q audience=%q ttl=%s", config.port, config.issuer, config.audience, config.tokenTTL)
	log.Fatal(http.ListenAndServe(":"+config.port, nil))
}
