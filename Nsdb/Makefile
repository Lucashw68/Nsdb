SHELL := /usr/bin/env zsh
.SHELLFLAGS := -lc

.PHONY: check commit deploy publish push version

# Default version type for version bump (patch, minor, major)
VERSION_TYPE ?= patch

# Commit message (pass via `make deploy MESSAGE='your message'`)
MESSAGE ?= "update"

NPM ?= npm
YARN ?= yarn

deploy: check commit version push publish

check:
	@echo "✅ Running checks..."
	$(YARN) run check
	$(YARN) run test

commit:
	@echo "🔄 Adding and committing changes..."
	git add --all
	git commit -m "$(MESSAGE)"

version:
	@echo "🔖 Bumping version ($(VERSION_TYPE))..."
	$(NPM) version $(VERSION_TYPE)

push:
	@echo "⬆️  Pushing main and tags..."
	git push origin main --follow-tags

publish:
	@echo "🚀 Publishing to GitHub Packages..."
	$(NPM) publish
