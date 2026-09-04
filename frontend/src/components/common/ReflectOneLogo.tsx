/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface ReflectOneLogoProps {
  className?: string;
  size?: number;
}

export const ReflectOneLogo: React.FC<ReflectOneLogoProps> = ({ className = 'w-8 h-8', size }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} shrink-0`}
      style={size ? { width: size, height: size } : undefined}
    >
      <defs>
        {/* Top Loop Blue Gradient */}
        <linearGradient id="r_blue_grad" x1="10" y1="10" x2="90" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="40%" stopColor="#1d4ed8" />
          <stop offset="80%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>

        {/* Inner Teal/Cyan Folding Ribbon */}
        <linearGradient id="r_teal_grad" x1="15" y1="85" x2="60" y2="35" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="35%" stopColor="#06b6d4" />
          <stop offset="75%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#2dd4bf" />
        </linearGradient>

        {/* Right Leg Dark Navy Gradient */}
        <linearGradient id="r_navy_grad" x1="45" y1="40" x2="85" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1d4ed8" />
          <stop offset="45%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      {/* Top Outer Loop of R */}
      <path
        d="M 22 18 C 22 13.5, 25.5 10, 30 10 H 62 C 78.5 10, 90 20.5, 90 35 C 90 49.5, 78.5 60, 62 60 H 45 C 41 60, 39 56.5, 41 53 L 45 44 H 60 C 69 44, 75 39.5, 75 35 C 75 30.5, 69 25, 60 25 H 34 C 30.5 25, 28.5 27, 28.5 30.5 V 42 H 22 V 18 Z"
        fill="url(#r_blue_grad)"
      />

      {/* Inner Ribbon Arrow Folding Left-to-Center */}
      <path
        d="M 18 56 L 43 36 C 45.5 34, 48.5 36.5, 47.5 39.5 L 43 83.5 C 42 86.5, 37.5 87.5, 34.5 85 L 19 63 C 17 60, 17 57.5, 18 56 Z"
        fill="url(#r_teal_grad)"
      />

      {/* Right Slanted Leg */}
      <path
        d="M 45 52 L 67 85 C 68.5 87.5, 71.5 88, 74.5 85.5 L 86 75.5 C 88.5 73.5, 88.5 70, 86 67.5 L 59 38.5 C 57 36, 53.5 37, 51.5 39.5 L 45 52 Z"
        fill="url(#r_navy_grad)"
      />
    </svg>
  );
};
