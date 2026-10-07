[Česky](LOCALIZATION_POLICY_CZ.md) | [English](LOCALIZATION_POLICY_EN.md)

# Hacesoft application localization policy

Every future app update must audit the shared language set: `cs`, `en`, `de`, `es`, `fr`, `it`, `nl`, `pl`, `pt`, `sk`, `uk`. Add missing languages and translation keys, verify Nextcloud language selection, and document the languages actually supported. A catalog file alone does not prove translation completeness. User guides and development documentation are published only in Czech and English.

Audit buttons, forms, dialogs, status messages, accessible labels and sample text. Resolve regional variants such as `pt_BR` or `de-DE` against the base language. Use English (EN) as the fallback for unsupported languages and individual missing translations. Audit Core-generated UI separately; documentation must not claim complete translations absent from the code.
