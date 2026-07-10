# Deployment

This app is built as a Next.js standalone server and deployed to a cPanel Node.js app from GitHub Actions over SSH.

## GitHub Secrets

Create these repository secrets in GitHub under `Settings > Secrets and variables > Actions > Secrets`:

- `CPANEL_SSH_HOST`: cPanel SSH host, for example `server.example.com`.
- `CPANEL_SSH_USER`: cPanel SSH username.
- `CPANEL_SSH_PRIVATE_KEY_B64`: Base64-encoded private SSH key allowed to access the cPanel account.
- `CPANEL_DEPLOY_PATH`: Absolute cPanel application root. Use `/home/afripnxq/demo.ismakfoods.com/standalone` for this deployment.
- `CPANEL_PUBLIC_ROOT`: Optional domain document root used for public `/_next/static` assets. If omitted, the workflow uses the parent directory of `CPANEL_DEPLOY_PATH`, currently `/home/afripnxq/demo.ismakfoods.com`.
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
- Application root: same path as `CPANEL_DEPLOY_PATH`, currently `/home/afripnxq/demo.ismakfoods.com/standalone`
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
3. Packages `.next/standalone`, `.next/static`, and `public` into `deploy/`.
4. Removes the generated standalone `node_modules` folder from the upload package because CloudLinux requires `node_modules` in the application root to be its own symlink.
5. Syncs the standalone server files to the cPanel application root with `rsync` over SSH while preserving CloudLinux-managed paths.
6. Mirrors `.next/static` to the domain document root so LiteSpeed/cPanel can serve `/_next/static/...` directly even when the Node app itself lives in the `standalone` subfolder.
7. Normalizes read/execute permissions on `.next` and `public` so cPanel/LiteSpeed can stream static assets.
8. Verifies that every generated file under `.next/static` exists in both the Node app root and the public document root after upload.
9. Runs `npm install --omit=dev` remotely when CloudLinux's `node_modules` symlink already exists.
10. If the symlink is missing, the workflow still deploys files and skips install so cPanel can create the symlink from the Node.js app screen.
11. Touches `tmp/restart.txt` after a successful remote install so Passenger/cPanel restarts the Node.js app.
12. Loads the public HTTPS URL and verifies the referenced `/_next/static` CSS, JS, and font assets return successful responses.

You can also run the workflow manually from GitHub Actions using `workflow_dispatch`.

## cPanel Notes

- cPanel should be configured as a Node.js application.
- The application root should match `CPANEL_DEPLOY_PATH`.
- The application startup file should be `server.js`.
- Create/save the cPanel Node.js app before deploying so CloudLinux creates its managed `node_modules` symlink.
- Do not manually upload a real `node_modules` directory into the application root.
- GitHub Actions runs `npm install --omit=dev` on the server after upload so dependencies land in CloudLinux's managed dependency folder.
- The cPanel server must allow SSH access and have `rsync` available. If `rsync` is unavailable, the deploy step can be changed to an `scp` upload.
- If the public HTTPS smoke test reports `500` for `/_next/static/...`, the HTML is deployed but the static asset pair is not being served correctly from the cPanel origin. Check that `.next/static` exists both inside the Node app root and the domain document root, then restart the Node.js app and purge any Cloudflare cache if needed.

## CloudLinux node_modules Recovery

If a previous deploy created a real `node_modules` directory in the application root, the workflow removes it automatically. After that, CloudLinux still needs its managed `node_modules` symlink before `npm install` can run safely.

If the workflow reports that the symlink is missing, the files have still been deployed. Then:

1. Open the cPanel Node.js app screen.
2. Confirm the application root is `/home/afripnxq/demo.ismakfoods.com/standalone`.
3. Save the app.
4. Click `Run NPM Install` once from cPanel so CloudLinux creates its managed dependency symlink.
5. Restart the cPanel Node.js app.
6. Rerun the GitHub Action after that only if you want the workflow to verify remote install/restart.
