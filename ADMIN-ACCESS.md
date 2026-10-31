# Administrator access and recovery

Inspection on October 31, 2026 found the existing administrator in both Neon/cloud and local PostgreSQL:

- Username: `admin`
- Email: `admin@foodtriphouse.com`
- Role: `admin`
- Active: yes

No existing password, account, active flag, role or permission was changed during this administrator setup task. Cloud and local passwords are independent. The website is https://snack-time-pos.onrender.com; Android uses its HTTPS API.

## Inspect safely

From the project folder:

```powershell
npm --prefix backend run admin:status -- --target cloud
npm --prefix backend run admin:status -- --target local
```

Output contains usernames/emails/active status only. Passwords, hashes and tokens are never printed. The commands require the owner's private database connection files. Keep those files and workstation access away from cashier accounts.

## Choose or reset your administrator password

Run this yourself in a private local PowerShell/terminal:

```powershell
npm --prefix backend run admin:reset -- --target cloud --username admin
```

Use `--target local` instead to change only the local database. The command shows the target, asks you to type the selected username as explicit approval, then asks for the password twice. All three entries are hidden. Nothing is copied to shell history, command arguments, logs or a plaintext password configuration file. Noninteractive/piped password input is refused.

Choose a unique passphrase with at least **15 characters** and no more than **72 UTF-8 bytes**. Spaces and Unicode are allowed; control characters are rejected. Bcrypt uses a fresh salt and cost **12**. The command changes only the chosen administrator's password hash. It does not reactivate a disabled account, promote a cashier, rename users or delete accounts. No existing password is reset merely by inspecting or running `admin:setup`.

After a reset, existing online JWT sessions fail the credential-version check. Sign in again using the new password on the website and on each Android device. No Render redeploy is needed for a database password reset.

There is deliberately no unauthenticated public password-reset endpoint. If you forget your administrator password, repeat this owner-only local command using trusted database access. If database access is also lost, recover your Neon account/database access first. An already authenticated administrator may also use Users to reset an account; new administrator passwords use the same strength policy.

## A genuinely new database with no administrator

```powershell
npm --prefix backend run admin:setup -- --target cloud
```

The command first checks for any existing administrator, including disabled ones. If one exists it reports the account and exits without changing anything. Otherwise it asks for a hidden password and creates one active administrator. The default username is `admin`; if a cashier already owns it, an unused `admin2`, `admin3`, etc. is chosen. `--username`, `--email` and `--name` are optional non-secret metadata. An explicitly supplied occupied username is rejected rather than promoting or overwriting its owner. Concurrent setup commands are serialized with a database transaction/advisory lock. Initial seed data no longer contains login credentials; existing databases must not be re-seeded.

## Android and offline sign-in

Use Online POS for the first successful authorization on each Android device. The signed grant is bound to that device and account. SQLite is SQLCipher-encrypted using the Android Keystore-protected secret. Its local password verifier is PBKDF2-HMAC-SHA256 with a random salt and 600,000 iterations; it does not contain plaintext passwords or PostgreSQL bcrypt hashes. Local password failures/lockouts persist across restarts.

An administrator can subsequently sign in to Offline cash POS. Offline mode intentionally exposes cash POS and the account's own transaction history; administration of products, users, inventory and reports requires an online administrator session. The PostgreSQL administrator role is preserved. Cashiers cannot use administrator API routes, even if they modify the browser UI or token role text.

Offline authorization expires after seven days; sessions also have an eight-hour maximum. A disconnected device cannot learn that a server password was reset or an account was disabled. Reconnect and complete online sign-in on every device after recovery to renew its local verifier; online rejections revoke cached authority. Immediate revocation of a fully disconnected device is not possible. Local sales are retained throughout recovery.

## Owner credential storage from deployment

The earlier deployment helper wrote generated cloud logins into a private plaintext file. Those existing values were migrated **without changing their database passwords** into ignored `backend/.credentials.dpapi.json`, encrypted with Windows DPAPI `CurrentUser` protection. The obsolete `.env.cloud-credentials` now contains non-secret target metadata only. The retired helpers no longer create plaintext password files or print hashes.

This owner vault is separate from PostgreSQL and Android authentication. It is used only by owner-run cloud acceptance tests and can be decrypted only through the same Windows user's protected profile. It is never sent to Render or bundled into React/Android. The application does not need it to run. Do not copy its contents into chat. An explicitly approved cloud reset refreshes an existing matching owner test entry in encrypted form; it never writes the new password to plaintext. Resetting the actual account always uses the owner command above, not an old generated credentials file.

## Verification

Tests cover no-op setup with an existing administrator, simultaneous first setup, occupied `admin` username, bcrypt cost/verification, explicit reset approval, weak/oversized password rejection, unchanged cashier permissions, hidden terminal handling, DPAPI encryption/tamper rejection, role enforcement and session invalidation. Cloud browser and offline UI tests read owner credentials privately in memory and never print them. SQLite process restart tests exercise persistent offline authentication and lockout. Physical Android/Keystore testing remains a separate device acceptance check.

Policy references: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) and [authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).
