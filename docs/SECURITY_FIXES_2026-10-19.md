# Security fixes — 19 October 2026

Scope: audit findings 2, 3, 4 and 6. Deployment verification is recorded below after activation. The earlier disk cleanup reduced usage from 97% to 88%; staging the patched runtime temporarily increases usage.

## Changes

- Both Nginx proxies log HTTP method and path without query strings, referrers, cookies or authorization headers. SignalR location errors are suppressed because Nginx cannot redact query credentials from error messages. Response status remains in the safe access log; backend diagnostics remain available.
- Generic static files and thumbnails require a resolved principal. Employees can read their own recorded photo/signature. System administrators retain access to ID assets. Leave attachments always use the dedicated endpoint that checks owner, assigned approver/delegate or HR access. Database backups, restore snapshots, traversal and symbolic links are denied.
- Approval routing deduplicates members within a stage. The same person assigned to different roles remains in each required stage and must make each manual decision separately. HR fitness review, operator-only SL line leaders and absence backups are preserved. Historical completed requests are retained.
- Photo processing, background removal and ID-card composition use SkiaSharp 4.153.1 with matching Linux native assets. PNG/JPEG export, orientation, cropping, signatures, QR codes, template sizing and PDF export are covered by synthetic checks. Source image allocations are limited to 64 megapixels. Native license notices ship under Assets/Licenses.

## Patched dependencies

| Component | Release version |
| --- | --- |
| .NET / ASP.NET Core runtime | 10.0.13 |
| JWT bearer package | 10.0.13 |
| EF Core SQLite provider | 8.0.32 |
| SQLitePCLRaw native package | 2.1.13 |
| Actual native SQLite engine | 3.53.3, checked on Windows and Linux |
| System.IO.Packaging | 10.0.13 |
| System.Security.Cryptography.Pkcs | 10.0.13 |
| SkiaSharp / Linux native assets | 4.153.1 |

ImageSharp and its drawing package are absent from the application dependency manifest. Excel export still depends on SixLabors.Fonts **1.0.0**, whose published license is Apache 2.0; it does not require the licensed image stack. See the [package license](https://www.nuget.org/packages/SixLabors.Fonts/1.0.0). SkiaSharp is [MIT licensed](https://mono.github.io/SkiaSharp/). NuGet auditing includes transitive packages, and the blanket NU1902/NU1903 suppression is removed. The release dependency audit returns no known vulnerable packages; this is a point-in-time package check, not a guarantee against future advisories.

## Verification and compatibility

- Frontend: 103 tests passed. The first highly parallel run timed out; limiting workers to two passed the complete suite.
- Backend: 66 security/image checks, 99 line-leader workflow checks, 51 absence-coverage checks, and 25 employee-summary checks passed against the isolated release source and inside Linux runtime containers.
- Actual Nginx configuration syntax and 401 authentication responses are checked in isolated containers. Both successful proxy handling and simulated upstream failure must omit token-query sentinels from their logs.
- A fresh isolated database must migrate successfully and report Healthy under the new runtime before activation.
- ID-card text uses Skia font metrics; custom template wrapping can differ slightly from ImageSharp. Synthetic cards were inspected visually. Standard PNG/JPEG inputs are supported; this SkiaSharp release disables RAW/DNG decoding ([publisher release notes](https://mono.github.io/SkiaSharp/docs/releases/4.153.1.html)).

## Deployment safeguards

Only selected security source files and proxy configurations are deployed. Existing frontend assets are retained. Unrelated local edits are excluded. Rollback images and source backups are retained. A consistent SQLite backup stays on the Linux server; employee databases are not exported to the workstation.

Tokens found in old container logs are parsed and cryptographically verified only on Linux. Only a matching, unexpired current session is invalidated. Tokens, signing keys and session identifiers are not returned in reports or used in HTTP requests. Recreating the proxy containers removes their old Docker log files. Affected users must sign in again. No PIN, employee, department, leave balance or completed request is reset.

Deployment status: **deployed and verified on Linux** at `/home/pgadmin/releases/security-20261019-155204`.

The consistent pre-change database backup is `/home/pgadmin/releases/security-20261019-155204/app.db.before`. The server reports Healthy with database integrity `ok`. Verification preserved all 35 business tables, including 110 employees, 38 departments, the 10 SL / 10 VL policy and existing leave history. Only three exposed current session identifiers were cleared. Both live proxies passed safe-logging checks; all three application containers run the expected release images. Disk usage after retaining the new runtime and rollback backups is 90%, with about 2.9 GiB available.

Other findings from the original audit remain outside this change, including the shared initial PIN/setup-session issue.
