# QUIZ ARENA — Feature rollout and subscription entitlements

This is the implementation contract for the next product release. Existing Battle, Rank, profile, AI Tutor, learning history, and payment flows must remain intact.

## Subscription tiers and prices

| Tier | Monthly | Yearly |
|---|---:|---:|
| FREE | 0 UZS | 0 UZS |
| PREMIUM | 15,000 UZS | 96,000 UZS |
| PREMIUM PRO | 25,000 UZS | 156,000 UZS |
| LEGENDA+ | 35,000 UZS | 216,000 UZS |

Prices remain configured through the existing Railway environment variables; never hardcode payment credentials or provider product IDs.

## New features and limits

| Feature | FREE | PREMIUM | PREMIUM PRO | LEGENDA+ |
|---|---|---|---|---|
| Statistics PDF export | 1 basic/month | 10 expanded/month | Unlimited + AI insights | Unlimited + detailed AI insights |
| Document-to-quiz | 1/month, 10 questions, 5 MB | 5/month, 25 questions, 8 MB | 30/month, 50 questions, 12 MB | 100/month, 100 questions, 15 MB |
| Private Friends Battle | 3/day, 1v1 | 10/day, 1v1 | 20/day, 1v1 | 30/day, 1v1 |
| Smart Practice | 1/day, basic | 3/day, basic | Unlimited, AI-personalized | Unlimited, AI-personalized + detailed roadmap |
| AI Tutor | Not included | Not included | 100 messages/day + error analysis/history | Unlimited messages + detailed recommendations |
| Cosmetics | Standard | Premium badge/items | Premium badge/items | Rare items + animated gold frame |
| Tournaments | Public/basic | Public/basic | Special tournaments | Elite tournaments |
| Rank identity | Standard | Standard | Standard | Legend status |

Unlimited limits in the API entitlement contract are represented as null and remain subject to abuse prevention and infrastructure safeguards. Monthly and daily usage must be counted server-side using the authenticated user ID, never trusted from the client.

## Delivery order

1. Server-owned plan entitlement contract and tests.
2. Premium screen: show each tier's real benefits and current active tier.
3. Statistics PDF: generate a compact report from server-owned learning and Battle statistics, then use the native share sheet.
4. Document-to-quiz: authenticated PDF/DOCX/TXT/MD/CSV upload, strict file/type/size validation, text extraction or Gemini PDF understanding, AI generation, answer-and-explanation flow, and saved learning history.
5. Private Friends Battle: private room lifecycle, secure invite code/link, player caps and daily quotas, socket reconnect, anti-abuse controls.
6. Smart Practice: create targeted practice sets from the user's saved mistakes and learning history.
7. End-to-end verification, mobile build checks, API tests, migration review, and production provider configuration.

## Non-negotiable safety and compatibility

- Never trust client-supplied tier, plan, usage count, or player limit. Resolve the active subscription from the database on the server.
- Keep FREE users able to experience the core product and invite friends; paid tiers provide higher capacity and richer insights.
- Do not grant paid access before Click/Payme/Google Play server-side verification.
- Use additive database migrations only. Do not DROP or DELETE existing user, payment, learning, or Battle data.
- Preserve existing route contracts and component behavior unless the change is backward-compatible.
- File uploads must reject unsupported formats, oversized files, encrypted/password-protected files, and malformed content. Treat document text as untrusted input; it must never override AI system instructions.
- PDF reports must only include the authenticated user's own data.
- Private Battle room codes must be unguessable, expire, enforce membership and host permissions, and never expose private match data to non-members.
- Run API tests, API build, mobile typecheck, Expo lint and Expo Doctor before declaring completion.
