# Implementation Plan: Shielding WAF PlatformMVP

## Goal Description
Build an MVP for a self-hosted, open-source Web Application Firewall (WAF) platform replacing traditional cloud WAFs. Consists of an Nginx WAF Engine (Coroza), Vulnerable Node.js App, Node/Python API Backend, React/Vue Dashboard Frontend, AI-powered log translation, and Docker/Docker-compose setup.

## Provided Structure
We will adopt the following structure located at `/home/piyush/Desktop/shielding`:
```
/home/piyush/Desktop/shielding
├── docker-compose.yml
├── deploy.sh
├── waf
│   ├── Dockerfile
│   ├── nginx.conf
│   └── coroza.conf
├── vulnerable-app
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
├── backend
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
└── frontend
    ├── Dockerfile
    ├── package.json
    ├── src
    │   └── ...
    └── ...
```

## User Review Required
The user has requested to only generate the folder structure and Phase 1 code, and wait for confirmation before moving to Phase 2. As per the user's request, Phase 1 code includes the WAF and Vulnerable App Dockerfiles, configuration, and app code itself.

## Proposed Changes
### Phase 1 Setups
#### [NEW] [vulnerable-app/package.json](file:///home/piyush/Desktop/shielding/vulnerable-app/package.json)
Node.js dependencies for the vulnerable application simulator.

#### [NEW] [vulnerable-app/server.js](file:///home/piyush/Desktop/shielding/vulnerable-app/server.js)
Node.js Express application containing intentional SQLi and XSS vulnerabilities to test the WAF.

#### [NEW] [vulnerable-app/Dockerfile](file:///home/piyush/Desktop/shielding/vulnerable-app/Dockerfile)
Containerization for the vulnerable-app.

#### [NEW] [waf/Dockerfile](file:///home/piyush/Desktop/shielding/waf/Dockerfile)
Containerization for Nginx with the Coraza WAF module using official source builds or Go compilation.

#### [NEW] [waf/nginx.conf](file:///home/piyush/Desktop/shielding/waf/nginx.conf)
Reverse proxy configuration that loads the Coraza module and forwards HTTP traffic to the vulnerable-app.

#### [NEW] [waf/coroza.conf](file:///home/piyush/Desktop/shielding/waf/coroza.conf)
Rules and configurations for OWASP Coraza, configuring detection mode/blocking mode and path to CRS.

### Phase 2: The Landing Page & ROI Calculator
#### [NEW] [frontend/package.json](file:///home/piyush/Desktop/shielding/frontend/package.json)
React Vite application housing the modern landing page.

#### [NEW] [frontend/src/App.jsx](file:///home/piyush/Desktop/shielding/frontend/src/App.jsx)
Main application view functioning as the modern landing page.

#### [NEW] [frontend/src/components/ROICalculator.jsx](file:///home/piyush/Desktop/shielding/frontend/src/components/ROICalculator.jsx)
A dynamic calculator comparing AWS/Azure/GCP WAF processing costs against $0 Shielding costs.

## Verification Plan
### Automated Tests
* None out of the box; we will simulate attacks manually via GET/POST requests or use tools like `curl`.

### Manual Verification
1. Run `docker build -t test-vulnerable-app ./vulnerable-app` and test if it runs.
2. Run `docker build -t test-waf ./waf` and test if the WAF engine starts correctly with Coraza.
3. Test an SQL injection payload (e.g. `' OR '1'='1`) against the WAF proxy endpoint to verify `403 Forbidden`.
