# 0G Router OpenAPI excerpt

Source: `docs/spike/openapi.yaml` — generated 2026-11-05T15:28:24.352Z

## GET /v1/account

Path in spec: `/account`

Get account

### 2xx response
```json
{
  "description": "Account metadata",
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "address": {
            "type": "string",
            "example": "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
          },
          "created_at": {
            "type": "string",
            "example": "2026-01-15T10:30:00Z"
          },
          "og_mode_available": {
            "description": "OgModeAvailable is false when the account is on USD, holds no 0G funds\nand is not offered the 0G settlement mode, so a client hides the 0G↔USD\nswitch. An account on 0G or with a 0G balance always reads true. [beta]",
            "type": "boolean",
            "example": true
          },
          "onboarded_at": {
            "type": "string",
            "example": "2026-01-15T10:35:00Z"
          }
        }
      }
    }
  }
}
```

## GET /v1/account/balance

Path in spec: `/account/balance`

Get account balance

### 2xx response
```json
{
  "description": "Balance info",
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "address": {
            "type": "string",
            "example": "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
          },
          "balance": {
            "description": "backward compat = total",
            "type": "string",
            "example": "1000000000000000000"
          },
          "credit_balance": {
            "type": "string",
            "example": "100000000000000000"
          },
          "currency": {
            "description": "Currency is the unit of the amount fields: \"0g\" (wei, default) or \"usd\"\n(micro-USD, USD*1e6). Omitted-value clients that predate USD mode read\nonly \"0g\" accounts, so the field is additive and backward-compatible. In\nUSD mode deposit_balance carries the account's own funds and\ncredit_balance the granted USD credit. Where 0G Pay serves the account's\nbilling, both come from there — so for such an account a top-up credited\nlocally rather than to 0G Pay is not part of this figure. There is no vault/defer, but the USD\nwallet CAN owe recoverable debt (a chargeback or an over-cost charge drives\nit negative); that debt is surfaced in **pending_charge** (= the owed\namount), with deposit_balance/total_balance clamped to ≥0 — mirroring how\nthe 0G path expresses debt, so the ≥0 contract above holds in both modes.\nThe true signed net (which may be negative) is on GET /account/funds. [beta]",
            "type": "string",
            "example": "0g"
          },
          "deposit_balance": {
            "type": "string",
            "example": "900000000000000000"
          },
          "pending_charge": {
            "type": "string",
            "example": "0"
          },
          "total_balance": {
            "type": "string",
            "example": "1000000000000000000"
          },
          "unsettled_charge": {
            "description": "UnsettledCharge (micro-USD) is present only for USD accounts whose\nbilling 0G Pay serves: charges already made that have not been sent to\n0G Pay yet, so they are not reflected in the other amounts here or in\n0G Pay's own balance. Subtract it to show the balance after those\ncharges. A charge leaves this figure when it is sent, a few seconds\nafter the reply, so while 0G Pay is slow to accept it the other amounts\ncan briefly read high; the figure never counts a charge 0G Pay may\nalready have applied. Absent when it could not be read. [beta]",
            "type": "string",
            "example": "87"
          }
        }
      }
    }
  }
}
```

## GET /v1/account/funds

Path in spec: `/account/funds`

Get unified account funds

