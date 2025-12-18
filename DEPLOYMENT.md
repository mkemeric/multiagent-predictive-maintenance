# Deployment Guide: HPE Private Cloud AI

This guide covers deploying the MongoDB Multi-Agent Predictive Maintenance demo on HPE Private Cloud AI with MLIS.

---

## Prerequisites

- [ ] HPE Private Cloud AI environment with Kubernetes access
- [ ] MLIS endpoints deployed with:
  - LLM: `meta/llama-3.1-70b-instruct` (or equivalent with tool calling)
  - Embeddings: `nvidia/nv-embedqa-e5-v5` (1024 dimensions)
- [ ] MongoDB Atlas cluster with:
  - Database: `agentic_predictive_maintenance`
  - Collections seeded with demo data
  - Vector search indexes created
- [ ] Container registry access (Harbor, NGC, or internal registry)
- [ ] `helm` CLI installed (v3.x)
- [ ] `kubectl` configured for your PC AI cluster

---

## Quick Start

### 1. Build and Push Container Image

```bash
# Set your registry
export REGISTRY=registry.pcai.local/demos

# Build the image
docker build -t ${REGISTRY}/multiagent-predictive-maintenance:latest .

# Push to registry
docker push ${REGISTRY}/multiagent-predictive-maintenance:latest
```

### 2. Create Kubernetes Secret

```bash
# Create namespace (if needed)
kubectl create namespace demos

# Create secret with credentials
kubectl create secret generic pred-maint-secrets \
  --namespace demos \
  --from-literal=MONGODB_URI='mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority' \
  --from-literal=MLIS_BASE_URL='https://mlis.pcai.local/v1' \
  --from-literal=MLIS_API_KEY=''
```

### 3. Deploy with Helm

```bash
# Install the chart
helm install pred-maint ./helm \
  --namespace demos \
  --set image.repository=${REGISTRY}/multiagent-predictive-maintenance \
  --set image.tag=latest \
  --set existingSecret=pred-maint-secrets \
  -f environments/pcai.yaml
```

### 4. Access the Application

```bash
# Port forward for testing
kubectl port-forward -n demos svc/pred-maint-multiagent-predictive-maintenance 8080:80

# Open browser
open http://localhost:8080
```

---

## Detailed Configuration

### Image Configuration

Update `environments/pcai.yaml`:

```yaml
image:
  repository: registry.pcai.local/demos/multiagent-predictive-maintenance
  pullPolicy: Always
  tag: "v1.0.0"  # Use specific tags in production

# If registry requires auth
imagePullSecrets:
  - name: pcai-registry-credentials
```

### Creating Registry Credentials

```bash
kubectl create secret docker-registry pcai-registry-credentials \
  --namespace demos \
  --docker-server=registry.pcai.local \
  --docker-username=myuser \
  --docker-password=mypassword
```

### Ingress Configuration

For external access, configure ingress in `environments/pcai.yaml`:

```yaml
ingress:
  enabled: true
  className: "nginx"  # or "traefik", "istio", etc.
  annotations:
    # Increase timeouts for long-running agent workflows
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "300"
    # Enable WebSocket support for streaming
    nginx.ingress.kubernetes.io/proxy-http-version: "1.1"
    nginx.ingress.kubernetes.io/use-regex: "true"
  hosts:
    - host: predictive-maintenance.pcai.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: predictive-maintenance-tls
      hosts:
        - predictive-maintenance.pcai.example.com
```

### Model Configuration

The models are configured via environment variables:

```yaml
config:
  # Foundational model - must support tool calling
  COMPLETION_MODEL: "meta/llama-3.1-70b-instruct"
  
  # Embedding model - must produce 1024 dimensions
  EMBEDDING_MODEL: "nvidia/nv-embedqa-e5-v5"
```

**Verify MLIS has these models deployed:**

```bash
# Test LLM endpoint
curl -X POST ${MLIS_BASE_URL}/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta/llama-3.1-70b-instruct",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# Test embeddings endpoint
curl -X POST ${MLIS_BASE_URL}/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nvidia/nv-embedqa-e5-v5",
    "input": "test"
  }'
```

---

## Operations

### Viewing Logs

```bash
# Stream logs
kubectl logs -n demos -l app.kubernetes.io/instance=pred-maint -f

# Get logs from specific pod
kubectl logs -n demos pred-maint-multiagent-predictive-maintenance-xxxxx
```

### Updating the Deployment

