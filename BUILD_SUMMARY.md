# High Table Protocol - Build Summary

## Build Pipeline

### Containerized Services

All HTP services operate via Docker Compose:

```
htp-stack/
├── anythingllm/       # Port 3030 - Knowledge engine
├── n8n/              # Port 5678 - Workflow automation
├── litellm/          # Port 4000 - LLM router
├── mirofish/         # Port 5001 - Agent swarms
├── redis/            # Port 6379 - Event bus
└── shared/
    └── data/         # Persistent volumes

Files:
  WIKI.md             - This documentation
  CODEBASE_ANALYSIS.md - Codebase parsing standards
  BUILD_SUMMARY.md    - This build instructions
  AGENT_NOTES.md      - Runtime agent observations (auto-generated)
```

## Service Configuration

### LiteLLM Gateway
- **Port**: 4000
- **Auth Token**: htp-stack-key-2026
- **Endpoints**: /chat/completions, /models
- **Models**: openai/gpt-4o, openai/gpt-3.5-turbo, fast (alias)

### n8n Workflow Engine
- **Port**: 5678
- **API**: RESTful workflow management
- **Triggers**: Schedule (60min), Webhook, Manual
- **Nodes**: GitHub, HTTP Request, Code, File operations

### AnythingLLM
- **Port**: 3030 (mapped to container 3001)
- **API**: Document management, workspace creation
- **LLM Backend**: Routed via LiteLLM gateway
- **Vector Store**: Internal embedding database

## Deployment Commands

```bash
# Start all services
docker-compose up -d

# Verify service health
curl http://localhost:5678/healthz
curl http://localhost:4000/health
curl http://localhost:3030/api/docs/

# Restart specific service
docker restart anythingllm
```

## Network Architecture

```
                    +------------------+
     User          |   AnythingLLM    |
      |            |    (Port 3030)     |
      v            +---------+--------+
+------------+               |        
|   n8n      |               | API    
| (Port 5678)|<-------------|        
+------+-----+               |        
       | API calls           |        
       v                     v        
+------------+     +----- LiteLLM ---+
|  Agents    |     |   (Port 4000)    |
|  (MCP)     |     +--------+---------+
+------+-----+              |
       |                    |
       +----------+---------+
                  |
          +-------+--------+
          |    Redis       |
          |  (Event Bus)   |
          +-------+--------+
                  |
          +-------+--------+
          |  GitHub/RPC    |
          +----------------+
```

## Monitoring

- Redis: Event stream for cross-service communication
- n8n: Scheduled workflows for periodic tasks
- AGENT_NOTES.md: Human-readable activity log
