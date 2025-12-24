import crons from "@convex-dev/crons/convex.config";
import polar from "@convex-dev/polar/convex.config";
import resend from "@convex-dev/resend/convex.config.js"
import { defineApp } from "convex/server";


const app = defineApp();
app.use(polar);
app.use(crons);
app.use(resend)

export default app;
