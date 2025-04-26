# AutoApply

A Chrome extension that automatically fills job applications across multiple ATS platforms.

## Features

- Automatically detects and fills forms on Workday, Greenhouse, Lever, and more
- Secure storage of personal information
- Real-time form field detection and filling
- Beautiful, modern UI with React
- Manifest V3 compliant

## Development Setup

1. Install dependencies:
```bash
pnpm install
```

2. Start development server:
```bash
pnpm dev
```

3. Load the extension in Chrome:
- Open Chrome and navigate to `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked" and select the `dist/apps/extension` directory

## Project Structure

```
auto-apply/
├── apps/
│   └── extension/          # Chrome extension
│       ├── src/
│       │   ├── popup/     # Extension popup UI
│       │   ├── content.ts # Content script
│       │   └── background.ts
├── libs/                   # Shared libraries
└── package.json
```

## Building for Production

```bash
pnpm build
```

The built extension will be in `dist/apps/extension/`.

## Testing

```bash
pnpm test
```

## Security

- All PII is encrypted at rest using AES-256
- JWT tokens with 30-minute TTL
- Content Security Policy enforced
- No PII in browser storage
- Regular security audits

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT 