# AMDOX ERP: The Grand Roadmap (50 Functional Workflows)

This document tracks the transformation of the AMDOX ERP from a skeleton to a fully integrated business engine.

## Pillar 1: Finance & Treasury (Financial Core)
1.  **Double-Entry Ledger Validation:** Prevent unbalanced Journal Entries (Debits != Credits).
2.  **Automated Period Closing:** Logic to "lock" a month/year to prevent back-dated entries.
3.  **Bank Reconciliation:** Matching uploaded bank statements to internal Cash/Bank accounts.
4.  **Fixed Asset Depreciation:** Auto-calculating and posting monthly depreciation entries for assets.
5.  **Multi-Currency Revaluation:** Updating G/L balances based on month-end exchange rates.
6.  **Expense Reimbursement:** Employee claim -> Approval -> Automated G/L posting -> Payment.
7.  **Tax Liability Engine:** Auto-calculating VAT/Sales Tax based on region and posting to liability accounts.

## Pillar 2: Supply Chain & Procurement (SCM)
8.  **Vendor Onboarding & Rating:** Performance tracking based on delivery speed and quality.
9.  **RFQ (Request for Quote):** Sending requirements to multiple vendors and comparing responses.
10. **Blanket Purchase Orders:** Long-term contracts with scheduled releases.
11. **PO Line Item Receipt:** Incremental receiving of items (partial shipments).
12. **Automated Landed Cost:** Adding freight/customs costs to product valuation.
13. **RMA (Return Merchandise Authorization):** Returning defective stock to vendors and adjusting G/L.
14. **Supplier Portal Sync:** Allowing vendors to see their pending POs via a restricted view.

## Pillar 3: Warehouse & Inventory Management
15. **Bin Location Tracking:** Managing exactly where items are (Row/Aisle/Shelf).
16. **Stock Valuation (FIFO/LIFO):** Calculating cost of goods sold based on actual inventory age.
17. **Cycle Counting:** Scheduled "blind" inventory counts to verify system accuracy.
18. **Multi-Warehouse Transfers:** Logical "In-Transit" state for stock moving between locations.
19. **Batch & Serial Tracking:** Mandatory for electronics/pharma compliance.
20. **Inventory Write-offs:** Adjusting stock for damage/theft with mandatory reason codes.

## Pillar 4: Sales & Order Management
21. **Lead-to-Quote Conversion:** Moving CRM data into a formal price offer.
22. **Sales Order Reservation:** "Ear-marking" stock so it can't be sold elsewhere while an order is pending.
23. **Automated Invoicing:** Generating a Finance Invoice immediately upon order fulfillment.
24. **Credit Note Issuance:** Handling customer returns and updating Accounts Receivable.
25. **Subscription Billing:** Recurring monthly invoices for service-based contracts.
26. **Discount & Promotion Engine:** Applying volume-based or seasonal price rules.

## Pillar 5: Human Resources & Payroll
27. **Leave Accrual Engine:** Auto-incrementing leave balances monthly based on tenure.
28. **Shift Scheduling & Attendance:** Integration between time-clocks and payroll.
29. **Payroll Tax Slab Compliance:** Dynamic tax calculation based on changing government rules.
30. **Performance Review Cycles:** Self-appraisal -> Manager review -> Salary adjustment linkage.
31. **Employee Benefits Admin:** Tracking insurance/retirement contributions.
32. **Offboarding Checklist:** Automated revocation of system access and final settlement calc.
33. **Skills Matrix:** Tracking certifications and suggesting employees for specific projects.

## Pillar 6: Project & Resource Management
34. **Gantt Dependency Logic:** Updating child task dates when parent tasks shift.
35. **Milestone-Based Billing:** Triggering invoices when a project phase is marked "Complete."
36. **Resource Over-allocation Alerts:** Warning when an employee is booked for >40hrs/week.
37. **Timesheet-to-Payroll Sync:** Paying contractors based on approved project hours.
38. **Project Profitability Analysis:** Real-time (Revenue - Labor Cost - Material Cost) per project.
39. **Document Versioning:** Attaching blueprints/specs to projects with history tracking.

## Pillar 7: AI, OCR & Intelligent Automation
40. **Demand-to-Replenishment:** AI Forecast -> Auto-generated "Draft" Purchase Orders.
41. **OCR Invoice-to-G/L:** PDF upload -> Entity Extraction -> Auto-drafted Journal Entry.
42. **Fraud Detection:** AI identifying "anomaly" transactions in the ledger.
43. **Chat-to-ERP:** Querying system stats ("What is our cash balance?") via LLM interface.
44. **Intelligent SKU Categorization:** AI suggesting categories based on product descriptions.
45. **Predictive Churn:** Identifying customers who haven't ordered in their usual cycle.

## Pillar 8: Platform, Security & Governance
46. **Tenant Data Isolation Hardening:** Row-level security (RLS) validation.
47. **Immutable Audit Chaining:** SHA-256 hash-linking for compliance (SOX/GDPR).
48. **Dynamic RBAC:** Custom role creation with granular permission bitmasks.
49. **Webhook Retry Logic:** Ensuring external system syncs don't fail due to network blips.
50. **System Health Self-Healing:** Automated Redis/DB cleanup jobs.

---

## Current Execution Focus
We are currently focusing on Pillar 7 & 1: **OCR-to-Finance (Intelligent Document Processing)**.
