# GitHub and Vercel Deployment

## 1. Create the GitHub repository

1. Sign in at `https://github.com/login`.
2. Select **New repository**.
3. Name it `apparelflow-gatekeeper` and choose **Public** if the evaluator requires a public repository.
4. Do not initialize it with a README, `.gitignore`, or license because those files are already included.
5. Extract this ZIP, open PowerShell in the extracted folder, and run:

```powershell
git init
git add .
git commit -m "feat: implement ApparelFlow cutting gatekeeper"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/apparelflow-gatekeeper.git
git push -u origin main
```

If Git requests authentication, complete the browser sign-in flow for Git Credential Manager. Do not paste a GitHub password into the terminal; GitHub uses browser authentication or a personal access token.

## 2. Import the repository into Vercel

1. Open `https://vercel.com/login`.
2. Select **Continue with GitHub** and authorize Vercel.
3. Open `https://vercel.com/new`.
4. Import `apparelflow-gatekeeper`.
5. Keep the repository root as the **Root Directory**.
6. Vercel reads `vercel.json`; do not change the output directory or build command.

Do not deploy yet because `DATABASE_URL` must exist first.

## 3. Create and attach Neon PostgreSQL

1. In the Vercel project, open **Storage**.
2. Select **Create Database** and choose **Neon Postgres**.
3. Choose the free plan and a Singapore or nearby region when available.
4. Connect the database to **Production**, **Preview**, and **Development**.
5. Confirm that the integration created `DATABASE_URL` in **Settings > Environment Variables**.

The application initializes its PostgreSQL schema, constraints, trigger functions, recipes, components, and demo users when the server starts.

## 4. Configure application secrets

Generate a secret locally:

```powershell
$bytes = New-Object byte[] 48
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

In **Vercel > Project > Settings > Environment Variables**, add:

| Name | Value | Environments |
| --- | --- | --- |
| `JWT_SECRET` | Generated value | Production, Preview, Development |
| `NODE_ENV` | `production` | Production, Preview |

Never commit `DATABASE_URL`, `JWT_SECRET`, `.env`, or `.env.local`.

## 5. Deploy and verify

1. Open the **Deployments** tab.
2. Redeploy the latest deployment, or push a new commit after configuring the variables.
3. Open the generated `*.vercel.app` URL.
4. Test login with all three demo accounts from the README.
5. Create a batch, refresh, and confirm it persists.
6. Test a shortage rejection, an all-green approval, and the Sewing Queue.
7. Add the live URL to the README and commit that change.

## 6. Preserve credible commit history

Do not upload later changes only through the GitHub web editor. Make focused commits such as:

```powershell
git add README.md
git commit -m "docs: add production deployment URL"
git push
```

The assessment explicitly evaluates iterative engineering history, so future fixes should be committed separately with descriptive messages.
