[🇨🇿 Česky](UPDATE_CHECK_CZ.md) | [🇬🇧 **English**](UPDATE_CHECK_EN.md)

# Application and Core version checks

Each application checks its own GitHub repository and Core independently. The public version is defined by `src/appinfo/info.xml` on the repository default branch. README and ZIP contents are not read. A development installation on your NAS may be newer than GitHub.

| Component | Repository | Expected `<id>` |
| --- | --- | --- |
| Core | `hacesoft/core` | `hc_shared_app_core` |
| Playground | `hacesoft/Playground` | `hc_shared_app_core_playground` |
| GridSight | `hacesoft/GridSight` | `hc_gridsight` |
| Sticky Notes | `hacesoft/nextcloud-stickynotes` | `hc_stickynotes` |

Other applications register their real repository and technical ID using `CORE.about.register({id, name, version, repository})`. The same mechanism then checks their XML. Core always uses `hacesoft/core`.

## Exact procedure

1. For GridSight, Nextcloud requests `https://api.github.com/repos/hacesoft/GridSight/contents/src/appinfo/info.xml`. Omitting `ref` selects the default branch, which need not be named `main`.
2. It checks JSON `type: file` and `encoding: base64`, decodes `content`, and parses XML without external entities. Exactly one `<info><version>` and `<info><id>` are required. The version must be valid SemVer. An ID mismatch rejects the entire check, including fallback, to prevent displaying another product.
3. Missing or unusable XML falls back to `https://api.github.com/repos/hacesoft/GridSight/contents/release`. Only `type: file` entries are read. Versions are extracted from archive `name` fields; the highest version wins. Archive contents and their IDs are not inspected, so keep only this application's packages in that folder.
4. The user-facing link comes from `html_url`. Core uses the same relative paths in `hacesoft/core`; other apps use their registered repository.

Tags and `/releases/latest` are no longer requested. Valid XML takes precedence over archives, even if an archive has a higher version. Therefore `<version>` on the default branch must represent the current public version.

| XML source | Archive fallback |
| --- | --- |
| `https://api.github.com/repos/hacesoft/core/contents/src/appinfo/info.xml` | `https://api.github.com/repos/hacesoft/core/contents/release` |
| `https://api.github.com/repos/hacesoft/GridSight/contents/src/appinfo/info.xml` | `https://api.github.com/repos/hacesoft/GridSight/contents/release` |
| `https://api.github.com/repos/hacesoft/nextcloud-stickynotes/contents/src/appinfo/info.xml` | `https://api.github.com/repos/hacesoft/nextcloud-stickynotes/contents/release` |
| `https://api.github.com/repos/hacesoft/Playground/contents/src/appinfo/info.xml` | `https://api.github.com/repos/hacesoft/Playground/contents/release` |

## Comparison and archives

| Installed version compared to GitHub | State |
| --- | --- |
| Equal | Current |
| Lower | Update available |
| Higher | Newer than published |
| Cannot determine the remote version | Check unavailable |

SemVer precedence applies: `1.10.0 > 1.9.0`, `dev.16 > dev.9`, stable `1.0.0 > 1.0.0-rc.1`. Build metadata does not change precedence. XML contains a plain version, such as `<version>2.0.11</version>`.

Fallback archives end with `.zip`, `.tar.gz` or `.tgz`. Optional packaging suffixes are `-source`, `-full-source`, `-runtime`, `-install` and `-bundle`, also with underscores. `hc_stickynotes-2.0.11-source.zip` provides `2.0.11`; `hc-shared-app-core-0.18.1-full-source.zip` provides `0.18.1`. Upload dates and file sizes are ignored. Equal-version candidates are selected deterministically by link URL.

## Cache and diagnostics

The browser requests the following server path through Nextcloud `OC.generateUrl()`:

```text
/apps/hc_shared_app_core/api/v1/release?repository=hacesoft%2FGridSight&appId=hc_gridsight
```

Nextcloud contacts the public GitHub API without a token or user data. Headers are `Accept: application/vnd.github+json`, `User-Agent: HC-Shared-App-Core/0.18.1`, and `X-GitHub-Api-Version: 2022-11-28`. Each request has an 8-second timeout and a 4-second connection timeout.

Results are stored in Core's Nextcloud app config under `release-cache:v3:<lowercase repository>:<app ID>`. Successful results are shared for 6 hours. Failures without a previous result are cached for 5 minutes. If GitHub fails and a previous result exists, it is returned with `stale: true` and `attemptedAt`.

Checks run when About opens or `CORE.updates.check()` is called. **There is no periodic background scan.** The next request after cache expiry fetches GitHub again. `aboutController.refresh()` or `CORE.updates.checkComponent({...registration, refresh: true})` bypass cache. An authenticated diagnostic request may add `&refresh=1`.

Inspect `api/v1/release` in browser developer tools → Network. Example:

```json
{
  "available": true,
  "repository": "hacesoft/nextcloud-stickynotes",
  "appId": "hc_stickynotes",
  "version": "2.0.11",
  "tag": "2.0.11",
  "source": "appinfo-xml",
  "sourceUrl": "https://api.github.com/repos/hacesoft/nextcloud-stickynotes/contents/src/appinfo/info.xml",
  "fileName": "src/appinfo/info.xml",
  "url": "https://github.com/hacesoft/nextcloud-stickynotes/blob/main/src/appinfo/info.xml",
  "checkedAt": 1791352800,
  "cached": false
}
```

`source` is `appinfo-xml` or `release-directory`; `sourceUrl` identifies the exact source and `fileName` the file. `checkedAt` is a Unix timestamp. About's status tooltip also exposes the source. A failed check does not mean the installed app is current.

## Tests

Frontend: `cd build && npm run check && npm run build`. Standalone PHP XML, ID, safe parsing and archive fallback tests: `cd build && npm run check:releases` (PHP with SimpleXML). Tests do not contact GitHub or Nextcloud.

Specification: [GitHub Contents API](https://docs.github.com/en/rest/repos/contents).

## About language

The shared About component follows the Nextcloud document language (the account language). It translates column labels, update states, links and optional map cache information. Supported languages: cs, en, de, es, fr, it, nl, pl, pt, sk and uk; regional variants use the base language. Unsupported languages or missing translations fall back to English. A custom heading provided by the host application remains controlled by that application.
