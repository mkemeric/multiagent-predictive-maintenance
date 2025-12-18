# Quick Deploy Guide

Minimal steps to deploy the MongoDB Multi-Agent Predictive Maintenance demo on HPE Private Cloud AI.

> For detailed configuration options, see [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## Prerequisites

- Kubernetes cluster access (`kubectl` configured)
- Container registry access
- MLIS endpoints running with:
  - `meta/llama-3.1-70b-instruct`
  - `nvidia/nv-embedqa-e5-v5`
- MongoDB Atlas connection string

---

## Step 1: Build and Push Image

```bash
# Set your registry
export REGISTRY=your-registry.local/demos

# Build
docker build -t ${REGISTRY}/pred-maint:latest .

# Push
docker push ${REGISTRY}/pred-maint:latest
```

---

## Step 2: Create Kubernetes Secret

```bash
# Create namespace (if needed)
kubectl create namespace demos

# Create secret with your credentials
kubectl create secret generic pred-maint-secrets \
  --namespace demos \
  --from-literal=MONGODB_URI='mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority' \
  --from-literal=MLIS_BASE_URL='https://mlis.pcai.local/v1' \
  --from-literal=MLIS_API_KEY=''
```

---

## Step 3: Deploy with Helm

```bash
helm install pred-maint ./helm \
  --namespace demos \
  --set image.repository=${REGISTRY}/pred-maint \
  --set image.tag=latest \
  --set existingSecret=pred-maint-secrets \
  -f environments/pcai.yaml
```

---

## Step 4: Access the Application

```bash
# Port forward
kubectl port-forward -n demos svc/pred-maint-multiagent-predictive-maintenance 8080:80

# Open browser
open http://localhost:8080
```

---

## Useful Commands

```bash
# Check status
kubectl get pods -n demos -l app.kubernetes.io/instance=pred-maint

# View logs
kubectl logs -n demos -l app.kubernetes.io/instance=pred-maint -f

# Upgrade after changes
helm upgrade pred-maint ./helm \
  --namespace demos \
  --set image.tag=v1.1.0 \
  -f environments/pcai.yaml

# Uninstall
helm uninstall pred-maint --namespace demos
```

---

## Local Development (No Kubernetes)

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with your MONGODB_URI and MLIS_BASE_URL

# Test MLIS connection
npm run test:connection

# Run locally
npm install
npm run dev

# Or with Docker
docker-compose up --build
```
