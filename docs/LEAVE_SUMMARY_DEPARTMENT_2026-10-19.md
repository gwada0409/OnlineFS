# Leave summary Section / Team assignment

Admin department membership is stored in Employee.LeaveDepartmentId. The older Section text field is independent and was previously the only value shown for Section / Team in the mobile summary. The personal profile, HR summary and approver summary now include LeaveDepartmentId and LeaveDepartmentName, resolved from the current department assignment.

The shared summary uses the assigned department name first, then the trimmed legacy Section when there is no assignment. Missing values display "Not assigned". The A4 form combines the employee's original Department and resolved Section / Team, avoiding duplicate names. Department renames and reassignments appear on the next profile/summary refresh. Existing authorization rules, original employee fields, balances, and routing settings are preserved; this fix requires no schema migration or employee-data rewrite.

Focused tests cover all three API entry points with blank legacy Section, department rename, reassignment, unassignment and an unauthorized approver. Component tests cover assigned-name precedence, legacy fallback, missing assignments, and matching print output. Browser checks use a blank Section with an Admin-assigned team and verify the mobile and printed fields.
