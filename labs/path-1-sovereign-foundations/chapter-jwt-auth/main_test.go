package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func decodeJSONResponse[T any](t *testing.T, recorder *httptest.ResponseRecorder) T {
	t.Helper()
	var payload T
	if err := json.NewDecoder(recorder.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return payload
}

func testConfig() appConfig {
	return appConfig{
		port:      "8080",
		secretKey: "test-secret",
		issuer:    "test-issuer",
		audience:  "test-audience",
		tokenTTL:  15 * time.Minute,
	}
}

func TestHandleHealth(t *testing.T) {
	handler := NewJWTAuthHandler(testConfig())
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	res := httptest.NewRecorder()

	handler.handleHealth(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	body := decodeJSONResponse[map[string]string](t, res)

	if body["status"] != "healthy" {
		t.Fatalf("expected healthy status, got %q", body["status"])
	}
}

func TestHandleHealthRejectsWrongMethod(t *testing.T) {
	handler := NewJWTAuthHandler(testConfig())
	req := httptest.NewRequest(http.MethodPost, "/health", nil)
	res := httptest.NewRecorder()

	handler.handleHealth(res, req)

	if res.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected status %d, got %d", http.StatusMethodNotAllowed, res.Code)
	}
}

func TestHandleReady(t *testing.T) {
	handler := NewJWTAuthHandler(testConfig())
	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	res := httptest.NewRecorder()

	handler.handleReady(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}
	body := decodeJSONResponse[map[string]any](t, res)
	if body["status"] != "ready" {
		t.Fatalf("expected ready status, got %+v", body)
	}
}

func TestHandleAuthRejectsInvalidJSON(t *testing.T) {
	handler := NewJWTAuthHandler(testConfig())
	req := httptest.NewRequest(http.MethodPost, "/auth", strings.NewReader("{"))
	res := httptest.NewRecorder()

	handler.handleAuth(res, req)

	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, res.Code)
	}
}

func TestHandleAuthRejectsWrongMethod(t *testing.T) {
	handler := NewJWTAuthHandler(testConfig())
	req := httptest.NewRequest(http.MethodGet, "/auth", nil)
	res := httptest.NewRecorder()

	handler.handleAuth(res, req)

	if res.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected status %d, got %d", http.StatusMethodNotAllowed, res.Code)
	}
}

func TestHandleAuthRejectsInvalidRole(t *testing.T) {
	handler := NewJWTAuthHandler(testConfig())
	req := httptest.NewRequest(
		http.MethodPost,
		"/auth",
		strings.NewReader(`{"user_id":"alice","role":"owner"}`),
	)
	res := httptest.NewRecorder()

	handler.handleAuth(res, req)

	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, res.Code)
	}
}

