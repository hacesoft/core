[🇨🇿 Česky](../cz/INSTALACE.md) | [🇬🇧 **English**](INSTALLATION.md)

# Installing the example application

`sudo sh install.sh` first repairs leftover duplicate copies of our applications with `scripts/custom-apps-safety.sh`, validates incoming code in `/tmp`, then deploys it under the canonical App ID only. Never create `*.new`, `*.old`, `*.backup` or other working directories with `appinfo/info.xml` inside `custom_apps`. Keep backups outside `custom_apps`, preferably in Nextcloud's data directory. Copy both the sample installer and its helper into future applications.
