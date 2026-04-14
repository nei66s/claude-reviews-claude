'use client';

export function SkeletonMessageBubble() {
  return (
    <div className="message agent">
      <div className="message-row">
        <div className="message-badge skeleton skeleton-avatar" />
        <div className="bubble">
          <div className="skeleton skeleton-lines">
            <div className="skeleton skeleton-line-full" />
            <div className="skeleton skeleton-line-full" />
            <div className="skeleton skeleton-line-partial" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonTokenPanel() {
  return (
    <div className="token-cost-compact-bar">
      <div className="token-cost-header-compact">
        <div className="token-cost-title-compact">
          <span className="skeleton skeleton-text" style={{ width: '120px' }} />
        </div>
        <div className="token-cost-details-compact">
          <span className="skeleton skeleton-text" style={{ width: '80px' }} />
        </div>
      </div>
      <div className="token-cost-graph-container">
        <div className="skeleton skeleton-input" style={{ height: '28px' }} />
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card">
      <div className="card-header">
        <div className="skeleton skeleton-title" style={{ width: '40%' }} />
      </div>
      <div className="card-body skeleton-lines">
        <div className="skeleton skeleton-line-full" />
        <div className="skeleton skeleton-line-full" />
        <div className="skeleton skeleton-line-short" />
      </div>
      <div className="card-footer">
        <div className="skeleton skeleton-btn" style={{ width: '100px' }} />
      </div>
    </div>
  );
}

export function SkeletonChatMessage() {
  return (
    <div className="flex flex-col gap-md">
      <SkeletonMessageBubble />
      <SkeletonMessageBubble />
      <SkeletonMessageBubble />
    </div>
  );
}

// Usage Example:
// <Suspense fallback={<SkeletonMessageBubble />}>
//   <YourAsyncComponent />
// </Suspense>
