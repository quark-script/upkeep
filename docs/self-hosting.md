# Self-hosting

Upkeep is a static site. Without any settings it runs fully offline, keeping everything in the
browser. Sign-in and sync need a [Supabase](https://supabase.com) project, and the sign-in email
needs an SMTP provider such as [Resend](https://resend.com).

## 1. Supabase project

1. Create a project.
2. Create the sync table: either run the files in
   [`supabase/migrations`](../supabase/migrations) in order in the SQL editor, or link the project
   with the [Supabase CLI](https://supabase.com/docs/guides/cli) and run `supabase db push`.
3. Create your account: **Authentication > Users > Add user**, with your email and "Auto Confirm
   User" ticked. Sign-ups are off ([`supabase/config.toml`](../supabase/config.toml)), so this is
   the only way in, and the app never creates accounts.

## 2. The sign-in email

Upkeep signs in with a 6-digit code instead of a link, because a link opens the browser, not the
installed app. Supabase's built-in email can't send a custom template, so it needs your own SMTP.

With the CLI, set these and push the auth settings from `supabase/config.toml`:

```bash
export SITE_URL=https://your-address
export SMTP_ADMIN_EMAIL=upkeep@your-domain     # on a domain verified in Resend
export SUPABASE_AUTH_EMAIL_SMTP_PASS=re_...    # a Resend API key
supabase config push
```

Or by hand in the dashboard:

- **Authentication > URL Configuration**: the Site URL is your app's address.
- **Authentication > Emails > SMTP Settings**: host `smtp.resend.com`, port 465, user `resend`,
  your Resend API key as the password and your sender address.
- **Authentication > Emails > Templates > Magic link**: paste
  [`supabase/templates/magic_link.html`](../supabase/templates/magic_link.html), which shows the
  code.
- **Authentication > Sign In / Providers > Email**: the OTP length is 6.

## 3. The app

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (from **Project Settings > API
Keys**). Then `npm run build` makes a static site in `dist/`.

On Vercel: import the repository (Vite is detected), add the same variables under
**Settings > Environment Variables**, and deploy.

## Updating

Database changes come as new files in `supabase/migrations`. Run them in order, or with
`supabase db push`.
