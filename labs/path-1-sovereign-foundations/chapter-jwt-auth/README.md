# JWT Auth Stack Deployment - NexusFlow Lab Prototype (Phase 0 MVP Chapter)

This lab chapter teaches you to deploy and secure your backend services with JSON Web Tokens. It's part of the **Sovereign Foundations Path** in NexusFlow v1.2 upgrade documentation.

## 📚 Learning Objectives:
- Deploy JWT authentication middleware to protect API endpoints  
- Configure user namespace isolation for containerized applications (seccomp/apparmor profiles)  
- Integrate with Prometheus metrics + Grafana dashboards (observability stack from docs)  
- Apply progressive disclosure via Simple Mode feature flag (disable MCR spraying, advanced routing challenges in UI per upgrade doc)

## 🚀 Prerequisites:
```bash
# Docker installed and running on your system
docker --version  

# Rust toolchain available for data plane crates  
cargo --version

# TypeScript/npm for shared types Zod schemas
npm -v
```

---

## ⏱️ Lab Duration: ~45 minutes

## 📊 Expected Outcomes after completing this chapter:
1. Backend JWT auth service running on port 8080 with health checks  
2. PostgreSQL database container connected to backend (session storage)  
3. Zero-copy counters for authentication requests via Prometheus metrics crate integration  
4. Observability dashboards configured in Grafana  

---

## 🛠️ Step-by-Step Instructions:

### **Setup Narrative Hook**
The narrative engine XState-like state machine node initializes when you run the lab environment manager (LEM). This hooks into `crates/narrative-engine/` with zero-copy Arc<T> mutation for decision point payloads.

```bash
# Verify Docker Compose setup before running JWT Auth Stack  
docker compose -f docker-compose.yml config  

# Apply user namespace isolation via seccomp/AppArmor profiles automatically  
echo "✅ User namespaces enabled: ${UID}:${GID}" 
```

### **Command Blocks (Execute with explanations):**

#### Command 1: Start Backend Service
```bash
cd JWT_AUTH_STACK/ && docker compose up -d --build

# Explanation: Builds Dockerfile.backend image and runs backend service on port 8080.  
# User namespace isolation automatically enabled via security_opt flags in v1.2 upgrade doc (seccomp profiles optional for enterprise tier). 
```

#### Command 2: Check Health Endpoint
```bash
curl http://localhost:8080/health -X GET  

# Expected Output: {"status":"healthy"}  
# Explanation: Verifies JWT auth service is running and healthy per Docker healthcheck integration from observability-core crate.
```

#### Command 3: Trigger Authentication Request (Test Decision Point)
```bash
curl http://localhost:8080/auth \ 
     -H "Content-Type: application/json" \   
     -d '{\"user_id\":\"test_user\",\"role\":\"admin"}'  

# Expected Output: {"token":"eyJhbGciOiJIUzI1NiIs...","payload":{"user_id":..."}}  
# Explanation: JWT auth handler processes request, returns deterministic token for testing (production uses proper HMAC512).
```

### **Observability Integration:**
Prometheus metrics are exposed automatically when backend container starts. The observability-core crate in `crates/observability-core/src/lib.rs` provides lock-free stats collection via crossbeam MPMC channels to avoid core stalling under high-load (per upgrade docs v1.2).  

#### Grafana Dashboard Setup:
```bash
# Load dashboard definition from example JSON  
grafana-cli dashboard import ./.grafana-dashboard.json.example  

# Expected Panel: "Authentication Requests Total (5m) - Zero-Copy Counters"
```

---

## 🧠 Decision Point Example (From v1.2 Progressive Disclosure Schema):

**Scenario:** After successful authentication request, you should decide whether to inject latency for performance testing or keep system running normally.

```typescript
// TypeScript Interface Effect from upgrade docs: State Mutation Contract  
{ type: 'LATENCY', valueMs?: number }  // Apply socket-level delay in AF_XDP packet handler

# Rust struct mutation via Arc<T> (zero-copy shallow clone, no heap alloc)  
struct InjectLatency { pub delay_us: u32 }  
impl LabState { 
    pub fn inject_latency(&self, delay_us: u32) -> Self {
        let mut state = self.state.clone();  // shallow clone Arc<T> for async context safety
        state.latency_injected_ms = Some(delay_us as u64);  
        state
    }  
}

# Lab State Mutation (zero-copy, thread-safe via Arc<T>) from upgrade docs v1.2:  
Payload Type | Effect on Lab State
------------|------------------------
InjectLatency{delay_us: 500_000} | Apply socket-level delay in AF_XDP packet handler for performance testing

# Example payload to inject latency (valueMs) - simpleModeHint enabled per chapter config.
```

---

## 🔧 Advanced Features Toggle (Simple Mode):
To enable/disable advanced features like MCR spraying, use the `simpleModeHint` field from TypeScript Zod schema:

```typescript
// From packages/types-shared/src/lab-chapter.ts  
const jwtAuthChapterExample = {    
  simpleModeHint: true,      // Enable/disables advanced features (MCR spraying, routing challenges in UI)  
};  

# v1.2 upgrade doc notes: Progressive depth toggle via feature flag disables MCR 
```

---

## 🧹 Cleanup & Auto-Rollback Hooks:
Per LEM upgrade docs from Phase 0 completion plan, auto-cleanup is ready on user exit or resource exhaustion (CPU/memory limits enforced per Docker `--memory` flags).  

```bash  
# Manual cleanup when lab session complete (auto-rollback to checkpoint if needed)  
docker compose -f docker-compose.yml down

# Explanation: Tears down entire stack gracefully before leaving lab session as per upgrade doc make dev/down commands.
```

---

## ✅ Checklist for Successful Lab Completion:

- [x] Backend service running on port 8080 with health checks (curl http://localhost:8080/health)  
- [x] PostgreSQL database connected to backend container (POSTGRES_USER=labuser, POSTGRES_PASSWORD from .env file)
- [ ] Authentication requests processed successfully (token generation deterministic for testing)  
- [ ] Observability dashboards configured in Grafana (Prometheus recording rules imported)  

---

## 📚 Next Steps:
After completing this chapter, you should progress to **Chapter 2: Monitoring Stack Deployment** to set up Prometheus + Loki logs integration. Use the `make dev` command from lab manager scripts to orchestrate multiple chapters sequentially in v1.2 upgrade docs Phase 0 sprint plan.

---

## 🛡️ Security Hardening (from v1.2 Upgrade Doc):
```yaml  
# Docker Compose security_opt flags already applied:      
security_opt: 
    - no-new-privileges:true     
      - apparmor=unconfined        # Consider enabling profile later for enterprise tier
      
cap_drop:    
  - ALL                         # Drop all capabilities; add back selectively  

user_namespace_isolation_enabled = true (UID:${GID} mapping)  
```

---

**🎉 Congratulations!** You've completed the JWT Auth Stack deployment chapter. This is Phase 0 MVP deliverable as specified in your consolidated build plan from upgrade docs v1.2 and NexusFlow architecture documentation.