### 2xx response
```json
{
  "description": "Unified funds view",
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "address": {
            "type": "string",
            "example": "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
          },
          "currency": {
            "description": "Currency is the unit of all amount fields: \"0g\" (wei, default) or \"usd\"\n(micro-USD). In USD mode there is no vault, so payment_layer.balance is\n\"0\" and total = router.subtotal = balance + credit. [beta]",
            "type": "string",
            "example": "0g"
          },
          "payment_layer": {
            "type": "object",
            "properties": {
              "balance": {
                "type": "string",
                "example": "7086440000000000000"
              },
              "queried_at": {
                "type": "string",
                "example": "2026-05-25T16:21:00Z"
              },
              "shared_across_products": {
                "type": "boolean",
                "example": true
              }
            }
          },
          "router": {
            "type": "object",
            "properties": {
              "credit": {
                "type": "string",
                "example": "3560000000000000"
              },
              "deposit": {
                "type": "string",
                "example": "300000000000000000"
              },
              "pending_charge": {
                "type": "string",
                "example": "0"
              },
              "subtotal": {
                "type": "string",
                "example": "303560000000000000"
              },
              "unsettled_charge": {
                "description": "UnsettledCharge (micro-USD) is present only for USD accounts whose\nbilling 0G Pay serves: charges already made that have not been sent to\n0G Pay yet, so they are not reflected in the other amounts here or in\n0G Pay's own balance. Subtract it to show the balance after those\ncharges. A charge leaves this figure when it is sent, a few seconds\nafter the reply, so while 0G Pay is slow to accept it the other amounts\ncan briefly read high; the figure never counts a charge 0G Pay may\nalready have applied. Absent when it could not be read. [beta]",
                "type": "string",
                "example": "87"
              }
            }
          },
          "total": {
            "type": "string",
            "example": "7390000000000000000"
          }
        }
      }
    }
  }
}
```

## GET /v1/account/usage/history

Path in spec: `/account/usage/history`

Get usage history

### Parameters
```json
[
  {
    "description": "Limit number of records",
    "name": "limit",
    "in": "query",
    "schema": {
      "type": "integer",
      "default": 20
    }
  },
  {
    "description": "Offset for pagination (legacy). Ignored when `cursor` is set.",
    "name": "offset",
    "in": "query",
    "schema": {
      "type": "integer",
      "default": 0
    }
  },
  {
    "description": "[beta] Opaque keyset cursor from a prior page's `next_cursor`. When set, pages via seek (constant per-page cost, independent of depth) and `offset` is ignored; also forces `include_total=false`.",
    "name": "cursor",
    "in": "query",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "[beta] Include the full-set `total` count (default true). Set false to skip the expensive COUNT(*); recommended with `cursor`.",
    "name": "include_total",
    "in": "query",
    "schema": {
      "type": "boolean",
      "default": true
    }
  },
  {
    "description": "Filter by model ID",
    "name": "model_id",
    "in": "query",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Filter by API key ID",
    "name": "api_key_id",
    "in": "query",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Filter by source: 'wallet' (JWT/browser), 'api_key' (any API key), or omit for all",
    "name": "source",
    "in": "query",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Start date (YYYY-MM-DD, inclusive)",
    "name": "start_date",
    "in": "query",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "End date (YYYY-MM-DD, inclusive)",
    "name": "end_date",
    "in": "query",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Filter by trust tier: 'standard' | 'verified' | 'private'. Omit for all tiers.",
    "name": "trust_mode",
    "in": "query",
    "schema": {
      "type": "string"
    }
  }
]
```
### 2xx response
```json
{
  "description": "Usage history list",
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "currency": {
            "description": "Currency is the unit of each row's cost/*_used fields: \"0g\" (wei) or \"usd\"\n(micro-USD). The list is filtered to a single currency (the account's\ncurrent settlement mode), so all rows share this unit.",
            "type": "string",
            "example": "0g"
          },
          "data": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/github_com_0glabs_0g-router_pkg_response.UsageLogEntry"
            }
          },
          "limit": {
            "type": "integer",
            "example": 20
          },
          "next_cursor": {
            "description": "NextCursor is the opaque token to fetch the next page via `?cursor=`.\nAbsent on the last page. [beta]",
            "type": "string",
            "x-stability": "beta"
          },
          "object": {
            "type": "string",
            "example": "list"
          },
          "offset": {
            "type": "integer",
            "example": 0
          },
          "total": {
            "description": "Total is the full-set count. Omitted when include_total=false (or when\npaging by cursor). Pointer + omitempty so absence is unambiguous.",
            "type": "integer",
            "example": 100
          }
        }
      }
    }
  }
}
```

