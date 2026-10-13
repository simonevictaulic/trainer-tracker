import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// Stand-in for the window.storage that exists inside Claude.
// Data is kept in this browser's localStorage (per computer, per browser).
window.storage = {
  async get(key) {
    const v = localStorage.getItem(key);
    if (v === null) throw new Error("not found");
    return { key, value: v };
  },
  async set(key, value) {
    localStorage.setItem(key, value);
    return { key, value };
  },
};

createRoot(document.getElementById("root")).render(<App />);
