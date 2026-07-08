# 03: Observability Deep Dive

In production, you can't manage what you can't measure. This module covers the observability stack integrated into NexxusFlow.

## The Stack
- **Prometheus**: Time-series database for metrics collection.
- **Grafana**: Visualization platform for dashboards.
- **OpenTelemetry (OTel)**: Standardized tracing and instrumentation.

## Metrics in the JWT Lab
We expose custom metrics such as:
- \`jwt_lab_auth_requests_total\`: Total auth attempts.
- \`jwt_lab_rate_limit_rejections_total\`: Count of blocked requests.
- \`jwt_lab_latency_injected_milliseconds\`: Artificial latency tracking.

## Exercises
1. **View Prometheus Metrics**:
   \`\`\`bash
   curl http://localhost:8080/metrics
   \`\`\`
2. **Analyze Traces**:
   The backend outputs OpenTelemetry spans to stdout in this lab. Look at the logs while making \`/auth\` requests.

## Dashboards
Open [http://localhost:9090](http://localhost:9090) to access the local Prometheus instance and explore the gathered metrics.
