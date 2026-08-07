import { resolveMimeType, extensionOf } from '../file-type.util';

describe('resolveMimeType', () => {
  it('maps every accepted extension to its canonical MIME type', () => {
    const cases: Array<[string, string]> = [
      ['contract.pdf',   'application/pdf'],
      ['sow.doc',        'application/msword'],
      ['sow.docx',       'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      ['budget.xls',     'application/vnd.ms-excel'],
      ['budget.xlsx',    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ['deck.ppt',       'application/vnd.ms-powerpoint'],
      ['deck.pptx',      'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      ['notes.txt',      'text/plain'],
      ['export.csv',     'text/csv'],
      ['config.json',    'application/json'],
      ['logo.png',       'image/png'],
      ['photo.jpg',      'image/jpeg'],
      ['photo.jpeg',     'image/jpeg'],
      ['anim.gif',       'image/gif'],
      ['hero.webp',      'image/webp'],
      ['icon.svg',       'image/svg+xml'],
      ['bundle.zip',     'application/zip'],
    ];
    for (const [name, expected] of cases) {
      expect(resolveMimeType(name, 'application/octet-stream')).toBe(expected);
    }
  });

  it('never classifies a spreadsheet or presentation as a Word document', () => {
    expect(resolveMimeType('q3.xlsx', '')).not.toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(resolveMimeType('q3.pptx', '')).not.toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
  });

  it('overrides the client MIME type when it contradicts the extension', () => {
    // Windows reports .csv as vnd.ms-excel when Excel is installed.
    expect(resolveMimeType('export.csv', 'application/vnd.ms-excel')).toBe('text/csv');
    // Some clients send no type at all for OOXML files.
    expect(resolveMimeType('budget.xlsx', '')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });

  it('is case-insensitive on the extension', () => {
    expect(resolveMimeType('BUDGET.XLSX', '')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });

  it('falls back to the declared type, normalising known aliases', () => {
    expect(resolveMimeType('archive', 'application/x-zip-compressed')).toBe('application/zip');
    expect(resolveMimeType('photo', 'image/jpg')).toBe('image/jpeg');
    expect(resolveMimeType('noext', 'application/pdf')).toBe('application/pdf');
    expect(resolveMimeType('noext', '')).toBe('');
  });
});

describe('extensionOf', () => {
  it('returns the lower-cased extension, or empty when there is none', () => {
    expect(extensionOf('a.Report.XLSX')).toBe('.xlsx');
    expect(extensionOf('README')).toBe('');
    expect(extensionOf('')).toBe('');
  });
});
