import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

/**
 * DRIFT GUARD: Ensures committed golden fixture in this repo matches the shared parent fixture.
 * If this test fails, the contracts have diverged.
 */
describe('Golden Fixture Drift Guard', () => {
  it('committed copy matches shared parent fixture', () => {
    const committedPath = path.join(__dirname, '../../..', 'contracts-golden.json');
    const parentPath = path.join(__dirname, '../../../../contracts', 'finance-golden.json');

    const committedContent = fs.readFileSync(committedPath, 'utf8');
    const parentContent = fs.readFileSync(parentPath, 'utf8');

    const committedHash = createHash('sha256').update(committedContent).digest('hex');
    const parentHash = createHash('sha256').update(parentContent).digest('hex');

    expect(committedHash).toBe(parentHash);
  });
});
