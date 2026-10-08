import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <nav className="calculator-return" aria-label="계산기 화면">
      <a href="./index.html">학생용 계산기</a>
    </nav>
    <App />
  </React.StrictMode>
);
