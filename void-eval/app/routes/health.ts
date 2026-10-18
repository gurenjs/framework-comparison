import { defineHandler } from "void";

// Health check endpoint for load balancers and uptime monitors
export const GET = defineHandler(() => ({ status: "ok" }));
