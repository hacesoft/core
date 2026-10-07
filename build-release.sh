#!/bin/sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
SRC="$ROOT/src"
INFO="$SRC/appinfo/info.xml"
[ -f "$INFO" ] || { echo "ERROR: $INFO not found" >&2; exit 1; }
APP_ID="$(sed -n 's:.*<id>\([^<]*\)</id>.*:\1:p' "$INFO" | head -n 1)"
VERSION="$(sed -n 's:.*<version>\([^<]*\)</version>.*:\1:p' "$INFO" | head -n 1)"
[ -n "$APP_ID" ] || { echo "ERROR: app id not found" >&2; exit 1; }
[ -n "$VERSION" ] || { echo "ERROR: version not found" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "ERROR: npm was not found" >&2; exit 1; }
command -v zip >/dev/null 2>&1 || { echo "ERROR: zip was not found" >&2; exit 1; }
command -v unzip >/dev/null 2>&1 || { echo "ERROR: unzip was not found" >&2; exit 1; }
# Každý soubor čtený instalačním skriptem musí být součástí zdrojového ZIPu.
INSTALL_FILES="scripts/custom-apps-safety.sh scripts/install-transaction.sh scripts/ensure-schema.php build/tests/php/cache.php build/tools/verify-core-install.php"
for file in $INSTALL_FILES; do
 [ -f "$ROOT/$file" ] || { echo "ERROR: missing installer dependency: $file" >&2; exit 1; }
done
cd "$ROOT/build"
npm ci
npm run check
npm run build
# Release policy: canonical artifacts never contain JavaScript source maps.
if find "$SRC/js" -type f -name '*.map' -print | grep -q .; then
 echo "ERROR: release policy violation: source map found in src/js" >&2
 find "$SRC/js" -type f -name '*.map' -print >&2
 exit 1
fi
if grep -R -n -E 'sourceMappingURL[[:space:]]*=' "$SRC/js" --include='*.js' >/dev/null 2>&1; then
 echo "ERROR: release policy violation: sourceMappingURL found in runtime JS" >&2
 grep -R -n -E 'sourceMappingURL[[:space:]]*=' "$SRC/js" --include='*.js' >&2 || true
 exit 1
fi
RUNTIME_ITEMS="appinfo css js lib"
for item in $RUNTIME_ITEMS; do [ -e "$SRC/$item" ] || { echo "ERROR: missing src/$item" >&2; exit 1; }; done
STAGE="$ROOT/.build"; APP="$STAGE/$APP_ID"; SOURCE="$STAGE/hc-shared-app-core-$VERSION"; RELEASE="$ROOT/release"
rm -rf "$STAGE"; mkdir -p "$APP" "$SOURCE" "$RELEASE"
# release/ contains generated output only; keep one current runtime version.
find "$RELEASE" -maxdepth 1 -type f \( -name "$APP_ID-*.zip" -o -name "$APP_ID-*.tar.gz" \) -delete
find "$RELEASE" -maxdepth 1 -type f -name 'hc-shared-app-core-*-full-source.zip' -delete
for item in $RUNTIME_ITEMS; do cp -R "$SRC/$item" "$APP/$item"; done
cp "$ROOT/LICENSE" "$APP/LICENSE"
(cd "$ROOT" && tar --exclude='build/node_modules' --exclude='build/examples/empty-app/node_modules' -cf - .gitignore LICENSE README.md README_CZ.md install.sh uninstall.sh build-release.sh scripts build docs src) | (cd "$SOURCE" && tar -xf -)
for file in $INSTALL_FILES; do
 [ -f "$SOURCE/$file" ] || { echo "ERROR: source stage omits installer dependency: $file" >&2; exit 1; }
done
(
 cd "$STAGE"
 tar -czf "$RELEASE/$APP_ID-$VERSION.tar.gz" "$APP_ID"
 if command -v zip >/dev/null 2>&1; then zip -qr "$RELEASE/$APP_ID-$VERSION.zip" "$APP_ID"; fi
 if command -v zip >/dev/null 2>&1; then zip -qr "$RELEASE/hc-shared-app-core-$VERSION-full-source.zip" "hc-shared-app-core-$VERSION"; fi
)
SOURCE_ZIP="$RELEASE/hc-shared-app-core-$VERSION-full-source.zip"
RUNTIME_ZIP="$RELEASE/$APP_ID-$VERSION.zip"
unzip -tqq "$SOURCE_ZIP"
# Packaged artifacts must also satisfy the source-map ban.
if unzip -Z1 "$SOURCE_ZIP" | grep -E '\.map$' >/dev/null; then
 echo "ERROR: release policy violation: source map found in full-source ZIP" >&2
 unzip -Z1 "$SOURCE_ZIP" | grep -E '\.map$' >&2
 exit 1
fi
if [ -f "$RUNTIME_ZIP" ] && unzip -Z1 "$RUNTIME_ZIP" | grep -E '\.map$' >/dev/null; then
 echo "ERROR: release policy violation: source map found in runtime ZIP" >&2
 unzip -Z1 "$RUNTIME_ZIP" | grep -E '\.map$' >&2
 exit 1
fi
for file in $INSTALL_FILES; do
 unzip -Z1 "$SOURCE_ZIP" | grep -Fx "hc-shared-app-core-$VERSION/$file" >/dev/null || {
  echo "ERROR: source ZIP omits installer dependency: $file" >&2; exit 1;
 }
done
rm -rf "$STAGE"
echo "Built release/$APP_ID-$VERSION.tar.gz"
[ -f "$RELEASE/$APP_ID-$VERSION.zip" ] && echo "Built release/$APP_ID-$VERSION.zip"
[ -f "$RELEASE/hc-shared-app-core-$VERSION-full-source.zip" ] && echo "Built release/hc-shared-app-core-$VERSION-full-source.zip"
