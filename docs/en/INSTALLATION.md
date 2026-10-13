[🇨🇿 Česky](../cz/INSTALLATION.md) | [🇬🇧 **English**](../en/INSTALLATION.md)

# Installation and updates

Shared App Core (`hc_shared_app_core`) provides reusable services for Nextcloud 35 apps. Compatibility with other Nextcloud versions must be verified before deployment.

## App Store installation

In Nextcloud administration, open **Apps**, find **Shared App Core**, and install it. This option becomes available once the app is publicly listed. No custom shell scripts should be required.

## Manual installation

Download the signed runtime archive matching the required version, verify its origin, and unpack it under the allowed `custom_apps/hc_shared_app_core` directory. Enable the app through Nextcloud's regular app manager or run `php occ app:enable hc_shared_app_core` as the web-server user. Do not deploy the full-source archive in place of the runtime package.

## Updates and disabling

Back up the database and configuration according to your Nextcloud administration policy. Prefer the regular Nextcloud update mechanism. Disabling is not the same as fully uninstalling; check dependent apps and the release-specific data-retention policy before removing the app.
