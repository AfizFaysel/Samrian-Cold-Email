# Licensing

Samrian uses component-based licensing. This is not a dual license over the same code.

| Path                                                              | License    |
| ----------------------------------------------------------------- | ---------- |
| Application, server, workers, migrations, and operational scripts | Apache-2.0 |
| `packages/contracts`                                              | MIT        |
| `packages/sdk`                                                    | MIT        |
| `packages/cli`                                                    | MIT        |
| `packages/mcp`                                                    | MIT        |

The root `LICENSE` applies unless a directory contains its own `LICENSE`. Each permissive package
contains a separate MIT license and declares `MIT` in its package manifest. Third-party and
generated files retain their original notices and licenses.

## Using Samrian

Apache-2.0 permits commercial use, modification, self-hosting, and hosting Samrian for others. Keep
the `LICENSE` and `NOTICE` files with copies you distribute, and mark files you change. The license
also grants a patent license from each contributor for their contributions.

`NEXT_PUBLIC_SOURCE_URL` adds a source link to the app. It is optional; forks should point it at
their own source.

Versions released before this change were licensed under AGPL-3.0-or-later and remain available
under that license.

## Contributions

Under section 5 of Apache-2.0, contributions submitted to this repository are licensed under the
license of the component they change, as listed above. No separate contributor agreement is needed.

## Packages

The contracts, SDK, CLI, and MCP packages are MIT-licensed so clients and integrations can use them
with the shortest possible license text. Their licenses do not change the
license of Samrian application or server code.

## Brand

Copyright licenses do not grant rights to present a fork as the official Samrian product. See
[`TRADEMARKS.md`](TRADEMARKS.md) for practical brand-use guidance.

This document summarizes repository boundaries and is not legal advice. The license texts control.
