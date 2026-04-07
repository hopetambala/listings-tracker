/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Type definitions for dlite web components in JSX
 * Allows TypeScript to recognize <dl-*> elements in React/JSX
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type React from "react";

declare global {
  namespace React.JSX {
    interface IntrinsicElements {
      "dl-alert": any;
      "dl-badge": any;
      "dl-button": any;
      "dl-card": any;
      "dl-checkbox": any;
      "dl-cluster": any;
      "dl-dialog": any;
      "dl-divider": any;
      "dl-heading": any;
      "dl-icon-button": any;
      "dl-input": any;
      "dl-select": any;
      "dl-spinner": any;
      "dl-stack": any;
      "dl-tab": any;
      "dl-table": any;
      "dl-tabs": any;
      "dl-text": any;
      "dl-textarea": any;
      "dl-toggle": any;
    }
  }
}
