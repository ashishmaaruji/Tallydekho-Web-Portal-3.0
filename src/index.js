import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./i18n"; // initialize translations before first render
import App from "./App";

// "Device not paired" (backend 403) is an expected state, not a crash: pages render
// their unpaired/empty views via AuthContext. Keep it out of the error overlay.
window.addEventListener("unhandledrejection", (e) => {
  if (e.reason?.notPaired) e.preventDefault();
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
