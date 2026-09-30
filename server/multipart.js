// Minimal multipart/form-data parser (whole body buffered; callers cap the size).

export function parseMultipart(body, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!m) throw new Error('Missing multipart boundary');
  const boundary = Buffer.from(`--${m[1] || m[2]}`);
  const fields = {};
  const files = {};

  let pos = body.indexOf(boundary);
  while (pos !== -1) {
    const start = pos + boundary.length;
    if (body.slice(start, start + 2).toString() === '--') break; // closing boundary
    const headerEnd = body.indexOf('\r\n\r\n', start);
    if (headerEnd === -1) break;
    const headers = body.slice(start + 2, headerEnd).toString('utf8');
    const next = body.indexOf(boundary, headerEnd);
    if (next === -1) break;
    const data = body.slice(headerEnd + 4, next - 2); // strip trailing \r\n

    const disposition = /content-disposition:[^\n]*/i.exec(headers)?.[0] || '';
    const name = /\bname="([^"]*)"/i.exec(disposition)?.[1];
    const filename = /\bfilename="([^"]*)"/i.exec(disposition)?.[1];
    const type = /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim() || '';
    if (name) {
      if (filename !== undefined) {
        if (data.length) files[name] = { filename, type, data };
      } else {
        fields[name] = data.toString('utf8');
      }
    }
    pos = next;
  }
  return { fields, files };
}

// Identify a file by its magic bytes (never trust the extension or declared type alone)
export function sniff(buf) {
  if (buf.length < 12) return null;
  if (buf.slice(0, 4).toString('latin1') === '%PDF') return 'pdf';
  if (buf.slice(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))) return 'doc';
  if (buf.slice(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return 'zip'; // docx is a zip
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}
