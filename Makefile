.PHONY: test full-check ladder examples oracle versions blueprint timestamps bench stats lean paper reproduce audit serve

test:
	npm test

full-check:
	FULL=1 node tools/check.mjs

ladder:
	npm run verify:ladder

examples:
	npm run examples

oracle:
	python3 scripts/verify_exact.py
	python3 -m pytest tests/test_oracle.py -v

versions:
	python3 scripts/check_versions.py
	python3 scripts/check_readme_axioms.py

blueprint:
	python3 scripts/check_blueprint_decls.py

timestamps:
	python3 scripts/timestamp_checksums.py --verify-only

bench:
	npm run bench

stats:
	npm run stats

lean:
	cd lean && lake build GlitchlingProofs Challenge Solution && lake env lean VerifyAxioms.lean

paper:
	python3 scripts/generate_figures.py
	python3 scripts/package_dist.py

reproduce: test ladder examples oracle versions blueprint timestamps bench stats lean paper

audit:
	bash scripts/audit-repo.sh .

serve:
	npm run serve
