#!/bin/bash

# Script to commit and push changes to GitHub
echo "Adding all changes to git..."
git add .

echo "Committing changes..."
git commit -m "Remove localStorage storage for research study independence

- Remove PROLIFIC_ID localStorage storage for fresh sessions
- Always prompt for participant ID (unless URL parameter provided)
- Add debugging logs for PROLIFIC_ID flow
- Clean up old tracking functions and variables
- Ensure each study session is independent
- Perfect for research study with no cross-session contamination"

echo "Pushing to GitHub..."
git push origin main

echo "Done! Changes pushed to GitHub."
