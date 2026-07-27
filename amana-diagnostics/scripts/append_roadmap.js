const fs = require('fs');
const path = require('path');

const agentsPath = path.join(__dirname, '../.agents/AGENTS.md');
let agentsContent = fs.readFileSync(agentsPath, 'utf8');

const newRule = `
## 6. Ongoing Refactoring Roadmap (Divide & Conquer)
We are actively transitioning away from God Components (\`ReceptionPage.tsx\`, \`DepartmentPage.tsx\`) and Monolithic State (\`lib/store.ts\`). All future work must adhere to this phased strategy:
- **Phase 1 (Active): Feature Extraction.** Pick specific tabs/areas of giant pages and extract them into \`components/features/*\`. Move all domain state into smaller Zustand slices.
- **Phase 2 (Upcoming): Sync Abstraction.** Abstract the complex SQLite (Local Mode) vs Supabase (Cloud Mode) fetching/syncing logic behind clean repository interfaces so components do not dictate how to fetch or sync data.
- **Phase 3 (Ongoing): Gradual Rollout.** Apply these patterns systematically across all modules before adding complex new features.
`;

if (!agentsContent.includes('Ongoing Refactoring Roadmap')) {
  agentsContent += newRule;
  fs.writeFileSync(agentsPath, agentsContent, 'utf8');
  console.log('Appended Refactoring Roadmap to AGENTS.md');
} else {
  console.log('Refactoring Roadmap already exists in AGENTS.md');
}
