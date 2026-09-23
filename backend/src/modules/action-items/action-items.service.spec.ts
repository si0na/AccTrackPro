import { generateAccountPrefix } from './action-items.service';

describe('ActionItemsService — Action Item # Logic', () => {
  describe('generateAccountPrefix', () => {
    it('extracts first 3 uppercase alphabetic characters for normal account names', () => {
      expect(generateAccountPrefix('Akumin Healthcare')).toBe('AKU');
      expect(generateAccountPrefix('Reflections Infosystems')).toBe('REF');
      expect(generateAccountPrefix('ABC Corporation')).toBe('ABC');
      expect(generateAccountPrefix('Accenture')).toBe('ACC');
    });

    it('handles special characters and numbers correctly', () => {
      expect(generateAccountPrefix('A-1 Tech')).toBe('ATE');
      expect(generateAccountPrefix('3M Global')).toBe('MGL');
    });

    it('pads with X when fewer than 3 alphabetic characters exist', () => {
      expect(generateAccountPrefix('A')).toBe('AXX');
      expect(generateAccountPrefix('AB')).toBe('ABX');
      expect(generateAccountPrefix('123')).toBe('XXX');
      expect(generateAccountPrefix('')).toBe('XXX');
      expect(generateAccountPrefix(undefined)).toBe('XXX');
    });
  });
});