## GET /v1/api-keys

Path in spec: `/api-keys`

Get API key list

### Parameters
```json
[
  {
    "description": "Filter: active / revoked / expired / all (default all)",
    "name": "status",
    "in": "query",
    "schema": {
      "type": "string"
    }
  }
]
```
### 2xx response
```json
{
  "description": "API key list",
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "data": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/github_com_0glabs_0g-router_pkg_response.APIKeyItem"
            }
          },
          "object": {
            "type": "string",
            "example": "list"
          }
        }
      }
    }
  }
}
```

## POST /v1/api-keys

Path in spec: `/api-keys`

Create API key

### Request body
```json
{
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "allowed_models": {
            "description": "AllowedModels is an optional allowlist of model IDs this key may\ninvoke. Nil = no restriction. Empty slice = explicit empty list,\nrejected at validation (a key that can call no models is useless).",
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "allowed_providers": {
            "description": "AllowedProviders is an optional allowlist of provider addresses\n(hex, 0x-prefixed) this key may target. Same nil-vs-empty convention\nas AllowedModels.",
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "credit_limit": {
            "description": "0G units; nil = unlimited",
            "type": "string"
          },
          "expiration": {
            "description": "RFC3339, \"no_expiration\", or \"\"",
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "reset_period": {
            "description": "never/daily/weekly/monthly; \"\" → never",
            "type": "string"
          },
          "routing": {
            "description": "Routing optionally sets the key's routing rules at creation, in the\nshape PUT /v1/api-keys/{keyId}/routing takes. It includes trust_mode,\nallowed_models and allowed_providers, so set those either here or at\nthe top level, not both (400 invalid_routing_policy). [beta]",
            "allOf": [
              {
                "$ref": "#/components/schemas/github_com_0glabs_0g-router_pkg_routingpolicy.Policy"
              }
            ],
            "x-stability": "beta"
          },
          "trust_mode": {
            "description": "TrustMode optionally pins this key to a single trust tier. Accepted\nvalues: \"standard\" | \"verified\" | \"private\" | \"\" (no pin). The wire\nshape is a value type rather than a pointer because the create path has\nno \"leave unchanged\" semantics — absent / empty / explicit \"\" all mean\n\"no pin\".",
            "type": "string"
          }
        }
      }
    }
  },
  "description": "API key configuration"
}
```
### 2xx response
```json
{
  "description": "API key created",
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "allowed_models": {
            "description": "AllowedModels / AllowedProviders are ALWAYS present in the response\n(never omitted) — `[]` means \"no restriction\", a non-empty slice\nmeans \"only these\". Stable shape so clients can index without\n`field !== undefined` guards, and so a missing field cleanly\nsignals \"response truncated by middleware / bug\" rather than \"no\nallowlist\". csvToSlice in the service layer materialises an empty\nslice (not nil) for the no-allowlist case to keep the contract.",
            "type": "array",
            "items": {
              "type": "string"
            },
            "example": [
              "[\"glm-5\"]"
            ]
          },
          "allowed_providers": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "example": [
              "[\"0xabc...\"]"
            ]
          },
          "created_at": {
            "type": "string",
            "example": "2024-01-15T10:30:00Z"
          },
          "credit_limit": {
            "type": "string",
            "example": "1.5"
          },
          "currency": {
            "description": "Currency is the unit of CreditLimit / Used: \"0g\" (0G decimals) or \"usd\"\n(USD decimals), following the account's settlement mode. Without it a\nclient can't tell whether \"1.5\" means 1.5 0G or $1.50.",
            "type": "string",
            "example": "0g"
          },
          "expires_at": {
            "type": "string",
            "example": "2025-02-15T10:30:00Z"
          },
          "key": {
            "description": "Only shown once!",
            "type": "string"
          },
          "key_id": {
            "type": "string",
            "example": "abc12345"
          },
          "key_preview": {
            "type": "string",
            "example": "sk-abcde…"
          },
          "name": {
            "type": "string",
            "example": "my-api-key"
          },
          "reset_period": {
            "type": "string",
            "example": "monthly"
          },
          "revoked": {
            "type": "boolean",
            "example": false
          },
          "routing": {
            "description": "Routing is the key's routing rules, in the shape GET/PUT\n/v1/api-keys/{keyId}/routing use. trust_mode / allowed_models /\nallowed_providers above are the same rules in their original form:\nan allowed_providers entry naming an upstream identity appears there\nas \"0x…/identity\" or \"*/identity\", and PATCH accepts it back. [beta]",
            "allOf": [
              {
                "$ref": "#/components/schemas/github_com_0glabs_0g-router_pkg_routingpolicy.Policy"
              }
            ],
            "x-stability": "beta"
          },
          "status": {
            "description": "active / revoked / expired",
            "type": "string",
            "example": "active"
          },
          "trust_mode": {
            "description": "TrustMode is the trust-tier pin for this key, or nil when the key\nhas no pin (matches the API-key constraint table verbatim). Emitted\nas a pointer so callers can distinguish \"no pin\" from \"pinned to\nthe empty string\"; the latter is rejected at create time, so a nil\nvalue is the only way the field is absent in practice.",
            "type": "string",
            "example": "verified"
          },
          "used": {
            "type": "string",
            "example": "0.42"
          }
        }
      }
    }
  }
}
```

