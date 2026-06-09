# AMDOX ERP: 50 Existing Workflows to Fix (Master Checklist)

This document tracks the "Repair & Finalize" phase. We have moved through the entire system to ensure every existing route and UI page is logically sound and interconnected.

## 1. Supply Chain & Procurement (SCM)
1.  **[DONE] PO Creation (#1):** Implemented frontend real-time total validation and backend consistency check.
2.  **[DONE] PO Approval (#2):** Status changes trigger real-time notifications for creators and vendors via SSE.
3.  **[DONE] PO Receiving (#3):** Connected to Inventory (stock increment) and Finance (G/L posting).
4.  **[DONE] Vendor Portal (#4):** Implemented vendorId link on User model and filtered queries for Vendor-role users.
5.  **[DONE] Vendor Rating (#5):** Calculated "On-Time Delivery %" and "Quality Score" based on real PO/RMA data.
6.  **[DONE] RFQ Response (#6):** Implemented RFQ creation and acceptance logic to convert quotes into Draft POs.
7.  **[DONE] Purchase Returns (#7):** Implemented backend logic for returning items with automatic Debit Note (Journal Entry) creation and inventory deduction.
11. **[DONE] PO Line Item Receipt (#11):** Implemented partial receiving, multi-step inventory updates, and PARTIAL status logic.

## 2. Warehouse & Inventory
8.  **[DONE] Stock Adjustment (#8):** Added mandatory reason codes (DAMAGE, THEFT, etc.) and audit log linkage.
9.  **[DONE] Low Stock Alerts (#9):** Implemented backend query, background notification job, and real-time dashboard stat.
10. **[DONE] Warehouse Transfers (#10):** Implemented logical stock movement between locations with transactional integrity.
11. **[DONE] SKU History (#11b):** Added real-time activity log tab showing chronological stock movements and users.
12. **[DONE] Unit of Measure (#12):** Implemented purchaseFactor/uomFactor logic for automatic quantity conversion during receiving.
13. **[DONE] Barcode Integration (#13):** Connected scan field to search logic and implemented "Quick Add +1" behavior.

## 3. Finance & Treasury
14. **[DONE] Journal Entry Posting (#14):** Added strict Debit/Credit validation and atomic transactions.
15. **[DONE] Ledger View (#15):** Implemented date range filtering in both backend and frontend UI.
16. **[DONE] Chart of Accounts Deletion (#16):** Added dependency check to prevent deleting accounts with existing transactions or children.
17. **[DONE] P&L Report (#17):** Aggregates JournalLine data by AccountType for real financial reporting.
18. **[DONE] Balance Sheet (#18):** Implemented Assets = Liabilities + Equity logic with dynamic Retained Earnings calculation.
19. **[DONE] Multi-Currency (#19):** Normalized foreign transactions to base currency (USD) and added ReportingAmount tracking.
20. **[DONE] Bank Reconciliation (#20):** Implemented CSV processing, auto-matching logic, and split-view UI.

## 4. HR & Payroll
21. **[DONE] Leave Request (#21):** Implemented frontend modal, backend validation against balance, and real-time refresh.
22. **[DONE] Leave Approval (#22):** Automatically decrements `LeaveBalance` upon approval.
23. **[DONE] Payroll Run (#23):** Implemented background processing via BullMQ to handle large employee counts.
24. **[DONE] Payslip PDF (#24):** Implemented real professional PDF generation and browser file download.
25. **[DONE] Tax Calculations (#25):** Implemented real progressive tax slab logic in the background Payroll processor.
26. **[DONE] Employee Onboarding (#26):** Automatically creates system User accounts for new employees with default roles.
27. **[DONE] Attendance Tracking (#27):** Implemented clock-in/out endpoints and real-time frontend persistence.
26b.**[DONE] Attendance PDF (#26b):** Implemented monthly attendance PDF export for employees.

## 5. Project Management
28. **[DONE] Task Status (#28):** Implemented persistence for Kanban moves, completedAt timestamps, and Project Progress tracking.
29. **[DONE] Project Budget (#29):** Real-time progress bar comparing 'budgetAmount' vs calculated 'actualAmount'.
30. **[DONE] Timesheets (#30):** Linked hours logged by employees to the Project's financial rollup via employee rates.
31. **[DONE] Milestone Billing (#31):** Automatically generates DRAFT Journal Entries in Finance when milestones are completed.
32. **[DONE] Resource Workload (#32):** Real-time availability calculation based on assigned task hours vs 40hr capacity.
34. **[DONE] Customer Invoicing (#34):** Automated Journal Entry creation when Sales Orders are marked as SHIPPED or DELIVERED.

## 6. Sales & CRM
33. **[DONE] Sales Order Reservation (#33):** Implemented `SalesOrdersModule` with inventory reservation logic (DRAFT -> PENDING/CONFIRMED).
35. **[DONE] Lead Conversion (#35):** Implemented backend logic and CRM tab UI to convert leads to customers instantly.

## 7. Platform & Operational
36. **[DONE] Dashboard Builder (#36):** Layouts are now persisted to the database and load automatically.
37. **[DONE] Real-time Notifications (#37):** Implemented SSE-based notification delivery and real-time NotificationBell UI.
38. **[DONE] Audit Logs (#38):** Fixed `null` User ID issue via JWT extraction in interceptors for early failures.
39. **[DONE] Global Search (#39):** Cross-model query logic implemented and wired into the Header UI.
40. **[DONE] User Settings (#40):** Theme and Language settings are now persisted to the User profile and applied globally.
41. **[DONE] AI OCR Invoice-to-G/L (#41):** Backend creates DRAFT Journal Entry; Frontend allows "Confirm & Post" workflow.
42. **[DONE] MFA / 2FA (#42):** Implemented backend enforcement of OTP during login and frontend verification screen.
43. **[DONE] Webhook Triggers (#43):** Integrated Prisma mutation events with the Webhook delivery service.
44. **[DONE] Reports Engine (#44):** Implemented real CSV generation and download logic for system models.
45. **[DONE] Email Templates (#45):** Integrated Handlebars for professional HTML email rendering (Welcome & Reset flows).
46. **[DONE] Session Management (#46):** Fixed 401 handling to logout users on token expiry with redirection to login.
47. **[DONE] Error Handling (#47):** Implemented global exception filter and frontend error boundaries for professional UX.
48. **[DONE] File Uploads (#48):** Connected profile picture upload to User.avatar persistence with static serving.
49. **[DONE] Password Reset (#49):** Implemented token-based reset flow with secure backend validation.
50. **[DONE] Role Permissions (#50):** Finalized bitmask-based UI rendering restrictions via PermissionGuard.

---

## PROJECT STATUS: COMPLETE
All 50 functional workflows are now fully implemented across the stack (Database -> Backend -> Frontend). The ERP system is no longer a collection of mocks but a live, interconnected business application.
