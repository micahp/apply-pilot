# AutoApply

AutoApply is a Chrome extension that automates the job application process by filling out forms across different Applicant Tracking Systems (ATS) like Workday, Greenhouse, Lever, and more.

## Features

- **Profile Management**: Create and store your personal information, work experience, education, and other job-related details.
- **Smart Form Detection**: Automatically detects form fields on job application websites.
- **Auto-Fill**: Fills in application forms with your stored profile information.
- **Multiple ATS Support**: Works with popular ATS platforms including Workday, Greenhouse, Lever, and more.
- **Privacy-First**: All your data is stored locally in your browser. No server-side storage of personal information.

## Supported ATS Platforms

- Workday
- Greenhouse
- Lever
- AshbyHQ
- iCIMS
- Workable

More platforms will be added in future updates.

## Installation

### Development Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/auto-apply.git
   cd auto-apply
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build the extension:
   ```
   npm run build
   ```

4. Load the extension in Chrome:
   ```
   npm run load-extension
   ```
   
   This script will provide instructions and attempt to open Chrome with the extensions page automatically.

### Manual Installation

1. Open Chrome and navigate to `chrome://extensions`
2. Enable "Developer mode" using the toggle in the top right
3. Click "Load unpacked"
4. Select the `dist/apps/extension` directory from this project

## Usage

### Extension

1. Open the AutoApply popup and fill in your profile: contact details, location, screening answers (work authorization, sponsorship), voluntary EEO choices (blank = decline), a cover letter template, **custom answers** for questions specific to you, and your resume file. Or use **Import** to load a `profile.json` (same format as the script below).
2. Open an application form on a supported ATS. A floating AutoApply panel appears.
3. Click **Autofill application**. The panel reports how many fields were filled and lists every required question it could not answer; those are outlined on the page. Click one to jump to it.
4. Review and submit yourself. The extension never submits.

### Command line: scrape and apply

```bash
pnpm install
cp profile.example.json profile.json   # fill it in; resumePath is relative to profile.json
pnpm scrape                            # writes jobs.json from scripts/companies.json + HN "Who is hiring?"
pnpm auto-apply                        # review mode: fills each form, waits for you, never submits
pnpm auto-apply -- --submit            # submits only forms with every required question answered
```

`pnpm scrape` options: `--source greenhouse,lever,ashby,hn`, `--keywords "llm,rag"`, `--location "remote|austin"`, `--min-score 30`, `--any-role`, `--companies file.json`. Edit `scripts/companies.json` to change which company boards are pulled.

`pnpm auto-apply` options: `--limit N`, `--min-score N`, `--location <regex>`, `--only <url substring>`, `--headless`, `--retry`.

Every attempt is recorded in `apply-results.json` with one of these statuses:

| Status | Meaning |
| --- | --- |
| `submitted` | The site showed an application-received confirmation |
| `ready` | Complete, not submitted (review mode) |
| `needs-review` | Required questions unanswered; they're listed, and the run summary ranks the most common so you can add `customAnswers` |
| `needs-human` | A CAPTCHA challenge appeared |
| `rejected` | Submit clicked, site reported validation errors |
| `unconfirmed` | Submit clicked, no confirmation seen |
| `no-form` | No application form found (account-gated or external) |
| `error` | Navigation/script failure |

A job already `submitted` is never applied to again.

## Development

The form-filling engine lives in `apps/extension/src/autofill/` and is shared: the extension imports it, and `pnpm build:autofill` bundles it for the Playwright runner, so both fill forms identically.

### Tests

```bash
pnpm --dir apps/extension exec jest     # engine + cover letter unit tests (jsdom)
pnpm test:scripts                        # scraper parsers (real API fixtures) and runner logic
(cd apps/extension && npx vite build)    # build the extension
pnpm test:e2e                            # runner and built extension against local form fixtures
```

End-to-end tests never touch live job sites; ATS pages are served from `tests/fixtures/forms` with a mock backend that enforces required fields.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Roadmap

- Add support for more ATS platforms
- Improve field detection accuracy
- Add resume parsing capability
- Implement more detailed work experience form filling
- Add ability to customize field mappings
- Create cloud sync option (with encryption) 