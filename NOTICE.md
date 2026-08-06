# Licensing

Internal package, consumed over a git URL by across-protocol services. Not
published to any registry — `package.json` sets `"private": true`.

`license` is `UNLICENSED` rather than a permissive licence on purpose: the sole
runtime dependency, `@across-protocol/constants`, is **AGPL-3.0-only**, so
declaring this package MIT would assert terms it cannot offer for the combined
work. If it ever needs to be distributed, settle the licence question first —
matching integrator-api (MPL-2.0) is the obvious starting point.
