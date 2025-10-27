.PHONY: deploy push tag publish version

# Default version type for version bump (patch, minor, major)
VERSION_TYPE ?= patch

# Read version from package.json
VERSION := $(shell node -p "require('./package.json').version")

# Commit message (pass via `make push MESSAGE='your message'`)
MESSAGE ?= "update"

deploy: push version tag publish

push:
	@echo "🔄 Adding and committing changes..."
	git add --all
	git commit -m "$(MESSAGE)"
	git push origin main

version:
	@echo "🔖 Bumping version ($(VERSION_TYPE))..."
	npm version $(VERSION_TYPE)

tag:
	@echo "🏷️  Pushing tag v$(VERSION)..."
	git push origin --tags

publish:
	@echo "🚀 Publishing to GitHub Packages..."
	npm publish
