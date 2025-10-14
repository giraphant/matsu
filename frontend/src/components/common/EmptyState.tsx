/**
 * Empty state component for when no data is available
 */

import React from 'react';

interface EmptyStateProps {
  title: string;
  message: string;
  code?: string;
}

export function EmptyState({ title, message, code }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{message}</p>
      {code && <code>{code}</code>}
    </div>
  );
}