## PATCH /v1/api-keys/{id}

Path in spec: `/api-keys/{keyId}`

Update API key

### Parameters
```json
[
  {
    "description": "API Key ID",
    "name": "keyId",
    "in": "path",
    "required": true,
    "schema": {
      "type": "string"
    }
  }
]
```
### Request body
```json
{
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "allowed_models": {
            "description": "AllowedModels / AllowedProviders sparse-PATCH sentinels:\n  nil               → unchanged\n  non-nil empty []  → clear the allowlist (no restriction)\n  non-nil non-empty → replace the allowlist\n\nPointer to slice (rather than slice) so we can distinguish \"leave\nalone\" from \"clear\", matching how Scopes is handled on mgmt keys.",
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "allowed_providers": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "credit_limit": {
            "type": "string"
          },
          "expiration": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "reset_period": {
            "type": "string"
          },
          "trust_mode": {
            "description": "TrustMode sparse-PATCH sentinels: nil → unchanged; \"\" → clear the\npin (key falls back to no trust-mode restriction); any of\nstandard|verified|private → set the pin.",
            "type": "string"
          }
        }
      }
    }
  },
  "description": "Patch payload",
  "required": true
}
```
### 2xx response
```json
{
  "description": "Updated key",
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "allowed_models": {
            "description": "AllowedModels / AllowedProviders are ALWAYS present in the response\n(never omitted) — `[]` means \"no restriction\", a non-empty slice\nmeans \"only these\". Stable shape so clients can index without\n`field !== undefined` guards, and so a missing field cleanly\nsignals \"response truncated by middleware / bug\" rather than \"no\nallowlist\". csvToSlice in the service layer materialises an empty\nslice (not nil) for the no-allowlist case to keep the contract.",
            "type": "array",
            "items": {
              "type": "string"
            },
            "example": [
              "[\"glm-5\"]"
            ]
          },
          "allowed_providers": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "example": [
              "[\"0xabc...\"]"
            ]
          },
          "created_at": {
            "type": "string",
            "example": "2024-01-15T10:30:00Z"
          },
          "credit_limit": {
            "type": "string",
            "example": "1.5"
          },
          "currency": {
            "description": "Currency is the unit of CreditLimit / Used: \"0g\" (0G decimals) or \"usd\"\n(USD decimals), following the account's settlement mode. Without it a\nclient can't tell whether \"1.5\" means 1.5 0G or $1.50.",
            "type": "string",
            "example": "0g"
          },
          "expires_at": {
            "type": "string",
            "example": "2025-02-15T10:30:00Z"
          },
          "key_id": {
            "type": "string",
            "example": "abc12345"
          },
          "key_preview": {
            "type": "string",
            "example": "sk-abcde…"
          },
          "name": {
            "type": "string",
            "example": "my-api-key"
          },
          "reset_period": {
            "type": "string",
            "example": "monthly"
          },
          "revoked": {
            "type": "boolean",
            "example": false
          },
          "routing": {
            "description": "Routing is the key's routing rules, in the shape GET/PUT\n/v1/api-keys/{keyId}/routing use. trust_mode / allowed_models /\nallowed_providers above are the same rules in their original form:\nan allowed_providers entry naming an upstream identity appears there\nas \"0x…/identity\" or \"*/identity\", and PATCH accepts it back. [beta]",
            "allOf": [
              {
                "$ref": "#/components/schemas/github_com_0glabs_0g-router_pkg_routingpolicy.Policy"
              }
            ],
            "x-stability": "beta"
          },
          "status": {
            "description": "active / revoked / expired",
            "type": "string",
            "example": "active"
          },
          "trust_mode": {
            "description": "TrustMode is the trust-tier pin for this key, or nil when the key\nhas no pin (matches the API-key constraint table verbatim). Emitted\nas a pointer so callers can distinguish \"no pin\" from \"pinned to\nthe empty string\"; the latter is rejected at create time, so a nil\nvalue is the only way the field is absent in practice.",
            "type": "string",
            "example": "verified"
          },
          "used": {
            "type": "string",
            "example": "0.42"
          }
        }
      }
    }
  }
}
```

