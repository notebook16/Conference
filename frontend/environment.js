const envServer = (import.meta.env.VITE_SERVER_URL || "").trim();
const defaultServer = import.meta.env.PROD
  ? "https://conference-3cu1.onrender.com"
  : "http://localhost:8000";

const server = (envServer || defaultServer).replace(/\/+$/, "");

console.log("Frontend server base URL:", server);

export default server;