func TestHandleAuthReturnsSignedToken(t *testing.T) {
	handler := NewJWTAuthHandler(testConfig())
	req := httptest.NewRequest(
		http.MethodPost,
		"/auth",
		strings.NewReader(`{"user_id":"alice","role":"admin"}`),
	)
	res := httptest.NewRecorder()

	handler.handleAuth(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	body := decodeJSONResponse[AuthResponse](t, res)

	if body.Payload.UserID != "alice" {
		t.Fatalf("expected user_id alice, got %q", body.Payload.UserID)
	}

	claims, err := handler.validateToken(body.Token)
	if err != nil {
		t.Fatalf("validate returned token: %v", err)
	}

	if claims.Subject != "alice" {
		t.Fatalf("expected subject alice, got %q", claims.Subject)
	}
	if claims.Role != "admin" {
		t.Fatalf("expected role admin, got %q", claims.Role)
	}
	if len(claims.Audience) != 1 || claims.Audience[0] != "test-audience" {
		t.Fatalf("expected audience test-audience, got %v", claims.Audience)
	}
}

func TestNarrativeMutationUpdatesStateAndMetrics(t *testing.T) {
	handler := NewJWTAuthHandler(testConfig())
	mutationRequest := httptest.NewRequest(
		http.MethodPost,
		"/narrative/apply",
		strings.NewReader(`{"type":"inject_latency","delay_us":250000}`),
	)
	mutationResponse := httptest.NewRecorder()

	handler.handleNarrativeMutation(mutationResponse, mutationRequest)

	if mutationResponse.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, mutationResponse.Code)
	}

	mutationBody := decodeJSONResponse[narrativeMutationResponse](t, mutationResponse)
	if mutationBody.State.LatencyInjectedMs == nil || *mutationBody.State.LatencyInjectedMs != 250 {
		t.Fatalf("expected latency 250 ms, got %+v", mutationBody.State.LatencyInjectedMs)
	}
	if mutationBody.Metrics.NarrativeMutationsTotal != 1 {
		t.Fatalf("expected one mutation, got %+v", mutationBody.Metrics)
	}

	stateResponse := httptest.NewRecorder()
	handler.handleState(stateResponse, httptest.NewRequest(http.MethodGet, "/state", nil))
	if stateResponse.Code != http.StatusOK {
		t.Fatalf("expected state status %d, got %d", http.StatusOK, stateResponse.Code)
	}
	stateBody := decodeJSONResponse[labState](t, stateResponse)
	if stateBody.LatencyInjectedMs == nil || *stateBody.LatencyInjectedMs != 250 {
		t.Fatalf("expected persisted latency 250 ms, got %+v", stateBody.LatencyInjectedMs)
	}

	metricsResponse := httptest.NewRecorder()
	handler.handleMetricsSnapshot(metricsResponse, httptest.NewRequest(http.MethodGet, "/metrics/snapshot", nil))
	if metricsResponse.Code != http.StatusOK {
		t.Fatalf("expected metrics status %d, got %d", http.StatusOK, metricsResponse.Code)
	}
	metricsBody := decodeJSONResponse[runtimeMetricsSnapshot](t, metricsResponse)
	if metricsBody.NarrativeMutationsTotal != 1 {
		t.Fatalf("expected one mutation in metrics, got %+v", metricsBody)
	}
	if metricsBody.StateReadsTotal == 0 {
		t.Fatalf("expected state reads to be tracked, got %+v", metricsBody)
	}
}

func TestNarrativeMutationRejectsInvalidRequest(t *testing.T) {
	handler := NewJWTAuthHandler(testConfig())
	request := httptest.NewRequest(
		http.MethodPost,
		"/narrative/apply",
		strings.NewReader(`{"type":"fail_node","node_id":"api-1","cause":"power"}`),
	)
	response := httptest.NewRecorder()

	handler.handleNarrativeMutation(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, response.Code)
	}
}

func TestAuthAndNarrativeFlowShareRuntime(t *testing.T) {
	handler := NewJWTAuthHandler(testConfig())

	authRequest := httptest.NewRequest(
		http.MethodPost,
		"/auth",
		strings.NewReader(`{"user_id":"alice","role":"admin"}`),
	)
	authResponse := httptest.NewRecorder()
	handler.handleAuth(authResponse, authRequest)
	if authResponse.Code != http.StatusOK {
		t.Fatalf("expected auth status %d, got %d", http.StatusOK, authResponse.Code)
	}

	partitionRequest := httptest.NewRequest(
		http.MethodPost,
		"/narrative/apply",
		strings.NewReader(`{"type":"partition_network","channels":["eth0","eth0","eth1"]}`),
	)
	partitionResponse := httptest.NewRecorder()
	handler.handleNarrativeMutation(partitionResponse, partitionRequest)
	if partitionResponse.Code != http.StatusOK {
		t.Fatalf("expected mutation status %d, got %d", http.StatusOK, partitionResponse.Code)
	}

	metricsResponse := httptest.NewRecorder()
	handler.handleMetricsSnapshot(metricsResponse, httptest.NewRequest(http.MethodGet, "/metrics/snapshot", nil))
	metricsBody := decodeJSONResponse[runtimeMetricsSnapshot](t, metricsResponse)
	if metricsBody.AuthRequestsTotal != 1 || metricsBody.AuthSuccessTotal != 1 {
		t.Fatalf("expected auth counters to increment, got %+v", metricsBody)
	}
	if metricsBody.NarrativeMutationsTotal != 1 {
		t.Fatalf("expected one mutation, got %+v", metricsBody)
	}

	stateResponse := httptest.NewRecorder()
	handler.handleState(stateResponse, httptest.NewRequest(http.MethodGet, "/state", nil))
	stateBody := decodeJSONResponse[labState](t, stateResponse)
	if len(stateBody.NetworkPartitions) != 2 {
		t.Fatalf("expected deduplicated partitions, got %+v", stateBody.NetworkPartitions)
	}
}

