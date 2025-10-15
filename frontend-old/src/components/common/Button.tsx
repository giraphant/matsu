/**
 * Reusable button component
 */

import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  title?: string;
  style?: React.CSSProperties;
}

export function Button({
  children,
  onClick,
  className = '',
  variant = 'primary',
  type = 'button',
  disabled = false,
  title,
  style
}: ButtonProps) {
  const variantClass = variant === 'primary' ? 'btn-primary'
    : variant === 'secondary' ? 'btn-secondary'
    : 'btn-danger';

  return (
    <button
      type={type}
      className={`${variantClass} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={style}
    >
      {children}
    </button>
  );
}
