// Set environment variables for testing
process.env.EXTRACTOR = 'pdf';
console.log('EXTRACTOR env var:', process.env.EXTRACTOR);
process.env.LINK_TOKEN_SECRET = 'test-secret';
process.env.LINK_TOKEN_TTL_DAYS = '1';
process.env.STORAGE_DRIVER = 'local'; // or s3, but we'll use local
process.env.STORAGE_DIR = './tmp/storage';
process.env.NOTICE_VERSION = 'v1';
process.env.DOC_RETENTION_DAYS = '90';
process.env.MAX_FILES = '3';
process.env.MAX_FILE_MB = '15';
process.env.WA_SUMMARY_TEMPLATE_ID = 'cover_check_summary_v1';
process.env.NODE_ENV = 'development';
console.log('Before import, process.env.EXTRACTOR:', process.env.EXTRACTOR);

import { buildDeps } from './backend/src/wiring';
console.log('After import, process.env.EXTRACTOR:', process.env.EXTRACTOR);

async function testExtractor() {
  const deps = buildDeps();

  // Create a dummy PDF buffer (same as before)
  const dummyPdfBuffer = Buffer.from('%PDF-1.4\n%���\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 5 0 R >>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Hello World) Tj\nET\nendstream\nendobj\n5 0 obj\n5\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000102 00000 n \n0000000257 00000 n \n0000000354 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n418\n%%EOF', 'utf8');

  console.log('Testing PDF extractor...');
  const result = await deps.extractor.extract({ data: dummyPdfBuffer, mime: 'application/pdf' });

  if (!result.ok) {
    console.error('Extraction failed:', result.reason);
    return;
  }

  console.log('Extraction successful!');
  console.log(`Extractor version: ${result.extractorVersion}`);
  console.log(`Pages: ${result.pages}`);
  console.log('Facts:');
  result.facts.forEach(fact => {
    console.log(`  ${fact.key}: ${JSON.stringify(fact.value)} (confidence: ${fact.confidence}, sourcePage: ${fact.sourcePage})`);
  });
}

testExtractor().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});