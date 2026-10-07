[🇨🇿 Česky](../README_CZ.md) | [🇬🇧 English](../README.md)

# Shared App Core — release artifact policy

This policy is mandatory for `hc_shared_app_core` . Release artifacts must be deterministic and must not contain accidental development output.

## Source maps

- The canonical Core build uses `sourcemap: false`.
- `*.map` files are forbidden in `src/js/`, runtime ZIP/TAR packages and the full-source ZIP.
- Runtime JavaScript must not contain a `sourceMappingURL` reference.
- Source maps are not required at runtime and are not release artifacts.
- A developer may use a temporary local-only configuration for debugging, but that output must never be committed or packaged.

## Runtime package

The runtime package contains only `appinfo/`, `css/`, `js/`, `lib/` and `LICENSE`. It must not contain build sources, documentation, tests, `node_modules`, reports or source maps.

## Full-source package

The full-source ZIP contains source code, documentation, build/test scripts and the built runtime, but excludes `node_modules`, `*.map`, temporary build directories, reports/caches and nested old release artifacts.

## Mandatory release gates

`build-release.sh` must fail if a source map or `sourceMappingURL` appears in runtime output or in either packaged artifact. This is a release gate, not a recommendation.

## Version immutability


