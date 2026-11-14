# OnlineFS

OnlineFS is leave-filing and approval application. The current system is split across:

- React/TypeScript/PWA frontend: 
- ASP.NET Core/EF Core/SQLite backend: 
- Production SQLite database: 

## Capabilities

- Employee leave filing, policy validation, attachments, balances, history, cancellation, rescheduling, and printable leave summary
- Department/category approval routing, delegation, approver actions, and immutable completed approval history
- HR finalization, balance management, reports, and CSV export
- Personal, Approval, HR, and System notification workspaces with SignalR and Web Push
- Admin/SystemAdmin operations with backend-authoritative capability checks

## Development setup

Prerequisites: Node.js 20+, npm, and .NET 10 SDK.

```powershell
npm ci
npm run dev
```

In another PowerShell session, provide an ephemeral development signing key without printing it:

```powershell
cd C:\Users\g.adorio\Documents\AutoID\src\AutoID
$env:JWT__SIGNINGKEY = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
dotnet run
```

Open `http://localhost:5173`. Vite proxies `/api` and `/hubs` to `http://127.0.0.1:5000`.

## Quality gate

Run this before every release:

```powershell
npm run quality
```

It performs TypeScript checking, frontend tests, a production PWA build, bundle-budget enforcement, a zero-warning backend Release build, and the complete rebuilt backend suite against isolated in-memory SQLite. It never opens production `app.db`.

## Documentation

- [Architecture and role boundaries](docs/ARCHITECTURE.md)
- [Operations, migrations, backup, recovery, and deployment](docs/OPERATIONS.md)
- [API reference](docs/API.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Approval routing design](docs/approval-routing-design.md)
- [Sick Leave HR review and grouped signatories](docs/SICK_LEAVE_APPROVALS.md)
- [Refactor audit](REFACTOR_AUDIT.md)

Internal and proprietary. Never commit credentials, JWTs, employee PINs, push private keys, or production database copies.
