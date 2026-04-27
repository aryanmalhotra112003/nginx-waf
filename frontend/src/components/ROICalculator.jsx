import React, { useState } from 'react';
import { Cloud, Shield, DollarSign } from 'lucide-react';

const ROICalculator = () => {
  const [requests, setRequests] = useState(50); // in millions

  // Simplified typical WAF pricing per million requests + base fees
  const awsCost = 25 + (requests * 1.80) + (requests * 0.60); // WAF $25 + requests + rule evaluations
  const azureCost = 60 + (requests * 1.50); // Base fee + per million
  const gcpCost = 50 + (requests * 1.20); 

  return (
    <div className="calculator-section glass-panel">
      <div className="calc-grid">
        <div className="calc-inputs">
          <h2 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign className="logo-icon" /> 
            Cost Savings Calculator
          </h2>
          
          <div className="calc-input-group">
            <label>Monthly Traffic (Web Requests)</label>
            <div className="request-value">{requests} Million Requests</div>
            <input 
              type="range" 
              className="range-slider"
              min="1" 
              max="500" 
              value={requests} 
              onChange={(e) => setRequests(Number(e.target.value))}
            />
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '20px' }}>
            * Estimations based on public cloud provider pricing tables for WAF + required Rulesets processing overhead.
          </p>
        </div>

        <div className="calc-results">
          <div className="result-card">
            <div className="provider-name"><Cloud size={18}/> AWS WAF</div>
            <div className="cost-value">${awsCost.toFixed(2)}/mo</div>
          </div>
          
          <div className="result-card">
            <div className="provider-name"><Cloud size={18}/> Azure WAF</div>
            <div className="cost-value">${azureCost.toFixed(2)}/mo</div>
          </div>

          <div className="result-card">
            <div className="provider-name"><Cloud size={18}/> GCP Cloud Armor</div>
            <div className="cost-value">${gcpCost.toFixed(2)}/mo</div>
          </div>

          <div className="result-card saver">
            <div className="provider-name shielding"><Shield size={18} color="var(--success-color)"/> Shielding (Self-Hosted)</div>
            <div className="cost-value saver">$0.00/mo</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ROICalculator;
