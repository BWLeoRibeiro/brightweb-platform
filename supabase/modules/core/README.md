# Core Migrations

`core` owns shared platform foundations that every client instance needs.

## Owns

- `profiles`
- auth/profile sync triggers
- shared helper functions like `current_profile_id()`
- shared app events / alerts foundations
- rate limiting primitives
- global notification/language preferences
- any always-on shared platform table or helper

## Does not own

- module-specific CRM tables
- project collaboration tables
- admin-only role governance tables
- client-only tables

## Apply order

Apply `core` before any module migrations.
