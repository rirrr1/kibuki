import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'default' | 'light' | 'dark';
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className = '', variant = 'default', showText = true }) => {
  const colors = {
    default: {
      gradient1: '#dc2626',
      gradient2: '#2563eb',
      accent: '#fbbf24',
    },
    light: {
      gradient1: '#ffffff',
      gradient2: '#ffffff',
      accent: '#fbbf24',
    },
    dark: {
      gradient1: '#1f2937',
      gradient2: '#1f2937',
      accent: '#fbbf24',
    },
  };

  const colorScheme = colors[variant];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
        role="img"
        aria-label="MyComic-Book.com logo"
      >
        <defs>
          <linearGradient id="bookGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorScheme.gradient1} />
            <stop offset="100%" stopColor={colorScheme.gradient2} />
          </linearGradient>
        </defs>

        <rect
          x="8"
          y="6"
          width="32"
          height="36"
          rx="2"
          fill="url(#bookGradient)"
          opacity="0.9"
        />

        <path
          d="M12 6 L12 42 L24 36 L36 42 L36 6 Z"
          fill="url(#bookGradient)"
          stroke={colorScheme.accent}
          strokeWidth="1.5"
        />

        <circle
          cx="24"
          cy="18"
          r="6"
          fill={colorScheme.accent}
          opacity="0.9"
        />

        <path
          d="M 18 22 Q 24 20 30 22"
          stroke={variant === 'light' ? '#ffffff' : colorScheme.gradient1}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />

        <path
          d="M 19 28 L 29 28 M 19 32 L 29 32"
          stroke={colorScheme.accent}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.7"
        />

        <path
          d="M 22 16 L 22 18 M 26 16 L 26 18"
          stroke={variant === 'light' ? '#ffffff' : colorScheme.gradient1}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>

      {showText && (
        <span
          className={`text-2xl font-bold ${
            variant === 'light' ? 'text-white' : 'text-gray-900'
          }`}
        >
          MyComic-Book
        </span>
      )}
    </div>
  );
};

export default Logo;
