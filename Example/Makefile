.PHONY: help setup generate generate-all generate-types generate-models generate-stores generate-entities

help:
	@echo "Targets:"
	@echo "  setup            -> run full generation (alias of 'generate')"
	@echo "  generate         -> generate types, models, stores, entities"
	@echo "  generate-all     -> alias of 'generate'"
	@echo "  generate-types   -> generate types only"
	@echo "  generate-models  -> generate models only"
	@echo "  generate-stores  -> generate stores only"
	@echo "  generate-entities-> generate entities only"

setup: generate

# Full pipeline
generate: generate-types generate-models generate-stores generate-entities
	@echo "✅  Setup complete!"

# Back-compat alias
generate-all: generate

generate-types:
	@echo "🔧  Generating types..."
	npx @lucashw68/nsdb generate:types
	@echo "✅  Types generated!"

generate-models:
	@echo "🔧  Generating models..."
	npx @lucashw68/nsdb generate:models
	@echo "✅  Models generated!"

generate-stores:
	@echo "🔧  Generating stores..."
	npx @lucashw68/nsdb generate:stores
	@echo "✅  Stores generated!"

generate-entities:
	@echo "🔧  Generating entities..."
	npx @lucashw68/nsdb generate:entities
	@echo "✅  Entities generated!"
