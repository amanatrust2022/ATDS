const fs = require('fs');
const path = require('path');

const agentsPath = path.join(__dirname, '../.agents/AGENTS.md');
let agentsContent = fs.readFileSync(agentsPath, 'utf8');

const newRule = `
## 5. Frontend Conventions (Component-Based Architecture)
- **State vs. UI Separation**: Keep UI components presentational where possible. Business logic, price calculations, and complex form states must live in dedicated Zustand slices under \`lib/store/\`.
- **Feature Grouping**: Group UI sub-components by feature inside \`components/features/<feature-name>/\` (e.g., \`components/features/registration/\`) instead of placing everything in a single page component.
- **Ephemeral vs. Domain State**:
  - Use local React \`useState\` only for transient UI state (e.g., search bar text, modal visibility, hover states).
  - Use Zustand stores for domain data that drives the feature (e.g., selected items, calculated totals, submitted payload).
- **Testing Requirement**: Every Zustand store or complex business logic function must have a co-located or parallel unit test in Vitest (\`*.test.ts\`) before being wired into the UI.
`;

agentsContent += newRule;

fs.writeFileSync(agentsPath, agentsContent, 'utf8');
console.log('Appended to AGENTS.md successfully');
