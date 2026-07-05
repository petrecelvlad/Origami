import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { runParityHarness } from './application/ParityHarness';

// DIAGNOSTIC: ?parityCheck=1 runs the CPU/GPU physics parity harness instead of interfering
// with normal app usage — see cone/agent/skills/gpu-cpu-parity-check/SKILL.md.
if (new URLSearchParams(window.location.search).has('parityCheck')) {
  runParityHarness();
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
    <App />
);