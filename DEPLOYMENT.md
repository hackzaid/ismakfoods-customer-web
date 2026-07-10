# Deployment

This app is built as a Next.js standalone server and deployed to a cPanel Node.js app from GitHub Actions over SSH.

## GitHub Secrets

Create these repository secrets in GitHub under `Settings > Secrets and variables > Actions > Secrets`:

- `CPANEL_SSH_HOST`: cPanel SSH host, for example `server.example.com`.
- `CPANEL_SSH_USER`: cPanel SSH username.
- `CPANEL_SSH_PRIVATE_KEY_B64`: Base64-encoded private SSH key allowed to access the cPanel account.
- `CPANEL_SSH_TARGET_DIR`: Writable parent deployment directory. Use `/home/afripnxq/demo.ismakfoods.com` for this deployment.
- `CPANEL_SSH_PORT`: Optional SSH port. If omitted, the workflow uses `22`.

`CPANEL_DEPLOY_PATH` is still supported as a fallback for older configuration. If `CPANEL_SSH_TARGET_DIR` is not set, the workflow derives the parent folder from `CPANEL_DEPLOY_PATH` by removing a trailing `/standalone`.

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
- Application root: `CPANEL_SSH_TARGET_DIR/standalone`, currently `/home/afripnxq/demo.ismakfoods.com/standalone`
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
2. `npm run build`, which currently forces `next build --webpack` because the cPanel/LiteSpeed origin returned `500` for specific Turbopack-generated static chunks.
3. Packages `.next/standalone` into `deploy/standalone`.
4. Copies `.next/static` into `deploy/standalone/.next/static`.
5. Copies `public`, `package-lock.json`, `.env.production`, and a deploy marker into `deploy/standalone`.
6. Removes the generated standalone `node_modules` folder from the artifact because CloudLinux requires `node_modules` in the application root to be its own symlink.
7. Adds a parent `server.js` wrapper as a fallback, but the intended cPanel app root remains `standalone`.
8. Tars the artifact as `customer-web-deploy.tar.gz`.
9. SSHes into cPanel, creates/checks `CPANEL_SSH_TARGET_DIR`, uploads the tarball with `scp`, then extracts it.
10. Preserves CloudLinux's managed `standalone/node_modules` symlink.
11. Runs `npm ci --omit=dev` only when the symlink exists and `npm` is available in SSH.
12. Touches `standalone/tmp/restart.txt` and parent `tmp/restart.txt` so Passenger/cPanel restarts the Node.js app.
13. Verifies the uploaded static manifest and deploy marker on cPanel.
14. Loads the public HTTPS URL and verifies `/__deploy.json` plus the referenced `/_next/static` CSS, JS, and font assets return successful responses.

You can also run the workflow manually from GitHub Actions using `workflow_dispatch`.

## cPanel Notes

- cPanel should be configured as a Node.js application.
- The application root should be `CPANEL_SSH_TARGET_DIR/standalone`.
- The application startup file should be `server.js`.
- Create/save the cPanel Node.js app before deploying so CloudLinux creates its managed `node_modules` symlink.
- Do not manually upload a real `node_modules` directory into the application root.
- GitHub Actions runs `npm ci --omit=dev` on the server after upload only when CloudLinux's managed symlink and `npm` are both available.
- The cPanel server must allow SSH and SCP access.
- If `/__deploy.json` is missing or shows an old SHA, the public domain is not serving the files uploaded by the current workflow. In that case, update either the GitHub `CPANEL_SSH_TARGET_DIR` secret or the cPanel Node.js Application root so both point to the same deployment.

## CloudLinux node_modules Recovery

If a previous deploy created a real `node_modules` directory in the application root, the workflow removes it automatically. After that, CloudLinux still needs its managed `node_modules` symlink before `npm install` can run safely.

If the workflow reports that the symlink is missing, the files have still been deployed. Then:

1. Open the cPanel Node.js app screen.
2. Confirm the application root is `/home/afripnxq/demo.ismakfoods.com/standalone`.
3. Save the app.
4. Click `Run NPM Install` once from cPanel so CloudLinux creates its managed dependency symlink.
5. Restart the cPanel Node.js app.
6. Rerun the GitHub Action after that only if you want the workflow to verify remote install/restart.
