import { normalisePriority } from './hl7-mapper';

describe('normalisePriority', () => {
  it.each([
    ['S', 'STAT'],
    ['s', 'STAT'],
    ['A', 'URGENT'],
    ['T', 'URGENT'],
    ['P', 'URGENT'],
    ['R', 'ROUTINE'],
    ['', 'ROUTINE'],
    ['routine', 'ROUTINE'],
    ['unknown', 'ROUTINE'],
  ])('maps %j to %s', (raw, expected) => {
    expect(normalisePriority(raw as string)).toBe(expected);
  });
});
