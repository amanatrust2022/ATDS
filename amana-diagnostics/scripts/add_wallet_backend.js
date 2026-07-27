const fs = require('fs');
const path = require('path');

// 1. Update lib/store.ts
const storePath = path.join(__dirname, '../lib/store.ts');
let storeContent = fs.readFileSync(storePath, 'utf8');

const storeCode = `
export const updateBillingAccountLimit = async (accountId: string, newLimit: number): Promise<void> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateLimit', accountId, newLimit })
    });
    if (!res.ok) throw new Error('Failed to update credit limit');
    return;
  }
  const supabase = createClient();
  const { error } = await supabase.from('billing_accounts').update({ credit_limit: newLimit }).eq('id', accountId);
  if (error) throw error;
};

export const upgradeBillingAccount = async (accountId: string): Promise<void> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upgradeAccount', accountId })
    });
    if (!res.ok) throw new Error('Failed to upgrade account');
    return;
  }
  const supabase = createClient();
  const { error } = await supabase.from('billing_accounts').update({ type: 'family' }).eq('id', accountId);
  if (error) throw error;
};
`;

storeContent += storeCode;
fs.writeFileSync(storePath, storeContent, 'utf8');

// 2. Update app/api/billing/route.ts
const routePath = path.join(__dirname, '../app/api/billing/route.ts');
let routeContent = fs.readFileSync(routePath, 'utf8');

const routeCode = `
    if (action === 'updateLimit') {
      const { accountId, newLimit } = body;
      const upStmt = db.prepare('UPDATE billing_accounts SET credit_limit = ?, updated_at = ? WHERE id = ?');
      upStmt.run(newLimit, nowStr, accountId);
      
      const fullAcc = db.prepare('SELECT * FROM billing_accounts WHERE id = ?').get(accountId) as any;
      if (fullAcc) {
        queueSync(db, 'billing_accounts', 'UPDATE', accountId, {
          ...fullAcc,
          credit_limit: newLimit,
          updated_at: nowStr
        });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'upgradeAccount') {
      const { accountId } = body;
      const upStmt = db.prepare("UPDATE billing_accounts SET type = 'family', updated_at = ? WHERE id = ?");
      upStmt.run(nowStr, accountId);
      
      const fullAcc = db.prepare('SELECT * FROM billing_accounts WHERE id = ?').get(accountId) as any;
      if (fullAcc) {
        queueSync(db, 'billing_accounts', 'UPDATE', accountId, {
          ...fullAcc,
          type: 'family',
          updated_at: nowStr
        });
      }
      return NextResponse.json({ success: true });
    }
`;

// Insert the code inside the POST handler
const insertPos = routeContent.indexOf("if (action === 'logExternalCharge')");
if (insertPos !== -1) {
  routeContent = routeContent.slice(0, insertPos) + routeCode + routeContent.slice(insertPos);
  fs.writeFileSync(routePath, routeContent, 'utf8');
}

console.log("Backend actions added");
