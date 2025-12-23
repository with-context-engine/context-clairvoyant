import crons from "@convex-dev/crons/convex.config";
import polar from "@convex-dev/polar/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(polar);
app.use(crons);

export default app;
