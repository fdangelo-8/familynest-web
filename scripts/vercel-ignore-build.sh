#!/bin/sh
# Vercel "Ignored Build Step": exit 0 skips the deployment, exit 1 builds it.
# The free plan allows 100 deployments a day, so previews are built only where
# someone looks at them: main and page or shared branches with app changes.
# An ignored build still counts as a deployment, so vercel.json also turns off
# deployments entirely (git.deploymentEnabled) for branches that never need a
# preview: admin, db, fix, docs, chore and the agents' local work branches.

ref="${VERCEL_GIT_COMMIT_REF:-}"

case "$ref" in
  main) exit 1 ;;
  feat/* | shared/*) ;;
  *)
    echo "No preview for branch '$ref'."
    exit 0
    ;;
esac

# Commits that only touch tests or documentation do not change the app.
if git diff --quiet HEAD^ HEAD -- . ':(exclude)tests' ':(exclude)docs' ':(exclude)*.md'; then
  echo "Only tests or documentation changed: no new preview."
  exit 0
fi

exit 1
