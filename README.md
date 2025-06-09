# AutoApply

AutoApply is a Chrome extension that automates the job application process by filling out forms across different Applicant Tracking Systems (ATS) like Workday, Greenhouse, Lever, and more.

## Features

- **Profile Management**: Create and store your personal information, work experience, education, and other job-related details.
- **Smart Form Detection**: Automatically detects form fields on job application websites.
- **Auto-Fill**: Fills in application forms with your stored profile information.
- **Multiple ATS Support**: Works with popular ATS platforms including Workday, Greenhouse, Lever, and more.
- **Privacy-First**: All your data is stored locally in your browser. No server-side storage of personal information.
- **Jobs Web**: Standalone webpage that aggregates job openings from multiple ATS providers.

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

### Jobs Web

You can run a small server that aggregates job listings from multiple ATS providers and serves them on `http://localhost:3001`:

```bash
pnpm --filter jobs-web start
```

Environment variables `LEVER_SLUG`, `GREENHOUSE_SLUG` and `WORKABLE_SLUG` can be used to set company slugs.

## Usage

1. After installing the extension, click on the AutoApply icon in your Chrome toolbar to open the popup.
2. Set up your profile with personal information, work experience, education, and skills.
3. Navigate to a supported job application page.
4. The extension will automatically detect the form and fill in the fields with your information.
5. Review the filled information before submitting the application.

## Development

This project uses:
- TypeScript for type-safe JavaScript
- React for the UI components
- NX for monorepo management
- Vite for fast builds

### Project Structure

```
auto-apply/
├── apps/
│   └── extension/      # Chrome extension code
│       ├── src/
│       │   ├── popup/  # Extension popup UI
│       │   ├── options/ # Options page
│       │   ├── types/  # TypeScript type definitions
│       │   ├── content.ts  # Content script for form filling
│       │   ├── background.ts # Background service worker
│       │   └── ats.ts  # ATS detection and mapping
│       ├── manifest.json
│       └── tsconfig.json
├── packages/           # Shared packages (for future use)
├── scripts/            # Utility scripts
└── dist/               # Build output
```

### Available Scripts

- `npm run build` - Build the extension
- `npm run dev` - Start development server
- `npm run lint` - Lint the code
- `npm run test` - Run tests
- `npm run load-extension` - Help load the extension in Chrome

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