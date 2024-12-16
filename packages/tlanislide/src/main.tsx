// import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  // <StrictMode>  // TODO: StrictMode calls the render method twice, and tldraw has a bug on it; the editor is initialized twice without disposing the first one. https://github.com/tldraw/tldraw/issues/5089
  <App />
  // </StrictMode>
);
