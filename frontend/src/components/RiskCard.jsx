import React from 'react';

const RiskCard = ({ title, description }) => (
  <div className="risk-card">
    <h4>{title}</h4>
    <p>{description}</p>
  </div>
);

export default RiskCard;
