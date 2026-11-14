# Line leader leave routing

Regular leave for employees whose trimmed Position is Operator (case-insensitive) requires the operator to choose one configured department line leader when filing only when their active leave department enables RequiresOperatorLineLeader. Other regular-leave routes remain unchanged.

Sick Leave is the existing SL code. It requires the existing HR fit-to-work/additional-rest assessment, the leave department's separate SickLeaveLineLeaderId, Recommending, and Approver. It never substitutes the operator-selected normal-leave leader or the legacy Noted by pool for its designated SL leader.

## Configure in Departments > Edit

- Assign an SL designated line leader for every leave department used for SL.
- Enable Operator line leader selection only in applicable departments.
- Configure the eligible Department line leaders / Noted by list in that department's editor. The operator chooses from that list when filing; no automatic personal assignment is used.
- Keep Recommending and Approver configured through the existing department/category settings.

Missing selections, non-department selections, and self-selection block normal Operator submission. Missing SL designated leaders block SL submission. If an operator selects the wrong eligible leader, that leader can explain in the request conversation. The operator cancels and files a new request with the correct leader. The cancelled request and its original chosen leader remain in history and cannot be approved. New leader fields are foreign keys; deletion clears assignments and future submissions require reconfiguration. Leaders use employee accounts and receive Approvals capability without changing their organization role. Only the snapshot's selected/designated line leader may act at its current stage. Existing recommending/final approver delegation is preserved. HR review remains a group of eligible assigned HR employees, with any one assigned member completing the stage.

## Migration and verification

Apply AddLineLeaderRouting20261008 with the matching backend before using the new frontend. Existing regular departments default to disabled. Existing request snapshots retain their original signatories; no pending or completed requests are rewritten. Configure department SL leaders before new SL filing is needed. Back up the production database before deployment.

Run frontend tests/build/bundle check and `dotnet run --project ../AutoID/tests/LineLeaderWorkflowChecks/LineLeaderWorkflowChecks.csproj`. The new backend suite uses in-memory SQLite, including an upgrade from the previous migration, and exercises submission, all approval phases, queues, notifications, audit history, assignment validation, rejection, cancellation, and out-of-order attempts.