## DELETE /v1/api-keys/{id}

Path in spec: `/api-keys/{keyId}`

Revoke API key

### Parameters
```json
[
  {
    "description": "API Key ID",
    "name": "keyId",
    "in": "path",
    "required": true,
    "schema": {
      "type": "string"
    }
  }
]
```
### 2xx response
```json
{
  "description": "Revoked successfully",
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "key_id": {
            "type": "string",
            "example": "abc12345"
          },
          "message": {
            "type": "string",
            "example": "API key revoked"
          }
        }
      }
    }
  }
}
```

## GET /v1/models

Path in spec: `/models`

Get model list

### Parameters
```json
[
  {
    "description": "[beta] true: historical raw-model_id-keyed view (listing-only; an unregistered id it lists is still 404 on the inference path). Default false: canonical view (id = canonical_id).",
    "name": "legacy",
    "in": "query",
    "schema": {
      "type": "boolean"
    }
  },
  {
    "description": "[beta] 'usd': emit the OpenRouter-standard shape with per-token USD decimal strings under the top-level `pricing` field (for external pricing aggregators, e.g. TKX); models without a USD price are omitted. Default: native prices under `pricing`, USD under `pricing_usd`.",
    "name": "pricing",
    "in": "query",
    "schema": {
      "type": "string",
      "enum": [
        "usd"
      ]
    }
  },
  {
    "description": "Filter by provider address (OR: match any)",
    "name": "provider_address",
    "in": "query",
    "explode": true,
    "schema": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  {
    "description": "Filter by input modality, e.g. text, image (AND: must support all)",
    "name": "input_modality",
    "in": "query",
    "explode": true,
    "schema": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  {
    "description": "Filter by supported parameter, e.g. temperature (AND: must support all)",
    "name": "supported_parameter",
    "in": "query",
    "explode": true,
    "schema": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  }
]
```
### 2xx response
```json
{
  "description": "Model list",
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "data": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/github_com_0glabs_0g-router_pkg_response.ModelEntry"
            }
          },
          "object": {
            "type": "string",
            "example": "list"
          }
        }
      }
    }
  }
}
```

## POST /v1/chat/completions

Path in spec: `/chat/completions`

Chat completion

