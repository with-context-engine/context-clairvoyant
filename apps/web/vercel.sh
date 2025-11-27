#!/bin/bash

# Navigate to monorepo root for convex commands
cd ../..

if [[ $VERCEL_ENV == "production" ]]; then
  # Deploy Convex to production, then build the web app
  bunx convex deploy --cmd 'cd apps/web && tsc && vite build'
else
  # Preview/staging: just build (uses existing dev Convex deployment)
  cd apps/web && tsc && vite build
fi

