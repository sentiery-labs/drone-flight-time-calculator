import React from "react";
import { createRoot } from "react-dom/client";
import StudentCalculator from "./student/StudentCalculator.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <StudentCalculator />
  </React.StrictMode>
);
