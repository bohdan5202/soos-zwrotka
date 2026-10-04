# Komendy projektu. Używaj ich zamiast gołego `anchor build` / `anchor test`:
# Anchor 1.2.0 domyślnie buduje SBPF v3, a z nim testy LiteSVM padają (InvalidAccountData).
ARCH        ?= v0
PROGRAM     := zwrotka
KEYPAIR_SRC := keys/$(PROGRAM)-program-keypair.json
KEYPAIR_DST := target/deploy/$(PROGRAM)-keypair.json

.PHONY: check keypair build test localnet deploy-local deploy-devnet clean

check:            ## sprawdza wersje narzędzi
	./scripts/check-env.sh

keypair:          ## kopiuje wspólny keypair programu (stały Program ID dla całego zespołu)
	@mkdir -p target/deploy
	@cp -n $(KEYPAIR_SRC) $(KEYPAIR_DST) 2>/dev/null || true

build: keypair    ## kompiluje program
	anchor build --arch $(ARCH)

test: build       ## kompiluje i uruchamia testy (LiteSVM, bez walidatora)
	anchor test --skip-build

localnet:         ## lokalny walidator (osobny terminal), nie potrzebuje SOL
	solana-test-validator --reset --ledger test-ledger

deploy-local: build ## deploy na lokalny walidator (najpierw: make localnet)
	solana program deploy -ul target/deploy/$(PROGRAM).so --program-id $(KEYPAIR_DST)

deploy-devnet: build ## deploy na devnet (potrzeba ~2 SOL na portfelu)
	solana program deploy -ud target/deploy/$(PROGRAM).so --program-id $(KEYPAIR_DST)

clean:
	anchor clean
