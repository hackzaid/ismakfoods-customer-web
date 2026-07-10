# Deployment

This app is built as a Next.js standalone server and deployed to a cPanel Node.js app from GitHub Actions over SSH.

## GitHub Secrets

Create these repository secrets in GitHub under `Settings > Secrets and variables > Actions > Secrets`:

- `CPANEL_SSH_HOST`: cPanel SSH host, for example `server.example.com`.
- `CPANEL_SSH_USER`: cPanel SSH username.
- `CPANEL_SSH_PRIVATE_KEY_B64`: Base64-encoded private SSH key allowed to access the cPanel account.
- `CPANEL_DEPLOY_PATH`: Absolute cPanel application root, for example `/home/username/demo.ismakfoods.com`.
- `CPANEL_SSH_PORT`: Optional SSH port. If omitted, the workflow uses `22`.

`CPANEL_SSH_PRIVATE_KEY` is also supported as a raw multiline private key, but `CPANEL_SSH_PRIVATE_KEY_B64` is preferred because it avoids GitHub secret newline formatting issues.

## Create the SSH Key Secret

Use an OpenSSH private key, not a PuTTY `.ppk` file. The key should not require an interactive passphrase in GitHub Actions.

On Windows PowerShell, encode the private key like this:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\.ssh\id_ed25519")) | Set-Clipboard
```

Then paste the clipboard value into the GitHub secret named `CPANEL_SSH_PRIVATE_KEY_B64`.

If you need to create a new deploy key:

```powershell
ssh-keygen -t ed25519 -C "github-actions-ismakfoods-customer-web" -f "$env:USERPROFILE\.ssh\ismakfoods_customer_web_deploy"
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\.ssh\ismakfoods_customer_web_deploy")) | Set-Clipboard
```

Add the public key content from this file to cPanel authorized keys:

```powershell
Get-Content "$env:USERPROFILE\.ssh\ismakfoods_customer_web_deploy.pub"
```

## Optional GitHub Variables

Create these under `Settings > Secrets and variables > Actions > Variables` only if the defaults should change:

- `NEXT_PUBLIC_API_BASE_URL`: Defaults to `https://api.ismakfoods.com/api/v1`.
- `NEXT_PUBLIC_API_ORIGIN`: Defaults to `https://api.ismakfoods.com`.

## cPanel Node.js App Settings

Use cPanel's Node.js app screen with these values:

- Node.js version: `22.x`
- Application mode: `Production`
- Application root: same path as `CPANEL_DEPLOY_PATH`, for example `/home/afripnxq/demo.ismakfoods.com`
- Application URL: your domain or subdomain, for example `demo.ismakfoods.com`
- Application startup file: `server.js`

Add these cPanel environment variables if the UI requires runtime values:

- `NODE_ENV`: `production`
- `NEXT_PUBLIC_API_BASE_URL`: `https://api.ismakfoods.com/api/v1`
- `NEXT_PUBLIC_API_ORIGIN`: `https://api.ismakfoods.com`

`NEXT_PUBLIC_BACKEND_URL` is not used by this app.

## Deploy Flow

Every push to `main` runs:

1. `npm ci`
2. `npm run build`
3. Packages `.next/standalone`, `.next/static`, and `public` into `deploy/`.
4. Syncs the standalone server files to the cPanel application root with `rsync` over SSH.
5. Touches `tmp/restart.txt` so Passenger/cPanel restarts the Node.js app.

You can also run the workflow manually from GitHub Actions using `workflow_dispatch`.

## cPanel Notes

- cPanel should be configured as a Node.js application.
- The application root should match `CPANEL_DEPLOY_PATH`.
- The application startup file should be `server.js`.
- cPanel does not need to run `npm install`; GitHub Actions uploads the standalone app with its required production dependencies.
- The cPanel server must allow SSH access and have `rsync` available. If `rsync` is unavailable, the deploy step can be changed to an `scp` upload.
