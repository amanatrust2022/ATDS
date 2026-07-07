import React from 'react';

interface AmanaLogoProps {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
  inverted?: boolean;
}

export default function AmanaLogo({
  size = 40,
  className = '',
  style = {},
  inverted = false,
}: AmanaLogoProps) {
  // Use light blue/white for inverted (dark backgrounds), Navy for standard
  const primaryColor = inverted ? '#85a9eb' : '#113557';
  const greenColor = '#3b8256';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 400"
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', ...style }}
      fill="none"
    >
      <defs>
        <linearGradient id="shield-gradient" x1="0" y1="0" x2="400" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="50%" stopColor={primaryColor} />
          <stop offset="50%" stopColor={greenColor} />
        </linearGradient>
      </defs>

      {/* Navy Blue Elements */}
      <g fill={primaryColor} stroke="none">
        {/* Cross: Hollow Top, Left, Bottom, and Center */}
        <path d="M 240 160 L 240 60 L 160 60 L 160 160 L 60 160 L 60 240 L 160 240 L 160 340 L 240 340 L 240 240 L 240 216 L 216 216 L 216 316 L 184 316 L 184 216 L 84 216 L 84 184 L 184 184 L 184 84 L 216 84 L 216 184 L 240 184 Z" />
        
        {/* Shield Top-Left */}
        <path d="M 144 60 L 60 76 L 60 144 L 84 144 L 84 100 L 144 84 Z" />
      </g>
      
      {/* Medical Green Elements */}
      <g fill={greenColor} stroke="none">
        {/* Cross: Hollow Right Arm */}
        <path d="M 240 160 L 340 160 L 340 240 L 240 240 L 240 216 L 316 216 L 316 184 L 240 184 Z" />
        
        {/* Shield Top-Right */}
        <path d="M 256 60 L 340 76 L 340 144 L 316 144 L 316 100 L 256 84 Z" />
      </g>
      
      {/* Shield Bottom (Single path with miter joint and split gradient) */}
      <path d="M 72 256 L 72 280 C 72 340, 150 370, 200 420 C 250 370, 328 340, 328 280 L 328 256" 
            stroke="url(#shield-gradient)" strokeWidth="24" strokeLinecap="butt" strokeLinejoin="miter" fill="none" />
    </svg>
  );
}
