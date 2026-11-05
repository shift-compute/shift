/**
 * GENERATED FILE — do not edit by hand.
 * Source: official 0G Router OpenAPI spec (https://0gfoundation.github.io/0g-router/openapi.yaml).
 * Regenerate with: pnpm gen:router-types
 * The spec is the source of truth: if it disagrees with docs/SHIFT_PLAN.md, the spec wins.
 * Some schemas are loose in the spec (e.g. /v1/decisions); the hand-written client validates the verified shapes.
 */
export interface paths {
    "/account": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get account
         * @description Returns non-financial metadata for the authenticated wallet: `created_at`, `onboarded_at` and `og_mode_available`. `og_mode_available` is `false` when the account is not offered the 0G settlement mode; a client should then hide the 0G↔USD switch. It is always `true` while the account is in 0G mode or holds a 0G balance (deposit or credit), so those funds stay reachable. `onboarded_at` is an RFC3339 timestamp once the account has completed or dismissed the new-user onboarding flow, and `null` until then — a client reads it to decide whether to show onboarding. Set it via `POST /account/onboarded`. The value is stored per wallet on the server, so it persists across a cleared cache, another browser, and another device.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Account metadata */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.AccountResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/account/balance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get account balance
         * @description Returns the caller's **Router ledger** balance: `deposit_balance` (funds Router has already pulled from the Payment Layer vault) plus `credit_balance` (promo / granted credit). `total_balance` is the sum of the two.
         *
         *     This endpoint deliberately does **not** include the PL vault balance. The vault is a shared pool across 0G apps; Router pulls from it incrementally on demand. To predict whether an inference request can be submitted, clients should combine this response with the PL vault balance — see the "Balance model" section in the API description for the formula.
         *
         *     `pending_charge` is any outstanding debt the user owes Router (created by the deferred-charge path when the ledger was short but the vault could cover the request); it is cleared automatically when the next vault pull lands on chain.
         *
         *     **Accounts settling in USD** (`currency: "usd"` in the response) are never *served* from the Payment Layer vault — USD settlement does not spend from it. Everything above this paragraph describes 0G-settling accounts only: for a USD account do **not** add a vault balance on top of this response, and there is no vault pull behind `pending_charge` either — an amount owed there is cleared by the account's own funds, not by a chain deposit. One caveat if this wallet settled in 0G before switching: Router may still be pulling its vault balance into the now-dormant 0G ledger, and neither this endpoint nor `/funds` reports that money while the account is in USD mode. Moving the account back to 0G settlement is what makes that money visible and spendable again — at the cost of moving billing off USD until you switch back, since only one ledger is live at a time (both are preserved, nothing is lost either way). The route that does it is session-authenticated, so it is a console action rather than something an `sk-` or `mk-` caller can perform.
         *
         *     A USD account **whose billing 0G Pay serves** is additionally answered from 0G Pay rather than from a balance Router holds. `deposit_balance` and `credit_balance` then carry the funds and promotional credit held there, reported as what this service can spend: promotional credit that has expired, or that was granted for a different 0G service, is excluded, so this can read lower than 0G Pay's own wallet view. It is the same figure an inference request is admitted against, but a positive value is **not** a promise of admission — an amount owed (`pending_charge`, which `total_balance` does not subtract), a minimum-balance floor, or a hold placed on the account each refuse independently of it. When the balance cannot be established — the billing service is unreachable, or answers something this endpoint will not act on — it returns `503` rather than a stale or empty figure.
         *
         *     For such an account `unsettled_charge` is the total of charges already made that have not been sent to 0G Pay yet: a request's charge is sent a few seconds after the reply finishes. The other amounts here, and 0G Pay's own balance, do not include it yet; subtract it to show the balance after those charges. It never counts a charge 0G Pay may already have applied, so while a send is in flight or 0G Pay is slow to accept it the result can briefly read high, never low. `total_balance` does not subtract `pending_charge`, so if those charges exceed what the account holds, floor the result at 0 here; `/account/funds` gives the exact net as `router.subtotal` − `router.unsettled_charge`. The field is absent for every other account, and when it could not be read.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Balance info */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.BalanceResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Billing service unavailable (0G Pay accounts) — retryable, honours Retry-After */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/account/funds": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get unified account funds
         * @description Returns a single aggregated view of the caller's funds so clients don't have to combine `/account/balance` (Router ledger) with the on-chain `PaymentVault.balanceOf` themselves.
         *
         *     `total` = `router.subtotal` + `payment_layer.balance`, where `router.subtotal` = `deposit` + `credit` − `pending_charge` (the net Router-ledger position). `total` is the user's net spendable funds and **may be negative** when outstanding debt exceeds available funds — render the shortfall as "owed to Router". This differs from `/account/balance`'s `total_balance`, which keeps a ≥0 contract for settlement / SDK callers and does NOT subtract pending_charge.
         *
         *     `payment_layer.balance` is the shared Payment Layer vault balance (`shared_across_products: true` — the vault is a pool across 0G apps, not owned exclusively by Router). `queried_at` is when that balance was actually read from chain; it is cached (~10s), so on a cache hit it can be up to that TTL in the past — treat it as the value's as-of time, not the request time.
         *
         *     For the Router-ledger-only view that settlement / SDK / mgmt-key integrations depend on, use `/account/balance` instead.
         *
         *     For **accounts settling in USD** (`currency: "usd"`) the `payment_layer` block does not apply — the Payment Layer vault plays no part in USD settlement — and is returned inert: `balance` is always `"0"`, `shared_across_products` is `false`, and `queried_at` is the time this response was produced, **not** a chain read. `total` is therefore the Router-side position alone, and is negative when the amount owed exceeds `deposit` + `credit`.
         *
         *     When 0G Pay serves that account's billing, the `router` figures come from there (`deposit` = funds, `credit` = promotional credit spendable on this service, `pending_charge` = amount owed), on the same spendable basis `/account/balance` documents, and the endpoint returns `503` when that balance cannot be established. `router.unsettled_charge` carries the charges not yet sent there, as on `/account/balance`.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Unified funds view */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.FundsResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Billing service unavailable (0G Pay accounts) — retryable, honours Retry-After */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/account/routing": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get account routing rules
         * @description Returns the routing rules that apply to every API key of the account: provider sort order, fallback, required parameters, trust-mode floor, encrypted transit, allowed / blocked models and providers, and price caps. Each rule is `null` until set. `updated_at` is `null` if the rules were never saved. JWT, or a management key with `routing:read`. These rules are defaults: an API key's own value for a rule replaces the account's for requests made with that key, and a request can override the preferences (`sort`, `allow_fallbacks`, `require_parameters`) and only tighten the rest. [beta]
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Routing rules */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.AccountRoutingPolicyResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Missing routing:read scope */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        /**
         * Replace account routing rules
         * @description Replaces the account's routing rules with the body: a field left out or `null` is cleared. Unknown fields are rejected. `sort` is `price` or `latency`; `trust_mode` is `standard`, `verified` or `private`; `encrypted_transit` is `off`, `preferred` or `required`. Models are canonical model ids. A provider is `{"address": "0x…"}` (every upstream behind that address), `{"address": "0x…", "identity": "aliyun"}` (one upstream behind it) or `{"identity": "aliyun"}` (that upstream behind every address). An allowed list must not be empty (use `null` for no restriction); an empty blocked list is the same as `null`. `max_price_usd` takes USD per 1M prompt tokens, USD per 1M completion tokens and USD per image; `0` admits only providers priced at $0. A provider no listing currently matches is saved, with a `warnings` entry (`unknown_provider`); a rule some of the account's active API keys replace with their own value is saved with an `overridden_by_keys` warning naming how many. Saved rules apply to new requests within about 30 seconds. Invalid input → 400 `invalid_routing_policy`. JWT, or a management key with `routing:write`. [beta]
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: components["requestBodies"]["github_com_0glabs_0g-router_pkg_routingpolicy.Policy"];
            responses: {
                /** @description Saved routing rules */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.AccountRoutingPolicyResponse"];
                    };
                };
                /** @description Invalid routing rules */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Missing routing:write scope */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/account/routing/explain": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Explain routing under routing rules
         * @description Shows how a request for `model` would be routed: every provider of the model, the routable ones first in the order a request tries them, then the excluded ones (this array order is guaranteed). Each routable one has a `route` (`primary`, then `fallback`; `not_used` when fallbacks are off; `skipped` when a retry passes over it because the same upstream — its `provider_identity`, else its address — already failed; `not_tried` past the retry budget) — providers equal on the sort key share a `tie_group`, across which routing spreads traffic, so their order within it is not a ranking and can change between calls — and for each excluded one every reason (`unhealthy`, `expired`, `not_capable`, `not_allowed`, `blocked`, `below_trust_mode`, `not_encryptable`, `over_price_cap`, `settlement_currency`, `not_billable`, `not_ranked`) with the rule `layer` that excluded it when a rule did. `outcome` says whether the request would be routed, and if not, the status and error code it would get. The account's routing rules apply, as `GET /v1/account/routing` returns them, or `account_routing` in their place (unsaved edits, validated as `PUT /v1/account/routing` validates them). With `api_key_id`, the rules of that key (one of the caller's inference keys) apply on top, a key's own value for a rule replacing the account's (a revoked or expired key's `outcome` is `401 invalid_api_key`, as a request with it gets); with `api_key_routing`, those rules apply instead of the saved ones (unsaved edits, or a key not created yet), validated as `PUT /v1/api-keys/{keyId}/routing` validates them. `rule_sources` names, for each rule set, whether the account's or the key's value applies; an exclusion's `layer` is `account`, `api_key` or `request`. `encrypted_transit` is the effective end-to-end encryption requirement (`off`, `preferred` — the default — or `required`); under `required` only providers a request can be sealed to are routable (`not_encryptable` excludes the rest). A preview model the caller is not listed for answers exactly like a model that does not exist (`404 model_not_found`, no `canonical_id`, no providers). `api_format` picks the chat surface explained: `openai` (`/v1/chat/completions`, the default) or `anthropic` (`/v1/messages`); each routes only to providers of its own format. A failure to compute the explanation (a database error) is a `500`, not an `outcome`. Nothing is executed or billed, and no routing metrics are recorded. JWT, or a management key with `routing:read` (and `keys:read` to name an `api_key_id`). [beta]
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            /** @description Explain request */
            requestBody: {
                content: {
                    "application/json": components["schemas"]["internal_handler.AccountRoutingExplainRequest"];
                };
            };
            responses: {
                /** @description Routing explanation */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["internal_handler.AccountRoutingExplainResponse"];
                    };
                };
                /** @description Invalid request or rules */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Missing scope */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description API key not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/account/usage/daily": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get daily usage statistics
         * @description Get usage statistics broken down by day for current user, with optional filters
         */
        get: {
            parameters: {
                query?: {
                    /** @description Filter by API key ID */
                    api_key_id?: string;
                    /** @description Filter by source: 'wallet' (JWT/browser), 'api_key' (any API key), or omit for all */
                    source?: string;
                    /** @description Start date (YYYY-MM-DD, inclusive) */
                    start_date?: string;
                    /** @description End date (YYYY-MM-DD, inclusive) */
                    end_date?: string;
                    /** @description Filter by trust tier: 'standard' | 'verified' | 'private'. Omit for all tiers. */
                    trust_mode?: string;
                    /** @description Extra breakdown dimensions on top of (date, model). Only 'trust_mode' is supported: pass `dimensions=trust_mode` to split each day/model row per trust tier and emit the `trust_mode` field. Omit (default) for the legacy one-row-per (date, model) shape. */
                    dimensions?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Daily usage statistics */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.DailyUsageResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/account/usage/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get usage history
         * @description Get usage history for current user, with optional filters
         */
        get: {
            parameters: {
                query?: {
                    /** @description Limit number of records */
                    limit?: number;
                    /** @description Offset for pagination (legacy). Ignored when `cursor` is set. */
                    offset?: number;
                    /** @description [beta] Opaque keyset cursor from a prior page's `next_cursor`. When set, pages via seek (constant per-page cost, independent of depth) and `offset` is ignored; also forces `include_total=false`. */
                    cursor?: string;
                    /** @description [beta] Include the full-set `total` count (default true). Set false to skip the expensive COUNT(*); recommended with `cursor`. */
                    include_total?: boolean;
                    /** @description Filter by model ID */
                    model_id?: string;
                    /** @description Filter by API key ID */
                    api_key_id?: string;
                    /** @description Filter by source: 'wallet' (JWT/browser), 'api_key' (any API key), or omit for all */
                    source?: string;
                    /** @description Start date (YYYY-MM-DD, inclusive) */
                    start_date?: string;
                    /** @description End date (YYYY-MM-DD, inclusive) */
                    end_date?: string;
                    /** @description Filter by trust tier: 'standard' | 'verified' | 'private'. Omit for all tiers. */
                    trust_mode?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Usage history list */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.UsageHistoryResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/account/usage/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get usage statistics
         * @description Get usage statistics for current user, optionally filtered by API key and date range
         */
        get: {
            parameters: {
                query?: {
                    /** @description Filter by API key ID */
                    api_key_id?: string;
                    /** @description Filter by source: 'wallet' (JWT/browser), 'api_key' (any API key), or omit for all */
                    source?: string;
                    /** @description Start date (YYYY-MM-DD, inclusive) */
                    start_date?: string;
                    /** @description End date (YYYY-MM-DD, inclusive) */
                    end_date?: string;
                    /** @description Filter by trust tier: 'standard' | 'verified' | 'private'. Omit for all tiers. */
                    trust_mode?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Usage statistics */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.UsageStatsResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api-keys": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get API key list
         * @description Get all API keys for current user
         */
        get: {
            parameters: {
                query?: {
                    /** @description Filter: active / revoked / expired / all (default all) */
                    status?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description API key list */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.APIKeyListResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        /**
         * Create API key
         * @description Create a new API key for LLM service access
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            /** @description API key configuration */
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_request.CreateAPIKeyRequest"];
                };
            };
            responses: {
                /** @description API key created */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.CreateAPIKeyResponse"];
                    };
                };
                /** @description Request error */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api-keys/{keyId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Revoke API key
         * @description Revoke a specific API key
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description API Key ID */
                    keyId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Revoked successfully */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.RevokeAPIKeyResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description API key not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /**
         * Update API key
         * @description Update name / credit_limit / reset_period / expiration of an API key
         */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description API Key ID */
                    keyId: string;
                };
                cookie?: never;
            };
            /** @description Patch payload */
            requestBody: {
                content: {
                    "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_request.UpdateAPIKeyRequest"];
                };
            };
            responses: {
                /** @description Updated key */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.APIKeyItem"];
                    };
                };
                /** @description Invalid request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description API key not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Duplicate name */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Key revoked */
                410: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api-keys/{keyId}/routing": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get API key routing rules
         * @description Returns one inference API key's routing rules, in the same shape as `GET /v1/account/routing`. `trust_mode`, `allowed_models` and `allowed_providers` are the same rules the key's own fields of those names carry. JWT, or a management key with `keys:read`. [beta]
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description API Key ID */
                    keyId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Routing rules */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.APIKeyRoutingPolicyResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description API key not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        /**
         * Replace API key routing rules
         * @description Replaces one inference API key's routing rules with the body, with the same fields and validation as `PUT /v1/account/routing`: a field left out or `null` is cleared — including `trust_mode`, `allowed_models` and `allowed_providers`, which are the key's fields of those names. A field the key sets replaces the account's rule of that name for requests made with the key; `null` inherits the account's. One difference from the account: an empty list (`[]`, allowed or blocked) is accepted and kept — it means "no restriction from this list" and replaces the account's list instead of inheriting it, and reads back as `[]`. A revoked key → 410 `key_revoked`. JWT, or a management key with `keys:manage`. [beta]
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description API Key ID */
                    keyId: string;
                };
                cookie?: never;
            };
            requestBody: components["requestBodies"]["github_com_0glabs_0g-router_pkg_routingpolicy.Policy"];
            responses: {
                /** @description Saved routing rules */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.APIKeyRoutingPolicyResponse"];
                    };
                };
                /** @description Invalid routing rules */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description API key not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Key revoked */
                410: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/async/images/edits": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit async image edit job
         * @description Submit an image editing job to be processed asynchronously. The response includes `jobId` and `provider_address` — clients then poll `/v1/async/jobs/{jobId}` with `?provider_address=...` to retrieve the result.
         *     Supports provider routing preferences via `X-0G-Provider-*` request headers (`Address`, `Sort`, `Trust-Mode`, `Allow-Fallbacks`). Multipart endpoints have no body-side routing surface — headers only.
         */
        post: {
            parameters: {
                query?: never;
                header?: {
                    /** @description Routing: pin to a specific provider by on-chain address (0x-prefixed). */
                    "X-0G-Provider-Address"?: string;
                    /** @description Routing: provider sort strategy. `latency` | `price`. */
                    "X-0G-Provider-Sort"?: string;
                    /** @description Routing: trust tier filter (`verified` | `private`). `verified` is a floor — `private` providers also satisfy it. */
                    "X-0G-Provider-Trust-Mode"?: string;
                    /** @description Routing: whether to retry on other providers after a failure. `true` | `false`. Defaults to false when an address is pinned, true otherwise. */
                    "X-0G-Provider-Allow-Fallbacks"?: string;
                    /** @description Routing: only these providers, comma-separated: `0x…` (every upstream behind that address), `0x…/identity` (one upstream behind it) or `*\/identity` (that upstream behind every address). Combines with the API key's own allowed providers: a provider must be on both. [beta] */
                    "X-0G-Provider-Allow"?: string;
                    /** @description Routing: never these providers, same forms as X-0G-Provider-Allow. Adds to the API key's own blocked providers. [beta] */
                    "X-0G-Provider-Block"?: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Job submitted; response carries jobId, status, provider_address */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            [key: string]: unknown;
                        };
                    };
                };
                /** @description Request error */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Insufficient balance */
                402: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Refund pending */
                423: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description No available provider */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/async/images/generations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit async image generation job
         * @description Submit an image generation job to be processed asynchronously. The response includes `jobId` and `provider_address` — clients then poll `/v1/async/jobs/{jobId}` with `?provider_address=...` to retrieve the result.
         *     **Provider Routing**: Use `"provider": {...}` body field OR `X-0G-Provider-*` request headers. Header > body precedence resolves same-field conflicts.
         *     **End-to-end encryption** [beta]: a 0G Private Computer client may seal `prompt` into a top-level `_e2ee` object and omit the cleartext `prompt`. The completed poll response is then sealed too: `data` is encrypted to the client and `usage.output_images` (cleartext) is the billed count. A sealed body must not also carry a top-level `prompt` (`400 invalid_request`) or `plugins`/`attachments` (`400 unsupported_with_e2ee`); a sealed result without a usable `usage.output_images` is refused with `502 invalid_sealed_response` and not charged.
         */
        post: {
            parameters: {
                query?: never;
                header?: {
                    /** @description Routing: pin to a specific provider by on-chain address (0x-prefixed). */
                    "X-0G-Provider-Address"?: string;
                    /** @description Routing: provider sort strategy. `latency` | `price`. */
                    "X-0G-Provider-Sort"?: string;
                    /** @description Routing: trust tier filter (`verified` | `private`). `verified` is a floor — `private` providers also satisfy it. */
                    "X-0G-Provider-Trust-Mode"?: string;
                    /** @description Routing: whether to retry on other providers after a failure. `true` | `false`. Defaults to false when an address is pinned, true otherwise. */
                    "X-0G-Provider-Allow-Fallbacks"?: string;
                    /** @description Routing: only these providers, comma-separated: `0x…` (every upstream behind that address), `0x…/identity` (one upstream behind it) or `*\/identity` (that upstream behind every address). Combines with the API key's own allowed providers: a provider must be on both. [beta] */
                    "X-0G-Provider-Allow"?: string;
                    /** @description Routing: never these providers, same forms as X-0G-Provider-Allow. Adds to the API key's own blocked providers. [beta] */
                    "X-0G-Provider-Block"?: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody: components["requestBodies"]["github_com_0glabs_0g-router_pkg_inference.ImageGenerationRequest"];
            responses: {
                /** @description Job submitted; response carries jobId, status, provider_address */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            [key: string]: unknown;
                        };
                    };
                };
                /** @description Request error (`invalid_request`, `invalid_value`, `unsupported_with_e2ee`) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Insufficient balance */
                402: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Refund pending */
                423: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description No available provider */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/audio/speech": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create speech
         * @description Generate audio from the input text. Request fields: `model`, `input`, `voice`, `response_format` (`mp3` default, `opus`, `aac`, `flac`, `wav`, `pcm` — a model may support fewer and answers 400 for the rest), `speed` (0.25–4.0), the `provider` routing preferences (see /chat/completions), and the optional fields the model lists in `speech_capabilities.controls` on GET /v1/models (e.g. `emotion`, `pitch`, `volume`, `language_boost`). A model's `speech_capabilities` also bound `input` (`max_input_bytes`, UTF-8), `response_format` and `speed`; a request outside them is refused with 400 before it is sent. Any other field is refused with 400; `stream_format` is accepted only as `"audio"` — the response is the whole audio file. `voice` takes the model's own voice ids (`speech_capabilities.voices` lists verified ones). Billed per input character at the model's `pricing.prompt` (USD per character); available to USD-settled accounts. [beta]
         */
        post: {
            parameters: {
                query?: never;
                header?: {
                    /** @description Routing: pin to a specific provider by on-chain address (0x-prefixed). */
                    "X-0G-Provider-Address"?: string;
                    /** @description Routing: whether to retry on other providers after a failure. `true` | `false`. Defaults to false when an address is pinned, true otherwise. */
                    "X-0G-Provider-Allow-Fallbacks"?: string;
                    /** @description Routing: only these providers, comma-separated: `0x…` (every upstream behind that address), `0x…/identity` (one upstream behind it) or `*\/identity` (that upstream behind every address). Combines with the API key's own allowed providers: a provider must be on both. [beta] */
                    "X-0G-Provider-Allow"?: string;
                    /** @description Routing: never these providers, same forms as X-0G-Provider-Allow. Adds to the API key's own blocked providers. [beta] */
                    "X-0G-Provider-Block"?: string;
                };
                path?: never;
                cookie?: never;
            };
            /** @description Speech request */
            requestBody: {
                content: {
                    "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_inference.SpeechRequest"];
                };
            };
            responses: {
                /** @description Audio file (Content-Type follows response_format) */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "audio/mpeg": string;
                    };
                };
                /** @description Request error */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "audio/mpeg": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "audio/mpeg": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Insufficient balance */
                402: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "audio/mpeg": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Model not found (unknown model id) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "audio/mpeg": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Refund pending */
                423: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "audio/mpeg": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "audio/mpeg": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Model not billable in the account's settlement currency */
                501: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "audio/mpeg": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description No available provider */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "audio/mpeg": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/audio/transcriptions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Audio transcription
         * @description Transcribe audio file to text. Accepts **either** content type:
         *     - `application/json` (default, schema below): `AudioTranscriptionRequest` body with base64-encoded audio in `file_base64`.
         *     - `multipart/form-data` (OpenAI-style): `file` part with audio bytes + `model` form field (plus optional `language`, `response_format`). Schema not auto-documented here — matches the OpenAI `/v1/audio/transcriptions` shape.
         *     `response_format` accepts `json` (the default) or `verbose_json`. `text`, `srt` and `vtt` are refused with `400 unsupported_response_format`.
         *     Streaming is not supported: `stream: true` is refused with `400 unsupported_stream`.
         *     Supports provider routing preferences via `X-0G-Provider-*` request headers (`Address`, `Sort`, `Trust-Mode`, `Allow-Fallbacks`). Multipart requests have no body-side routing surface — headers only. JSON requests may also use the body `provider: {...}` field.
         */
        post: {
            parameters: {
                query?: never;
                header?: {
                    /** @description Routing: pin to a specific provider by on-chain address (0x-prefixed). */
                    "X-0G-Provider-Address"?: string;
                    /** @description Routing: provider sort strategy. `latency` | `price`. */
                    "X-0G-Provider-Sort"?: string;
                    /** @description Routing: trust tier filter (`verified` | `private`). `verified` is a floor — `private` providers also satisfy it. */
                    "X-0G-Provider-Trust-Mode"?: string;
                    /** @description Routing: whether to retry on other providers after a failure. `true` | `false`. Defaults to false when an address is pinned, true otherwise. */
                    "X-0G-Provider-Allow-Fallbacks"?: string;
                    /** @description Routing: only these providers, comma-separated: `0x…` (every upstream behind that address), `0x…/identity` (one upstream behind it) or `*\/identity` (that upstream behind every address). Combines with the API key's own allowed providers: a provider must be on both. [beta] */
                    "X-0G-Provider-Allow"?: string;
                    /** @description Routing: never these providers, same forms as X-0G-Provider-Allow. Adds to the API key's own blocked providers. [beta] */
                    "X-0G-Provider-Block"?: string;
                };
                path?: never;
                cookie?: never;
            };
            /** @description JSON-body shape (base64-encoded audio in `file_base64`). For multipart/form-data requests, send `file` + `model` form parts instead — see description. */
            requestBody: {
                content: {
                    "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_inference.AudioTranscriptionRequest"];
                    "multipart/form-data": components["schemas"]["github_com_0glabs_0g-router_pkg_inference.AudioTranscriptionRequest"];
                };
            };
            responses: {
                /** @description Transcription result */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_inference.AudioTranscriptionResponse"];
                    };
                };
                /** @description Request error */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Insufficient balance */
                402: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Model not found (unknown model id) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Refund pending */
                423: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description No available provider */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/chat/completions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Chat completion
         * @description Send chat request to AI provider (OpenAI compatible API).
         *
         *     **Web Search**: Add `"plugins": [{"id": "web"}]` to enable real-time web search.
         *     Search results are injected into the prompt context and returned as `url_citation` annotations
         *     in the response. Works with any model. Multi-turn conversations automatically rewrite
         *     the query for better search relevance. The injected search context tokens are billed
         *     as normal input tokens.
         *
         *     **File Attachments**: Upload via `POST /v1/files`, then reference with
         *     `"attachments": [{"file_id": "file-..."}]`. Extracted text is injected into the system prompt
         *     and billed as normal input tokens.
         *
         *     **Provider Routing**: Use `"provider": {"sort": "latency"|"price", "address": "0x...", "allow_fallbacks": true}`
         *     to influence provider selection. `address` overrides `sort`. The `X-0G-Provider-*` request headers (documented below) are the equivalent canonical surface.
         *     **Price Ceiling** (header-only): set `X-0G-Provider-Max-Price-Usd-Prompt` / `-Completion` (USD per 1M tokens)
         *     or `-Image` (USD per generated image). Providers above the cap are excluded before sort/fallback runs. [beta]
         *
         *     **E2EE (sealed requests)**: a 0G Private Computer sidecar may seal `messages`/`tools` into a top-level
         *     `_e2ee` object and omit them from the cleartext body. The router detects `_e2ee`, skips the
         *     `messages`-required check, and carries the `_e2ee` field through to the provider (which it never
         *     reads or decrypts); `model` and response `usage` stay cleartext for routing/billing. Presence of
         *     `_e2ee` is the only signal (no header). [beta]
         */
        post: {
            parameters: {
                query?: never;
                header?: {
                    /** @description Routing: pin to a specific provider by on-chain address (0x-prefixed). */
                    "X-0G-Provider-Address"?: string;
                    /** @description Routing: provider sort strategy. `latency` | `price`. */
                    "X-0G-Provider-Sort"?: string;
                    /** @description Routing: trust tier filter (`verified` | `private`). `verified` is a floor — `private` providers also satisfy it. */
                    "X-0G-Provider-Trust-Mode"?: string;
                    /** @description Routing: whether to retry on other providers after a failure. `true` | `false`. Defaults to false when an address is pinned, true otherwise. */
                    "X-0G-Provider-Allow-Fallbacks"?: string;
                    /** @description Routing: only these providers, comma-separated: `0x…` (every upstream behind that address), `0x…/identity` (one upstream behind it) or `*\/identity` (that upstream behind every address). Combines with the API key's own allowed providers: a provider must be on both. [beta] */
                    "X-0G-Provider-Allow"?: string;
                    /** @description Routing: never these providers, same forms as X-0G-Provider-Allow. Adds to the API key's own blocked providers. [beta] */
                    "X-0G-Provider-Block"?: string;
                };
                path?: never;
                cookie?: never;
            };
            /** @description Chat request */
            requestBody: {
                content: {
                    "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_inference.ChatCompletionRequest"];
                };
            };
            responses: {
                /** @description Chat response */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_inference.ChatCompletionResponseWithTrace"];
                    };
                };
                /** @description Request error */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Insufficient balance */
                402: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Model not found (unknown model id) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Refund pending */
                423: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Provider error */
                502: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description No available provider (model exists but unavailable) */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/decisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create decisions
         * @description Ask a decision model (TypeSafe Jev) one or more typed questions about `state`. `questions` is an object of named questions, each `{"type":"noul"|"choice"|"score","instructions":...,"criteria":...}`; the response carries a typed answer with a probability per question, never generated text. Synchronous: one JSON response, no streaming. Supports `provider` routing preferences (see /chat/completions).
         *     **E2EE (sealed requests)**: a 0G Private Computer client may seal `state` and `questions` into a top-level `_e2ee` object and omit them from the cleartext body. The router skips the required-field checks for such a body and forwards `_e2ee` to the provider without reading it; `model` stays cleartext for routing. The response seals `answers` and carries the billable `usage.input_tokens` in cleartext. A sealed request must not also carry a top-level `state` or `questions`, and `attachments` is refused on a sealed request (`unsupported_with_e2ee`). [beta]
         */
        post: {
            parameters: {
                query?: never;
                header?: {
                    /** @description Routing: pin to a specific provider by on-chain address (0x-prefixed). */
                    "X-0G-Provider-Address"?: string;
                    /** @description Routing: provider sort strategy. `latency` | `price`. */
                    "X-0G-Provider-Sort"?: string;
                    /** @description Routing: trust tier filter (`verified` | `private`). `verified` is a floor — `private` providers also satisfy it. */
                    "X-0G-Provider-Trust-Mode"?: string;
                    /** @description Routing: whether to retry on other providers after a failure. `true` | `false`. Defaults to false when an address is pinned, true otherwise. */
                    "X-0G-Provider-Allow-Fallbacks"?: string;
                    /** @description Routing: only these providers, comma-separated: `0x…` (every upstream behind that address), `0x…/identity` (one upstream behind it) or `*\/identity` (that upstream behind every address). Combines with the API key's own allowed providers: a provider must be on both. [beta] */
                    "X-0G-Provider-Allow"?: string;
                    /** @description Routing: never these providers, same forms as X-0G-Provider-Allow. Adds to the API key's own blocked providers. [beta] */
                    "X-0G-Provider-Block"?: string;
                };
                path?: never;
                cookie?: never;
            };
            /** @description Decisions request */
            requestBody: {
                content: {
                    "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_inference.DecisionsRequest"];
                };
            };
            responses: {
                /** @description Typed answers keyed by question name */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            [key: string]: unknown;
                        };
                    };
                };
                /** @description Request error */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Insufficient balance */
                402: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Model not found (unknown model id) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Refund pending */
                423: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description No available provider */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/embeddings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create embeddings
         * @description Create a vector embedding for the given input text. Supports `provider` routing preferences (see /chat/completions).
         *     **E2EE (sealed requests)**: a 0G Private Computer client may seal `input` into a top-level `_e2ee` object and omit it from the cleartext body. The router skips the `input`-required check for such a body and forwards `_e2ee` to the provider without reading it; `model`, `dimensions` and `encoding_format` stay cleartext for routing. The response seals `data` (the vectors) and carries the billable `usage.prompt_tokens` in cleartext. A sealed request must not also carry a top-level `input`, and `attachments` is refused on a sealed request (`unsupported_with_e2ee`). [beta]
         */
        post: {
            parameters: {
                query?: never;
                header?: {
                    /** @description Routing: pin to a specific provider by on-chain address (0x-prefixed). */
                    "X-0G-Provider-Address"?: string;
                    /** @description Routing: provider sort strategy. `latency` | `price`. */
                    "X-0G-Provider-Sort"?: string;
                    /** @description Routing: trust tier filter (`verified` | `private`). `verified` is a floor — `private` providers also satisfy it. */
                    "X-0G-Provider-Trust-Mode"?: string;
                    /** @description Routing: whether to retry on other providers after a failure. `true` | `false`. Defaults to false when an address is pinned, true otherwise. */
                    "X-0G-Provider-Allow-Fallbacks"?: string;
                    /** @description Routing: only these providers, comma-separated: `0x…` (every upstream behind that address), `0x…/identity` (one upstream behind it) or `*\/identity` (that upstream behind every address). Combines with the API key's own allowed providers: a provider must be on both. [beta] */
                    "X-0G-Provider-Allow"?: string;
                    /** @description Routing: never these providers, same forms as X-0G-Provider-Allow. Adds to the API key's own blocked providers. [beta] */
                    "X-0G-Provider-Block"?: string;
                };
                path?: never;
                cookie?: never;
            };
            /** @description Embedding request */
            requestBody: {
                content: {
                    "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_inference.EmbeddingRequest"];
                };
            };
            responses: {
                /** @description Embedding vector(s) */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            [key: string]: unknown;
                        };
                    };
                };
                /** @description Request error */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Insufficient balance */
                402: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Model not found (unknown model id) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Refund pending */
                423: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description No available provider */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/images/edits": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Image editing
         * @description Edit an image using AI (inpainting, variations). The `n` and `size` form fields are held to the model's `image_capabilities` on GET /v1/models, as on /images/generations.
         *     Supports provider routing preferences via `X-0G-Provider-*` request headers (`Address`, `Sort`, `Trust-Mode`, `Allow-Fallbacks`). Multipart endpoints have no body-side routing surface — headers only.
         */
        post: {
            parameters: {
                query?: never;
                header?: {
                    /** @description Routing: pin to a specific provider by on-chain address (0x-prefixed). */
                    "X-0G-Provider-Address"?: string;
                    /** @description Routing: provider sort strategy. `latency` | `price`. */
                    "X-0G-Provider-Sort"?: string;
                    /** @description Routing: trust tier filter (`verified` | `private`). `verified` is a floor — `private` providers also satisfy it. */
                    "X-0G-Provider-Trust-Mode"?: string;
                    /** @description Routing: whether to retry on other providers after a failure. `true` | `false`. Defaults to false when an address is pinned, true otherwise. */
                    "X-0G-Provider-Allow-Fallbacks"?: string;
                    /** @description Routing: only these providers, comma-separated: `0x…` (every upstream behind that address), `0x…/identity` (one upstream behind it) or `*\/identity` (that upstream behind every address). Combines with the API key's own allowed providers: a provider must be on both. [beta] */
                    "X-0G-Provider-Allow"?: string;
                    /** @description Routing: never these providers, same forms as X-0G-Provider-Allow. Adds to the API key's own blocked providers. [beta] */
                    "X-0G-Provider-Block"?: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "multipart/form-data": {
                        /**
                         * Format: binary
                         * @description Source image file
                         */
                        image?: string;
                        /** @description Edit instruction */
                        prompt: string;
                        /** @description Model ID */
                        model: string;
                    };
                };
            };
            responses: {
                /** @description Edited image */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_inference.ImageGenerationResponse"];
                    };
                };
                /** @description Request error */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Insufficient balance */
                402: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Model not found (unknown model id) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Refund pending */
                423: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description No available provider */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/images/generations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Image generation
         * @description Generate images using AI. Supports `provider` routing preferences (see /chat/completions). `n` and `size` must lie within the model's `image_capabilities` on GET /v1/models (`max_n`; `size.min_side`/`max_side`/`min_pixels`/`max_pixels`, and `size.sizes` — the only sizes the model renders — when listed); a request outside them is refused with 400 before it is sent.
         */
        post: {
            parameters: {
                query?: never;
                header?: {
                    /** @description Routing: pin to a specific provider by on-chain address (0x-prefixed). */
                    "X-0G-Provider-Address"?: string;
                    /** @description Routing: provider sort strategy. `latency` | `price`. */
                    "X-0G-Provider-Sort"?: string;
                    /** @description Routing: trust tier filter (`verified` | `private`). `verified` is a floor — `private` providers also satisfy it. */
                    "X-0G-Provider-Trust-Mode"?: string;
                    /** @description Routing: whether to retry on other providers after a failure. `true` | `false`. Defaults to false when an address is pinned, true otherwise. */
                    "X-0G-Provider-Allow-Fallbacks"?: string;
                    /** @description Routing: only these providers, comma-separated: `0x…` (every upstream behind that address), `0x…/identity` (one upstream behind it) or `*\/identity` (that upstream behind every address). Combines with the API key's own allowed providers: a provider must be on both. [beta] */
                    "X-0G-Provider-Allow"?: string;
                    /** @description Routing: never these providers, same forms as X-0G-Provider-Allow. Adds to the API key's own blocked providers. [beta] */
                    "X-0G-Provider-Block"?: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody: components["requestBodies"]["github_com_0glabs_0g-router_pkg_inference.ImageGenerationRequest"];
            responses: {
                /** @description Generated image */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_inference.ImageGenerationResponse"];
                    };
                };
                /** @description Request error */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Insufficient balance */
                402: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Model not found (unknown model id) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Refund pending */
                423: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description No available provider */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Anthropic Messages API
         * @description Send chat request using Anthropic Messages API format.
         *     Routes to providers that support the Anthropic format.
         *     Supports web search plugins, file attachments, and provider routing preferences
         *     (same as `/chat/completions`).
         *
         *     **Streaming (`stream: true`)** returns a Server-Sent Events stream of standard
         *     Anthropic events. Router-added data rides as extra top-level fields on the
         *     `message_delta` event — `x_0g_trace`, plus `annotations` when the web search
         *     plugin was used — so every `data:` payload the router authors stays a valid
         *     Anthropic stream event. Read them from the **last** `message_delta`; there can
         *     be more than one, and only the last carries them. `x_0g_trace` is omitted
         *     entirely when the router could not attach it to a valid `message_delta`, so
         *     treat its absence as "not available", not as an error. `message_stop` is the
         *     final frame whenever the provider sends one. Some clients strip unknown fields
         *     from their parsed event objects, so read the raw SSE payload if your SDK does.
         *     Non-streaming responses carry `x_0g_trace` at the top level of the response
         *     body instead.
         */
        post: {
            parameters: {
                query?: never;
                header?: {
                    /** @description Routing: pin to a specific provider by on-chain address (0x-prefixed). */
                    "X-0G-Provider-Address"?: string;
                    /** @description Routing: provider sort strategy. `latency` | `price`. */
                    "X-0G-Provider-Sort"?: string;
                    /** @description Routing: trust tier filter (`verified` | `private`). `verified` is a floor — `private` providers also satisfy it. */
                    "X-0G-Provider-Trust-Mode"?: string;
                    /** @description Routing: whether to retry on other providers after a failure. `true` | `false`. Defaults to false when an address is pinned, true otherwise. */
                    "X-0G-Provider-Allow-Fallbacks"?: string;
                    /** @description Routing: only these providers, comma-separated: `0x…` (every upstream behind that address), `0x…/identity` (one upstream behind it) or `*\/identity` (that upstream behind every address). Combines with the API key's own allowed providers: a provider must be on both. [beta] */
                    "X-0G-Provider-Allow"?: string;
                    /** @description Routing: never these providers, same forms as X-0G-Provider-Allow. Adds to the API key's own blocked providers. [beta] */
                    "X-0G-Provider-Block"?: string;
                };
                path?: never;
                cookie?: never;
            };
            /** @description Anthropic Messages request */
            requestBody: {
                content: {
                    "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_inference.AnthropicRequest"];
                };
            };
            responses: {
                /** @description Anthropic Messages response */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_inference.AnthropicResponse"];
                    };
                };
                /** @description Request error */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.AnthropicErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.AnthropicErrorResponse"];
                    };
                };
                /** @description Insufficient balance */
                402: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.AnthropicErrorResponse"];
                    };
                };
                /** @description Model not found (unknown model id) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.AnthropicErrorResponse"];
                    };
                };
                /** @description Refund pending */
                423: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.AnthropicErrorResponse"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.AnthropicErrorResponse"];
                    };
                };
                /** @description Provider error */
                502: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.AnthropicErrorResponse"];
                    };
                };
                /** @description No available provider (model exists but unavailable) */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.AnthropicErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/models": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get model list
         * @description Get all available AI models. By default the response is the **canonical view**: one row per `canonical_id`, with curated registry metadata and endpoints aggregated (max context, union of params/formats, cheapest pricing); `id` is the canonical model id. A model stays listed even when all its endpoints are temporarily unhealthy (health is not a visibility filter; routing falls back to unhealthy endpoints so a listed model is always routable). To enumerate the endpoints behind a canonical id, call `GET /v1/providers?canonical_id=<id>`. provider_address uses OR (match any), input_modality and supported_parameter use AND (must match all).
         *     `?legacy=true` returns the historical view keyed by the raw provider `model_id` (one row per on-chain model id, including ids not mapped to a registered canonical), for clients that have not migrated to canonical ids. This is a **listing-only** compatibility surface — routing remains canonical-only, so a raw id absent from the model registry is still `404 model_not_found` on the inference path. **[beta]**
         */
        get: {
            parameters: {
                query?: {
                    /** @description [beta] true: historical raw-model_id-keyed view (listing-only; an unregistered id it lists is still 404 on the inference path). Default false: canonical view (id = canonical_id). */
                    legacy?: boolean;
                    /** @description [beta] 'usd': emit the OpenRouter-standard shape with per-token USD decimal strings under the top-level `pricing` field (for external pricing aggregators, e.g. TKX); models without a USD price are omitted. Default: native prices under `pricing`, USD under `pricing_usd`. */
                    pricing?: "usd";
                    /** @description Filter by provider address (OR: match any) */
                    provider_address?: string[];
                    /** @description Filter by input modality, e.g. text, image (AND: must support all) */
                    input_modality?: string[];
                    /** @description Filter by supported parameter, e.g. temperature (AND: must support all) */
                    supported_parameter?: string[];
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Model list */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ModelListResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/providers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get provider list
         * @description Get all TEE-acknowledged providers, optionally narrowed by service type, on-chain model id, and/or canonical id. `model` and `canonical_id` are independent filters and compose (ANDed): `canonical_id` alone lists every endpoint of a canonical, while `model` + `canonical_id` narrows to a specific endpoint within it. An empty value means "not filtered on" (so no filters = list all). Includes providers with unknown health status (is_healthy=null).
         */
        get: {
            parameters: {
                query?: {
                    /** @description Filter by service type (chatbot, text-to-image, speech-to-text) */
                    service_type?: string;
                    /** @description Filter by on-chain model ID (e.g. zai-org/GLM-5.1-FP8); exact model_id match. Empty = not filtered. */
                    model?: string;
                    /** @description [beta] Filter by canonical model ID (e.g. glm-5.1); lists every endpoint serving that canonical. Composes (AND) with model. Empty = not filtered. */
                    canonical_id?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Provider list */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ProviderListResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/responses": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Responses API
         * @description Send a request in OpenAI Responses API format (what OpenAI Codex speaks). [beta]
         *     Routes only to providers that serve the Responses API for the model; a model with none returns `400 model_format_mismatch`.
         *     Stateless: `previous_response_id`, `conversation`, `background` and `store: true` are refused with a 400 — send the full input on every request. `store` defaults to `false`.
         *     `plugins` and `attachments` are not supported on this endpoint.
         *     **Streaming (`stream: true`)** returns the standard Responses event stream; `x_0g_trace` rides as an extra top-level field on the terminal `response.completed` (or `response.incomplete` / `response.failed`) event. Non-streaming responses carry it at the top level of the body.
         */
        post: {
            parameters: {
                query?: never;
                header?: {
                    /** @description Routing: pin to a specific provider by on-chain address (0x-prefixed). */
                    "X-0G-Provider-Address"?: string;
                    /** @description Routing: provider sort strategy. `latency` | `price`. */
                    "X-0G-Provider-Sort"?: string;
                    /** @description Routing: whether to retry on other providers after a failure. `true` | `false`. Defaults to false when an address is pinned, true otherwise. */
                    "X-0G-Provider-Allow-Fallbacks"?: string;
                    /** @description Routing: only these providers, comma-separated: `0x…` (every upstream behind that address), `0x…/identity` (one upstream behind it) or `*\/identity` (that upstream behind every address). Combines with the API key's own allowed providers: a provider must be on both. [beta] */
                    "X-0G-Provider-Allow"?: string;
                    /** @description Routing: never these providers, same forms as X-0G-Provider-Allow. Adds to the API key's own blocked providers. [beta] */
                    "X-0G-Provider-Block"?: string;
                };
                path?: never;
                cookie?: never;
            };
            /** @description Responses API request */
            requestBody: {
                content: {
                    "application/json": Record<string, never>;
                };
            };
            responses: {
                /** @description Responses API response object */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": Record<string, never>;
                    };
                };
                /** @description Request error */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Insufficient balance */
                402: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Model not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Provider error */
                502: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description No available provider (model exists but unavailable) */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/routing/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Preview provider selection (E2EE)
         * @description Return, in fallback order, the provider(s) the router WOULD select for a request — WITHOUT executing or billing (a pinned address with several upstreams and no `X-0G-Provider-Identity` does advance the internal round-robin counter). Built for end-to-end-encrypted (sealed) requests: a sealed request must be encrypted to a specific provider enclave before it can be sent, so a gateway calls this first (with the sensitive `messages` / prompt stripped out), seals to the head candidate, and pins the real request to it via `X-0G-Provider-Address` + `X-0G-Provider-Identity` — falling back to the next candidate (re-sealing) on failure.
         *
         *     The body is the stripped inference request plus the control field `service_type` — the internal service type being previewed (`chatbot` | `text-to-image` | `image-editing` | `speech-to-text` | `embedding` | `decisions`). This is the SAME vocabulary returned by `GET /v1/service-types` (`.type`) and accepted by `GET /v1/providers` (`?service_type=`), so a caller discovering providers via the catalog feeds the same string straight in (it is NOT the model-modality `type` on `/v1/models`). `anthropic-chat` is not an accepted `service_type` — the API surface is a separate axis, see `api_format`. `api_format` is OPTIONAL and applies to `service_type=chatbot` only, which is the one service type serving two surfaces: `anthropic` previews `/v1/messages` (candidates are narrowed to providers advertising the Anthropic format), `openai` previews `/v1/chat/completions` (candidates are narrowed to providers advertising the OpenAI format, as that endpoint routes), and omitting it previews either. A model with no provider on the requested surface is a `400` with code `model_format_mismatch`. Sending `api_format` with a non-chat `service_type` is a `400`: image, audio, embedding and decisions have one surface each. `embedding` is accepted only where `/v1/embeddings` is served, `decisions` only where `/v1/decisions` is. `model` is OPTIONAL: given, candidates are that model's providers; omitted, candidates are ANY provider of the service type (a heterogeneous list — each candidate carries its own `canonical_id` / `model_id`). Routing preferences (`provider` / `X-0G-Provider-*`) and capability signals (`tools`, `response_format`, `max_tokens`, `reasoning_effort`) are read from the body/headers exactly as on the inference endpoints, so the previewed order matches what the request would select. The number of candidates is fixed at the router's provider-retry budget (the length of the fallback chain the router itself would try); a smaller healthy pool returns fewer. Each candidate returns the provider `address` and `provider_identity` (together, the pin — see below), its broker `endpoint` (to fetch the enclave key from), and the model it serves (`canonical_id` to put in the sealed request, `model_id` informational). `provider_identity` names the upstream a provider forwards to, and is present whenever that provider reports one — omitted otherwise, which is a property of the provider, not a promise that it serves only one upstream. Treat it as opaque: pin back exactly what the candidate carries (`X-0G-Provider-Identity` alongside `X-0G-Provider-Address`), including pinning nothing when it carries nothing, and infer nothing from its absence. Pin only the address where a candidate has an identity and the router re-picks among that address's upstreams at execute time, so you may be served by one other than the candidate you previewed and sealed against. A pinned `provider.address` returns just that provider. For the multipart inference endpoints (`image-editing`, `speech-to-text`) there is no JSON body to strip: synthesize this JSON body carrying `service_type` + `model` and forward routing prefs via `X-0G-Provider-*` headers — the uploaded blob (`file` / `mask`) and `prompt` need not (and should not) be included, as they are both sensitive and irrelevant to provider selection. [beta]
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            /** @description Preview request (stripped inference body + service_type/model) */
            requestBody: {
                content: {
                    "application/json": components["schemas"]["internal_handler.RoutePreviewRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["internal_handler.RoutePreviewResponse"];
                    };
                };
                /** @description Request error */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Model not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Model cannot be billed in the account's settlement currency */
                501: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description No available provider */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/service-types": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get available service types
         * @description Get service types that have at least one TEE-acknowledged provider (health is not a filter — a service type stays listed even when its providers are temporarily unhealthy)
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Service type list */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ServiceTypeListResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/videos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List your video jobs
         * @description Return this account's video jobs, most recent first. It exists so a client that lost a job id — a script that died after `POST /videos` returned, a page reloaded before the id was stored — can find it again: without it a lost id is a lost video, since every other video endpoint is keyed on the id.
         *
         *     Each entry is the ROUTER's record of the job, not the provider's video object: `id` (send it back to `GET /videos/{id}` unmodified), `model`, `created_at` (unix seconds, submit time), and the `seconds` / `size` the request asked for — `seconds` is quoted as a string and `size` echoes what you sent (`1080p`), not the provider's rendered resolution. **Both are the values you REQUESTED and can differ from what was rendered and billed** — a model that declares no `seconds` range may clamp the duration, and a model may downgrade a resolution it does not serve, so a request for `1080p` can be delivered at `720p` while this still shows `1080p`. `GET /videos/{id}` reports what the provider actually produced. Fields the provider owns, such as `progress`, are absent; a job still running has them there too. `status` is `in_progress` | `completed` | `failed`, derived from the router's own record — `completed` means the clip was delivered AND charged, and `in_progress` includes a clip the provider may already have finished but nobody has polled for yet. Poll `GET /videos/{id}` for the provider's full object; that is also what settles the charge.
         *
         *     Only jobs submitted through this router are visible, and only your own. The window is the most recent 100 jobs — there is no cursor, so an id lost further back than that cannot be recovered here.
         *
         *     A listed job is a router-side RECORD, not a guarantee the file still exists: the media is held by the model provider, not by this router, and vendors expire it (roughly a day to a week depending on the vendor). So `status: completed` on an older entry can still mean `GET /videos/{id}/content` no longer has anything to serve.
         */
        get: {
            parameters: {
                query?: {
                    /** @description How many jobs to return, most recent first. Default 20, maximum 100 — a larger value is clamped, not rejected. There is no pagination: only the most recent 100 jobs are reachable. */
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description { object: \"list\", data: [...] } */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            [key: string]: unknown;
                        };
                    };
                };
                /** @description invalid_request — `limit` is not a positive integer */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        /**
         * Submit async video generation job
         * @description Submit a video generation job (OpenAI Video API shape). The response `id` names the provider that owns the job, so poll it at `GET /videos/{id}` and download from `GET /videos/{id}/content` with no other parameter. Store it as text — it is up to 80 characters, not the 36 the older format used — and send it back exactly as returned. `provider_address` is still accepted but is ignored when the id names one.
         *     Accepts `application/json` OR `multipart/form-data`. Use multipart to drive image-to-video: send the same fields as form values plus the reference image as a file part.
         *     Supports provider routing preferences via `X-0G-Provider-*` request headers (`Address`, `Sort`, `Trust-Mode`, `Allow-Fallbacks`), identical to the other inference endpoints.
         *     The request shape is the OpenAI Video API's, but the models behind it are not OpenAI's, and where a model's own limits differ from OpenAI's they win. Those limits are per-model — read them from the model's `description` and `pricing.variants` on `GET /v1/models` rather than assuming the OpenAI defaults — and a request that violates one is rejected by the model provider, so the error text and any numeric code in it are theirs, not ours. The two that differ most often are `size` and `seconds`.
         *     `size` names a resolution TIER, not output dimensions, because a video model advertises the tiers it is PRICED at rather than arbitrary sizes. Two spellings are accepted and they are not equivalent. **Pixel dimensions** (`1280x720`, OpenAI's spelling and what an SDK sends) select the ASPECT RATIO only, and only for text-to-video — the clip renders at whatever tier the model serves, so on a 2K-only model `1280x720` returns a 2560x1440 clip billed at the 2K rate, not a 720p one. For **image-to-video** the aspect ratio follows your reference image, so pixel dimensions have no effect there — a tier name still selects the tier. **A tier name** (`2K`) addresses the tier directly. Send only names that appear in that list — it is the set this endpoint can price, and it grows as a model adds tiers, so read it rather than hard-coding what a model serves today. For a model whose `video_capabilities` lists a `resolution` control, any other tier name is refused with 400 (the message lists the tiers) instead of rendering at a different tier. Read the tiers from `pricing.variants[].dimensions.resolution`. Omitting `size` is the recommended default — the model's own default tier and aspect ratio apply.
         *     `seconds` must lie within the model's supported range. For a model with a known range (MiniMax-H3 4–15, ByteDance Seedance 2.5 4–30, Seedance 2.0 4–15; shown as the `seconds` control in `video_capabilities` on `GET /v1/models` when that model's vendor fields are available), a request outside it is rejected with 400 before anything is generated or charged, and the error states the range. For a model with no known range, the provider may clamp an out-of-range value without an error, and you are billed for the clip actually produced. Video edit is the one exception: a model whose `seconds` control lists `auto_with: ["reference_video"]` (Seedance 2.5) takes the length from the reference video, so with a `reference_video` in `metadata.content` send `seconds: -1` or leave `seconds` out.
         *     For both fields the submit response echoes what you SENT, while the poll response reports what was actually rendered. Reconcile against the poll.
         *     [beta] A model whose `GET /v1/models` entry lists `video_capabilities` also accepts the vendor's own fields (first/last frame, reference images/video/audio, and the controls listed there) under `metadata`, forwarded unchanged. Such a request is routed only to an endpoint that forwards `metadata`, and is rejected with 400 `model_not_capable` rather than having those fields dropped; send it as JSON, not multipart.
         */
        post: {
            parameters: {
                query?: never;
                header?: {
                    /** @description Routing: pin to a specific provider by on-chain address (0x-prefixed). */
                    "X-0G-Provider-Address"?: string;
                    /** @description Routing: provider sort strategy. `latency` | `price`. */
                    "X-0G-Provider-Sort"?: string;
                    /** @description Routing: trust tier filter (`verified` | `private`). `verified` is a floor — `private` providers also satisfy it. */
                    "X-0G-Provider-Trust-Mode"?: string;
                    /** @description Routing: whether to retry on other providers after a failure. `true` | `false`. Defaults to false when an address is pinned, true otherwise. */
                    "X-0G-Provider-Allow-Fallbacks"?: string;
                    /** @description Routing: only these providers, comma-separated: `0x…` (every upstream behind that address), `0x…/identity` (one upstream behind it) or `*\/identity` (that upstream behind every address). Combines with the API key's own allowed providers: a provider must be on both. [beta] */
                    "X-0G-Provider-Allow"?: string;
                    /** @description Routing: never these providers, same forms as X-0G-Provider-Allow. Adds to the API key's own blocked providers. [beta] */
                    "X-0G-Provider-Block"?: string;
                };
                path?: never;
                cookie?: never;
            };
            /** @description Video generation request. `model`, `prompt` and `seconds` are REQUIRED (`seconds` is optional in the upstream OpenAI Video API but mandatory here — see the changelog); `size` is optional. */
            requestBody: {
                content: {
                    "application/json": Record<string, never>;
                    "multipart/form-data": Record<string, never>;
                };
            };
            responses: {
                /** @description Job submitted; response carries id, status, provider_address */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            [key: string]: unknown;
                        };
                    };
                };
                /** @description Request error — includes `seconds is required` and a `seconds` value the model has no price for (the available durations are listed) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description insufficient_balance — either the account is out of funds, or its balance does not cover one clip of the requested length on this model. The second case is specific to video: a request here can cost many times the flat per-request minimum, so an account can pass the general balance check and still be refused. Add funds or request fewer seconds. */
                402: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description model_not_found — no provider on the network serves this model */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description refund_pending — a refund is in progress for this account */
                423: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description video_jobs_in_flight_limit — too many unfinished video jobs for this account; poll or wait for the earlier ones. The limit is per-account — it is your spendable balance divided by what one clip on that model can cost, capped at a ceiling — so read it from the message rather than hard-coding one. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Not available in USD mode */
                501: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description no_available_provider, or vault_unavailable when the balance backing this account cannot be read right now — both are retryable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/videos/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Poll async video generation job
         * @description Return a video job's current status. When the job has completed this is also what settles the charge. `provider_address` is optional — it is resolved from the job id when omitted, so an OpenAI-native client can call `GET /videos/{id}` with no query parameters.
         *     The object is the model provider's, passed through: beyond the fields this router sets (`id`, `x_0g_trace` on completion, and `seconds` / `size` from your request when the provider omits them), a field appears only when the provider reports it — in particular `expires_at` is present only when the provider states how long it keeps the clip; absent means unknown, not a default. The clip lives with the provider: once it is gone, `GET /videos/{id}/content` no longer returns it.
         */
        get: {
            parameters: {
                query?: {
                    /** @description Pin the provider, for an id issued before ids named their own provider. Ignored when the id names one. */
                    provider_address?: string;
                    /** @description Verify the provider's TEE signature and include the trace */
                    verify_tee?: boolean;
                };
                header?: never;
                path: {
                    /** @description Video job id exactly as returned by POST /videos. It names the provider that owns the job, so it is longer than the provider's own id (up to 80 chars) — store it as text and echo it back unmodified. Ids issued before this became the format keep working. */
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Job status; on completion the result payload */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            [key: string]: unknown;
                        };
                    };
                };
                /** @description Request error. `malformed_job_id` means the id is shaped like one this endpoint issues but is not usable — resend it exactly as POST /videos returned it. An id issued before ids carried their provider can still report that it is tracked against more than one provider, where `provider_address` disambiguates. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Caller is not the submitter of this job */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description async_job_not_found — this router has no such job id (it never existed, or it belongs to a different provider than the one pinned) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Upstream provider error */
                502: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/videos/{id}/artifacts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a video's artifacts [beta]
         * @description [beta] Every file a completed video job produced — the clip, and anything else the request asked the model for (for example the last frame, with `metadata.return_last_frame`) — each with a `content_url` to download it from. Available for videos served by an endpoint that forwards vendor-native fields (see `video_capabilities` on GET /models); other videos return 404 `artifact_not_found` and have only GET /videos/{id}/content. Same rules as /content: a job not yet charged is charged first, a running job returns 409.
         */
        get: {
            parameters: {
                query?: {
                    /** @description Pin the provider, for an id issued before ids named their own provider. Ignored when the id names one. */
                    provider_address?: string;
                };
                header?: never;
                path: {
                    /** @description Video job id exactly as returned by POST /videos */
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description {id, object: \"list\", data: [{key, type, mime_type, content_url}]} */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            [key: string]: unknown;
                        };
                    };
                };
                /** @description Caller is not the submitter of this job */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description async_job_not_found, or artifact_not_found when the video has no artifacts */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Video not ready yet; keep polling GET /videos/{id} */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description The video job failed at the provider and has no output */
                424: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Upstream provider error */
                502: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/videos/{id}/artifacts/{key}/content": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Download a video artifact [beta]
         * @description [beta] Stream one file listed by GET /videos/{id}/artifacts. Same rules as /content.
         */
        get: {
            parameters: {
                query?: {
                    /** @description Pin the provider, for an id issued before ids named their own provider. Ignored when the id names one. */
                    provider_address?: string;
                };
                header?: never;
                path: {
                    /** @description Video job id exactly as returned by POST /videos */
                    id: string;
                    /** @description Artifact key, as listed by GET /videos/{id}/artifacts */
                    key: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The artifact */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/octet-stream": string;
                    };
                };
                /** @description Caller is not the submitter of this job */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/octet-stream": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description async_job_not_found, or artifact_not_found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/octet-stream": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Video not ready yet; keep polling GET /videos/{id} */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/octet-stream": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description The video job failed at the provider and has no output */
                424: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/octet-stream": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Too many concurrent downloads for this account */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/octet-stream": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Upstream provider error */
                502: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/octet-stream": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/videos/{id}/content": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Download a completed video
         * @description Stream the finished video file. If the job has not been charged yet (the client never polled `GET /videos/{id}`) it is charged before any bytes are sent. A job that is still running returns 409; a job that failed at the provider returns 424. `provider_address` is optional: an id issued by `POST /videos` names its own provider, and an older id is resolved by lookup.
         */
        get: {
            parameters: {
                query?: {
                    /** @description Pin the provider, for an id issued before ids named their own provider. Ignored when the id names one. */
                    provider_address?: string;
                    /** @description Verify the provider's TEE signature before billing */
                    verify_tee?: boolean;
                };
                header?: never;
                path: {
                    /** @description Video job id exactly as returned by POST /videos. It names the provider that owns the job, so it is longer than the provider's own id (up to 80 chars) — store it as text and echo it back unmodified. Ids issued before this became the format keep working. */
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The video file */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/octet-stream": string;
                    };
                };
                /** @description Request error. `malformed_job_id` means the id is shaped like one this endpoint issues but is not usable — resend it exactly as POST /videos returned it. An id issued before ids carried their provider can still report that it is tracked against more than one provider, where `provider_address` disambiguates. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/octet-stream": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Caller is not the submitter of this job */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/octet-stream": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description async_job_not_found — this router has no such job id (it never existed, or it belongs to a different provider than the one pinned) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/octet-stream": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Video not ready yet; keep polling GET /videos/{id} */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/octet-stream": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description The video job failed at the provider and has no output */
                424: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/octet-stream": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Too many concurrent downloads for this account */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/octet-stream": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Upstream provider error */
                502: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/octet-stream": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/web/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Search the web
         * @description Runs one web search and returns the results, for a client that executes a search tool itself: declare a `web_search` function tool, and when the model calls it, run its query here and send the results back as the tool result. This works with every model that supports tool calling, including end-to-end-encrypted ones, whose prompt the router cannot add search results to; only the query leaves the encrypted conversation.
         *     Billed at the per-search fee when results are returned (in 0G for 0G-settled accounts, converted at the router's current rate); a search with no results is free. Counts toward the inference rate limit. [beta]
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            /** @description Search query */
            requestBody: {
                content: {
                    "application/json": components["schemas"]["internal_handler.WebSearchRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["internal_handler.WebSearchResponse"];
                    };
                };
                /** @description Missing or too long query */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Insufficient balance */
                402: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Refund pending */
                423: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description The search backend failed */
                502: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Search is not available right now */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List webhook endpoints
         * @description The account's webhook endpoints (at most 5) with their subscribed events and delivery health. `status` is `healthy` (the last delivery succeeded), `failing` (it did not), `no_deliveries` (nothing sent yet) or `disabled` (deliveries failed for 3 days in a row; nothing more is sent — remove the endpoint and add it again). Secrets are never listed. JWT, or a management key with `webhooks:read`. See the webhooks guide for payloads and signature checks. [beta]
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Endpoints */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["internal_handler.WebhookListResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Missing webhooks:read scope */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        /**
         * Create a webhook endpoint
         * @description Registers an https URL on a public host for the given events: `balance.low`, `model.added`, `model.removed`, `model.down`, `model.recovered` (at least one). `balance.low` is available to USD-billed accounts only (otherwise 400 `event_not_available`). The response carries the signing `secret` — the only time it is shown; store it. An account can have 5 endpoints (409 `webhook_limit_reached`). A URL that is not https, has credentials, or points at a private, loopback, link-local, CGNAT or metadata address → 400 `invalid_webhook`. Deliveries come from no fixed IP address: authenticate them by their signature. JWT, or a management key with `webhooks:write`. [beta]
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            /** @description Endpoint */
            requestBody: {
                content: {
                    "application/json": components["schemas"]["internal_handler.CreateWebhookRequest"];
                };
            };
            responses: {
                /** @description Created; secret shown once */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["internal_handler.WebhookCreatedResponse"];
                    };
                };
                /** @description Invalid URL or events */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Missing webhooks:write scope */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Already 5 endpoints */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete a webhook endpoint
         * @description Removes the endpoint and its delivery history; deliveries not yet sent are dropped. JWT, or a management key with `webhooks:write`. [beta]
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description Endpoint id */
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Deleted */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "*/*": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Missing webhooks:write scope */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "*/*": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description No such endpoint */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "*/*": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "*/*": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/{id}/deliveries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List webhook deliveries
         * @description The endpoint's deliveries from the last 30 days, newest first, 50 per page; pass `next_before` as `before` for the next page. `status` is `pending` (more attempts to come, at `next_attempt_at`), `delivered` or `abandoned` (every attempt failed: retries run 1m, 5m, 30m, 2h, 6h and 12h after the first). JWT, or a management key with `webhooks:read`. [beta]
         */
        get: {
            parameters: {
                query?: {
                    /** @description Cursor: deliveries older than this id */
                    before?: number;
                };
                header?: never;
                path: {
                    /** @description Endpoint id */
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Page */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["internal_handler.WebhookDeliveryListResponse"];
                    };
                };
                /** @description Invalid cursor */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Missing webhooks:read scope */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description No such endpoint */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/{id}/rotate-secret": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Rotate a webhook signing secret
         * @description Returns a new signing secret — the only time it is shown. For 24 hours deliveries carry two `v1=` signatures, one per secret, so a receiver can switch over without dropping events; after that only the new secret signs. JWT, or a management key with `webhooks:write`. [beta]
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description Endpoint id */
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description New secret */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["internal_handler.WebhookSecretResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Missing webhooks:write scope */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description No such endpoint */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/{id}/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Send a test event
         * @description Sends one sample event of the endpoint's first subscribed type, with `"test": true`, signed like any delivery, and answers with what the receiver did: `ok` (a 2xx within 10 seconds), its `status_code` (null if none arrived) and `error`. Not retried; a failing test does not count towards disabling the endpoint. One test per endpoint every 10 seconds (429 `webhook_test_rate_limited`, with `Retry-After`). A failure to connect reads `destination not allowed`, `timed out` or `could not connect`. JWT, or a management key with `webhooks:write`. [beta]
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description Endpoint id */
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Receiver's answer */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_internal_service.WebhookTestResult"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Missing webhooks:write scope */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description No such endpoint */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Tested less than 10 seconds ago */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
                /** @description Server error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        "github_com_0glabs_0g-router_internal_model.Broadcast": {
            /**
             * @description Accounts is every account at send time; Notified those whose bell got
             *     the entry (the rest turned the category's console channel off).
             */
            accounts?: number;
            body?: string;
            category?: string;
            created_at?: string;
            created_by?: string;
            forced?: boolean;
            id?: number;
            link?: string;
            /**
             * @description Subject is the model a new_models broadcast is about; Link the URL a
             *     news one points to.
             */
            model?: string;
            notified?: number;
            title?: string;
        };
        "github_com_0glabs_0g-router_internal_model.ModelIncident": {
            announced_by?: string;
            created_at?: string;
            id?: number;
            model?: string;
            /**
             * @description Notified / RecoveredNotified are how many bell entries each announcement
             *     wrote, for the on-call's record.
             */
            notified?: number;
            recovered_notified?: number;
            resolved_at?: string;
            resolved_by?: string;
            started_at?: string;
            status?: string;
        };
        "github_com_0glabs_0g-router_internal_model.ModelRemoval": {
            cancelled_at?: string;
            cancelled_by?: string;
            created_at?: string;
            created_by?: string;
            id?: number;
            last_notice_at?: string;
            model?: string;
            next_notice_at?: string;
            /**
             * @description Notices / Notified: how many notices went out, and how many bell entries
             *     they wrote in all.
             */
            notices?: number;
            notified?: number;
            removal_at?: string;
            replacement?: string;
            /** @description Status is scheduled, then removed (the last notice went out) or cancelled. */
            status?: string;
            sudden?: boolean;
        };
        "github_com_0glabs_0g-router_internal_model.Notification": {
            action?: string;
            body?: string;
            category?: string;
            created_at?: string;
            id?: number;
            kind?: string;
            /** @description Link is the https URL a news broadcast points to (action open_link). */
            link?: string;
            pinned?: boolean;
            read_at?: string;
            /**
             * @description Subject is what the entry is about when that is not the account itself:
             *     the model id for model-status entries ('' otherwise). The Console links
             *     "View status" with it.
             */
            subject?: string;
            title?: string;
        };
        "github_com_0glabs_0g-router_internal_service.AdminRoleView": {
            created_at?: string;
            granted_by?: string;
            scopes?: string[];
            updated_at?: string;
            wallet_address?: string;
        };
        "github_com_0glabs_0g-router_internal_service.BroadcastPreview": {
            accounts?: number;
            category?: string;
            /**
             * @description LastSentAt is the category's last broadcast; for news, another one
             *     before LastSentAt + 7 days needs force.
             */
            last_sent_at?: string;
            recipients?: number;
        };
        "github_com_0glabs_0g-router_internal_service.CreateProjectGrantRequest": {
            /**
             * @description Currency selects the grant's unit and target ledger: "0g" (the default when
             *     omitted) or "usd". A "usd" grant requires features.usd_billing.
             */
            currency?: string;
            /** @description RFC3339, "" = never */
            expires_at?: string;
            name?: string;
            owner_address: string;
            /**
             * @description TotalQuota is a raw neuron integer for a 0g grant, or a USD decimal
             *     ("5", "1.50") for a usd grant (stored as micro-USD).
             */
            total_quota: string;
        };
        "github_com_0glabs_0g-router_internal_service.DistributeProjectCreditRequest": {
            amount: string;
            grant_id: string;
            idempotency_key: string;
            reason?: string;
            recipient_address: string;
        };
        "github_com_0glabs_0g-router_internal_service.GrantCreditRequest": {
            /** @description neuron (1 0G = 10^18 neuron) */
            amount: string;
            reason?: string;
            /** @description "welcome", "promotion", "compensation", "manual" */
            type: string;
            user_address: string;
        };
        "github_com_0glabs_0g-router_internal_service.GrantUsdCreditRequest": {
            /** @description USD decimal, e.g. "5.00" */
            amount: string;
            reason?: string;
            /** @description "welcome", "promotion", "compensation", "manual" */
            type: string;
            user_address: string;
        };
        "github_com_0glabs_0g-router_internal_service.IncidentPreview": {
            /**
             * @description Callers is every account that called the model in the window;
             *     Recipients those of them whose bell will get the entry.
             */
            callers?: number;
            model?: string;
            recipients?: number;
            window_days?: number;
        };
        "github_com_0glabs_0g-router_internal_service.RemovalPreview": {
            model?: string;
            /**
             * @description Recipients is every account that called the model in the window; all
             *     of them get the notices (must-send).
             */
            recipients?: number;
            window_days?: number;
        };
        "github_com_0glabs_0g-router_internal_service.RevokeUsdCreditRequest": {
            /** @description USD decimal, e.g. "1.00"; omitted = all remaining */
            amount?: string;
            /**
             * @description max=500 matches credit_grants.reason's varchar(500). Without the bound, a
             *     longer reason — a pasted clawback justification is plausible — fails the
             *     audit-row INSERT with MySQL 1406 under prod's STRICT_TRANS_TABLES. The
             *     transaction rolls back correctly, but classify-by-exclusion would file that
             *     permanent, caller-caused failure under ErrRevokeUnavailable → 503 "retry
             *     this one", and the batch would retry that account forever.
             */
            reason: string;
            user_address: string;
        };
        "github_com_0glabs_0g-router_internal_service.UpdateAutoDepositRequest": {
            enabled?: boolean;
            low_watermark?: string;
            max_balance?: string;
        };
        "github_com_0glabs_0g-router_internal_service.WebhookDeliveryView": {
            attempts?: number;
            created_at?: string;
            error?: string;
            event_id?: string;
            event_type?: string;
            id?: number;
            last_attempt_at?: string;
            next_attempt_at?: string;
            /** @description Status is pending (more attempts to come), delivered or abandoned. */
            status?: string;
            status_code?: number;
            test?: boolean;
        };
        "github_com_0glabs_0g-router_internal_service.WebhookEndpointView": {
            created_at?: string;
            disabled_at?: string;
            /**
             * @example [
             *       "balance.low",
             *       "model.down"
             *     ]
             */
            events?: string[];
            /** @example 12 */
            id?: number;
            last_delivery?: components["schemas"]["github_com_0glabs_0g-router_internal_service.WebhookLastDelivery"];
            /**
             * @description PreviousSecretExpiresAt is set during a rotation's grace window, while
             *     deliveries are also signed with the previous secret.
             */
            previous_secret_expires_at?: string;
            /**
             * @description Status is healthy (last delivery succeeded), failing (it did not),
             *     no_deliveries (nothing sent yet) or disabled (failed for 3 days; no
             *     longer delivered to).
             * @example healthy
             */
            status?: string;
            /** @example https://example.com/hooks/0g */
            url?: string;
        };
        "github_com_0glabs_0g-router_internal_service.WebhookLastDelivery": {
            at?: string;
            error?: string;
            ok?: boolean;
            /** @description StatusCode is the receiver's HTTP status; null when no response arrived. */
            status_code?: number;
        };
        "github_com_0glabs_0g-router_internal_service.WebhookTestResult": {
            error?: string;
            /** @example evt_4f1c2a9b0d3e5f6a7b8c9d0e */
            event_id?: string;
            ok?: boolean;
            status_code?: number;
            /** @example balance.low */
            type?: string;
        };
        "github_com_0glabs_0g-router_pkg_inference.AnthropicCacheCreation": {
            ephemeral_1h_input_tokens?: number;
            ephemeral_5m_input_tokens?: number;
        };
        "github_com_0glabs_0g-router_pkg_inference.AnthropicContentBlock": {
            /** @description tool_use fields */
            id?: string;
            input?: unknown;
            name?: string;
            text?: string;
            /** @description "text", "tool_use", etc. */
            type?: string;
        };
        "github_com_0glabs_0g-router_pkg_inference.AnthropicRequest": {
            attachments?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.Attachment"][];
            max_tokens?: number;
            /** @description AnthropicMessage objects */
            messages?: unknown[];
            metadata?: unknown;
            model?: string;
            /** @description 0G Router extensions (stripped before forwarding) */
            plugins?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.Plugin"][];
            provider?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.ProviderPreferences"];
            stop_sequences?: string[];
            stream?: boolean;
            /** @description string or []AnthropicContentBlock */
            system?: unknown;
            temperature?: number;
            tool_choice?: unknown;
            tools?: unknown[];
            top_k?: number;
            top_p?: number;
        };
        "github_com_0glabs_0g-router_pkg_inference.AnthropicResponse": {
            content?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.AnthropicContentBlock"][];
            id?: string;
            model?: string;
            /** @description "assistant" */
            role?: string;
            stop_reason?: string;
            /** @description "message" */
            type?: string;
            usage?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.AnthropicUsage"];
        };
        "github_com_0glabs_0g-router_pkg_inference.AnthropicServerToolUse": {
            web_search_requests?: number;
        };
        "github_com_0glabs_0g-router_pkg_inference.AnthropicUsage": {
            cache_creation?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.AnthropicCacheCreation"];
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
            input_tokens?: number;
            output_tokens?: number;
            /**
             * @description ServerToolUse counts the server tools the upstream ran itself, e.g. the
             *     Anthropic web_search tool (web_search_20250305) a caller passed through.
             */
            server_tool_use?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.AnthropicServerToolUse"];
        };
        "github_com_0glabs_0g-router_pkg_inference.Attachment": {
            /**
             * @description File ID from upload endpoint
             * @example file-abc123
             */
            file_id?: string;
        };
        "github_com_0glabs_0g-router_pkg_inference.AudioTranscriptionRequest": {
            /**
             * @description Base64 encoded audio file
             * @example SGVsbG8gd29ybGQ=
             */
            file_base64?: string;
            /**
             * @description Filename
             * @example audio.mp3
             */
            filename?: string;
            /**
             * @description Audio language
             * @example en
             */
            language?: string;
            /**
             * @description Model ID
             * @example whisper-1
             */
            model?: string;
            /**
             * @description Response format
             * @example json
             */
            response_format?: string;
        };
        "github_com_0glabs_0g-router_pkg_inference.AudioTranscriptionResponse": {
            /**
             * @description Audio duration (seconds)
             * @example 5.5
             */
            duration?: number;
            /**
             * @description Detected language
             * @example en
             */
            language?: string;
            /**
             * @description Transcribed text
             * @example Hello, world!
             */
            text?: string;
        };
        "github_com_0glabs_0g-router_pkg_inference.BillingInfo": {
            /**
             * @description Currency is the unit of input_cost, output_cost, total_cost and
             *     web_search_cost (total_cost_usd_micro is always micro-USD): "0g" (wei) or "usd" (micro-USD),
             *     matching the account's settlement mode. Always set — every construction
             *     site stamps it from the ledger that priced the block, and the booked-charge
             *     substitution (settledBilling) carries the quote's tag through — so it is
             *     deliberately NOT omitempty: an empty value on the wire would mean a
             *     producer forgot it, and hiding that is worse than showing it.
             * @example usd
             */
            currency?: string;
            /**
             * @description Input cost
             * @example 0.00001
             */
            input_cost?: string;
            /**
             * @description Output cost
             * @example 0.00002
             */
            output_cost?: string;
            /**
             * @description Total cost
             * @example 0.00003
             */
            total_cost?: string;
            /**
             * @description TotalCostUSDMicro is total_cost valued in micro-USD whatever the account
             *     settles in: on a "usd" account it equals total_cost; on a "0g" account it
             *     is the USD equivalent of the wei charge, priced from the model's USD list
             *     price (or, under a discount, the wei actually charged at the router's
             *     0G/USD rate) — the same figure the usage endpoints report as
             *     cost_usd_micro, so spend reads in one unit across both ledgers. It is a
             *     reporting figure, not the amount settled: a 0G account is charged
             *     total_cost in wei. Absent when no USD valuation could be derived, and on
             *     the asynchronous endpoints and /v1/web/search. [beta]
             * @example 1500
             */
            total_cost_usd_micro?: string;
            /**
             * @description WebFetchCost is the fee for the pages the web fetch tool fetched,
             *     included in input_cost and total_cost, in the same unit; present only
             *     when priced pages were fetched for this request. [beta]
             * @example 3000
             */
            web_fetch_cost?: string;
            /**
             * @description WebSearchCost is the web-search fee included in input_cost and
             *     total_cost, in the same unit; present only when a priced search was
             *     injected into this request. [beta]
             * @example 20000
             */
            web_search_cost?: string;
        };
        "github_com_0glabs_0g-router_pkg_inference.ChatCompletionRequest": {
            /** @description File attachments (uploaded via /v1/files) */
            attachments?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.Attachment"][];
            /**
             * @description Maximum output tokens
             * @example 1024
             */
            max_tokens?: number;
            /** @description Message list (content may be string or multimodal array) */
            messages?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.RequestMessage"][];
            /**
             * @description Model ID
             * @example qwen/qwen-2.5-7b-instruct
             */
            model?: string;
            /** @description Plugins to enable (e.g. [{"id":"web"}] for web search) */
            plugins?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.Plugin"][];
            /** @description Routing preferences (0G Router extension) */
            provider?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.ProviderPreferences"];
            /** @description Output format: json_object or json_schema for structured output */
            response_format?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.ResponseFormat"];
            /**
             * @description Whether to stream output
             * @example false
             */
            stream?: boolean;
            /**
             * @description Temperature parameter (0-2)
             * @example 0.7
             */
            temperature?: number;
            /** @description Which tool to use: "none", "auto", "required", or {"type":"function","function":{"name":"..."}} */
            tool_choice?: unknown;
            /** @description Tools (functions) the model may call */
            tools?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.Tool"][];
            /**
             * @description Top-p sampling parameter
             * @example 0.9
             */
            top_p?: number;
        };
        "github_com_0glabs_0g-router_pkg_inference.ChatCompletionResponseWithTrace": {
            /** @description Choice list */
            choices?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.Choice"][];
            /**
             * @description Creation timestamp
             * @example 1677652288
             */
            created?: number;
            /**
             * @description Response ID
             * @example chatcmpl-123
             */
            id?: string;
            /**
             * @description Model used
             * @example qwen/qwen-2.5-7b-instruct
             */
            model?: string;
            /**
             * @description Object type
             * @example chat.completion
             */
            object?: string;
            /** @description Token usage */
            usage?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.Usage"];
            /** @description 0G trace info */
            x_0g_trace?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.TraceInfo"];
        };
        "github_com_0glabs_0g-router_pkg_inference.ChatMessage": {
            /**
             * @description Message content
             * @example Hello!
             */
            content?: string;
            /**
             * @description Role: system, user, assistant
             * @example user
             */
            role?: string;
        };
        "github_com_0glabs_0g-router_pkg_inference.Choice": {
            /** @description Delta content (streaming) */
            delta?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.DeltaMessage"];
            /**
             * @description Finish reason
             * @example stop
             */
            finish_reason?: string;
            /**
             * @description Choice index
             * @example 0
             */
            index?: number;
            /** @description Message content (non-streaming) */
            message?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.ChatMessage"];
        };
        "github_com_0glabs_0g-router_pkg_inference.CompletionTokensDetails": {
            audio_tokens?: number;
            text_tokens?: number;
        };
        "github_com_0glabs_0g-router_pkg_inference.DecisionsRequest": {
            /**
             * @description Model ID
             * @example jev-1.13
             */
            model?: string;
            /** @description Named typed questions */
            questions?: number[];
            /** @description App state the questions are asked about */
            state?: number[];
        };
        "github_com_0glabs_0g-router_pkg_inference.DeltaMessage": {
            content?: string;
            /**
             * @description Reasoning carries the raw `delta.reasoning` field some providers emit
             *     before NormalizeReasoningSSELine mirrors it into ReasoningContent.
             *     Captured here so the upstream parser can count reasoning tokens for
             *     the streaming-disconnect fallback (issue #190).
             */
            reasoning?: string;
            reasoning_content?: string;
            role?: string;
        };
        "github_com_0glabs_0g-router_pkg_inference.EmbeddingRequest": {
            /** @description Text (or array of texts / token arrays) to embed */
            input?: number[];
            /**
             * @description Model ID
             * @example qwen3.7-text-embedding
             */
            model?: string;
        };
        "github_com_0glabs_0g-router_pkg_inference.ImageData": {
            /** @description Base64 encoded image data */
            b64_json?: string;
            /**
             * @description Revised prompt
             * @example A sunset..
             */
            revised_prompt?: string;
            /**
             * @description Image URL
             * @example https://...
             */
            url?: string;
        };
        "github_com_0glabs_0g-router_pkg_inference.ImageGenerationRequest": {
            /**
             * @description Model ID
             * @example dall-e-3
             */
            model?: string;
            /**
             * @description Number of images to generate
             * @example 1
             */
            n?: number;
            /**
             * @description Image description
             * @example A beautiful sunset
             */
            prompt?: string;
            /**
             * @description Response format: url or b64_json
             * @example url
             */
            response_format?: string;
            /**
             * @description Image size
             * @example 1024x1024
             */
            size?: string;
        };
        "github_com_0glabs_0g-router_pkg_inference.ImageGenerationResponse": {
            /**
             * @description Creation timestamp
             * @example 1677652288
             */
            created?: number;
            /** @description Image data list */
            data?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.ImageData"][];
        };
        "github_com_0glabs_0g-router_pkg_inference.Plugin": {
            /**
             * @description Plugin ID ("web" for web search)
             * @example web
             */
            id?: string;
        };
        "github_com_0glabs_0g-router_pkg_inference.PromptTokensDetails": {
            audio_tokens?: number;
            /** @description 1-hour-TTL portion of the cache-write tokens */
            cache_write_1h_tokens?: number;
            /** @description Default/5-minute subset of PromptTokens written to prompt cache (creation) */
            cache_write_tokens?: number;
            /** @description Subset of PromptTokens served from prompt cache (read) */
            cached_tokens?: number;
            image_tokens?: number;
            /**
             * @description The input modality split some vendors report (Qwen omni: text / image /
             *     video / audio). Subsets of PromptTokens; read by modality pricing only.
             */
            text_tokens?: number;
            video_tokens?: number;
        };
        "github_com_0glabs_0g-router_pkg_inference.ProviderPreferences": {
            /**
             * @description Route to a specific provider address
             * @example 0x1234...
             */
            address?: string;
            /**
             * @description Allow fallback to other providers on failure (default: true, false when address is set)
             * @example true
             */
            allow_fallbacks?: boolean;
            /**
             * @description Sort strategy: "latency" or "price" (default: price — cheapest healthy provider)
             * @example latency
             */
            sort?: string;
            /**
             * @description Trust tier filter: "verified" | "private" (empty = no preference). A "verified" filter also accepts "private" providers, since private (native TeeML) provides verifiability plus privacy.
             * @example verified
             */
            trust_mode?: string;
        };
        "github_com_0glabs_0g-router_pkg_inference.RequestMessage": {
            /** @example Hello! */
            content?: string;
            /** @example user */
            role?: string;
        };
        "github_com_0glabs_0g-router_pkg_inference.ResponseFormat": {
            /** @description Required when type is "json_schema": {name, schema, strict?} */
            json_schema?: unknown;
            /**
             * @description "text", "json_object", or "json_schema"
             * @example json_schema
             */
            type?: string;
        };
        "github_com_0glabs_0g-router_pkg_inference.SpeechRequest": {
            input?: string;
            model?: string;
            response_format?: string;
            speed?: number;
            voice?: string;
        };
        "github_com_0glabs_0g-router_pkg_inference.Tool": {
            /** @description Function definition */
            function?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.ToolFunction"];
            /**
             * @description Tool type (currently only "function")
             * @example function
             */
            type?: string;
        };
        "github_com_0glabs_0g-router_pkg_inference.ToolFunction": {
            /**
             * @description Function description
             * @example Get weather
             */
            description?: string;
            /**
             * @description Function name
             * @example get_weather
             */
            name?: string;
            /** @description JSON Schema for parameters */
            parameters?: unknown;
        };
        "github_com_0glabs_0g-router_pkg_inference.TraceInfo": {
            /**
             * @description Billing is a pointer + omitempty so it is genuinely OMITTED (not emitted as
             *     {"input_cost":"","output_cost":"","total_cost":""}) when the cost couldn't
             *     be computed — a mode-read/pricing error or missing billing service. The
             *     success path always sets it, so the normal wire shape is unchanged.
             */
            billing?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.BillingInfo"];
            /**
             * @description Provider address
             * @example 0x1234...
             */
            provider?: string;
            /**
             * @description ProviderIdentity names the upstream behind Provider (the provider_identity
             *     of GET /v1/providers). Present when the provider reports one, omitted
             *     otherwise. Pin a request to it with X-0G-Provider-Identity.
             * @example anonymous1
             */
            provider_identity?: string;
            /**
             * @description Request ID
             * @example req_abc123
             */
            request_id?: string;
            /**
             * @description RequestRewritten lists how the router changed the request before sending
             *     it to the provider for this response, one name per rewrite applied.
             *     Absent when the request was sent as received. The provider's TEE
             *     signature covers the request it received, so when this is present a
             *     signature will not verify against the request you sent. [beta]
             */
            request_rewritten?: string[];
            /**
             * @description TEEVerified reports the provider's TEE attestation.
             *
             *       true    — a signature was obtained and verified.
             *       false   — the attestation is bad. Either a signature was obtained and did
             *                 not verify, or the chain disqualifies the route before one is
             *                 requested: the provider's TEE signing key is not acknowledged
             *                 on chain, or its registered verifiability mode is not one we
             *                 recognise. Both of the latter are operational states rather
             *                 than forged signatures.
             *       ABSENT  — no verdict is available, and it is NOT a failure. Three cases:
             *                 you did not ask; the route does not claim per-response
             *                 attestation at all (a standard-mode provider); or the request
             *                 was END-TO-END ENCRYPTED — it carried a top-level `_e2ee`
             *                 envelope — where reaching a verdict is the CLIENT's job and not
             *                 this router's. On that last one, verify the signature yourself:
             *                 the enclave signs a binding over the ciphertext it returned, and
             *                 only the client that sealed the request can tie that binding to
             *                 the plaintext it actually sent, so a claim from here could not
             *                 substitute for your own check. This third case carries the
             *                 stability of the sealed surfaces it applies to. [beta]
             *
             *                 Note the first two cases are narrower than they sound — a route
             *                 the CHAIN disqualifies reports false, above.
             *
             *     One case splits by endpoint, so read it carefully: when NO SIGNATURE COULD
             *     BE OBTAINED at all — expired, evicted, never issued, endpoint unreachable —
             *     the ASYNC polls (GET /v1/videos/{id}, GET /v1/async/jobs/{id}) omit the
             *     field, while the SYNCHRONOUS endpoints (/v1/chat/completions, /v1/messages,
             *     /v1/images/*, /v1/audio/transcriptions) report false. That is deliberate:
             *     a synchronous response is seconds old, so a miss there is a provider that
             *     stopped serving signatures rather than one whose signature simply aged out.
             *     That split is about a signature the router TRIED and failed to obtain; on a
             *     sealed request none is ever fetched, so the field is absent there on every
             *     endpoint — see the third ABSENT case above.
             * @example true
             */
            tee_verified?: boolean;
        };
        "github_com_0glabs_0g-router_pkg_inference.Usage": {
            /**
             * @description Output tokens
             * @example 20
             */
            completion_tokens?: number;
            /**
             * @description CompletionTokensDetails: the output modality split some vendors report
             *     (Qwen omni audio output). Read by modality pricing only.
             */
            completion_tokens_details?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.CompletionTokensDetails"];
            /**
             * @description Input tokens
             * @example 10
             */
            prompt_tokens?: number;
            prompt_tokens_details?: components["schemas"]["github_com_0glabs_0g-router_pkg_inference.PromptTokensDetails"];
            /**
             * @description Total tokens
             * @example 30
             */
            total_tokens?: number;
        };
        "github_com_0glabs_0g-router_pkg_request.CreateAPIKeyRequest": {
            /**
             * @description AllowedModels is an optional allowlist of model IDs this key may
             *     invoke. Nil = no restriction. Empty slice = explicit empty list,
             *     rejected at validation (a key that can call no models is useless).
             */
            allowed_models?: string[];
            /**
             * @description AllowedProviders is an optional allowlist of provider addresses
             *     (hex, 0x-prefixed) this key may target. Same nil-vs-empty convention
             *     as AllowedModels.
             */
            allowed_providers?: string[];
            /** @description 0G units; nil = unlimited */
            credit_limit?: string;
            /** @description RFC3339, "no_expiration", or "" */
            expiration?: string;
            name?: string;
            /** @description never/daily/weekly/monthly; "" → never */
            reset_period?: string;
            /**
             * @description Routing optionally sets the key's routing rules at creation, in the
             *     shape PUT /v1/api-keys/{keyId}/routing takes. It includes trust_mode,
             *     allowed_models and allowed_providers, so set those either here or at
             *     the top level, not both (400 invalid_routing_policy). [beta]
             */
            routing?: components["schemas"]["github_com_0glabs_0g-router_pkg_routingpolicy.Policy"];
            /**
             * @description TrustMode optionally pins this key to a single trust tier. Accepted
             *     values: "standard" | "verified" | "private" | "" (no pin). The wire
             *     shape is a value type rather than a pointer because the create path has
             *     no "leave unchanged" semantics — absent / empty / explicit "" all mean
             *     "no pin".
             */
            trust_mode?: string;
        };
        "github_com_0glabs_0g-router_pkg_request.CreateMgmtKeyRequest": {
            name?: string;
            scopes?: string[];
        };
        "github_com_0glabs_0g-router_pkg_request.PrivySigninRequest": {
            /** @description Router-issued Cloudflare Turnstile response token (defence-in-depth) */
            cf_turnstile_token?: string;
            /** @description Privy access token */
            token: string;
        };
        "github_com_0glabs_0g-router_pkg_request.SigninRequest": {
            /** @description SIWE message */
            message: string;
            /** @description Signature */
            signature: string;
        };
        "github_com_0glabs_0g-router_pkg_request.UpdateAPIKeyRequest": {
            /**
             * @description AllowedModels / AllowedProviders sparse-PATCH sentinels:
             *       nil               → unchanged
             *       non-nil empty []  → clear the allowlist (no restriction)
             *       non-nil non-empty → replace the allowlist
             *
             *     Pointer to slice (rather than slice) so we can distinguish "leave
             *     alone" from "clear", matching how Scopes is handled on mgmt keys.
             */
            allowed_models?: string[];
            allowed_providers?: string[];
            credit_limit?: string;
            expiration?: string;
            name?: string;
            reset_period?: string;
            /**
             * @description TrustMode sparse-PATCH sentinels: nil → unchanged; "" → clear the
             *     pin (key falls back to no trust-mode restriction); any of
             *     standard|verified|private → set the pin.
             */
            trust_mode?: string;
        };
        "github_com_0glabs_0g-router_pkg_request.UpdateMgmtKeyRequest": {
            name?: string;
            scopes?: string[];
        };
        "github_com_0glabs_0g-router_pkg_response.APIKeyItem": {
            /**
             * @description AllowedModels / AllowedProviders are ALWAYS present in the response
             *     (never omitted) — `[]` means "no restriction", a non-empty slice
             *     means "only these". Stable shape so clients can index without
             *     `field !== undefined` guards, and so a missing field cleanly
             *     signals "response truncated by middleware / bug" rather than "no
             *     allowlist". csvToSlice in the service layer materialises an empty
             *     slice (not nil) for the no-allowlist case to keep the contract.
             * @example [
             *       "[\"glm-5\"]"
             *     ]
             */
            allowed_models?: string[];
            /**
             * @example [
             *       "[\"0xabc...\"]"
             *     ]
             */
            allowed_providers?: string[];
            /** @example 2024-01-15T10:30:00Z */
            created_at?: string;
            /** @example 1.5 */
            credit_limit?: string;
            /**
             * @description Currency is the unit of CreditLimit / Used: "0g" (0G decimals) or "usd"
             *     (USD decimals), following the account's settlement mode. Without it a
             *     client can't tell whether "1.5" means 1.5 0G or $1.50.
             * @example 0g
             */
            currency?: string;
            /** @example 2025-02-15T10:30:00Z */
            expires_at?: string;
            /** @example abc12345 */
            key_id?: string;
            /** @example sk-abcde… */
            key_preview?: string;
            /** @example my-api-key */
            name?: string;
            /** @example monthly */
            reset_period?: string;
            /** @example false */
            revoked?: boolean;
            /**
             * @description Routing is the key's routing rules, in the shape GET/PUT
             *     /v1/api-keys/{keyId}/routing use. trust_mode / allowed_models /
             *     allowed_providers above are the same rules in their original form:
             *     an allowed_providers entry naming an upstream identity appears there
             *     as "0x…/identity" or "*\/identity", and PATCH accepts it back. [beta]
             */
            routing?: components["schemas"]["github_com_0glabs_0g-router_pkg_routingpolicy.Policy"];
            /**
             * @description active / revoked / expired
             * @example active
             */
            status?: string;
            /**
             * @description TrustMode is the trust-tier pin for this key, or nil when the key
             *     has no pin (matches the API-key constraint table verbatim). Emitted
             *     as a pointer so callers can distinguish "no pin" from "pinned to
             *     the empty string"; the latter is rejected at create time, so a nil
             *     value is the only way the field is absent in practice.
             * @example verified
             */
            trust_mode?: string;
            /** @example 0.42 */
            used?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.APIKeyListResponse": {
            data?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.APIKeyItem"][];
            /** @example list */
            object?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.APIKeyRoutingPolicyResponse": {
            /**
             * @description AllowFallbacks: whether a failed request may move to another provider.
             * @example true
             */
            allow_fallbacks?: boolean;
            /**
             * @description AllowedModels / BlockedModels: canonical model ids.
             * @example [
             *       "glm-5"
             *     ]
             */
            allowed_models?: string[];
            /** @description AllowedProviders / BlockedProviders: see ProviderRef. */
            allowed_providers?: components["schemas"]["github_com_0glabs_0g-router_pkg_routingpolicy.ProviderRef"][];
            /**
             * @example [
             *       "claude-opus-5"
             *     ]
             */
            blocked_models?: string[];
            blocked_providers?: components["schemas"]["github_com_0glabs_0g-router_pkg_routingpolicy.ProviderRef"][];
            /**
             * @description EncryptedTransit: "off" | "preferred" | "required".
             * @example preferred
             */
            encrypted_transit?: string;
            /** @example 3f2a6c1e-8d4b-4f0a-9c7e-1b2d3e4f5a6b */
            key_id?: string;
            max_price_usd?: components["schemas"]["github_com_0glabs_0g-router_pkg_routingpolicy.MaxPriceUSD"];
            /**
             * @description RequireParameters: route only to providers that advertise every
             *     sampling / reasoning parameter the request uses.
             * @example false
             */
            require_parameters?: boolean;
            /**
             * @description Sort: "price" | "latency".
             * @example price
             */
            sort?: string;
            /**
             * @description TrustMode: "standard" | "verified" | "private" (a floor).
             * @example verified
             */
            trust_mode?: string;
            warnings?: components["schemas"]["github_com_0glabs_0g-router_pkg_routingpolicy.Warning"][];
        };
        "github_com_0glabs_0g-router_pkg_response.AccountResponse": {
            /** @example 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 */
            address?: string;
            /** @example 2026-01-15T10:30:00Z */
            created_at?: string;
            /**
             * @description OgModeAvailable is false when the account is on USD, holds no 0G funds
             *     and is not offered the 0G settlement mode, so a client hides the 0G↔USD
             *     switch. An account on 0G or with a 0G balance always reads true. [beta]
             * @example true
             */
            og_mode_available?: boolean;
            /** @example 2026-01-15T10:35:00Z */
            onboarded_at?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.AccountRoutingPolicyResponse": {
            /**
             * @description AllowFallbacks: whether a failed request may move to another provider.
             * @example true
             */
            allow_fallbacks?: boolean;
            /**
             * @description AllowedModels / BlockedModels: canonical model ids.
             * @example [
             *       "glm-5"
             *     ]
             */
            allowed_models?: string[];
            /** @description AllowedProviders / BlockedProviders: see ProviderRef. */
            allowed_providers?: components["schemas"]["github_com_0glabs_0g-router_pkg_routingpolicy.ProviderRef"][];
            /**
             * @example [
             *       "claude-opus-5"
             *     ]
             */
            blocked_models?: string[];
            blocked_providers?: components["schemas"]["github_com_0glabs_0g-router_pkg_routingpolicy.ProviderRef"][];
            /**
             * @description EncryptedTransit: "off" | "preferred" | "required".
             * @example preferred
             */
            encrypted_transit?: string;
            max_price_usd?: components["schemas"]["github_com_0glabs_0g-router_pkg_routingpolicy.MaxPriceUSD"];
            /**
             * @description RequireParameters: route only to providers that advertise every
             *     sampling / reasoning parameter the request uses.
             * @example false
             */
            require_parameters?: boolean;
            /**
             * @description Sort: "price" | "latency".
             * @example price
             */
            sort?: string;
            /**
             * @description TrustMode: "standard" | "verified" | "private" (a floor).
             * @example verified
             */
            trust_mode?: string;
            /** @example 2026-11-02T08:00:00Z */
            updated_at?: string;
            warnings?: components["schemas"]["github_com_0glabs_0g-router_pkg_routingpolicy.Warning"][];
        };
        "github_com_0glabs_0g-router_pkg_response.AdminUsageDailyEntry": {
            /** @example 0 */
            cache_write_1h_tokens?: number;
            /** @example 0 */
            cache_write_tokens?: number;
            /**
             * @description Token-shape detail, previously emitted but undeclared.
             * @example 0
             */
            cached_tokens?: number;
            /**
             * @description canonical model id (the GROUP BY key); '' = unmapped
             * @example glm-5
             */
            canonical_id?: string;
            /** @example 4345 */
            completion_tokens?: number;
            /**
             * @description Cost is neuron/wei (1 0G = 10^18) and counts 0G-settled traffic ONLY.
             *
             *     Beware a per-row inconsistency this endpoint inherits: the daily query
             *     GROUPs BY (date, canonical_id[, trust_mode]) WITHOUT currency, so one row
             *     merges both ledgers — but the money columns carry a
             *     `CASE WHEN currency='0g'` guard while the counters do not. In a row that
             *     spans both ledgers, `request_count` / token counts / CostUsdMicro include
             *     USD traffic while Cost and the three *Used fields exclude it. Read Spend
             *     (or CostUsdMicro) for a figure that covers the whole row, and SpendCredit
             *     for its credit share — those two are the only pair that is consistent in
             *     merged mode. `?currency=` narrows the row to one ledger, after which the
             *     native columns describe it fully.
             * @example 3038400000000000000
             */
            cost?: string;
            /**
             * @description CostUsdMicro is this row's USD-equivalent (micro-USD), comparable ACROSS
             *     rows regardless of Currency — 0G rows are valued at the provider's real
             *     rate frozen at billing time. Previously emitted but undeclared.
             * @example 459994
             */
            cost_usd_micro?: string;
            /**
             * @description Settlement-source split of Cost, in Cost's unit. Previously emitted but
             *     undeclared.
             * @example 600000000000000000
             */
            credit_used?: string;
            /** @example all */
            currency?: string;
            /** @example 2024-01-15 */
            date?: string;
            /** @example 44400000000000000 */
            deferred_used?: string;
            /** @example 2394000000000000000 */
            deposit_used?: string;
            /** @example 8000 */
            input_tokens?: number;
            /**
             * @description dual-emits the same canonical value for back-compat
             * @example glm-5
             */
            model_id?: string;
            /** @example 4345 */
            output_tokens?: number;
            /**
             * @description Aliases of the two above (same value), spelled as /admin/usage/stats does
             *     so one consumer can read all three usage endpoints with one field mapping.
             * @example 8000
             */
            prompt_tokens?: number;
            /** @example 42 */
            request_count?: number;
            /**
             * @description ServiceType is the canonical model's type in the model registry
             *     (chatbot, text-to-image, image-editing, video-generation, speech-to-text,
             *     text-to-speech, embedding, decisions), or "unknown" when canonical_id is
             *     not registered.
             * @example chatbot
             */
            service_type?: string;
            /**
             * @description source filter only
             * @example 0g-app
             */
            source_id?: string;
            /**
             * @description Spend / SpendUnit / Currency / SpendCredit mirror /admin/usage/stats. Beyond
             *     giving both endpoints one field mapping, they supply the unit declaration
             *     this endpoint never had: CreditUsed is wei on a 0G-settled row and micro-USD
             *     on a USD-settled one, and nothing in the response said which.
             *
             *     Spend is the cross-ledger micro-USD figure when merged (== CostUsdMicro) and
             *     the pinned ledger's native amount under `?currency=`; SpendUnit names that
             *     unit and SpendCredit is in it, so real money spent is Spend - SpendCredit.
             * @example 459994
             */
            spend?: string;
            /** @example 90836 */
            spend_credit?: string;
            /** @example usd */
            spend_unit?: string;
            /**
             * @description TrustMode is the tier of the provider that served the row's traffic —
             *     "private" (native TEE model), "verified" (centralized / TeeTLS),
             *     "standard" (TEE route hiding its upstream), "" (no tier: billed without
             *     a provider, e.g. standalone web search; unrecognised provider_type; or
             *     history from before the column).
             *     Present only with ?dimensions=trust_mode, which also splits the row
             *     per tier.
             * @example private
             */
            trust_mode?: string;
            /**
             * @description wallet filter only
             * @example 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
             */
            user_address?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.AdminUsageDailyResponse": {
            data?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.AdminUsageDailyEntry"][];
            /** @example list */
            object?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.AdminUsageHistoryResponse": {
            data?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.AdminUsageLogEntry"][];
            /** @example 20 */
            limit?: number;
            /** @description NextCursor is the opaque token for the next page via `?cursor=`; absent on the last page. [beta] */
            next_cursor?: string;
            /** @example list */
            object?: string;
            /** @example 0 */
            offset?: number;
            /**
             * @description Total is the full-set count; omitted when include_total=false / cursor paging.
             * @example 12345
             */
            total?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.AdminUsageLogEntry": {
            /** @example abc12345 */
            api_key_id?: string;
            /**
             * @description 1-hour-TTL portion of cache_write_tokens (disjoint); only the Anthropic path reports a TTL breakdown, else 0
             * @example 0
             */
            cache_write_1h_tokens?: number;
            /**
             * @description cache-WRITE (creation) subset of input_tokens; reflects volume, not a premium (disjoint from cached_tokens; input_tokens includes both)
             * @example 0
             */
            cache_write_tokens?: number;
            /**
             * @description cache-READ subset of input_tokens
             * @example 40
             */
            cached_tokens?: number;
            /**
             * @description registry-resolved canonical id ('' if unmapped); mirrors /v1/source/usage/history
             * @example glm-5
             */
            canonical_id?: string;
            /**
             * @description alias of output_tokens (same value)
             * @example 150
             */
            completion_tokens?: number;
            /**
             * @description neuron (1 0G = 10^18)
             * @example 150000000000000
             */
            cost?: string;
            /**
             * @description micro-USD equivalent frozen at billing time; == spend
             * @example 3833
             */
            cost_usd_micro?: string;
            created_at?: string;
            /**
             * @description neuron
             * @example 50000000000000
             */
            credit_used?: string;
            /**
             * @description Currency and CostUsdMicro are emitted by the handler but were absent from
             *     this struct, so a client generated from the published spec could not reach
             *     them — and the SpendUnit note below names Currency, which would have pointed
             *     at a field the schema does not declare.
             * @example 0g
             */
            currency?: string;
            /**
             * @description portion charged but not yet paid for: on 0G rows, not yet deposit-backed (pending_charge); on 0G Pay rows, the shortfall 0G Pay booked as owed
             * @example 0
             */
            deferred_used?: string;
            /**
             * @description neuron
             * @example 100000000000000
             */
            deposit_used?: string;
            /** @example 1 */
            id?: number;
            /** @example 100 */
            input_tokens?: number;
            /**
             * @description raw on-chain model id (per-provider attribution)
             * @example zai-org/GLM-5-FP8
             */
            model_id?: string;
            /** @example 150 */
            output_tokens?: number;
            /**
             * @description alias of input_tokens (same value), spelled as /admin/usage/stats does
             * @example 100
             */
            prompt_tokens?: number;
            /** @example 0x1234... */
            provider_address?: string;
            /** @example req_abc123 */
            request_id?: string;
            /**
             * @description Spend / SpendUnit / SpendCredit mirror /admin/usage/stats and
             *     /admin/usage/daily so one consumer reads all three with a single field
             *     mapping. This endpoint takes no `?currency=` pin — rows are returned as-is,
             *     each carrying its own Currency — so SpendUnit is always "usd" and rows of
             *     different settlement currencies are directly summable. SpendCredit is exact
             *     here (one request = one price = one credit/cost ratio), unlike the aggregate
             *     endpoints.
             *
             *     DERIVE THE UNIT FROM SpendUnit, NEVER FROM Currency — the two fields answer
             *     different questions, and `currency` does not mean here what it means on the
             *     aggregate endpoints. There it names the ledger the RESPONSE was pinned to
             *     ("0g" / "usd" / "all") and the money fields follow it; here it names the
             *     ledger THIS ROW settled on, while Spend / SpendCredit are micro-USD
             *     regardless. So a row legitimately reads `currency: "0g"` alongside
             *     `spend_unit: "usd"`, and a client that inferred the unit from `currency`
             *     would be wrong by 10^12 — the exact accident SpendUnit exists to prevent.
             *     Cost / CreditUsed / DepositUsed / DeferredUsed are the fields Currency
             *     describes.
             * @example 3833
             */
            spend?: string;
            /**
             * @description micro-USD credit share; real money = spend - spend_credit
             * @example 756
             */
            spend_credit?: string;
            /**
             * @description always "usd" on this endpoint
             * @example usd
             */
            spend_unit?: string;
            /** @example 0xabc1230000000000000000000000000000000001 */
            user_address?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.AdminUsageStatsEntry": {
            /**
             * @description CachedTokens is the cache-READ subset of PromptTokens — a SUBSET, never an
             *     addend (PromptTokens already includes it), so adding the two double-counts.
             *     Present on the flat shapes and inside `router_tokens`; absent from
             *     `direct_tokens` / `combined_tokens`, whose source table carries no cache
             *     detail.
             *
             *     One coverage gap: an UNDATED `group_by=user` ranking is served from the
             *     all-time rollup, whose column is NOT backfilled — it counts only days
             *     folded after it shipped, so pre-deploy history reads low there. Every
             *     date-windowed query answers from the live union and is complete, as is
             *     /admin/usage/daily.
             *
             *     This endpoint reports the cache-READ subset only. The cache-WRITE counts
             *     (`cache_write_tokens` / `cache_write_1h_tokens`, which are premium-priced,
             *     not discounted) are on /admin/usage/daily and /admin/usage/history and are
             *     deliberately not aggregated here, so the full-rate token remainder —
             *     prompt - cached - cache_write - cache_write_1h — cannot be derived from a
             *     /stats response alone. Use /admin/usage/daily when you need to price the
             *     four input buckets separately; /stats answers "how much of the prompt was a
             *     cache hit", not "what did each bucket cost".
             * @example 30000
             */
            cached_tokens?: number;
            /** @example 120000 */
            completion_tokens?: number;
            /** @example 800000000000000000 */
            credit_used?: string;
            /**
             * @description Currency names WHICH ledger the row covers: "0g", "usd", or "all" for the
             *     merged cross-ledger view. Present wherever Spend is (see above) — and it is
             *     reported rather than omitted when merged, because SpendUnit cannot carry this,
             *     since it is "usd" both for merged and for `?currency=usd` and those two
             *     numbers differ. "all" is a RESPONSE value only; sending it as a request
             *     parameter is rejected (it would be a second spelling of omitting it).
             * @example usd
             */
            currency?: string;
            /** @example 34500000000000000 */
            deferred_used?: string;
            /**
             * @description Settlement-source split of Spend, in SpendUnit's unit, so
             *     Spend == DepositUsed + CreditUsed + DeferredUsed (issue #665).
             *
             *     PINNED QUERIES ONLY — absent without `?currency=`, and absent under
             *     `channel=all` (which rejects a pin). Merged mode has no USD-priced split to
             *     report: only `cost` has a `cost_usd_micro` sibling, the three split columns
             *     exist in native units alone, so a merged split would break down the
             *     deprecated 0G-only TotalCost rather than Spend.
             * @example 400000000000000000
             */
            deposit_used?: string;
            /** @example 80000 */
            prompt_tokens?: number;
            /** @example 0g-app */
            source_id?: string;
            /**
             * @description Spend is THE amount to read, and SpendUnit is its unit. Present on every
             *     row of the FLAT shapes — the breakdown, and filter mode under the default
             *     channel=router. Under channel=direct/all the flat money fields are
             *     replaced by the *_tokens groups (see the note above); router_tokens then
             *     carries spend / spend_unit / currency, and direct_tokens carries no money
             *     at all because the Router never billed that traffic.
             *
             *     	no ?currency=   → cross-ledger micro-USD   (spend_unit "usd", currency "all")
             *     	?currency=0g    → that ledger's wei        (spend_unit "0g",  currency "0g")
             *     	?currency=usd   → that ledger's micro-USD  (spend_unit "usd", currency "usd")
             *
             *     One amount whose unit is declared, rather than two amounts whose meaning
             *     depends on a third field: a client that hardcodes the unit is wrong by
             *     10^12 the moment the pin changes, silently. Same shape as
             *     /v1/admin/credits/history's `amount` + `currency`.
             *     In MERGED mode Spend has a coverage start date, and it is not the start of
             *     the data: a 0G-settled row only carries a USD equivalent if one could be
             *     derived at billing time (provider `pricing_usd`, else `usd.og_to_usd_rate`).
             *     Rows where neither was available store `cost_usd_micro = 0`, are counted in
             *     `router_usd_unpriced_charges_total{fallback="zero"}`, and are never
             *     backfilled — so merged Spend understates them permanently while the 0G
             *     ledger still has them in full. On mainnet the boundary is 2026-07-17
             *     (~49.8k 0G before it, ~31% of the retained window); other deployments
             *     differ. An undated group_by=user ranking is served from the all-time rollup
             *     and therefore ALWAYS spans it. Use `?currency=0g` for the complete
             *     pre-boundary figure — it is wei and cannot be added to a micro-USD one.
             * @example 709994
             */
            spend?: string;
            /**
             * @description SpendCredit is the part of Spend that was covered by free credit rather than
             *     by money the user paid in, in SpendUnit's unit — so "real money" spent is
             *     Spend - SpendCredit, with no unit conversion on the client.
             *
             *     Present on every row that carries Spend, INCLUDING the merged view, which is
             *     the point: the native `credit_used` below is 0G-only when merged (wei), so it
             *     cannot be subtracted from a cross-ledger micro-USD total at all. On 0G-settled
             *     rows this is that row's frozen `cost_usd_micro` split by the wei-domain ratio
             *     credit_used/cost — no exchange rate is applied, so the figure does not drift
             *     with the 0G token price; rows billed before a USD price was available carry
             *     `cost_usd_micro = 0` and contribute 0 here exactly as they do to Spend.
             *
             *     One coverage gap: an UNDATED `group_by=user` ranking is served from the
             *     all-time rollup, whose column is NOT backfilled — it counts only days folded
             *     after it shipped, so pre-deploy history reads low there (and `Spend -
             *     SpendCredit` correspondingly high). Date-windowed queries answer from the live
             *     union and are complete, as are /admin/usage/daily and /admin/usage/history.
             * @example 140836
             */
            spend_credit?: string;
            /**
             * @description "0g" = wei (1 0G = 10^18); "usd" = micro-USD (1 USD = 10^6)
             * @example usd
             */
            spend_unit?: string;
            /**
             * @description TotalCost / TotalCostUsd predate Spend and are kept so existing dashboards
             *     keep working. TotalCost is 0G-only wei in merged mode (it silently excludes
             *     USD-settled traffic) and follows the pin otherwise; TotalCostUsd is the
             *     micro-USD figure, narrowed to one ledger by a pin. New integrations should
             *     read Spend + SpendUnit instead.
             *     The examples across this struct are ONE consistent row on purpose: Spend
             *     709994 == TotalCostUsd, SpendCredit 140836 is a part of it, and
             *     Spend - SpendCredit = 569158 is the money-funded remainder. An example that
             *     makes the documented subtraction negative teaches the field wrong.
             * @example 3038400000000000000
             */
            total_cost?: string;
            /** @example 709994 */
            total_cost_usd?: string;
            /** @example 12345 */
            total_requests?: number;
            /** @example 200000 */
            total_tokens?: number;
            /** @example 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 */
            user_address?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.AdminUsageStatsResponse": {
            data?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.AdminUsageStatsEntry"][];
            /** @example 2026-08-06 */
            end_date?: string;
            /**
             * @description breakdown only
             * @example 50
             */
            limit?: number;
            /** @example list */
            object?: string;
            /**
             * @description breakdown only
             * @example 0
             */
            offset?: number;
            /**
             * @description OrderBy is the ranking key that was APPLIED (`tokens` default, `requests`,
             *     `spend`, `credit`) — breakdown only. Declared here because the whole point
             *     of echoing it is that a client can tell which ranking it got rather than
             *     assuming its own default matches ours, which a client generated from the
             *     published spec could not do if the field existed only in the handler.
             * @example tokens
             */
            order_by?: string;
            /**
             * @description StartDate / EndDate are the window the returned numbers actually describe,
             *     present on EVERY response, which is not always the window that was
             *     requested. Breakdown: the all-time rollup answers up to its fold watermark
             *     with no lower bound (`start_date` null), while the live path clamps to
             *     stats.max_lookback_days and includes today. Filter: a cross-account
             *     (global) total is clamped the same way; per-wallet and per-source queries
             *     report the caller's own window. Emitted as JSON null rather than omitted,
             *     so "unbounded" stays distinguishable from "this build doesn't report it" —
             *     which is also why these carry no `omitempty`.
             * @example 2026-06-01
             */
            start_date?: string;
            /**
             * @description breakdown only: distinct key count
             * @example 137
             */
            total?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.AnthropicErrorDetail": {
            code?: string;
            message?: string;
            type?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.AnthropicErrorResponse": {
            error?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.AnthropicErrorDetail"];
            request_id?: string;
            /** @description always "error" */
            type?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.AutoDepositConfigResponse": {
            /** @example 1000000000000000000 */
            default_low_watermark?: string;
            /** @example 10000000000000000000 */
            default_max_balance?: string;
            /** @example true */
            enabled?: boolean;
            /** @example false */
            is_custom?: boolean;
            /** @example 1000000000000000000 */
            low_watermark?: string;
            /** @example 10000000000000000000 */
            max_balance?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.BalanceResponse": {
            /** @example 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 */
            address?: string;
            /**
             * @description backward compat = total
             * @example 1000000000000000000
             */
            balance?: string;
            /** @example 100000000000000000 */
            credit_balance?: string;
            /**
             * @description Currency is the unit of the amount fields: "0g" (wei, default) or "usd"
             *     (micro-USD, USD*1e6). Omitted-value clients that predate USD mode read
             *     only "0g" accounts, so the field is additive and backward-compatible. In
             *     USD mode deposit_balance carries the account's own funds and
             *     credit_balance the granted USD credit. Where 0G Pay serves the account's
             *     billing, both come from there — so for such an account a top-up credited
             *     locally rather than to 0G Pay is not part of this figure. There is no vault/defer, but the USD
             *     wallet CAN owe recoverable debt (a chargeback or an over-cost charge drives
             *     it negative); that debt is surfaced in **pending_charge** (= the owed
             *     amount), with deposit_balance/total_balance clamped to ≥0 — mirroring how
             *     the 0G path expresses debt, so the ≥0 contract above holds in both modes.
             *     The true signed net (which may be negative) is on GET /account/funds. [beta]
             * @example 0g
             */
            currency?: string;
            /** @example 900000000000000000 */
            deposit_balance?: string;
            /** @example 0 */
            pending_charge?: string;
            /** @example 1000000000000000000 */
            total_balance?: string;
            /**
             * @description UnsettledCharge (micro-USD) is present only for USD accounts whose
             *     billing 0G Pay serves: charges already made that have not been sent to
             *     0G Pay yet, so they are not reflected in the other amounts here or in
             *     0G Pay's own balance. Subtract it to show the balance after those
             *     charges. A charge leaves this figure when it is sent, a few seconds
             *     after the reply, so while 0G Pay is slow to accept it the other amounts
             *     can briefly read high; the figure never counts a charge 0G Pay may
             *     already have applied. Absent when it could not be read. [beta]
             * @example 87
             */
            unsettled_charge?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.BatchCreditGrantResponse": {
            /** @example 1 */
            failed?: number;
            results?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.BatchCreditGrantResultItem"][];
            /** @example 2 */
            succeeded?: number;
            /** @example 3 */
            total?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.BatchCreditGrantResultItem": {
            /** @example 10000000000000000000 */
            amount?: string;
            /** @example  */
            error?: string;
            /** @example 1 */
            grant_id?: number;
            /** @example 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 */
            user_address?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.CreateAPIKeyResponse": {
            /**
             * @description AllowedModels / AllowedProviders are ALWAYS present in the response
             *     (never omitted) — `[]` means "no restriction", a non-empty slice
             *     means "only these". Stable shape so clients can index without
             *     `field !== undefined` guards, and so a missing field cleanly
             *     signals "response truncated by middleware / bug" rather than "no
             *     allowlist". csvToSlice in the service layer materialises an empty
             *     slice (not nil) for the no-allowlist case to keep the contract.
             * @example [
             *       "[\"glm-5\"]"
             *     ]
             */
            allowed_models?: string[];
            /**
             * @example [
             *       "[\"0xabc...\"]"
             *     ]
             */
            allowed_providers?: string[];
            /** @example 2024-01-15T10:30:00Z */
            created_at?: string;
            /** @example 1.5 */
            credit_limit?: string;
            /**
             * @description Currency is the unit of CreditLimit / Used: "0g" (0G decimals) or "usd"
             *     (USD decimals), following the account's settlement mode. Without it a
             *     client can't tell whether "1.5" means 1.5 0G or $1.50.
             * @example 0g
             */
            currency?: string;
            /** @example 2025-02-15T10:30:00Z */
            expires_at?: string;
            /** @description Only shown once! */
            key?: string;
            /** @example abc12345 */
            key_id?: string;
            /** @example sk-abcde… */
            key_preview?: string;
            /** @example my-api-key */
            name?: string;
            /** @example monthly */
            reset_period?: string;
            /** @example false */
            revoked?: boolean;
            /**
             * @description Routing is the key's routing rules, in the shape GET/PUT
             *     /v1/api-keys/{keyId}/routing use. trust_mode / allowed_models /
             *     allowed_providers above are the same rules in their original form:
             *     an allowed_providers entry naming an upstream identity appears there
             *     as "0x…/identity" or "*\/identity", and PATCH accepts it back. [beta]
             */
            routing?: components["schemas"]["github_com_0glabs_0g-router_pkg_routingpolicy.Policy"];
            /**
             * @description active / revoked / expired
             * @example active
             */
            status?: string;
            /**
             * @description TrustMode is the trust-tier pin for this key, or nil when the key
             *     has no pin (matches the API-key constraint table verbatim). Emitted
             *     as a pointer so callers can distinguish "no pin" from "pinned to
             *     the empty string"; the latter is rejected at create time, so a nil
             *     value is the only way the field is absent in practice.
             * @example verified
             */
            trust_mode?: string;
            /** @example 0.42 */
            used?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.CreateMgmtKeyResponse": {
            /** @example 2026-04-22T10:30:00Z */
            created_at?: string;
            /** @description Only shown once! */
            key?: string;
            /** @example abc12345 */
            key_id?: string;
            /** @example mk-abcde… */
            key_preview?: string;
            /** @example mgmt */
            key_type?: string;
            /**
             * @description LastSourceIP is the client IP recorded at LastUsedAt — emitted as the
             *     full address; UI is responsible for any masking before display.
             * @example 52.13.45.6
             */
            last_source_ip?: string;
            /**
             * @description LastUsedAt is the most recent successful authentication via this key.
             *     nil until the key has been used at least once.
             * @example 2026-04-29T14:02:00Z
             */
            last_used_at?: string;
            /** @example ci-deploy */
            name?: string;
            /**
             * @description RateLimitRPM is this key's requests-per-minute cap; omitted when the
             *     key has none.
             * @example 30
             */
            rate_limit_rpm?: number;
            /**
             * @description NOTE: expires_at is deliberately not emitted. The row in api_keys
             *     still has the column and the service layer still tracks it for
             *     internal callers, but mgmt keys today are non-expiring at the HTTP
             *     surface. Adding back is a single line here — no schema or service
             *     changes — once the product surface for expiration is finalised.
             * @example false
             */
            revoked?: boolean;
            /**
             * @example [
             *       "[\"keys:read\"",
             *       "\"keys:create\"]"
             *     ]
             */
            scopes?: string[];
            /** @example active */
            status?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.CreatePartnerResponse": {
            /** @example pk-foopartner-7a3f9c2e8b... */
            api_key?: string;
            api_keys?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.PartnerAPIKeyMeta"][];
            /** @example tech@foopartner.com */
            contact_email?: string;
            created_at?: string;
            /** @example foopartner */
            id?: string;
            /** @example a1b2c3d4e5f60718 */
            key_id?: string;
            /** @example https://foopartner.com */
            link?: string;
            /** @example https://cdn.example/logo.png */
            logo_url?: string;
            /** @example FooPartner */
            name?: string;
            revoked_at?: string;
            /** @example active */
            status?: string;
            updated_at?: string;
            /** @example This api_key will not be shown again. Store it securely. */
            warning?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.CreditGrantListResponse": {
            data?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.CreditGrantResponse"][];
            /** @example 20 */
            limit?: number;
            /** @example list */
            object?: string;
            /** @example 0 */
            offset?: number;
            /** @example 100 */
            total?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.CreditGrantResponse": {
            /** @example 10000000000000000000 */
            amount?: string;
            /** @example 2024-01-15T10:30:00Z */
            created_at?: string;
            /** @example 1 */
            grant_id?: number;
            /** @example system */
            granted_by?: string;
            /** @example Welcome bonus */
            reason?: string;
            /** @example welcome */
            type?: string;
            /** @example 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 */
            user_address?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.DailyUsageResponse": {
            /**
             * @description Currency is the unit of every row's cost — "0g" (wei) or "usd" (micro-USD)
             *     — and is present ONLY when the series really is single-currency, which
             *     means the /account endpoint: it pins to the account's current settlement
             *     mode. The partner /source series is merged (Currency:"" in
             *     partnerScopeFromContext), so there is no series-wide unit and this field is
             *     absent; read `currency` on each row instead. It previously claimed "0g" for
             *     the partner endpoint, which was never true and was never sent.
             * @example 0g
             */
            currency?: string;
            data?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.DailyUsageSummaryEntry"][];
            /** @example list */
            object?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.DailyUsageSummaryEntry": {
            /**
             * @description CacheWrite1hTokens is the 1-hour-TTL portion of cache_write_tokens summed
             *     over the day (disjoint from it). Permanent; reflects volume, not billing. [beta]
             * @example 0
             */
            cache_write_1h_tokens?: number;
            /** @example 0 */
            cache_write_tokens?: number;
            /**
             * @description CachedTokens / CacheWriteTokens are the provider-reported cache-READ and
             *     cache-WRITE (creation) subsets of input_tokens, summed over the day's
             *     rows. Permanent (survive usage_logs retention), so a monthly bill can
             *     break out cache volume and reconcile `cost`. Both reflect volume, not
             *     billing: cache_write_tokens is non-zero whenever a provider reported
             *     cache-creation tokens and does NOT by itself imply a premium was charged
             *     (the premium, when active, only changes how those tokens price into
             *     `cost`). Disjoint subsets — input_tokens already includes both
             *     (input_tokens = plain + cached_tokens + cache_write_tokens). [beta]
             * @example 3200
             */
            cached_tokens?: number;
            /**
             * @description CanonicalID is the registry-resolved model id this row aggregates.
             *     Empty only for rows whose underlying on-chain model_id was never in
             *     the registry (same '' = "unmapped" sentinel as providers.canonical_id).
             *     [beta]
             * @example glm-5
             */
            canonical_id?: string;
            /** @example 150000000000000 */
            cost?: string;
            /**
             * @description CostUsdMicro is sent by the PARTNER series (/v1/source/usage/daily) only.
             *     There it is the only money field that covers a whole row: that scope is
             *     merged while `cost` carries a 0G-only guard, so on a partner row spanning
             *     both ledgers `cost` excludes USD traffic that the counters include (#710).
             *
             *     The ACCOUNT series is unaffected by that: it pins to one currency, reports
             *     which one on the envelope, and does not send this field — its `cost` is the
             *     complete figure for that single ledger.
             * @example 1234
             */
            cost_usd_micro?: string;
            /** @example 2024-01-15 */
            date?: string;
            /** @example 8000 */
            input_tokens?: number;
            /**
             * @description ModelID is preserved for one dual-emit milestone and carries the SAME
             *     value as CanonicalID for /daily responses. Clients should migrate to
             *     `canonical_id`; the field is dropped after migration.
             * @example glm-5
             */
            model_id?: string;
            /** @example 4345 */
            output_tokens?: number;
            /** @example 42 */
            request_count?: number;
            /**
             * @description TrustMode is the trust tier this row aggregates. Emitted only when the
             *     caller opts in with ?dimensions=trust_mode (and the capability is
             *     enabled); omitted otherwise, so the default wire shape is one row per
             *     (date, model) — byte-identical to pre-trust-mode prod regardless of the
             *     server flag. When emitted, an empty string represents traffic with no
             *     known tier — logs that predate the dimension, and providers whose
             *     registered tier signal the router could not classify; clients render
             *     it as "Unknown" or filter the series out.
             * @example verified
             */
            trust_mode?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.ErrorDetail": {
            /** @example bad_request */
            code?: string;
            /** @example Invalid request */
            message?: string;
            /** @example invalid_request */
            type?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.ErrorResponse": {
            error?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ErrorDetail"];
            request_id?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.FundsResponse": {
            /** @example 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 */
            address?: string;
            /**
             * @description Currency is the unit of all amount fields: "0g" (wei, default) or "usd"
             *     (micro-USD). In USD mode there is no vault, so payment_layer.balance is
             *     "0" and total = router.subtotal = balance + credit. [beta]
             * @example 0g
             */
            currency?: string;
            payment_layer?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.PaymentLayerFunds"];
            router?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.RouterLedgerFunds"];
            /** @example 7390000000000000000 */
            total?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.GetNonceResponse": {
            expires_at?: string;
            nonce?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.HealthCheckResponse": {
            /** @example backend-abc123 */
            instance_id?: string;
            /** @example ok */
            status?: string;
            /** @example 1677652288 */
            time?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.ImageCapabilities": {
            /**
             * @description Controls are the model's optional request-body parameters beyond
             *     prompt / n / size / references, in the same shape as
             *     video_capabilities.controls. Absent: the model takes none.
             */
            controls?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ImageControl"][];
            /**
             * @description MaxN is the most images one request returns. A larger `n` is refused
             *     with 400.
             * @example 1
             */
            max_n?: number;
            /** @description MultiTurn says the model edits across turns. Absent: single-turn only. */
            multi_turn?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ImageMultiTurn"];
            /**
             * @description References describes reference images (character / style consistency).
             *     Absent: the model takes none.
             */
            references?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ImageReferenceCapabilities"];
            /**
             * @description Size constrains `size` (`<width>x<height>`); a size outside its numeric
             *     bounds is refused with 400.
             */
            size?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ImageSizeCapabilities"];
        };
        "github_com_0glabs_0g-router_pkg_response.ImageControl": {
            /**
             * @description Default is the value the model uses when the parameter is omitted, in
             *     the parameter's own JSON type (number, boolean or string).
             */
            default?: string;
            /** @example seed */
            key?: string;
            max?: number;
            /**
             * @description MaxLength bounds a string control, in characters.
             * @example 16
             */
            max_length?: number;
            /** @example 0 */
            min?: number;
            /** @description Note says what the parameter does. */
            note?: string;
            /**
             * @description Path is where the value goes in the JSON body (top-level field name).
             * @example seed
             */
            path?: string;
            /**
             * @description Type is "enum" (one of Values), "integer" (Min/Max bound it when set),
             *     "boolean" or "string" (MaxLength bounds it when set).
             * @example integer
             */
            type?: string;
            /**
             * @description Values are an enum control's allowed values, in the parameter's own
             *     JSON type (numbers stay numbers): send one back as is.
             */
            values?: string[];
        };
        "github_com_0glabs_0g-router_pkg_response.ImageMultiTurn": {
            /** @example messages */
            history_field?: string;
            /** @example assembled_history */
            response_field?: string;
            /** @example session */
            session_field?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.ImageReferenceCapabilities": {
            /**
             * @description Accepts lists the reference forms: "url" (an http(s) link the vendor
             *     downloads, so it must be publicly reachable) and/or "data_uri" (a
             *     base64 `data:image/...` URI inline).
             * @example [
             *       "url"
             *     ]
             */
            accepts?: string[];
            /**
             * @description Endpoint is where references go: "/v1/images/generations" (as a JSON
             *     field, see Fields) or "/v1/images/edits" (multipart `image`).
             * @example /v1/images/generations
             */
            endpoint?: string;
            /**
             * @description Fields are the request-body field names that take references on
             *     /v1/images/generations, each a string or an array of strings. They are
             *     alternatives: send the references in any one of them; Max is the total.
             * @example [
             *       "image"
             *     ]
             */
            fields?: string[];
            /**
             * @description most reference images per request
             * @example 3
             */
            max?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.ImageSizeCapabilities": {
            /**
             * @description Default is the size rendered when the request omits `size`; absent
             *     means the model picks.
             * @example 2048x2048
             */
            default?: string;
            /**
             * @description width × height at most this
             * @example 1048576
             */
            max_pixels?: number;
            /**
             * @description each of width and height at most this many pixels
             * @example 2048
             */
            max_side?: number;
            /**
             * @description width × height at least this
             * @example 3686400
             */
            min_pixels?: number;
            /**
             * @description each of width and height at least this many pixels
             * @example 512
             */
            min_side?: number;
            /**
             * @description Note explains a size behaviour the numbers above cannot, e.g. a model
             *     that maps `size` onto its nearest supported aspect ratio.
             */
            note?: string;
            /**
             * @description Sizes, when present, are the only sizes the model renders: each is
             *     returned exactly as requested, and any other `size` is refused with 400
             *     rather than mapped onto one of them. Absent means any size within the
             *     limits above. [beta]
             * @example [
             *       "1024x1024",
             *       "1280x720"
             *     ]
             */
            sizes?: string[];
        };
        "github_com_0glabs_0g-router_pkg_response.InputCapability": {
            /**
             * @description Accepts lists the forms a request may pass the media in: `base64`
             *     (inline, always listed — OpenAI chat and Responses as a data URI
             *     `data:<mime>;base64,<data>` in image_url / video_url, Anthropic messages
             *     as a source of type `base64` with `media_type`) and `url` (an http(s)
             *     link the upstream downloads; listed when an upstream of the model takes
             *     links — a link request is routed only to those).
             * @example [
             *       "base64",
             *       "url"
             *     ]
             */
            accepts?: string[];
            /**
             * @description MaxBytes is the largest single media item, in decoded bytes, the model
             *     takes inline; a larger one is refused with 400 before it is sent.
             *     Absent: no stated per-item limit. Either way the whole request body is
             *     capped at 20 MiB (base64 inflates media by 4/3): 413 when the request
             *     declares a larger Content-Length, 400 when a chunked body runs over.
             * @example 10485760
             */
            max_bytes?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.MeResponse": {
            /** @example jwt */
            auth_type?: string;
            /**
             * @description PrivyUserID is the session owner's Privy DID, present only for Privy
             *     logins (omitempty). SIWE / API-key sessions omit it; the frontend then
             *     falls back to wallet-address matching. [beta]
             * @example did:privy:abc123
             */
            privy_user_id?: string;
            /** @example 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 */
            wallet_address?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.MgmtKeyItem": {
            /** @example 2026-04-22T10:30:00Z */
            created_at?: string;
            /** @example abc12345 */
            key_id?: string;
            /** @example mk-abcde… */
            key_preview?: string;
            /** @example mgmt */
            key_type?: string;
            /**
             * @description LastSourceIP is the client IP recorded at LastUsedAt — emitted as the
             *     full address; UI is responsible for any masking before display.
             * @example 52.13.45.6
             */
            last_source_ip?: string;
            /**
             * @description LastUsedAt is the most recent successful authentication via this key.
             *     nil until the key has been used at least once.
             * @example 2026-04-29T14:02:00Z
             */
            last_used_at?: string;
            /** @example ci-deploy */
            name?: string;
            /**
             * @description RateLimitRPM is this key's requests-per-minute cap; omitted when the
             *     key has none.
             * @example 30
             */
            rate_limit_rpm?: number;
            /**
             * @description NOTE: expires_at is deliberately not emitted. The row in api_keys
             *     still has the column and the service layer still tracks it for
             *     internal callers, but mgmt keys today are non-expiring at the HTTP
             *     surface. Adding back is a single line here — no schema or service
             *     changes — once the product surface for expiration is finalised.
             * @example false
             */
            revoked?: boolean;
            /**
             * @example [
             *       "[\"keys:read\"",
             *       "\"keys:create\"]"
             *     ]
             */
            scopes?: string[];
            /** @example active */
            status?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.MgmtKeyListResponse": {
            data?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.MgmtKeyItem"][];
            /** @example list */
            object?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.ModalityPrices": {
            input?: {
                [key: string]: string;
            };
            output?: {
                [key: string]: string;
            };
        };
        "github_com_0glabs_0g-router_pkg_response.ModelArchitecture": {
            input_modalities?: string[];
            instruct_type?: string;
            /**
             * @description MaxInputBytes [beta]: on GET /v1/providers, per input modality the
             *     largest single media item (decoded bytes) this endpoint takes. Never set
             *     on a /v1/models entry — see input_capabilities.
             */
            max_input_bytes?: {
                [key: string]: number;
            };
            modality?: string;
            output_modalities?: string[];
            tokenizer?: string;
            /**
             * @description URLInputModalities [beta]: on GET /v1/providers, the input modalities
             *     this endpoint also takes as a link it downloads, not only inline (a
             *     data: URI). Never set on a /v1/models entry — see input_capabilities.
             */
            url_input_modalities?: string[];
        };
        "github_com_0glabs_0g-router_pkg_response.ModelEntry": {
            architecture?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ModelArchitecture"];
            /**
             * @description AsyncSupported, on an image model (text-to-image / image-editing), says
             *     whether POST /v1/async/images/generations or /v1/async/images/edits can
             *     serve it: true when at least one endpoint serving it takes async jobs,
             *     false when none does — call the synchronous POST /v1/images/generations
             *     or /v1/images/edits instead (an async submit for such a model is refused
             *     with 400 model_not_capable). true is best-effort: if the async-capable
             *     endpoints are unavailable for a given request, the async submit is
             *     refused the same way, so treat 400 model_not_capable on an async submit
             *     as "use the synchronous endpoint". Every image model takes the
             *     synchronous endpoints. Absent on non-image models.
             *     Computed over all of the model's endpoints, whatever filters the listing
             *     was asked for. [beta]
             */
            async_supported?: boolean;
            context_length?: number;
            /**
             * @description Created is when the router FIRST recorded an endpoint serving this model
             *     (Unix seconds) — the earliest such time across every endpoint aggregated
             *     into this entry. It is router-side bookkeeping, not a model release,
             *     training or on-chain registration date, and it moves forward if every
             *     endpoint of a model leaves the network and later returns.
             * @example 1737936000
             */
            created?: number;
            default_parameters?: {
                [key: string]: unknown;
            };
            description?: string;
            /**
             * @description E2EE says whether this model's requests are end-to-end encrypted to the
             *     provider by the 0G gateway, so that the router cannot read the prompt:
             *     "required" (every listed provider serving it is encrypted), "optional"
             *     (some are), "none". Always computed over all of the model's providers,
             *     whatever filters the listing was asked for. Features that work by adding
             *     to the prompt (the web plugin, the 0g:web_search tool, file attachments)
             *     are unavailable on an encrypted request; run search yourself with
             *     POST /v1/web/search instead. [beta]
             */
            e2ee?: string;
            expiration_date?: string;
            /**
             * @description The canonical model id by default; the raw provider model_id when listed with ?legacy=true
             * @example qwen-2.5-7b-instruct
             */
            id?: string;
            /**
             * @description ImageCapabilities [beta]: on an image model, the request limits a client
             *     can build its options from — how many images one request returns, the
             *     sizes it takes, and the reference images it accepts. A limit the model
             *     does not have is omitted (read an absent field as "no stated limit"),
             *     never written as 0.
             */
            image_capabilities?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ImageCapabilities"];
            /**
             * @description InputCapabilities [beta]: on a chat model, for each media input modality
             *     it takes (`image`, `video`), the forms a request may pass it in and the
             *     largest item it takes. Inline `base64` is always accepted; `url` is
             *     listed only when the model takes links. A request carrying a link for a
             *     modality not listing `url`, or an inline item over `max_bytes`, is
             *     refused with 400. The whole request body is capped at 20 MiB.
             */
            input_capabilities?: {
                [key: string]: components["schemas"]["github_com_0glabs_0g-router_pkg_response.InputCapability"];
            };
            max_completion_tokens?: number;
            name?: string;
            /** @example model */
            object?: string;
            /** @example 0G Foundation */
            owned_by?: string;
            pricing?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ModelPricing"];
            /** @description Per-token USD prices; only set when upstream metadata provides them */
            pricing_usd?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ModelPricing"];
            /**
             * @description ProviderCount is the number of DISTINCT provider addresses (brokers)
             *     serving this model — "how many providers offer this model", the redundancy
             *     signal. One broker fronting the same model via several same-model upstreams
             *     (differing only in provider_identity) counts ONCE, not once per upstream.
             *     Counted irrespective of health — it is NOT a count of currently-healthy
             *     capacity. For per-endpoint rows (one per address+provider_identity) and
             *     their health, call GET /v1/providers?canonical_id=<id> (each ProviderEntry
             *     carries is_healthy and provider_identity).
             */
            provider_count?: number;
            /**
             * @description SpeechCapabilities [beta]: on a text-to-speech model, what a request may
             *     carry — the longest `input`, the audio formats, the `speed` range, voices
             *     verified to work, and the optional controls (emotion, pitch, …). The
             *     router refuses a request outside these limits with 400 before it is sent.
             */
            speech_capabilities?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.SpeechCapabilities"];
            supported_formats?: string[];
            supported_parameters?: string[];
            tee_attested?: boolean;
            tee_type?: string;
            tee_verifier?: string;
            type?: string;
            verifiability?: string;
            /**
             * @description VideoCapabilities [beta]: for a video model served by an endpoint that
             *     forwards vendor-native request fields, the fields it accepts under
             *     `metadata` on POST /v1/videos (input slots such as first/last frame and
             *     reference image/video/audio, and controls such as resolution, ratio,
             *     audio, seed), with their limits. Each input slot's `accepts` lists the
             *     forms it takes: `url` (a link the vendor downloads) and/or `data_uri`
             *     (base64 inline). Absent when no serving endpoint forwards them.
             */
            video_capabilities?: {
                [key: string]: unknown;
            };
        };
        "github_com_0glabs_0g-router_pkg_response.ModelListResponse": {
            data?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ModelEntry"][];
            /** @example list */
            object?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.ModelPriceVariant": {
            dimensions?: {
                [key: string]: string;
            };
            unit?: string;
            unit_price?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.ModelPricing": {
            /**
             * @description CacheWrite is the per-token price for writing a prompt token to the cache
             *     (cache creation) at the default/5-minute TTL, i.e. prompt * write_multiplier.
             *     [beta] Present only when the provider advertises a cache-write premium
             *     (write_multiplier > 1) and features.cache_write_premium is enabled; omitted
             *     otherwise.
             */
            cache_write?: string;
            /**
             * @description CacheWrite1h is the per-token price for writing a prompt token to the cache
             *     at the 1-hour TTL, i.e. prompt * write_1h_multiplier. [beta] Present only
             *     when the provider advertises a distinct, valid 1-hour cache-write premium and
             *     features.cache_write_premium is enabled; omitted otherwise (1-hour writes
             *     then bill at CacheWrite, or the plain prompt rate when no premium applies).
             */
            cache_write_1h?: string;
            cached_prompt?: string;
            completion?: string;
            image?: string;
            /**
             * @description ModalityPricing [beta]: on a model priced by modality (e.g. Qwen omni),
             *     the per-token prices that replace Prompt / Completion: `input` by
             *     modality (`image`, `video`, `audio` — text input bills at Prompt), and
             *     `output.text_only_input` (output of a request whose input is text only)
             *     and `output.audio` (audio output tokens; text output tokens of that
             *     response are then not billed). Absent: every token bills at Prompt /
             *     Completion.
             */
            modality_pricing?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ModalityPrices"];
            prompt?: string;
            tiered_pricing?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ModelPricingTier"][];
            variants?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ModelPriceVariant"][];
            /**
             * @description Video is the flat per-effective-output-second price for a single-rate
             *     video-generation model (wei in the native block, USD decimal in the USD
             *     block). Variants supersedes it when the model prices by request shape
             *     (resolution/duration) — see ModelPriceVariant. Both mirror the broker's
             *     /models pricing.video / pricing.variants so a video model shows a real
             *     per-second/per-resolution price instead of a misleading per-token one.
             */
            video?: string;
            /**
             * @description VideoUnit names what one unit of this model's video price buys, when it is not
             *     a second: "video_token" for a model billed on the vendor's reported token count.
             *     Absent means per-second, which is every other video model.
             *
             *     It exists because `Video` alone is ambiguous and the ambiguity is expensive: a
             *     per-token scalar read as a per-second rate is wrong by the vendor's tokens per
             *     second (~21,600 at 720p for Seedance), not by rounding. A token-priced model
             *     therefore omits `Video` entirely and publishes only `Variants` — so a consumer
             *     rendering "price per second" must read this field first and fall back to the
             *     variant rows, rather than treating a missing `Video` as "no price".
             */
            video_unit?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.ModelPricingTier": {
            cached_prompt?: string;
            completion?: string;
            max_input_tokens?: number;
            prompt?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.PartnerAPIKeyMeta": {
            created_at?: string;
            /** @example a1b2c3d4e5f60718 */
            key_id?: string;
            /** @example false */
            revoked?: boolean;
            revoked_at?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.PartnerListResponse": {
            data?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.PartnerResponse"][];
            /** @example 50 */
            limit?: number;
            /** @example list */
            object?: string;
            /** @example 0 */
            offset?: number;
            /** @example 5 */
            total?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.PartnerResponse": {
            api_keys?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.PartnerAPIKeyMeta"][];
            /** @example tech@foopartner.com */
            contact_email?: string;
            created_at?: string;
            /** @example foopartner */
            id?: string;
            /** @example https://foopartner.com */
            link?: string;
            /** @example https://cdn.example/logo.png */
            logo_url?: string;
            /** @example FooPartner */
            name?: string;
            revoked_at?: string;
            /** @example active */
            status?: string;
            updated_at?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.PaymentLayerFunds": {
            /** @example 7086440000000000000 */
            balance?: string;
            /** @example 2026-05-25T16:21:00Z */
            queried_at?: string;
            /** @example true */
            shared_across_products?: boolean;
        };
        "github_com_0glabs_0g-router_pkg_response.ProjectGrantDetailResponse": {
            /** @example 2026-07-01T10:30:00Z */
            created_at?: string;
            /** @example 0x0000000000000000000000000000000000000001 */
            created_by?: string;
            /** @example 128 */
            distribution_total?: number;
            distributions?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ProjectGrantDistributionItem"][];
            /**
             * @description EffectiveStatus is the derived operator/expiry state: "expired" once
             *     past expires_at (expiry is lazy, judged at read time), else Status.
             *     It reflects ONLY the pause/expiry axis — an "active" grant can still
             *     reject distributions on quota (also check Remaining > 0). Never gate on
             *     Status alone; it hides expiry.
             * @example active
             * @enum {string}
             */
            effective_status?: "active" | "paused" | "expired";
            /** @example 2026-12-31T23:59:59Z */
            expires_at?: string;
            /** @example pcg-6f9619ff-8b86-d011-b42d-00cf4fc964ff */
            grant_id?: string;
            /** @example 0G App launch campaign */
            name?: string;
            /** @example 0x15d34aaf54267db7d7c367839aaf71a00a2c6a65 */
            owner_address?: string;
            /** @example 750000000000000000000 */
            remaining?: string;
            /**
             * @description Status is the STORED operator state — the writable domain of PATCH.
             * @example active
             * @enum {string}
             */
            status?: "active" | "paused";
            /** @example 1000000000000000000000 */
            total_quota?: string;
            /** @example 2026-07-01T10:30:00Z */
            updated_at?: string;
            /** @example 250000000000000000000 */
            used_quota?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.ProjectGrantDistributionItem": {
            /** @example 1000000000000000000 */
            amount?: string;
            /** @example 2026-07-01T10:30:00Z */
            created_at?: string;
            /** @example 0x15d34aaf54267db7d7c367839aaf71a00a2c6a65 */
            distributed_by?: string;
            /** @example 42 */
            distribution_id?: number;
            /** @example pcg-6f9619ff-8b86-d011-b42d-00cf4fc964ff */
            grant_id?: string;
            /** @example user-42-onboarding */
            idempotency_key?: string;
            /** @example onboarding reward */
            reason?: string;
            /** @example 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 */
            recipient_address?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.ProjectGrantDistributionListResponse": {
            data?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ProjectGrantDistributionItem"][];
            /** @example list */
            object?: string;
            /** @example 128 */
            total?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.ProjectGrantDistributionResponse": {
            /** @example 1000000000000000000 */
            amount?: string;
            /** @example 2026-07-01T10:30:00Z */
            created_at?: string;
            /** @example 0x15d34aaf54267db7d7c367839aaf71a00a2c6a65 */
            distributed_by?: string;
            /** @example 42 */
            distribution_id?: number;
            grant?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ProjectGrantQuotaSummary"];
            /** @example pcg-6f9619ff-8b86-d011-b42d-00cf4fc964ff */
            grant_id?: string;
            /** @example user-42-onboarding */
            idempotency_key?: string;
            /** @example onboarding reward */
            reason?: string;
            /** @example 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 */
            recipient_address?: string;
            /** @example false */
            replayed?: boolean;
        };
        "github_com_0glabs_0g-router_pkg_response.ProjectGrantListResponse": {
            data?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ProjectGrantResponse"][];
            /** @example list */
            object?: string;
            /** @example 3 */
            total?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.ProjectGrantQuotaSummary": {
            /** @example pcg-6f9619ff-8b86-d011-b42d-00cf4fc964ff */
            grant_id?: string;
            /** @example 749000000000000000000 */
            remaining?: string;
            /** @example 1000000000000000000000 */
            total_quota?: string;
            /** @example 251000000000000000000 */
            used_quota?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.ProjectGrantResponse": {
            /** @example 2026-07-01T10:30:00Z */
            created_at?: string;
            /** @example 0x0000000000000000000000000000000000000001 */
            created_by?: string;
            /**
             * @description EffectiveStatus is the derived operator/expiry state: "expired" once
             *     past expires_at (expiry is lazy, judged at read time), else Status.
             *     It reflects ONLY the pause/expiry axis — an "active" grant can still
             *     reject distributions on quota (also check Remaining > 0). Never gate on
             *     Status alone; it hides expiry.
             * @example active
             * @enum {string}
             */
            effective_status?: "active" | "paused" | "expired";
            /** @example 2026-12-31T23:59:59Z */
            expires_at?: string;
            /** @example pcg-6f9619ff-8b86-d011-b42d-00cf4fc964ff */
            grant_id?: string;
            /** @example 0G App launch campaign */
            name?: string;
            /** @example 0x15d34aaf54267db7d7c367839aaf71a00a2c6a65 */
            owner_address?: string;
            /** @example 750000000000000000000 */
            remaining?: string;
            /**
             * @description Status is the STORED operator state — the writable domain of PATCH.
             * @example active
             * @enum {string}
             */
            status?: "active" | "paused";
            /** @example 1000000000000000000000 */
            total_quota?: string;
            /** @example 2026-07-01T10:30:00Z */
            updated_at?: string;
            /** @example 250000000000000000000 */
            used_quota?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.ProviderEntry": {
            /** @example 0x1234567890abcdef */
            address?: string;
            architecture?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ModelArchitecture"];
            /**
             * @description [beta] Canonical model id this endpoint serves; empty if unmapped
             * @example glm-5.1
             */
            canonical_id?: string;
            context_length?: number;
            default_parameters?: {
                [key: string]: unknown;
            };
            /** @description Upstream model availability expiration (RFC3339); empty = no expiration. Only visible before the instant — an expired endpoint drops out of this listing entirely. */
            expiration_date?: string;
            /**
             * @description nil=unknown, true=healthy, false=unhealthy
             * @example true
             */
            is_healthy?: boolean;
            /**
             * @description nil=no health data
             * @example 150
             */
            latency?: number;
            max_completion_tokens?: number;
            /** @example qwen-2.5-7b-instruct */
            model_id?: string;
            /** @description Model metadata (populated when listing providers for a specific model) */
            name?: string;
            pricing?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ModelPricing"];
            /** @description Per-token USD prices; only set when upstream metadata provides them */
            pricing_usd?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ModelPricing"];
            /** @description [beta] Operator-declared serving country/locality */
            provider_country?: string;
            /**
             * @description ProviderIdentity distinguishes two same-model candidates served by one
             *     broker (same address) via different upstreams (e.g. glm-5.2 via aliyun vs
             *     zhipu). Empty (omitted) for a legacy single-upstream endpoint, so the two
             *     rows for one address+model are otherwise indistinguishable without it.
             * @example aliyun
             */
            provider_identity?: string;
            /**
             * @description Operator-declared, descriptive endpoint identity/locality (from the
             *     broker's /models metadata). Empty when the operator did not declare them.
             */
            provider_name?: string;
            /** @example chatbot */
            service_type?: string;
            /** @description [beta] Operator-declared serving domain. Present only on `verified` / `private` endpoints; never on `standard` */
            serving_domain?: string;
            supported_formats?: string[];
            supported_parameters?: string[];
            /** @example true */
            tee_acknowledged?: boolean;
            tee_attested?: boolean;
            tee_type?: string;
            tee_verifier?: string;
            /** @description [beta] Routable trust tier of this endpoint: standard | verified | private. Derived from provider_type — the authoritative tier signal (verifiability is a descriptive TEE label and is empty for standard). Use this to match a request's provider.trust_mode / X-0G-Provider-Trust-Mode floor. ABSENT when the endpoint registered a tier signal the router has no mapping for: read that as "not classified" rather than substituting a tier, and note such an endpoint is not selected by any trust-mode request (it still serves requests that ask for no tier). */
            trust_mode?: string;
            type?: string;
            /**
             * @description nil=no health data
             * @example 99.5
             */
            uptime?: number;
            verifiability?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.ProviderListResponse": {
            data?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ProviderEntry"][];
            /** @example list */
            object?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.PublicActivityPoint": {
            /** @example 2026-05-01 */
            date?: string;
            values?: {
                [key: string]: number;
            };
        };
        "github_com_0glabs_0g-router_pkg_response.PublicActivityResponse": {
            /** @example true */
            available?: boolean;
            /** @example 90 */
            days?: number;
            /** @example tokens */
            metric?: string;
            models?: string[];
            /** @example usage_activity */
            object?: string;
            points?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.PublicActivityPoint"][];
            /** @example 2026-05-30T08:00:00Z */
            updated_at?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.PublicMediaModelEntry": {
            /** @example bytedance/seedream-4.5 */
            canonical_id?: string;
            /** @example 640 */
            count?: number;
            /**
             * @example image
             * @enum {string}
             */
            kind?: "image" | "video";
            /** @example bytedance/seedream-4.5 */
            model?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.PublicMediaTotals": {
            /** @example 1200 */
            images?: number;
            /** @example 85 */
            videos?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.PublicModelUsageEntry": {
            /**
             * @description CanonicalID is the registry canonical id for joining /v1/models metadata;
             *     null when unresolved. [beta]
             * @example glm-5
             */
            canonical_id?: string;
            /** @example 4000000 */
            input_tokens?: number;
            /** @example glm-5 */
            model?: string;
            /** @example 2400000 */
            output_tokens?: number;
            /** @example 6400000 */
            total_tokens?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.PublicModelsCard": {
            /** @example 6 */
            total?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.PublicProvidersCard": {
            by_type?: {
                [key: string]: number;
            };
            /** @example 14 */
            total?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.PublicSummaryMetric": {
            /** @example 50600000 */
            total?: number;
            /** @example 687000 */
            yesterday?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.PublicSummaryResponse": {
            /** @description Images is the count of images generated. [beta] */
            images?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.PublicSummaryMetric"];
            /**
             * @description Models is the count of distinct user-facing (canonical) models available
             *     across the provider network. [beta]
             */
            models?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.PublicModelsCard"];
            /** @example usage_summary */
            object?: string;
            providers?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.PublicProvidersCard"];
            requests?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.PublicSummaryMetric"];
            tee_proofs?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.PublicTeeProofsCard"];
            tokens?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.PublicSummaryMetric"];
            /**
             * @description UniqueWallets is the network-wide distinct-wallet count: wallets known to
             *     the Router (any user_balances row — created on login, so connected wallets
             *     count, not only funded ones) ∪ on-chain inference-ledger users, deduped.
             *     [beta]
             */
            unique_wallets?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.PublicUniqueWalletsCard"];
            /** @example 2026-05-30T08:00:00Z */
            updated_at?: string;
            /** @description Videos is the count of videos generated. [beta] */
            videos?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.PublicSummaryMetric"];
        };
        "github_com_0glabs_0g-router_pkg_response.PublicTeeProofsCard": {
            /** @example false */
            available?: boolean;
            /** @example 24500 */
            total?: number;
            /** @example 331 */
            yesterday?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.PublicUniqueWalletsCard": {
            /** @example 8400 */
            total?: number;
            /** @example 38 */
            yesterday?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.PublicUsageStatsResponse": {
            /** @description MediaModels ranks image and video models by generated count (top 10). [beta] */
            media_models?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.PublicMediaModelEntry"][];
            /** @description MediaTotals counts generated images and videos in the window. [beta] */
            media_totals?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.PublicMediaTotals"];
            models?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.PublicModelUsageEntry"][];
            /** @example usage_stats */
            object?: string;
            /** @example 30d */
            period?: string;
            totals?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.PublicUsageTotals"];
            /** @example 2026-05-30T08:00:00Z */
            updated_at?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.PublicUsageTotals": {
            /** @example 5000000 */
            input_tokens?: number;
            /** @example 3000000 */
            output_tokens?: number;
            /** @example 8000000 */
            total_tokens?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.RevokeAPIKeyResponse": {
            /** @example abc12345 */
            key_id?: string;
            /** @example API key revoked */
            message?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.RevokeMgmtKeyResponse": {
            /** @example abc12345 */
            key_id?: string;
            /** @example Management key revoked */
            message?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.RevokePartnerResponse": {
            /** @example foopartner */
            id?: string;
            /** @example a1b2c3d4e5f60718 */
            key_id?: string;
            /** @example revoked */
            status?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.RotatePartnerKeyResponse": {
            /** @example pk-foopartner-9b1c8a... */
            api_key?: string;
            /** @example f0e1d2c3b4a59687 */
            key_id?: string;
            /** @example This api_key will not be shown again. Store it securely. */
            warning?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.RouterLedgerFunds": {
            /** @example 3560000000000000 */
            credit?: string;
            /** @example 300000000000000000 */
            deposit?: string;
            /** @example 0 */
            pending_charge?: string;
            /** @example 303560000000000000 */
            subtotal?: string;
            /**
             * @description UnsettledCharge (micro-USD) is present only for USD accounts whose
             *     billing 0G Pay serves: charges already made that have not been sent to
             *     0G Pay yet, so they are not reflected in the other amounts here or in
             *     0G Pay's own balance. Subtract it to show the balance after those
             *     charges. A charge leaves this figure when it is sent, a few seconds
             *     after the reply, so while 0G Pay is slow to accept it the other amounts
             *     can briefly read high; the figure never counts a charge 0G Pay may
             *     already have applied. Absent when it could not be read. [beta]
             * @example 87
             */
            unsettled_charge?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.ServiceTypeEntry": {
            /** @example Chat */
            label?: string;
            /** @example 3 */
            provider_count?: number;
            /** @example chatbot */
            type?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.ServiceTypeListResponse": {
            data?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ServiceTypeEntry"][];
            /** @example list */
            object?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.SigninResponse": {
            expires_at?: string;
            token?: string;
            wallet_address?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.SignoutResponse": {
            /** @example Signed out successfully */
            message?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.SourceUsageHistoryResponse": {
            data?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.SourceUsageLogEntry"][];
            /** @example 20 */
            limit?: number;
            /** @description NextCursor is the opaque token for the next page via `?cursor=`; absent on the last page. [beta] */
            next_cursor?: string;
            /** @example list */
            object?: string;
            /** @example 0 */
            offset?: number;
            /**
             * @description Total is the full-set count; omitted when include_total=false / cursor paging.
             * @example 12345
             */
            total?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.SourceUsageLogEntry": {
            /**
             * @description ID of the end user's `sk-` API key (NOT your `pk-` partner key) — useful for distinguishing multiple keys under the same wallet.
             * @example abc12345
             */
            api_key_id?: string;
            /**
             * @description CacheWrite1hTokens is the 1-hour-TTL portion of cache_write_tokens (disjoint
             *     from it). Only the Anthropic path reports a TTL breakdown; elsewhere 0.
             *     Reflects volume, not billing. [beta]
             * @example 0
             */
            cache_write_1h_tokens?: number;
            /**
             * @description CacheWriteTokens is the provider-reported cache-WRITE (creation) subset of
             *     input_tokens (the pair of cached_tokens). Non-zero whenever the provider
             *     reports cache-creation tokens — reflects volume, not billing (does NOT
             *     imply a premium was charged). A cache-write premium, when active, prices
             *     these above the plain prompt rate in `cost`; else they bill at the plain
             *     rate. Disjoint from cached_tokens; input_tokens already includes both
             *     (input_tokens = plain + cached_tokens + cache_write_tokens). [beta]
             * @example 0
             */
            cache_write_tokens?: number;
            /**
             * @description cache-READ subset of input_tokens (billed at the read-discount rate).
             * @example 40
             */
            cached_tokens?: number;
            /**
             * @description CanonicalID is the registry-resolved canonical model id captured at
             *     billing time (e.g. `glm-5`). Empty when the underlying on-chain
             *     `model_id` isn't a registered canonical / alias. Aggregate by this
             *     when you want "what model did the user use" (canonical concept);
             *     `model_id` stays as the on-chain literal so partner debugging tools
             *     can still drill into the specific endpoint served. [beta]
             * @example glm-5
             */
            canonical_id?: string;
            /**
             * @description Total request cost in neuron (1 0G = 10^18 neuron).
             * @example 150000000000000
             */
            cost?: string;
            created_at?: string;
            /**
             * @description Portion of `cost` paid from the user's promotional credit balance, in neuron.
             * @example 50000000000000
             */
            credit_used?: string;
            /**
             * @description Portion of `cost` paid from the user's deposited (on-chain) balance, in neuron.
             * @example 100000000000000
             */
            deposit_used?: string;
            /** @example 1 */
            id?: number;
            /** @example 100 */
            input_tokens?: number;
            /** @example zai-org/GLM-5-FP8 */
            model_id?: string;
            /** @example 150 */
            output_tokens?: number;
            /**
             * @description On-chain address of the upstream 0G Compute provider that served the request.
             * @example 0x1234...
             */
            provider_address?: string;
            /**
             * @description Stable request identifier; quote this when raising support tickets.
             * @example req_abc123
             */
            request_id?: string;
            /**
             * @description TrustMode is the trust tier of the provider that served the request:
             *     `standard` (TEE route, undisclosed upstream), `verified` (TeeTLS
             *     broker) or `private` (native TeeML). Always emitted; empty string
             *     for rows that pre-date the dimension (clients render as "—") and
             *     for a provider whose registered tier signal the router could not
             *     classify. Mirror of the field on UsageLogEntry; included on the
             *     partner shape so SDKs generated from this swagger see the same
             *     contract the wire actually emits.
             * @example verified
             */
            trust_mode?: string;
            /**
             * @description Wallet address that issued the inference request (your downstream end user).
             * @example 0xabc1230000000000000000000000000000000001
             */
            user_address?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.SourceUsageStatsResponse": {
            /** @example 120000 */
            completion_tokens?: number;
            /**
             * @description Distinct wallets whose first tagged request to this partner fell inside the date window. For lifetime queries (both dates omitted), the cumulative count of unique users you have brought to the platform.
             * @example 158
             */
            new_users?: number;
            /** @example 80000 */
            prompt_tokens?: number;
            /**
             * @description TotalCost is neuron/wei (1 0G = 10^18), 0G-settled traffic ONLY. This
             *     endpoint takes no `?currency=` parameter — the scope is always merged — so
             *     with USD billing live this figure silently excludes a partner's USD-settled
             *     downstream users. Read TotalCostUsd for the real number.
             * @example 1234500000000000000
             */
            total_cost?: string;
            /**
             * @description TotalCostUsd is the all-currency cost in micro-USD (1 USD = 10^6, issue
             *     #582): 0G-settled requests are valued at the provider's real rate frozen at
             *     billing time. It has always been emitted (source.go) but was missing from
             *     this struct, so a client generated from the published spec could not reach
             *     it — and docs/partner.md described only the 0G-only field.
             * @example 1234
             */
            total_cost_usd?: string;
            /** @example 12345 */
            total_requests?: number;
            /** @example 200000 */
            total_tokens?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.SpeechCapabilities": {
            /**
             * @description Controls are the model's optional top-level request fields beyond the
             *     OpenAI speech request. Absent: the model takes none.
             */
            controls?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.SpeechControl"][];
            /**
             * @description MaxInputBytes bounds `input` in UTF-8 bytes (a CJK character is 3).
             * @example 2000
             */
            max_input_bytes?: number;
            /**
             * @description ResponseFormats are the `response_format` values the model renders; the
             *     default is mp3.
             * @example [
             *       "mp3",
             *       "wav"
             *     ]
             */
            response_formats?: string[];
            /** @description Speed bounds `speed` (1 = normal). */
            speed?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.SpeechRange"];
            /**
             * @description Voices are `voice` ids verified to work on this model. Not exhaustive:
             *     VoicesNote says what else `voice` accepts.
             */
            voices?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.SpeechVoice"][];
            voices_note?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.SpeechControl": {
            /** @description Default is what the model uses when the field is omitted (as text). */
            default?: string;
            /** @description ExclusiveMin: the value must be greater than Min, not equal to it. */
            exclusive_min?: boolean;
            /** @example emotion */
            key?: string;
            max?: number;
            min?: number;
            note?: string;
            /**
             * @description Type is "enum" (one of Values), "integer" or "number" (Min/Max bound it
             *     when set; ExclusiveMin makes Min itself invalid).
             * @example enum
             */
            type?: string;
            values?: string[];
        };
        "github_com_0glabs_0g-router_pkg_response.SpeechRange": {
            /** @example 2 */
            max?: number;
            /** @example 0.5 */
            min?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.SpeechVoice": {
            /** @example English_Graceful_Lady */
            id?: string;
            /** @example English */
            language?: string;
            /** @example Graceful Lady */
            name?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.StripeTopupEntry": {
            /**
             * @description AmountMicro is the gross credited amount in micro-USD.
             * @example 10000000
             */
            amount_micro?: string;
            /**
             * @description CreatedAt is when the credit was recorded (ISO8601).
             * @example 2026-07-16T06:18:42Z
             */
            created_at?: string;
            /**
             * @description ID is the Stripe PaymentIntent id (pi_…) — the stable, idempotency-keyed
             *     reference to quote in support tickets.
             * @example pi_3QabcDEfgHIjkLMn
             */
            id?: string;
            /**
             * @description RefundedAmountMicro is the cumulative refunded amount in micro-USD ("0" when
             *     none). A dispute is surfaced via `status`, not this field.
             * @example 0
             */
            refunded_amount_micro?: string;
            /**
             * @description Status: paid | partially_refunded | refunded | disputed. Derived from the
             *     clawback counters (every row is credited at baseline).
             * @example paid
             */
            status?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.StripeTopupsResponse": {
            /** @example usd */
            currency?: string;
            data?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.StripeTopupEntry"][];
            /** @example 20 */
            limit?: number;
            /** @example list */
            object?: string;
            /** @example 1 */
            page?: number;
            /** @example 3 */
            total?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.TopAppEntry": {
            /** @example FooPartner */
            display_name?: string;
            /** @example 4000000 */
            input_tokens?: number;
            /** @example https://foopartner.com */
            link?: string;
            /** @example https://www.google.com/s2/favicons?domain=foopartner.com&sz=64 */
            logo_url?: string;
            /** @example 2400000 */
            output_tokens?: number;
            /** @example 12345 */
            request_count?: number;
            /**
             * @description SourceType distinguishes a registered partner ("registered", branding
             *     curated by 0G and spoof-proof) from a self-reported app ("self_reported",
             *     branding derived from the request's HTTP-Referer / X-Title).
             * @example registered
             */
            source_type?: string;
            /** @example 6400000 */
            total_tokens?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.TopAppsResponse": {
            apps?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.TopAppEntry"][];
            /** @example app_ranking */
            object?: string;
            /** @example 30d */
            period?: string;
            /** @example 2026-05-30T08:00:00Z */
            updated_at?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.UsageHistoryResponse": {
            /**
             * @description Currency is the unit of each row's cost/*_used fields: "0g" (wei) or "usd"
             *     (micro-USD). The list is filtered to a single currency (the account's
             *     current settlement mode), so all rows share this unit.
             * @example 0g
             */
            currency?: string;
            data?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.UsageLogEntry"][];
            /** @example 20 */
            limit?: number;
            /**
             * @description NextCursor is the opaque token to fetch the next page via `?cursor=`.
             *     Absent on the last page. [beta]
             */
            next_cursor?: string;
            /** @example list */
            object?: string;
            /** @example 0 */
            offset?: number;
            /**
             * @description Total is the full-set count. Omitted when include_total=false (or when
             *     paging by cursor). Pointer + omitempty so absence is unambiguous.
             * @example 100
             */
            total?: number;
        };
        "github_com_0glabs_0g-router_pkg_response.UsageLogEntry": {
            /** @example abc12345 */
            api_key_id?: string;
            /**
             * @description CacheWrite1hTokens is the 1-hour-TTL portion of cache_write_tokens (disjoint
             *     from it; cache_write_tokens then carries only the default/5-minute portion).
             *     Only the Anthropic /v1/messages path reports a TTL breakdown; elsewhere it is
             *     0 and cache_write_tokens carries the whole write count. Reflects volume, not
             *     billing. [beta]
             * @example 0
             */
            cache_write_1h_tokens?: number;
            /**
             * @description CacheWriteTokens is the provider-reported cache-WRITE (creation) subset of
             *     input_tokens (the pair of cached_tokens). Non-zero whenever the provider
             *     reports cache-creation tokens — it reflects volume, not billing: it does
             *     NOT imply a premium was charged. When a cache-write premium is active it
             *     prices these tokens above the plain prompt rate in `cost`; otherwise they
             *     bill at the plain rate. Disjoint from cached_tokens, and input_tokens
             *     already includes both (input_tokens = plain + cached_tokens +
             *     cache_write_tokens) — do not add them on top of input_tokens. [beta]
             * @example 0
             */
            cache_write_tokens?: number;
            /**
             * @description cache-READ subset of input_tokens (billed at the read-discount rate)
             * @example 40
             */
            cached_tokens?: number;
            /**
             * @description CanonicalID is the registry-resolved canonical model id captured at
             *     billing time. Empty when the underlying on-chain `model_id` isn't a
             *     registered canonical / alias (same '' = "unmapped" sentinel as
             *     providers.canonical_id). Clients that need a non-empty display string
             *     should render `canonical_id || model_id`. `model_id` remains the
             *     on-chain literal so per-endpoint drill-down still works. [beta]
             * @example glm-5
             */
            canonical_id?: string;
            /** @example 150000000000000 */
            cost?: string;
            /** @example 2024-01-15T10:30:00Z */
            created_at?: string;
            /**
             * @description CreditUsed is the part of `cost` paid with promotional credit, in `cost`'s unit.
             *     For a USD account billed through 0G Pay it is settled shortly after the
             *     charge (normally within seconds); until then it reads "0" and
             *     `deposit_used` carries the whole `cost`.
             * @example 50000000000000
             */
            credit_used?: string;
            /**
             * @description DepositUsed is the part of `cost` paid from the account's own funds, in
             *     `cost`'s unit. `credit_used + deposit_used` can be less than `cost` when
             *     the balance did not cover the charge; the difference is the amount owed.
             * @example 100000000000000
             */
            deposit_used?: string;
            /** @example 1 */
            id?: number;
            /** @example 100 */
            input_tokens?: number;
            /** @example qwen-2.5-7b-instruct */
            model_id?: string;
            /** @example 50 */
            output_tokens?: number;
            /** @example 0x1234... */
            provider_address?: string;
            /**
             * @description ProviderIdentity is the same-model upstream that served the request
             *     (aliyun vs zhipu under one broker address). Empty (omitted) for a legacy
             *     single-upstream row — parity with provider_address. [beta]
             * @example aliyun
             */
            provider_identity?: string;
            /** @example req_abc123 */
            request_id?: string;
            /**
             * @description TrustMode is the trust tier of the provider that served the request.
             *     Always emitted; empty string for rows that pre-date the dimension
             *     (clients render as "—"). usage_logs.trust_mode is NOT NULL DEFAULT
             *     '' (AutoMigrate creates the column that way), so the value is
             *     either a tier name or ''.
             *
             *     '' now covers a second case besides legacy rows: a provider whose
             *     registered tier signal the router could not classify records no
             *     tier rather than being filed under one (see trustmode.FromProvider).
             *     The two are indistinguishable on the wire and both mean "no tier
             *     known" — do not read '' as a tier, and do not fold it into one.
             * @example verified
             */
            trust_mode?: string;
        };
        "github_com_0glabs_0g-router_pkg_response.UsageStatsResponse": {
            /** @example 4345 */
            completion_tokens?: number;
            /**
             * @description Currency is the unit of TotalCost: "0g" (wei) or "usd" (micro-USD). The
             *     figures are already filtered to a single currency (the account's current
             *     settlement mode), so a client renders TotalCost in this unit without a
             *     second lookup and never mislabels wei as USD.
             * @example 0g
             */
            currency?: string;
            /** @example 8000 */
            prompt_tokens?: number;
            /** @example 1000000000000000 */
            total_cost?: string;
            /** @example 42 */
            total_requests?: number;
            /** @example 12345 */
            total_tokens?: number;
        };
        "github_com_0glabs_0g-router_pkg_routingpolicy.MaxPriceUSD": {
            /** @example 10 */
            completion?: number;
            /** @example 0.04 */
            image?: number;
            /** @example 2.5 */
            prompt?: number;
        };
        "github_com_0glabs_0g-router_pkg_routingpolicy.Policy": {
            /**
             * @description AllowFallbacks: whether a failed request may move to another provider.
             * @example true
             */
            allow_fallbacks?: boolean;
            /**
             * @description AllowedModels / BlockedModels: canonical model ids.
             * @example [
             *       "glm-5"
             *     ]
             */
            allowed_models?: string[];
            /** @description AllowedProviders / BlockedProviders: see ProviderRef. */
            allowed_providers?: components["schemas"]["github_com_0glabs_0g-router_pkg_routingpolicy.ProviderRef"][];
            /**
             * @example [
             *       "claude-opus-5"
             *     ]
             */
            blocked_models?: string[];
            blocked_providers?: components["schemas"]["github_com_0glabs_0g-router_pkg_routingpolicy.ProviderRef"][];
            /**
             * @description EncryptedTransit: "off" | "preferred" | "required".
             * @example preferred
             */
            encrypted_transit?: string;
            max_price_usd?: components["schemas"]["github_com_0glabs_0g-router_pkg_routingpolicy.MaxPriceUSD"];
            /**
             * @description RequireParameters: route only to providers that advertise every
             *     sampling / reasoning parameter the request uses.
             * @example false
             */
            require_parameters?: boolean;
            /**
             * @description Sort: "price" | "latency".
             * @example price
             */
            sort?: string;
            /**
             * @description TrustMode: "standard" | "verified" | "private" (a floor).
             * @example verified
             */
            trust_mode?: string;
        };
        "github_com_0glabs_0g-router_pkg_routingpolicy.ProviderRef": {
            /** @example 0x1234567890abcdef1234567890abcdef12345678 */
            address?: string;
            /** @example aliyun */
            identity?: string;
        };
        "github_com_0glabs_0g-router_pkg_routingpolicy.Warning": {
            /** @example unknown_provider */
            code?: string;
            /** @example blocked_providers */
            field?: string;
            /** @example no provider currently matches *\/acme */
            message?: string;
        };
        "internal_handler.AccountRoutingExplainExclusion": {
            /**
             * @description Layer is the level whose rule excluded the provider (account |
             *     api_key); absent
             *     for a condition of the provider itself (unhealthy, expired, not_capable,
             *     settlement_currency, not_billable, not_ranked).
             * @example api_key
             */
            layer?: string;
            /**
             * @description Reason: unhealthy | expired | not_capable | not_allowed | blocked |
             *     below_trust_mode | not_encryptable | over_price_cap |
             *     settlement_currency | not_billable | not_ranked.
             * @example over_price_cap
             */
            reason?: string;
        };
        "internal_handler.AccountRoutingExplainOutcome": {
            /** @example provider_not_allowed */
            code?: string;
            /** @example provider not allowed: no provider of glm-5.3 passes the provider rules (allowed by api_key) */
            message?: string;
            /** @example false */
            ok?: boolean;
            /** @example 403 */
            status?: number;
        };
        "internal_handler.AccountRoutingExplainProvider": {
            /** @example 0x1234567890abcdef */
            address?: string;
            architecture?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ModelArchitecture"];
            /**
             * @description [beta] Canonical model id this endpoint serves; empty if unmapped
             * @example glm-5.1
             */
            canonical_id?: string;
            context_length?: number;
            default_parameters?: {
                [key: string]: unknown;
            };
            /**
             * @description Exclusions lists why an excluded provider is excluded, every reason
             *     that applies, the one routing meets first first.
             */
            exclusions?: components["schemas"]["internal_handler.AccountRoutingExplainExclusion"][];
            /** @description Upstream model availability expiration (RFC3339); empty = no expiration. Only visible before the instant — an expired endpoint drops out of this listing entirely. */
            expiration_date?: string;
            /**
             * @description nil=unknown, true=healthy, false=unhealthy
             * @example true
             */
            is_healthy?: boolean;
            /**
             * @description nil=no health data
             * @example 150
             */
            latency?: number;
            max_completion_tokens?: number;
            /** @example qwen-2.5-7b-instruct */
            model_id?: string;
            /** @description Model metadata (populated when listing providers for a specific model) */
            name?: string;
            pricing?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ModelPricing"];
            /** @description Per-token USD prices; only set when upstream metadata provides them */
            pricing_usd?: components["schemas"]["github_com_0glabs_0g-router_pkg_response.ModelPricing"];
            /** @description [beta] Operator-declared serving country/locality */
            provider_country?: string;
            /**
             * @description ProviderIdentity distinguishes two same-model candidates served by one
             *     broker (same address) via different upstreams (e.g. glm-5.2 via aliyun vs
             *     zhipu). Empty (omitted) for a legacy single-upstream endpoint, so the two
             *     rows for one address+model are otherwise indistinguishable without it.
             * @example aliyun
             */
            provider_identity?: string;
            /**
             * @description Operator-declared, descriptive endpoint identity/locality (from the
             *     broker's /models metadata). Empty when the operator did not declare them.
             */
            provider_name?: string;
            /**
             * @description Route: primary | fallback | not_used (routable, but fallbacks are
             *     off) | skipped (a retry passes it over: the same upstream — its
             *     provider_identity, or its whole address when it has none — already
             *     failed in an earlier attempt) | not_tried (past the retry budget, or
             *     the request fails before routing) | excluded.
             * @example fallback
             */
            route?: string;
            /** @example chatbot */
            service_type?: string;
            /** @description [beta] Operator-declared serving domain. Present only on `verified` / `private` endpoints; never on `standard` */
            serving_domain?: string;
            supported_formats?: string[];
            supported_parameters?: string[];
            /** @example true */
            tee_acknowledged?: boolean;
            tee_attested?: boolean;
            tee_type?: string;
            tee_verifier?: string;
            /**
             * @description TieGroup numbers, from 1 in order, the routable providers that are equal
             *     on the sort's key (price, latency, or failure count for the default
             *     ranking). Routing spreads traffic across a group, so within one the
             *     order, and with it which member shows as primary or as which fallback,
             *     is not a ranking and can change from one call to the next. Suggested
             *     display: a group of one as "Primary" or "Fallback N" (N counted along
             *     the array); a larger group as a whole, "shares traffic · attempts k–m".
             *     Absent for an excluded provider.
             * @example 1
             */
            tie_group?: number;
            /** @description [beta] Routable trust tier of this endpoint: standard | verified | private. Derived from provider_type — the authoritative tier signal (verifiability is a descriptive TEE label and is empty for standard). Use this to match a request's provider.trust_mode / X-0G-Provider-Trust-Mode floor. ABSENT when the endpoint registered a tier signal the router has no mapping for: read that as "not classified" rather than substituting a tier, and note such an endpoint is not selected by any trust-mode request (it still serves requests that ask for no tier). */
            trust_mode?: string;
            type?: string;
            /**
             * @description nil=no health data
             * @example 99.5
             */
            uptime?: number;
            verifiability?: string;
        };
        "internal_handler.AccountRoutingExplainRequest": {
            /**
             * @description AccountRouting previews these account rules instead of the saved ones
             *     (unsaved edits on the Routing page). Same shape and validation as PUT
             *     /v1/account/routing.
             */
            account_routing?: components["schemas"]["github_com_0glabs_0g-router_pkg_routingpolicy.Policy"];
            /**
             * @description APIFormat is the chatbot surface explained: openai
             *     (/v1/chat/completions, the default) | anthropic (/v1/messages). Each
             *     endpoint routes only to providers of its own format, so there is no
             *     "either": a preview mixing both would rank providers no request uses.
             * @example openai
             */
            api_format?: string;
            /**
             * @description APIKeyID previews the routing of requests made with this key (one of
             *     the caller's own inference keys), under its saved rules.
             * @example 3f2a6c1e-8d4b-4f0a-9c7e-1b2d3e4f5a6b
             */
            api_key_id?: string;
            /**
             * @description APIKeyRouting previews these key rules instead of the saved ones —
             *     unsaved edits in the key dialog, or a key not created yet (without
             *     api_key_id). Same shape and validation as PUT /v1/api-keys/{keyId}/routing.
             */
            api_key_routing?: components["schemas"]["github_com_0glabs_0g-router_pkg_routingpolicy.Policy"];
            /**
             * @description Model is required: any name the router accepts (canonical id or alias).
             * @example glm-5.3
             */
            model?: string;
            /**
             * @description ServiceType defaults to chatbot. Same vocabulary as /v1/routing/preview.
             * @example chatbot
             */
            service_type?: string;
        };
        "internal_handler.AccountRoutingExplainResponse": {
            /** @example true */
            allow_fallbacks?: boolean;
            /** @example glm-5.3 */
            canonical_id?: string;
            /**
             * @description EncryptedTransit is the effective end-to-end encryption requirement:
             *     off | preferred (the default) | required. Under required only
             *     providers a request can be sealed to are routable, and a request that
             *     is not end-to-end encrypted is refused.
             * @example preferred
             */
            encrypted_transit?: string;
            /**
             * @description MaxAttempts is how many providers a request tries at most.
             * @example 4
             */
            max_attempts?: number;
            /** @example glm-5.3 */
            model?: string;
            /** @example routing.explanation */
            object?: string;
            outcome?: components["schemas"]["internal_handler.AccountRoutingExplainOutcome"];
            /**
             * @description Providers are the routable rows first, in the order a request tries
             *     them, then the excluded rows. The order is part of the contract.
             */
            providers?: components["schemas"]["internal_handler.AccountRoutingExplainProvider"][];
            /**
             * @description Routable is how many providers a request could use (0 when the
             *     request is refused).
             * @example 4
             */
            routable?: number;
            /**
             * @description RuleSources names, for each rule the account or the API key sets, the
             *     level whose value applies: account | api_key (a key's own value
             *     replaces the account's). Keys are the routing policy's field names,
             *     max_price_usd's dimensions one by one (max_price_usd.prompt, …).
             * @example {
             *       "sort": "api_key",
             *       "trust_mode": "account"
             *     }
             */
            rule_sources?: {
                [key: string]: string;
            };
            /** @example chatbot */
            service_type?: string;
            /**
             * @description Settlement is the account's settlement currency, which decides price
             *     ordering and which providers can bill it: 0g | usd.
             * @example 0g
             */
            settlement?: string;
            /**
             * @description Sort is the effective provider order: price | latency | default (the
             *     router's health-aware ranking: fewest recent failures, then latency).
             * @example price
             */
            sort?: string;
            /**
             * @description Total is every acknowledged provider row of the model, not paged: the
             *     length of Providers.
             * @example 6
             */
            total?: number;
        };
        "internal_handler.AnnounceModelIncidentRequest": {
            /** @example claude-sonnet-5.5 */
            model?: string;
            /** @description StartedAt defaults to now; RFC3339, within the last 7 days. */
            started_at?: string;
            /**
             * @description outage | degraded
             * @example outage
             */
            status?: string;
        };
        "internal_handler.AnnounceModelRemovalRequest": {
            /** @example gpt-5-mini */
            model?: string;
            /**
             * @description RemovalAt is when the model goes away (RFC3339, in the future).
             *     Required unless sudden.
             * @example 2026-11-30T00:00:00Z
             */
            removal_at?: string;
            /**
             * @description Replacement is the model to switch to, named in the notices.
             * @example gpt-6.1-sol
             */
            replacement?: string;
            /**
             * @description Sudden: the model is already gone upstream. removal_at is now and the
             *     "has been removed" entry goes out at once.
             */
            sudden?: boolean;
        };
        "internal_handler.AutoRankingVersion": {
            /** @description Active is true for the version the router serves. */
            active?: boolean;
            /**
             * @description CheckedAt is the last time the leaderboard was read and gave this
             *     ranking.
             */
            checked_at?: string;
            created_at?: string;
            id?: number;
            rejected?: boolean;
            source?: string;
            /** @description Tasks maps each task to its models, best first. */
            tasks?: {
                [key: string]: string[];
            };
            /**
             * @description Unmapped are leaderboard names that matched no 0G model and are not
             *     listed as absent from 0G; left out of the ranking.
             */
            unmapped?: string[];
        };
        "internal_handler.AutoRankingVersionList": {
            data?: components["schemas"]["internal_handler.AutoRankingVersion"][];
        };
        "internal_handler.BalanceAlertSettings": {
            amount_enabled?: boolean;
            /** @example 20 */
            amount_usd?: number;
            /**
             * @description DailyAverageUSD is the 7-day average daily spend the days-left alert
             *     divides the balance by; null when nothing was spent in 7 days. Read-only.
             * @example 6.10
             */
            daily_average_usd?: string;
            /** @example 3 */
            days?: number;
            days_enabled?: boolean;
        };
        "internal_handler.BroadcastListResponse": {
            data?: components["schemas"]["github_com_0glabs_0g-router_internal_model.Broadcast"][];
        };
        "internal_handler.ChannelSettings": {
            console?: boolean;
            email?: boolean;
        };
        "internal_handler.CreatePartnerRequest": {
            /** @example tech@foopartner.com */
            contact_email?: string;
            /** @example foopartner */
            id: string;
            /** @example https://foopartner.com */
            link?: string;
            /** @example https://cdn.example/logo.png */
            logo_url?: string;
            /** @example FooPartner */
            name: string;
        };
        "internal_handler.CreateWebhookRequest": {
            /**
             * @example [
             *       "balance.low",
             *       "model.down"
             *     ]
             */
            events?: string[];
            /** @example https://example.com/hooks/0g */
            url?: string;
        };
        "internal_handler.ModelIncidentListResponse": {
            data?: components["schemas"]["github_com_0glabs_0g-router_internal_model.ModelIncident"][];
        };
        "internal_handler.ModelRemovalListResponse": {
            data?: components["schemas"]["github_com_0glabs_0g-router_internal_model.ModelRemoval"][];
        };
        "internal_handler.NotificationCategories": {
            low_balance?: components["schemas"]["internal_handler.ChannelSettings"];
            model_status?: components["schemas"]["internal_handler.ChannelSettings"];
            new_models?: components["schemas"]["internal_handler.ChannelSettings"];
            news?: components["schemas"]["internal_handler.ChannelSettings"];
        };
        "internal_handler.NotificationListResponse": {
            data?: components["schemas"]["github_com_0glabs_0g-router_internal_model.Notification"][];
            has_more?: boolean;
            next_before?: number;
            unread_count?: number;
        };
        "internal_handler.NotificationSettingsPatchRequest": {
            balance_alert?: {
                amount_enabled?: boolean;
                amount_usd?: number;
                days?: number;
                days_enabled?: boolean;
            };
            notifications?: {
                low_balance?: components["schemas"]["internal_handler.channelPatch"];
                model_status?: components["schemas"]["internal_handler.channelPatch"];
                new_models?: components["schemas"]["internal_handler.channelPatch"];
                news?: components["schemas"]["internal_handler.channelPatch"];
            };
        };
        "internal_handler.NotificationSettingsResponse": {
            balance_alert?: components["schemas"]["internal_handler.BalanceAlertSettings"];
            notifications?: components["schemas"]["internal_handler.NotificationCategories"];
        };
        "internal_handler.ResolveModelIncidentRequest": {
            /** @description ResolvedAt defaults to now; RFC3339, after started_at. */
            resolved_at?: string;
        };
        "internal_handler.RoutePreviewAutoResult": {
            enabled?: boolean;
            model?: string;
            task?: string;
        };
        "internal_handler.RoutePreviewCandidate": {
            address?: string;
            canonical_id?: string;
            endpoint?: string;
            model_id?: string;
            /**
             * @description ProviderIdentity is empty (omitted) for a row whose broker reports no
             *     upstream identity — which is a property of the PROVIDER TYPE, not of how
             *     many upstreams it fronts. The broker writes ProviderIdentity into its
             *     on-chain AdditionalInfo only for centralized forwarders (and requires it
             *     there, for a single upstream as much as for ten); provider_lister resolves
             *     it per model, preferring the /models entry's own value over that
             *     service-level one. A decentralized (TeeML) endpoint carries '' however
             *     many models it serves. So presence means "this broker names its upstream",
             *     never "this broker has more than one" — the two coincide only by accident
             *     of who happens to be multi-upstream today.
             *
             *     Omitted rather than emitted empty, for parity with provider_identity on
             *     GET /v1/providers and the usage endpoints, and with the pin itself:
             *     X-0G-Provider-Identity unset and set to "" mean the same thing to
             *     resolvePinnedVariant.
             * @example aliyun
             */
            provider_identity?: string;
        };
        "internal_handler.RoutePreviewRequest": {
            /** @description OPTIONAL, chatbot only: openai | anthropic; empty = any format */
            api_format?: string;
            /**
             * @description Auto is required, and read only, when model is "0g/auto": the task to
             *     choose a model for, and constraints on the choice. [beta]
             *     Kept raw and decoded only for "0g/auto" with the feature on, so the
             *     field is ignored otherwise, as it was before it existed.
             */
            auto?: Record<string, never>;
            /** @description OPTIONAL: canonical id (or alias / on-chain id); empty = any provider of this service type */
            model?: string;
            /** @description chatbot | text-to-image | image-editing | speech-to-text | embedding | decisions */
            service_type?: string;
        };
        "internal_handler.RoutePreviewResponse": {
            /**
             * @description Auto is present for model "0g/auto": the task the model was chosen for
             *     and the model chosen, whose providers are listed. [beta]
             */
            auto?: components["schemas"]["internal_handler.RoutePreviewAutoResult"];
            /**
             * @description EncryptedTransit is the request's effective end-to-end encryption
             *     requirement — the account's, API key's and X-0G-Encrypted-Transit's
             *     values merged (each level may only make it stricter than the one
             *     before): off (send in plaintext), preferred (encrypt when the model
             *     can be, the default) or required (encrypt, or refuse the request;
             *     every candidate listed can be sealed to). For the E2EE gateway, which
             *     enforces it. [beta]
             * @example preferred
             */
            encrypted_transit?: string;
            object?: string;
            providers?: components["schemas"]["internal_handler.RoutePreviewCandidate"][];
            service_type?: string;
        };
        "internal_handler.SendBroadcastRequest": {
            /** @example Run large jobs at half price. */
            body?: string;
            /**
             * @description new_models | news
             * @example news
             */
            category?: string;
            /** @description Force sends a news broadcast within 7 days of the last one. */
            force?: boolean;
            /**
             * @description Link (news only) is an https URL the entry opens.
             * @example https://0g.ai/blog/batch
             */
            link?: string;
            /**
             * @description Model (new_models only) is the model the entry links to the playground for.
             * @example gpt-6.1-sol
             */
            model?: string;
            /** @example Batch API is live */
            title?: string;
        };
        "internal_handler.UnreadCountResponse": {
            unread_count?: number;
        };
        "internal_handler.UpdatePartnerRequest": {
            contact_email?: string;
            link?: string;
            logo_url?: string;
            /** @example FooPartner (renamed) */
            name?: string;
            /** @example active */
            status?: string;
        };
        "internal_handler.UploadFileResponse": {
            /** @example 2026-03-01T14:00:00Z */
            expires_at?: string;
            /** @example document.pdf */
            filename?: string;
            /** @example file-abc123 */
            id?: string;
            /** @example application/pdf */
            mime_type?: string;
            /** @example 1024 */
            size?: number;
        };
        "internal_handler.WebSearchBilling": {
            /** @example usd */
            currency?: string;
            /** @example 20000 */
            total_cost?: string;
            /** @example 20000 */
            web_search_cost?: string;
        };
        "internal_handler.WebSearchRequest": {
            /**
             * @description Query is the search query, 1–400 characters.
             * @example latest stable Python release
             */
            query?: string;
        };
        "internal_handler.WebSearchResponse": {
            query?: string;
            results?: components["schemas"]["internal_handler.WebSearchResult"][];
            x_0g_trace?: components["schemas"]["internal_handler.WebSearchTrace"];
        };
        "internal_handler.WebSearchResult": {
            /** @description Content is an excerpt of the page relevant to the query. */
            content?: string;
            /**
             * @description PublishedDate is the page's publication date (YYYY-MM-DD) when known.
             * @example 2026-09-30
             */
            published_date?: string;
            /** @example Python 3.14.8 */
            title?: string;
            /** @example https://www.python.org/downloads/release/python-3148/ */
            url?: string;
        };
        "internal_handler.WebSearchTrace": {
            billing?: components["schemas"]["internal_handler.WebSearchBilling"];
            request_id?: string;
        };
        "internal_handler.WebhookCreatedResponse": {
            created_at?: string;
            disabled_at?: string;
            /**
             * @example [
             *       "balance.low",
             *       "model.down"
             *     ]
             */
            events?: string[];
            /** @example 12 */
            id?: number;
            last_delivery?: components["schemas"]["github_com_0glabs_0g-router_internal_service.WebhookLastDelivery"];
            /**
             * @description PreviousSecretExpiresAt is set during a rotation's grace window, while
             *     deliveries are also signed with the previous secret.
             */
            previous_secret_expires_at?: string;
            /** @example whsec_9b1f… */
            secret?: string;
            /**
             * @description Status is healthy (last delivery succeeded), failing (it did not),
             *     no_deliveries (nothing sent yet) or disabled (failed for 3 days; no
             *     longer delivered to).
             * @example healthy
             */
            status?: string;
            /** @example https://example.com/hooks/0g */
            url?: string;
        };
        "internal_handler.WebhookDeliveryListResponse": {
            data?: components["schemas"]["github_com_0glabs_0g-router_internal_service.WebhookDeliveryView"][];
            has_more?: boolean;
            next_before?: number;
        };
        "internal_handler.WebhookListResponse": {
            data?: components["schemas"]["github_com_0glabs_0g-router_internal_service.WebhookEndpointView"][];
        };
        "internal_handler.WebhookSecretResponse": {
            /**
             * @description PreviousSecretExpiresAt: until then deliveries are also signed with the
             *     previous secret.
             */
            previous_secret_expires_at?: string;
            /** @example whsec_9b1f… */
            secret?: string;
        };
        "internal_handler.batchGrantRequest": {
            grants: components["schemas"]["github_com_0glabs_0g-router_internal_service.GrantCreditRequest"][];
        };
        "internal_handler.channelPatch": {
            console?: boolean;
            email?: boolean;
        };
        "internal_handler.createAdminScopedKeyRequest": {
            /**
             * @description Expiration is optional: RFC3339 (e.g. 2026-12-31T23:59:59+08:00) or
             *     "no_expiration"/empty for a non-expiring key. Same grammar as
             *     ParseExpiration elsewhere.
             */
            expiration?: string;
            name: string;
            /**
             * @description RateLimitRPM optionally caps this key at N requests per minute across
             *     the admin endpoints it can reach; omitted/null = no per-key cap. Must be
             *     ≥ 1 when set (400 invalid_rate_limit otherwise).
             * @example 30
             */
            rate_limit_rpm?: number;
            /** @description admin-only scopes, e.g. ["usage:read"] */
            scopes: string[];
        };
        "internal_handler.putAdminRoleRequest": {
            scopes?: string[];
        };
        "internal_handler.setSettlementModeRequest": {
            /**
             * @description "0g" or "usd"
             * @example usd
             */
            mode?: string;
        };
        "internal_handler.stripeCheckoutRequest": {
            amount_micro: string;
            cancel_url?: string;
            /**
             * @description Email (optional) → Stripe customer_email: prefills the email field + gets
             *     the receipt. Not persisted server-side.
             */
            email?: string;
            /**
             * @description SuccessURL (required) / CancelURL (optional) → the browser return targets.
             *     The frontend owns the path (e.g. its locale prefix); the backend validates
             *     only the origin against auth.allowed_origins. There is no server-side
             *     default — success_url must be supplied on every request.
             */
            success_url: string;
        };
        "internal_handler.updateProjectGrantRequest": {
            /** @description "active" | "paused" */
            status: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: {
        /** @description Routing rules */
        "github_com_0glabs_0g-router_pkg_routingpolicy.Policy": {
            content: {
                "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_routingpolicy.Policy"];
            };
        };
        /** @description Image generation request */
        "github_com_0glabs_0g-router_pkg_inference.ImageGenerationRequest": {
            content: {
                "application/json": components["schemas"]["github_com_0glabs_0g-router_pkg_inference.ImageGenerationRequest"];
            };
        };
    };
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