```bash
# Update image tag
helm upgrade pred-maint ./helm \
  --namespace demos \
  --set image.tag=v1.1.0 \
  -f environments/pcai.yaml

# Update secrets
kubectl create secret generic pred-maint-secrets \
  --namespace demos \
  --from-literal=MONGODB_URI='new-connection-string' \
  --from-literal=MLIS_BASE_URL='https://new-mlis-url/v1' \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart pods to pick up new secrets
kubectl rollout restart deployment -n demos pred-maint-multiagent-predictive-maintenance
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment -n demos pred-maint-multiagent-predictive-maintenance --replicas=3

# Enable autoscaling via values
helm upgrade pred-maint ./helm \
  --namespace demos \
  --set autoscaling.enabled=true \
  --set autoscaling.minReplicas=2 \
  --set autoscaling.maxReplicas=5 \
  -f environments/pcai.yaml
```

### Uninstalling

```bash
# Remove the Helm release
helm uninstall pred-maint --namespace demos

# Remove the secret (if no longer needed)
kubectl delete secret pred-maint-secrets --namespace demos
```

---

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl describe pod -n demos -l app.kubernetes.io/instance=pred-maint

# Common issues:
# - ImagePullBackOff: Check registry credentials
# - CrashLoopBackOff: Check logs for startup errors
# - Pending: Check resource availability
```

### Connection to MLIS Failing

```bash
# Exec into pod and test connectivity
kubectl exec -it -n demos deployment/pred-maint-multiagent-predictive-maintenance -- sh

# Inside pod:
wget -qO- ${MLIS_BASE_URL}/models
```

### MongoDB Connection Failing

```bash
# Check if MONGODB_URI is set correctly
kubectl get secret -n demos pred-maint-secrets -o jsonpath='{.data.MONGODB_URI}' | base64 -d

# Test from pod
kubectl exec -it -n demos deployment/pred-maint-multiagent-predictive-maintenance -- sh -c 'echo $MONGODB_URI'
```

### Health Check Failing

The default health check hits `/`. If the app takes longer to start:

```yaml
# In values or pcai.yaml
livenessProbe:
  initialDelaySeconds: 60  # Increase if needed
  periodSeconds: 15

readinessProbe:
  initialDelaySeconds: 10
  periodSeconds: 10
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         HPE Private Cloud AI                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐      ┌──────────────────────────────────────────┐      │
│  │   Ingress   │      │              MLIS (NIM)                   │      │
│  │   (nginx)   │      │  ┌─────────────┐  ┌──────────────────┐   │      │
│  └──────┬──────┘      │  │ Llama 3.1   │  │ NV-EmbedQA       │   │      │
│         │             │  │ 70B Instruct│  │ (1024 dims)      │   │      │
│         │             │  └─────────────┘  └──────────────────┘   │      │
│         ▼             │         ▲                  ▲              │      │
│  ┌──────────────┐     └─────────┼──────────────────┼──────────────┘      │
│  │  Service     │               │                  │                     │
│  │  (ClusterIP) │               │                  │                     │
│  └──────┬───────┘               │                  │                     │
│         │                       │                  │                     │
│         ▼                       │                  │                     │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                         Pod                                     │     │
│  │  ┌──────────────────────────────────────────────────────────┐  │     │
│  │  │           Next.js Application (Port 8080)                 │  │     │
│  │  │                                                           │  │     │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │  │     │
│  │  │  │  Supervisor │  │   Failure   │  │  Workorder  │       │  │     │
│  │  │  │    Agent    │──│    Agent    │──│    Agent    │──...  │  │     │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘       │  │     │
│  │  │           │                │               │              │  │     │
│  │  │           └────────────────┴───────────────┘              │  │     │
│  │  │                            │                              │  │     │
│  │  │                    LangChain/LangGraph                    │  │     │
│  │  └──────────────────────────────────────────────────────────┘  │     │
│  │                               │                                 │     │
│  │                     ConfigMap + Secret                          │     │
│  │                   (MLIS_BASE_URL, MONGODB_URI)                  │     │
│  └───────────────────────────────┼─────────────────────────────────┘     │
│                                  │                                        │
└──────────────────────────────────┼────────────────────────────────────────┘
                                   │
                                   ▼
                          ┌────────────────┐
                          │  MongoDB Atlas │
                          │  (External)    │
                          └────────────────┘
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `helm/Chart.yaml` | Chart metadata |
| `helm/values.yaml` | Default configuration |
| `helm/templates/*.yaml` | Kubernetes manifests |
| `environments/pcai.yaml` | PC AI-specific overrides |
| `Dockerfile` | Container build instructions |
| `.env.example` | Environment variable reference |
| `REFACTORING_GUIDE.md` | Code changes documentation |

---

## Support

For issues specific to:
- **MLIS/NIM**: Contact HPE PC AI support
- **MongoDB Atlas**: Contact MongoDB support
- **Application Code**: See `REFACTORING_GUIDE.md`
