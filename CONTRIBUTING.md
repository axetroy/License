# Contributing

## Development setup

- Use Node.js 20.19 or newer for development tooling; the package runtime supports Node.js 18 and newer.
- Run `npm ci` to install the locked dependencies.
- Run `npm run check` before opening a pull request. It runs lint, tests, builds the documentation site and embedded playground, and checks the npm package contents.

## Changes

- Add or update tests for behavior changes and bug fixes.
- Keep the implementation and specification in `DESIGN.md` consistent. Protocol changes must explicitly identify compatibility and security implications.
- Do not commit generated `dist/` output, private keys, or license files containing real customer data.
- Keep pull requests focused and describe user-visible changes and validation performed.

## Releases

Releases are published from GitHub Releases using the npm trusted publisher workflow. Update `package.json` and `package-lock.json` together, and ensure the release tag matches the package version.
