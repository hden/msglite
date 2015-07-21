NODEBIN := ./node_modules/.bin

index.js: src/index.js
	$(NODEBIN)/babel src/index.js > index.js

test: index.js
	npm test

.PHONY: test
