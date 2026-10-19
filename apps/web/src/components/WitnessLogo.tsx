import React from 'react';

export const WitnessLogo: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="-2 -2 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M12 2L3 6v5.5c0 5.5 3.8 10.7 9 12.5 5.2-1.8 9-7 9-12.5V6l-9-4z"
      stroke="#ef4444"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3" stroke="#ef4444" strokeWidth="1.5" />
    <path
      d="M12 9l2.5-3M15 12l3 2M12 15l-2.5 3M9 12l-3-2"
      stroke="#ef4444"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="12" cy="12" r="1" fill="#ef4444" />
  </svg>
);
