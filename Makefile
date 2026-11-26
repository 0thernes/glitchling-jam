.PHONY: test ladder examples oracle bench stats lean paper reproduce audit serve

test:
	npm test

ladder:
	npm run verify:ladder

examples:
	npm run examples

oracle:
	python3 scripts/verify_exact.py
	python3 -m pytest tests/test_oracle.py -v

bench:
	npm run bench

stats:
	npm run stats

lean:
	cd lean && lake build GlitchlingProofs Challenge Solution && lake env lean VerifyAxioms.lean && lake env leanchecker --fresh GlitchlingProofs && lake env leanchecker --fresh Solution

paper:
	python3 scripts/generate_figures.py
	python3 scripts/package_dist.py

reproduce: test ladder examples oracle bench stats lean paper

audit:
	bash scripts/audit-repo.sh .

serve:
	npm run serve
