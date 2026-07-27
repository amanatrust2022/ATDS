const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '../components/features/wallet/LedgerModal.tsx');
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  'const handleLinkExistingDependent = async',
  `const handleUpdateLimit = async (accountId: string) => {
    const limit = Number(newCreditLimit);
    if (isNaN(limit) || limit < 0) return alert('Invalid credit limit');
    try {
      await updateBillingAccountLimit(accountId, limit);
      store.updateCreditLimit(accountId, limit);
      setIsEditingLimit(false);
      alert('Credit limit updated successfully');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpgradeAccount = async (accountId: string) => {
    try {
      await upgradeBillingAccount(accountId);
      store.upgradeAccountToFamily(accountId);
      alert('Account upgraded to Family successfully');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLinkExistingDependent = async`
);

fs.writeFileSync(p, c, 'utf8');
console.log("Updated actions in LedgerModal.tsx");