### Parameters
```json
[
  {
    "description": "Routing: pin to a specific provider by on-chain address (0x-prefixed).",
    "name": "X-0G-Provider-Address",
    "in": "header",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Routing: provider sort strategy. `latency` | `price`.",
    "name": "X-0G-Provider-Sort",
    "in": "header",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Routing: trust tier filter (`verified` | `private`). `verified` is a floor — `private` providers also satisfy it.",
    "name": "X-0G-Provider-Trust-Mode",
    "in": "header",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Routing: whether to retry on other providers after a failure. `true` | `false`. Defaults to false when an address is pinned, true otherwise.",
    "name": "X-0G-Provider-Allow-Fallbacks",
    "in": "header",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Routing: only these providers, comma-separated: `0x…` (every upstream behind that address), `0x…/identity` (one upstream behind it) or `*/identity` (that upstream behind every address). Combines with the API key's own allowed providers: a provider must be on both. [beta]",
    "name": "X-0G-Provider-Allow",
    "in": "header",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Routing: never these providers, same forms as X-0G-Provider-Allow. Adds to the API key's own blocked providers. [beta]",
    "name": "X-0G-Provider-Block",
    "in": "header",
    "schema": {
      "type": "string"
    }
  }
]
```
### Request body
```json
{
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "attachments": {
            "description": "File attachments (uploaded via /v1/files)",
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/github_com_0glabs_0g-router_pkg_inference.Attachment"
            }
          },
          "max_tokens": {
            "description": "Maximum output tokens",
            "type": "integer",
            "example": 1024
          },
          "messages": {
            "description": "Message list (content may be string or multimodal array)",
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/github_com_0glabs_0g-router_pkg_inference.RequestMessage"
            }
          },
          "model": {
            "description": "Model ID",
            "type": "string",
            "example": "qwen/qwen-2.5-7b-instruct"
          },
          "plugins": {
            "description": "Plugins to enable (e.g. [{\"id\":\"web\"}] for web search)",
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/github_com_0glabs_0g-router_pkg_inference.Plugin"
            }
          },
          "provider": {
            "description": "Routing preferences (0G Router extension)",
            "allOf": [
              {
                "$ref": "#/components/schemas/github_com_0glabs_0g-router_pkg_inference.ProviderPreferences"
              }
            ]
          },
          "response_format": {
            "description": "Output format: json_object or json_schema for structured output",
            "allOf": [
              {
                "$ref": "#/components/schemas/github_com_0glabs_0g-router_pkg_inference.ResponseFormat"
              }
            ]
          },
          "stream": {
            "description": "Whether to stream output",
            "type": "boolean",
            "example": false
          },
          "temperature": {
            "description": "Temperature parameter (0-2)",
            "type": "number",
            "example": 0.7
          },
          "tool_choice": {
            "description": "Which tool to use: \"none\", \"auto\", \"required\", or {\"type\":\"function\",\"function\":{\"name\":\"...\"}}"
          },
          "tools": {
            "description": "Tools (functions) the model may call",
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/github_com_0glabs_0g-router_pkg_inference.Tool"
            }
          },
          "top_p": {
            "description": "Top-p sampling parameter",
            "type": "number",
            "example": 0.9
          }
        }
      }
    }
  },
  "description": "Chat request",
  "required": true
}
```
### 2xx response
```json
{
  "description": "Chat response",
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "choices": {
            "description": "Choice list",
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/github_com_0glabs_0g-router_pkg_inference.Choice"
            }
          },
          "created": {
            "description": "Creation timestamp",
            "type": "integer",
            "example": 1677652288
          },
          "id": {
            "description": "Response ID",
            "type": "string",
            "example": "chatcmpl-123"
          },
          "model": {
            "description": "Model used",
            "type": "string",
            "example": "qwen/qwen-2.5-7b-instruct"
          },
          "object": {
            "description": "Object type",
            "type": "string",
            "example": "chat.completion"
          },
          "usage": {
            "description": "Token usage",
            "allOf": [
              {
                "$ref": "#/components/schemas/github_com_0glabs_0g-router_pkg_inference.Usage"
              }
            ]
          },
          "x_0g_trace": {
            "description": "0G trace info",
            "allOf": [
              {
                "$ref": "#/components/schemas/github_com_0glabs_0g-router_pkg_inference.TraceInfo"
              }
            ]
          }
        }
      }
    }
  }
}
```