func TestMetricsEndpointExposesPrometheusText(t *testing.T) {
	handler := NewJWTAuthHandler(testConfig())

	handler.handleAuth(
		httptest.NewRecorder(),
		httptest.NewRequest(http.MethodPost, "/auth", strings.NewReader(`{"user_id":"alice","role":"admin"}`)),
	)
	handler.handleNarrativeMutation(
		httptest.NewRecorder(),
		httptest.NewRequest(http.MethodPost, "/narrative/apply", strings.NewReader(`{"type":"inject_latency","delay_us":1000}`)),
	)

	response := httptest.NewRecorder()
	handler.handleMetrics(response, httptest.NewRequest(http.MethodGet, "/metrics", nil))

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	contentType := response.Header().Get("Content-Type")
	if !strings.Contains(contentType, "text/plain") {
		t.Fatalf("expected Prometheus content type, got %q", contentType)
	}
	body, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	bodyText := string(body)
	for _, expected := range []string{
		"jwt_lab_auth_requests_total 1",
		"jwt_lab_auth_success_total 1",
		"jwt_lab_narrative_mutations_total 1",
		"jwt_lab_latency_injected_milliseconds 1",
	} {
		if !strings.Contains(bodyText, expected) {
			t.Fatalf("expected metrics output to contain %q, got %s", expected, bodyText)
		}
	}
}

func TestAlertWebhookUpdatesMetrics(t *testing.T) {
	handler := NewJWTAuthHandler(testConfig())
	request := httptest.NewRequest(
		http.MethodPost,
		"/alerts",
		strings.NewReader(`{"status":"firing","alerts":[{"status":"firing","labels":{"alertname":"JWTLabAuthFailuresDetected"},"annotations":{"summary":"auth failures"}}]}`),
	)
	response := httptest.NewRecorder()

	handler.handleAlerts(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}

	metricsResponse := httptest.NewRecorder()
	handler.handleMetricsSnapshot(metricsResponse, httptest.NewRequest(http.MethodGet, "/metrics/snapshot", nil))
	metricsBody := decodeJSONResponse[runtimeMetricsSnapshot](t, metricsResponse)
	if metricsBody.AlertsReceivedTotal != 1 {
		t.Fatalf("expected one alert received, got %+v", metricsBody)
	}

	prometheusResponse := httptest.NewRecorder()
	handler.handleMetrics(prometheusResponse, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	body, err := io.ReadAll(prometheusResponse.Body)
	if err != nil {
		t.Fatalf("read metrics body: %v", err)
	}
	if !strings.Contains(string(body), "jwt_lab_alerts_received_total 1") {
		t.Fatalf("expected alerts metric in Prometheus output, got %s", string(body))
	}
}

func TestLoadConfigRequiresSecret(t *testing.T) {
	t.Setenv("JWT_SECRET", "")
	t.Setenv("PORT", "")
	t.Setenv("JWT_ISSUER", "")
	t.Setenv("JWT_AUDIENCE", "")
	t.Setenv("JWT_TTL", "")

	_, err := loadConfig()
	if err == nil {
		t.Fatal("expected missing secret to fail")
	}
}

func TestLoadConfigParsesOverrides(t *testing.T) {
	t.Setenv("JWT_SECRET", "override-secret")
	t.Setenv("PORT", "9090")
	t.Setenv("JWT_ISSUER", "override-issuer")
	t.Setenv("JWT_AUDIENCE", "override-audience")
	t.Setenv("JWT_TTL", "30m")

	config, err := loadConfig()
	if err != nil {
		t.Fatalf("load config: %v", err)
	}

	if config.port != "9090" || config.secretKey != "override-secret" {
		t.Fatalf("unexpected config: %+v", config)
	}
	if config.issuer != "override-issuer" || config.audience != "override-audience" {
		t.Fatalf("unexpected claims config: %+v", config)
	}
	if config.tokenTTL != 30*time.Minute {
		t.Fatalf("expected 30m token TTL, got %s", config.tokenTTL)
	}
}

func TestMainRequiresSecretInEnvironmentContract(t *testing.T) {
	if value, ok := os.LookupEnv("JWT_SECRET"); ok && value != "" {
		t.Skip("environment already provides JWT_SECRET")
	}

	_, err := loadConfig()
	if err == nil {
		t.Fatal("expected config load to fail without JWT_SECRET")
	}
}
