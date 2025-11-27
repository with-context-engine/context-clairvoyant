#!/bin/bash

# Navigate to monorepo root for convex commands
cd ../..

if [[ $VERCEL_ENV == "production" ]]; then
  bunx convex deploy --cmd 'cd apps/web && vite build'
else
  cd apps/web && vite build
fi

