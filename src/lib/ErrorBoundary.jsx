// =============================================================================
//  WALIDA — Tiny ErrorBoundary
// -----------------------------------------------------------------------------
//  Used to wrap individual <ProductCard3D/> models so a corrupt / wrong-type
//  GLB (e.g. a JPEG accidentally uploaded as a .glb during simulation) just
//  swaps in the iridescent proxy instead of taking the whole storefront down.
//
//  Standard React class component — Three.js / drei loaders throw synchronously
//  past Suspense and the only way to catch those errors is with an
//  ErrorBoundary.
// =============================================================================

import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Soft warning — fall back silently in production but log for debugging.
    if (import.meta.env.DEV) {
      console.warn('[walida] ErrorBoundary caught:', error?.message || error, info);
    }
    // Notify the parent so it can swap to a different render branch.
    this.props.onError?.(error);
  }

  // Reset if the children (e.g. modelUrl) change — lets a fresh upload retry.
  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
