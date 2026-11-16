import { pdfExtractor } from './backend/src/integrations/extractor';

// dummy PDF buffer (same as before)
const dummyPdfBuffer = Buffer.from('%PDF-1.4\n%���\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 5 0 R >>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Hello World) Tj\nET\nendstream\nendobj\n5 0 obj\n5\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000102 00000 n \n0000000257 00000 n \n0000000354 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n418\n%%EOF', 'utf8');

(async () => {
  const result = await pdfExtractor().extract({ data: dummyPdfBuffer, mime: 'application/pdf' });
  console.log('Result:', result);
})();