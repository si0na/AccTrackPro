import { matchesDeclaredMimeType } from '../file-signature.util';

const PDF   = Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj', 'latin1');
const PNG   = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const JPEG  = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const GIF   = Buffer.from('GIF89a\x01\x00\x01\x00', 'latin1');
const WEBP  = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0x00, 0x00, 0x00]), Buffer.from('WEBPVP8 ')]);
const ZIP   = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const OLE2  = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00]);
const EXE   = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]); // MZ header

describe('matchesDeclaredMimeType', () => {
  it('accepts files whose content matches the declared type', () => {
    expect(matchesDeclaredMimeType(PDF, 'application/pdf')).toBe(true);
    expect(matchesDeclaredMimeType(PNG, 'image/png')).toBe(true);
    expect(matchesDeclaredMimeType(JPEG, 'image/jpeg')).toBe(true);
    expect(matchesDeclaredMimeType(JPEG, 'image/jpg')).toBe(true);
    expect(matchesDeclaredMimeType(GIF, 'image/gif')).toBe(true);
    expect(matchesDeclaredMimeType(WEBP, 'image/webp')).toBe(true);
    expect(matchesDeclaredMimeType(ZIP, 'application/zip')).toBe(true);
    expect(matchesDeclaredMimeType(ZIP, 'application/x-zip-compressed')).toBe(true);
  });

  it('accepts OOXML (zip container) for modern Office types and OLE2 for legacy', () => {
    expect(
      matchesDeclaredMimeType(ZIP, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ).toBe(true);
    expect(
      matchesDeclaredMimeType(ZIP, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ).toBe(true);
    expect(matchesDeclaredMimeType(OLE2, 'application/msword')).toBe(true);
    expect(matchesDeclaredMimeType(OLE2, 'application/vnd.ms-excel')).toBe(true);
    expect(matchesDeclaredMimeType(OLE2, 'application/vnd.ms-powerpoint')).toBe(true);
  });

  it('accepts plain text, CSV, and JSON content', () => {
    expect(matchesDeclaredMimeType(Buffer.from('hello world'), 'text/plain')).toBe(true);
    expect(matchesDeclaredMimeType(Buffer.from('a,b,c\n1,2,3'), 'text/csv')).toBe(true);
    expect(matchesDeclaredMimeType(Buffer.from('{"ok":true}'), 'application/json')).toBe(true);
    // UTF-16 LE BOM text is still text
    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('h\0i\0', 'latin1')]);
    expect(matchesDeclaredMimeType(utf16, 'text/plain')).toBe(true);
  });

  it('accepts SVG with an <svg> root and XML declaration', () => {
    const svg = Buffer.from('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(matchesDeclaredMimeType(svg, 'image/svg+xml')).toBe(true);
  });

  it('rejects content that does not match the declared type', () => {
    // Renamed executable claiming to be a PDF / image / Office doc
    expect(matchesDeclaredMimeType(EXE, 'application/pdf')).toBe(false);
    expect(matchesDeclaredMimeType(EXE, 'image/png')).toBe(false);
    expect(
      matchesDeclaredMimeType(EXE, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ).toBe(false);
    // ZIP renamed to .pdf
    expect(matchesDeclaredMimeType(ZIP, 'application/pdf')).toBe(false);
    // PNG claiming to be a JPEG
    expect(matchesDeclaredMimeType(PNG, 'image/jpeg')).toBe(false);
    // Binary content claiming to be text
    expect(matchesDeclaredMimeType(EXE.includes(0x00) ? EXE : PNG, 'text/plain')).toBe(false);
    // Plain text claiming to be SVG
    expect(matchesDeclaredMimeType(Buffer.from('just text'), 'image/svg+xml')).toBe(false);
  });

  it('rejects MIME types with no known signature', () => {
    expect(matchesDeclaredMimeType(PDF, 'application/x-msdownload')).toBe(false);
  });
});