## POST /v1/decisions

Path in spec: `/decisions`

Create decisions

### Parameters
```json
[
  {
    "description": "Routing: pin to a specific provider by on-chain address (0x-prefixed).",
    "name": "X-0G-Provider-Address",
    "in": "header",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Routing: provider sort strategy. `latency` | `price`.",
    "name": "X-0G-Provider-Sort",
    "in": "header",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Routing: trust tier filter (`verified` | `private`). `verified` is a floor — `private` providers also satisfy it.",
    "name": "X-0G-Provider-Trust-Mode",
    "in": "header",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Routing: whether to retry on other providers after a failure. `true` | `false`. Defaults to false when an address is pinned, true otherwise.",
    "name": "X-0G-Provider-Allow-Fallbacks",
    "in": "header",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Routing: only these providers, comma-separated: `0x…` (every upstream behind that address), `0x…/identity` (one upstream behind it) or `*/identity` (that upstream behind every address). Combines with the API key's own allowed providers: a provider must be on both. [beta]",
    "name": "X-0G-Provider-Allow",
    "in": "header",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Routing: never these providers, same forms as X-0G-Provider-Allow. Adds to the API key's own blocked providers. [beta]",
    "name": "X-0G-Provider-Block",
    "in": "header",
    "schema": {
      "type": "string"
    }
  }
]
```
### Request body
```json
{
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "model": {
            "description": "Model ID",
            "type": "string",
            "example": "jev-1.13"
          },
          "questions": {
            "description": "Named typed questions",
            "type": "array",
            "items": {
              "type": "integer"
            }
          },
          "state": {
            "description": "App state the questions are asked about",
            "type": "array",
            "items": {
              "type": "integer"
            }
          }
        }
      }
    }
  },
  "description": "Decisions request",
  "required": true
}
```
### 2xx response
```json
{
  "description": "Typed answers keyed by question name",
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
}
```

## POST /v1/audio/transcriptions

Path in spec: `/audio/transcriptions`

Audio transcription

