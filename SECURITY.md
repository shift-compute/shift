# Security

Shift holds a user's 0G management key so it can read a balance and mint a short-lived capped inference key. This page is the threat model for that design. It is not a promise that the operator cannot see results.

## Where keys live

A management key (`mk-`) is encrypted with AES-256-GCM before it is written to Postgres (`mkCiphertext`, `mkIv`, `mkAuthTag`). The AES key is `SHIFT_MASTER_KEY`, 32 bytes, base64, in the service environment of the web app and the worker. The account address is authenticated data, so a ciphertext copied onto another user's row does not open. During a rotation, `SHIFT_MASTER_KEY_PREV` can open an old row; that row is then sealed again with the current key.

The master key is not in the database and not in the browser. Anyone who can read the service environment can read it.

An ephemeral inference key (`sk-`) exists in process memory for one user night. Postgres stores its id, not the secret. The run revokes it before it returns. A sweeper revokes ids that are still alive after two hours.

`OPERATOR_PRIVATE_KEY` is the Galileo wallet that pays for 0G Storage and signs `anchorNight` and `recordDonations`. It lives in the same service environment. The validated web config object does not include it. The worker reads it, and so does **Run now** (`POST /api/runs/now`). Plan §19.7 says only the worker should. The web route does too, because a manual run uploads and anchors in that process.

Personal task outputs are encrypted before upload: HKDF-SHA256 of `SHIFT_MASTER_KEY` and the account address, then AES-256-GCM. The Merkle leaf stores the ciphertext root. Commons outputs are uploaded as public JSON on purpose.

## What an attacker with the whole service could do

"The whole service" means the Postgres database, the process environment (master key and operator key), and the ability to call the Router with a decrypted `mk-`.

- **Spend that account's credits** by creating new capped `sk-` keys (`keys:create`) and calling the Router. The cap limits one key. It does not stop a new key. The night also refuses to start a second run while one night run is `RUNNING`, and it starts at most 20 tasks.
- **Anchor false roots** with `OPERATOR_PRIVATE_KEY`. `anchorNight` and `recordDonations` are owner-only. A false root would be a real transaction from the operator wallet.
- **Read personal outputs.** That required only the storage root when outputs were plaintext. They are ciphertext now, so a root alone is not the plaintext. The same attacker still has `SHIFT_MASTER_KEY`, so they can decrypt. **The operator can decrypt.** Say that to anyone who connects an account.

An attacker who steals only the database, or only a storage root, does not get the master key from those objects. They cannot open an `mk-` and they cannot read a personal output sealed under this scheme. They can still download the ciphertext, and they can read a commons file, which is public.

## What the key scopes allow

Connect asks for three scopes and checks them:

| Scope | What Shift uses it for |
|---|---|
| `account:read` | Read the 0G account and the balance (`credit_balance`, `deposit_balance`). |
| `keys:create` | Mint the ephemeral inference key. That is how a night spends. The key is capped and pinned to a trust tier. |
| `keys:manage` | Revoke that key, including from the sweeper and from disconnect. |

Shift does not ask for a broader management key. Spending still happens, because `keys:create` is enough to mint a key that calls the Router.

## What is not protected

- The operator can decrypt every personal output and every stored `mk-`. Encryption stops a stranger who has a root hash. It does not stop the operator.
- The operator key can anchor any root the process asks it to anchor.
- Commons outputs, the commons page, batch roots, and the anchor transaction are public.
- The session cookie holds the user id, not the `mk-`. A stolen cookie can ask the server to use the key while the row still has one.
- Rate limits live in one Node process. They are not a global firewall.
- `X-Real-IP` is the client address Railway's public edge sets. A caller that reaches the process without that edge can choose the header.
- Plan §19.8 is unanswered: whether 0G allows delegated use of iAI credits, and whether donating the leftover is allowed. See the TODO in the README.

## Roadmap

These are not built. The list is the direction, not a control that exists today.

1. **Sealed-box storage of `mk-` under a worker-only private key.** The web process would not be able to open the management key. Run now would stop decrypting it.
2. **Two services.** The worker would hold the master key and the operator key. The web process would not.
3. **TEE custody of `mk-` keys** (plan C3, dstack / Phala). The master key would not sit in the service environment.
4. **Browser-side encryption of results** (plan C1). The operator would not be able to decrypt a personal output. Today the operator can.
