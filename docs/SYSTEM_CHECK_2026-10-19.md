# Leave filing investigation — 19 October 2026

Employee 21-014 has a valid REGULAR employee profile and is assigned to the active leave department ASST.SUPERVISOR/TEAMLEADER (47). The department has a recommending approver and an inherited final approver. SickLeaveLineLeaderId is NULL, which should be valid for this non-operator employee. The earlier implementation incorrectly required an SL line leader for every employee. The user clarified that this stage applies only to operators.

FileLeavePage incorrectly mapped every error containing `employee` to a profile verification failure. The SL route validation message contains `excluding the filing employee`, so the form hid the actual routing explanation. Eligibility and other routing messages could be misreported for the same reason. The fix preserves specific API validation messages and translates only exact missing-profile errors. It does not change approval requirements or assign approvers.

The routing correction requires a designated SL line leader only when Position is Operator (case-insensitive, trimmed). Other employees proceed from HR Review to Recommending and Approver. Operator SL still requires its designated leader even if normal-leave leader selection is disabled. HR review, eligibility, supporting documents, self-approval prevention, manual approval, and absence backup rules remain in force. Department and filing help text now explicitly says operators only.

The initial finding that 80 employees lacked an active department or designated SL line leader was based on the incorrect universal requirement. It must not be interpreted as 80 employees needing a line leader assignment. Fifteen employees lack an active leave department; those routes require individual review, including any explicit employee routes. No approver assignments were made by this investigation.

Server checks performed against 192.168.2.137:

- Backend readiness: application, database, and notification outbox Healthy.
- SQLite quick_check: ok; foreign_key_check: no violations.
- 110 employees; SL and VL balances each cover all 110 at 10 credits each. No negative used/pending balance values were found.
- Last 72 hours: no backend fail/critical log entries. Frontend API access logs contain two 400 responses for apply-with-attachments and seven 401 responses. No API 5xx responses were found in that window.
- Notification deliveries: 753 Delivered and 753 Skipped, no failed/pending status groups.
- Storage: 96% used, approximately 1.4 GB free. No cleanup was performed; retained backups and rollback images were preserved.
- Remaining warnings include EF multiple-collection query performance warnings, HTTP/HTTPS port configuration behind the proxy, and one long-lived notification hub request reported as slow. These were not evidence of the leave filing failure.

No production database or approval settings were changed by this investigation. Frontend error handling is covered by focused regression tests and a production build.