### Parameters
```json
[
  {
    "description": "Routing: pin to a specific provider by on-chain address (0x-prefixed).",
    "name": "X-0G-Provider-Address",
    "in": "header",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Routing: provider sort strategy. `latency` | `price`.",
    "name": "X-0G-Provider-Sort",
    "in": "header",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Routing: trust tier filter (`verified` | `private`). `verified` is a floor — `private` providers also satisfy it.",
    "name": "X-0G-Provider-Trust-Mode",
    "in": "header",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Routing: whether to retry on other providers after a failure. `true` | `false`. Defaults to false when an address is pinned, true otherwise.",
    "name": "X-0G-Provider-Allow-Fallbacks",
    "in": "header",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Routing: only these providers, comma-separated: `0x…` (every upstream behind that address), `0x…/identity` (one upstream behind it) or `*/identity` (that upstream behind every address). Combines with the API key's own allowed providers: a provider must be on both. [beta]",
    "name": "X-0G-Provider-Allow",
    "in": "header",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Routing: never these providers, same forms as X-0G-Provider-Allow. Adds to the API key's own blocked providers. [beta]",
    "name": "X-0G-Provider-Block",
    "in": "header",
    "schema": {
      "type": "string"
    }
  }
]
```
### Request body
```json
{
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "file_base64": {
            "description": "Base64 encoded audio file",
            "type": "string",
            "example": "SGVsbG8gd29ybGQ="
          },
          "filename": {
            "description": "Filename",
            "type": "string",
            "example": "audio.mp3"
          },
          "language": {
            "description": "Audio language",
            "type": "string",
            "example": "en"
          },
          "model": {
            "description": "Model ID",
            "type": "string",
            "example": "whisper-1"
          },
          "response_format": {
            "description": "Response format",
            "type": "string",
            "example": "json"
          }
        }
      }
    },
    "multipart/form-data": {
      "schema": {
        "type": "object",
        "properties": {
          "file_base64": {
            "description": "Base64 encoded audio file",
            "type": "string",
            "example": "SGVsbG8gd29ybGQ="
          },
          "filename": {
            "description": "Filename",
            "type": "string",
            "example": "audio.mp3"
          },
          "language": {
            "description": "Audio language",
            "type": "string",
            "example": "en"
          },
          "model": {
            "description": "Model ID",
            "type": "string",
            "example": "whisper-1"
          },
          "response_format": {
            "description": "Response format",
            "type": "string",
            "example": "json"
          }
        }
      }
    }
  },
  "description": "JSON-body shape (base64-encoded audio in `file_base64`). For multipart/form-data requests, send `file` + `model` form parts instead — see description.",
  "required": true
}
```
### 2xx response
```json
{
  "description": "Transcription result",
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "duration": {
            "description": "Audio duration (seconds)",
            "type": "number",
            "example": 5.5
          },
          "language": {
            "description": "Detected language",
            "type": "string",
            "example": "en"
          },
          "text": {
            "description": "Transcribed text",
            "type": "string",
            "example": "Hello, world!"
          }
        }
      }
    }
  }
}
```

## POST /v1/images/generations

Path in spec: `/images/generations`

Image generation

### Parameters
```json
[
  {
    "description": "Routing: pin to a specific provider by on-chain address (0x-prefixed).",
    "name": "X-0G-Provider-Address",
    "in": "header",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Routing: provider sort strategy. `latency` | `price`.",
    "name": "X-0G-Provider-Sort",
    "in": "header",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Routing: trust tier filter (`verified` | `private`). `verified` is a floor — `private` providers also satisfy it.",
    "name": "X-0G-Provider-Trust-Mode",
    "in": "header",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Routing: whether to retry on other providers after a failure. `true` | `false`. Defaults to false when an address is pinned, true otherwise.",
    "name": "X-0G-Provider-Allow-Fallbacks",
    "in": "header",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Routing: only these providers, comma-separated: `0x…` (every upstream behind that address), `0x…/identity` (one upstream behind it) or `*/identity` (that upstream behind every address). Combines with the API key's own allowed providers: a provider must be on both. [beta]",
    "name": "X-0G-Provider-Allow",
    "in": "header",
    "schema": {
      "type": "string"
    }
  },
  {
    "description": "Routing: never these providers, same forms as X-0G-Provider-Allow. Adds to the API key's own blocked providers. [beta]",
    "name": "X-0G-Provider-Block",
    "in": "header",
    "schema": {
      "type": "string"
    }
  }
]
```
### Request body
```json
{
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "model": {
            "description": "Model ID",
            "type": "string",
            "example": "dall-e-3"
          },
          "n": {
            "description": "Number of images to generate",
            "type": "integer",
            "example": 1
          },
          "prompt": {
            "description": "Image description",
            "type": "string",
            "example": "A beautiful sunset"
          },
          "response_format": {
            "description": "Response format: url or b64_json",
            "type": "string",
            "example": "url"
          },
          "size": {
            "description": "Image size",
            "type": "string",
            "example": "1024x1024"
          }
        }
      }
    }
  },
  "description": "Image generation request",
  "required": true
}
```
### 2xx response
```json
{
  "description": "Generated image",
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "created": {
            "description": "Creation timestamp",
            "type": "integer",
            "example": 1677652288
          },
          "data": {
            "description": "Image data list",
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/github_com_0glabs_0g-router_pkg_inference.ImageData"
            }
          }
        }
      }
    }
  }
}
```

