# Automated Testing Blueprint (Unit + Feature)

To eradicate the "whack-a-mole" bug cycle (where fixing one feature breaks another), our testing strategy strictly enforces two layers of defense using Vitest and React Testing Library (RTL).

## 1. The Rationale: Two Layers of Defense
- **The Brain (Unit Tests):** Testing the pure logic in Zustand stores (e.g., `calculateLedgerTotal`). This proves the math and state transitions work.
- **The Body (Feature/Integration Tests):** Testing how the React components behave when a user interacts with them. This proves the *feature* works (e.g., "When the user clicks 'Register', the API is called and a success message appears").

## 2. Feature Testing Blueprint (React Testing Library)

### A. Testing User Interactions (Not Implementation Details)
When testing a UI feature, never test *how* the component is built (e.g., checking for specific CSS classes). Test *what the user experiences* (e.g., finding a button by its text and clicking it).

**Source**: `components/features/queue/QueueTab.tsx`
**Test**: `components/features/queue/QueueTab.test.tsx`

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { QueueTab } from './QueueTab';
import { describe, it, expect, vi } from 'vitest';

describe('Feature: Patient Queue Management', () => {
  it('should allow the user to search and filter the queue', () => {
    // 1. Render the component with mock data
    render(<QueueTab patients={mockPatients} onViewSlip={vi.fn()} onViewResult={vi.fn()} />);

    // 2. Simulate User Action: Typing in the search bar
    const searchInput = screen.getByPlaceholderText('Search by name or slip number...');
    fireEvent.change(searchInput, { target: { value: 'John' } });

    // 3. Assert the outcome
    expect(screen.getByText('John Doe')).toBeDefined();
    expect(screen.queryByText('Jane Smith')).toBeNull(); // Should disappear
  });
});
```

### B. Mocking API Calls & Contexts for Features
Feature tests often break because the component tries to fetch real data during the test. Always mock global fetches or Repositories.

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock global fetch
global.fetch = vi.fn();

describe('Feature: Adding Funds to Wallet', () => {
  it('should successfully submit a deposit', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    render(<WalletTab accounts={mockAccounts} />);

    // Simulate clicking and typing
    await userEvent.click(screen.getByRole('button', { name: /Add Funds/i }));
    await userEvent.type(screen.getByPlaceholderText('Amount'), '5000');
    await userEvent.click(screen.getByRole('button', { name: /Submit Deposit/i }));

    // Assert the API was called
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/billing/deposit', expect.anything());
    });
  });
});
```

## 3. Unit Testing Blueprint (Zustand Stores)

### A. Extract Pure Functions from the Zustand Hook
Whenever possible, do not test the Zustand hook itself using complex wrappers. Extract the complex logic into pure TypeScript functions and test those directly.

```typescript
// Pure function export for easy testing
export const calculateLedgerTotal = (items: Item[]) => {
  return items.reduce((acc, item) => acc + item.price, 0);
};
```

### B. Mocking Time for Date-Dependent Logic
Medical diagnostic software relies heavily on dates. Always use Vitest's fake timers to freeze time.

```typescript
describe('Date Filters', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 27, 12, 0, 0)); // July 27, 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should filter out patients older than 7 days', () => { ... });
});
```

## 4. Definition of Done (DoD) Checklist for Testing
When an AI Agent builds or fixes a feature, ensure:
1. Is the business logic extracted into pure functions and covered by a **Unit Test**?
2. Is the user interaction covered by a **Feature Test** (RTL)?
3. Does `npx vitest run` pass flawlessly?
