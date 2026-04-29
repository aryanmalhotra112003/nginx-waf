# Vigiles: Next-Gen AI-Assisted Web Application Firewall (WAF) 🛡️

A Zero-Trust security architecture utilizing NGINX, Coraza (OWASP CRS), and a Node.js telemetry backend to instantly detect, block, and translate malicious web traffic into human-readable AI summaries.

## 🌟 The Problem
Traditional WAFs are computationally heavy and generate massive, cryptic log files that cause alert fatigue. Developers and Security Engineers waste hours deciphering ModSecurity payloads to determine if an alert is a false positive or a critical breach.

## 🚀 The Solution
This project acts as an automated SecOps analyst. It places a lightning-fast WebAssembly WAF at the network edge to block attacks in real-time. An asynchronous Node.js backend tails the logs, filters out benign traffic, and uses an LLM to explain the exact nature of the blocked exploit in plain English. 

### Key Features
*   **Zero-Trust Isolation:** The target application is completely severed from the public internet, accessible only through the WAF's internal Docker bridge network.
*   **Real-Time AI Telemetry:** Blocked payloads are parsed and sent to an LLM (via OpenRouter) for instant threat translation.
*   **SecFinOps ROI Dashboard:** A React frontend calculates the "Compute Waste Prevented" by dropping bad traffic at the edge, proving the financial value of the WAF.

## 🏗️ Architecture Flow
```mermaid
flowchart TD
    %% Define Styles
    classDef public fill:#e1f5fe,stroke:#0288d1,stroke-width:2px;
    classDef private fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px;
    classDef isolated fill:#ffebee,stroke:#c62828,stroke-width:2px;

    %% External
    Attacker[Public Internet / Attacker]:::public

    %% Public Network (Exposed)
    subgraph Public_Network [Public Bridge Network]
        WAF[NGINX + Coraza WAF <br/> Port: 18080]:::public
        Dashboard[React Command Center <br/> Port: 5173]:::public
    end

    %% Internal Network (Isolated)
    subgraph Internal_Network [Internal Bridge Network]
        Backend[Node.js API + LLM Integrator <br/> Port: 3000]:::private
        App[Vulnerable Target App <br/> No Exposed Ports]:::isolated
    end

    %% Flow
    Attacker -- "1. Malicious Request" --> WAF
    WAF -- "2a. Clean Traffic Proxy" --> App
    WAF -- "2b. Blocks Attack & Writes" --> Log[(audit.log)]
    Log -. "3. Tailed by" .-> Backend
    Backend -- "4. Explains Payload" --> LLM[OpenRouter AI API]
    Dashboard -- "5. Fetches Telemetry" --> Backend
    
    🚦 How to Run the Project
Prerequisites

    Docker and Docker Compose installed.

    An OpenRouter API key.

Setup

    Clone the repository and navigate to the root directory.

    Add your OpenRouter API key to the backend environment file:
    Bash

    echo "OPENAI_API_KEY=your_key_here" > api-backend/.env

    Spin up the infrastructure:
    Bash

    docker compose up -d --build

    Access the Command Center Dashboard at http://localhost:5173.

    Run the automated attack suite to watch the WAF intercept traffic:
    Bash

    ./test-attacks.sh
