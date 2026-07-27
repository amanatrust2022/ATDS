const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '../app/api/billing/route.ts');
let c = fs.readFileSync(p, 'utf8');

c = c.replace(/charge\.payment_method/g, "charge.paymentMethod");
c = c.replace(/charge\.billing_account_id/g, "charge.billingAccountId");
c = c.replace(/charge\.organization_id/g, "charge.organizationId");
c = c.replace(/charge\.patient_id/g, "charge.patientId");
c = c.replace(/charge\.receipt_number/g, "charge.receiptNumber");
c = c.replace(/charge\.created_by/g, "charge.createdBy");

fs.writeFileSync(p, c, 'utf8');
console.log("Fixed snake_case in app/api/billing/route.ts");
