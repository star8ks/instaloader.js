# Release Process

**IMPORTANT: Always use Changesets for version management. Never use `npm version` manually.**

## How to Release

1. **Create a changeset for your changes:**
   ```bash
   npm run changeset
   ```
   - Select the type of change (patch/minor/major)
   - Write a clear summary of the changes
   - This creates a `.changeset/*.md` file

2. **Commit and push the changeset:**
   ```bash
   git add .changeset/
   git commit -m "feat: add new feature"
   git push
   ```

3. **Changesets will automatically:**
   - Create a "Version Packages" PR with version bumps
   - When you merge that PR, it will:
     - Update package.json version
     - Generate CHANGELOG.md
     - Publish to npm
     - Create GitHub release

## What NOT to Do

- ❌ **Never run `npm version patch/minor/major`** - this bypasses Changesets
- ❌ **Never manually edit package.json version** - Changesets manages this
- ❌ **Never publish manually** - the workflow handles publishing

## Emergency Manual Release

If you need to fix a broken release:

1. Create a changeset with the fix
2. Wait for the automated process
3. If absolutely necessary, you can run locally:
   ```bash
   npm run version  # Updates versions
   npm run release  # Publishes to npm
   ```

## Troubleshooting

- **"Version already published" error**: You likely ran `npm version` manually. Create a new changeset to bump the version properly.
- **Missing GitHub release**: Check that the workflow has `createGithubReleases: true` and proper permissions.