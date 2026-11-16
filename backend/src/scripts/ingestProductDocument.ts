import { createHash } from 'node:crypto';
import { pool } from '../db/pool.js';
import {
  extractProductEvidenceFromPages,
  PRODUCT_EVIDENCE_EXTRACTOR_VERSION,
  readProductPdf,
} from '../integrations/productDocumentReader.js';

const MAX_BYTES = 50 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30_000;

const OFFICIAL_DOMAINS: Array<{ insurer: RegExp; domains: string[] }> = [
  { insurer: /icici\s*lombard/i, domains: ['icicilombard.com'] },
  { insurer: /hdfc\s*ergo/i, domains: ['hdfcergo.com'] },
  { insurer: /manip(al)?\s*cigna/i, domains: ['manipalcigna.com'] },
  { insurer: /tata\s*aig/i, domains: ['tataaig.com'] },
  { insurer: /niva\s*bupa/i, domains: ['nivabupa.com'] },
];

const DOCUMENT_TYPES = new Set([
  'policy_wording', 'prospectus', 'customer_information_sheet', 'add_on_wording',
  'proposal_form', 'brochure', 'official_product_page', 'other',
]);

type Args = Record<string, string>;

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === undefined) continue;
    if (token === '--help' || token === '-h') {
      args.help = 'true';
      continue;
    }
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    if (args[key]) throw new Error(`Duplicate argument: --${key}`);
    args[key] = value;
  }
  return args;
}

function usage(): string {
  return [
    'Ingest an official insurer PDF as pending-review evidence (does not approve policy terms).',
    '',
    'Required:',
    '  --insurer "ICICI Lombard" --product "Elevate" --type policy_wording --url https://official-insurer-domain/path.pdf',
    '',
    'Optional:',
    '  --uin "..." --title "..." --version "..." --published YYYY-MM-DD',
    '  --effective-from YYYY-MM-DD --effective-to YYYY-MM-DD',
    '',
    'Supported insurer domains: ICICI Lombard, HDFC ERGO, ManipalCigna, Tata AIG, Niva Bupa.',
    'Use only the insurer\'s official HTTPS PDF URL. Scanned PDFs are rejected until OCR is approved.',
  ].join('\n');
}

function validateDate(value: string | undefined, flag: string): string | null {
  if (value === undefined) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))
      || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error(`--${flag} must be a real date in YYYY-MM-DD format.`);
  }
  return value;
}

function officialUrl(raw: string, insurer: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('--url must be a valid HTTPS URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('--url must use HTTPS and must not contain credentials.');
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const rule = OFFICIAL_DOMAINS.find(item => item.insurer.test(insurer));
  if (!rule) throw new Error('Unsupported insurer. This first version supports ICICI Lombard, HDFC ERGO, ManipalCigna, Tata AIG and Niva Bupa.');
  if (!rule.domains.some(domain => host === domain || host.endsWith(`.${domain}`))) {
    throw new Error(`Source host "${host}" is not an allow-listed official domain for ${insurer}. Use the insurer-hosted PDF URL.`);
  }
  return url;
}

async function downloadPdf(url: URL): Promise<Buffer> {
  const response = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    headers: { accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.1', 'user-agent': 'Turtlemint-Cover-Check-Policy-Intelligence/1.0' },
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error('The source URL redirected. Resolve the redirect and provide the final official insurer-hosted PDF URL.');
  }
  if (!response.ok) throw new Error(`Official PDF download failed with HTTP ${response.status}.`);
  const contentType = ((response.headers.get('content-type') ?? '').split(';')[0] ?? '').trim().toLowerCase();
  if (contentType && !['application/pdf', 'application/octet-stream', 'binary/octet-stream'].includes(contentType)) {
    throw new Error(`Expected a PDF response, received content type "${contentType}".`);
  }
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BYTES) throw new Error('PDF exceeds the 50 MiB size limit.');
  if (!response.body) throw new Error('The source returned an empty response body.');
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      total += chunk.length;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new Error('PDF exceeds the 50 MiB size limit.');
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  const data = Buffer.concat(chunks);
  if (data.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('The official URL did not return PDF content.');
  return data;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const insurerArg = args.insurer?.trim();
  const productArg = args.product?.trim();
  const typeArg = args.type;
  const rawUrl = args.url;
  if (!insurerArg || !productArg || !typeArg || !rawUrl?.trim()) {
    throw new Error(`Missing one or more required arguments: --insurer, --product, --type, --url.\n\n${usage()}`);
  }
  if (!DOCUMENT_TYPES.has(typeArg)) throw new Error(`Invalid --type. Allowed: ${[...DOCUMENT_TYPES].join(', ')}`);
  const insurer = insurerArg;
  const product = productArg;
  if (insurer.length > 160 || product.length > 200) throw new Error('Insurer or product name exceeds the allowed length.');
  const url = officialUrl(rawUrl, insurer);
  const publishedDate = validateDate(args.published, 'published');
  const effectiveFrom = validateDate(args['effective-from'], 'effective-from');
  const effectiveTo = validateDate(args['effective-to'], 'effective-to');
  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) throw new Error('--effective-to cannot be earlier than --effective-from.');

  console.info(`Downloading official PDF from ${url.hostname}...`);
  const data = await downloadPdf(url);
  const contentSha256 = createHash('sha256').update(data).digest('hex');
  const { pageCount, pages } = await readProductPdf(data);
  const candidates = extractProductEvidenceFromPages(pages);
  const evidenceCounts = candidates.reduce<Record<string, number>>((counts, item) => {
    counts[item.factKey] = (counts[item.factKey] ?? 0) + 1;
    return counts;
  }, {});

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const productResult = await client.query<{ product_id: string }>(
      `SELECT product_id FROM insurer_product
       WHERE lower(trim(insurer_name)) = lower(trim($1))
         AND lower(trim(product_name)) = lower(trim($2))
         AND coalesce(upper(trim(uin)), '') = coalesce(upper(trim($3)), '')
       LIMIT 1`,
      [insurer, product, args.uin?.trim() || null],
    );
    let productId = productResult.rows[0]?.product_id;
    if (!productId) {
      const inserted = await client.query<{ product_id: string }>(
        `INSERT INTO insurer_product (insurer_name, product_name, uin)
         VALUES ($1, $2, $3) RETURNING product_id`,
        [insurer, product, args.uin?.trim() || null],
      );
      const insertedProduct = inserted.rows[0];
      if (!insertedProduct) throw new Error('Database did not return the inserted product ID.');
      productId = insertedProduct.product_id;
    }
    if (!productId) throw new Error('Unable to resolve the product registry ID.');

    const duplicate = await client.query<{ document_id: string; ingestion_status: string }>(
      'SELECT document_id, ingestion_status FROM product_source_document WHERE product_id = $1 AND content_sha256 = $2',
      [productId, contentSha256],
    );
    const existingDocument = duplicate.rows[0];
    if (existingDocument) {
      await client.query('COMMIT');
      console.info(JSON.stringify({
        status: 'already_ingested',
        documentId: existingDocument.document_id,
        ingestionStatus: existingDocument.ingestion_status,
        sha256: contentSha256,
        pageCount,
      }, null, 2));
      return;
    }

    const insertedDocument = await client.query<{ document_id: string }>(
      `INSERT INTO product_source_document
       (product_id, document_type, source_url, source_title, document_version, publication_date,
        effective_from, effective_to, content_sha256, mime_type, byte_size, page_count,
        extractor_version, ingestion_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'application/pdf', $10, $11, $12, 'pending_review')
       RETURNING document_id`,
      [
        productId, typeArg, url.toString(), args.title?.trim() || null, args.version?.trim() || null,
        publishedDate, effectiveFrom, effectiveTo, contentSha256, data.length, pageCount,
        PRODUCT_EVIDENCE_EXTRACTOR_VERSION,
      ],
    );
    const newDocument = insertedDocument.rows[0];
    if (!newDocument) throw new Error('Database did not return the inserted document ID.');
    const documentId = newDocument.document_id;

    for (const candidate of candidates) {
      const evidenceSha256 = createHash('sha256').update(candidate.evidenceText, 'utf8').digest('hex');
      await client.query(
        `INSERT INTO product_fact_evidence
         (document_id, fact_key, source_page, evidence_text, evidence_sha256, normalized_value,
          extraction_method, extraction_confidence, review_status)
         VALUES ($1, $2, $3, $4, $5, NULL, $6, NULL, 'pending_review')
         ON CONFLICT (document_id, fact_key, source_page, evidence_sha256) DO NOTHING`,
        [documentId, candidate.factKey, candidate.sourcePage, candidate.evidenceText, evidenceSha256, PRODUCT_EVIDENCE_EXTRACTOR_VERSION],
      );
    }
    await client.query('COMMIT');
    console.info(JSON.stringify({
      status: 'pending_review',
      documentId,
      insurer,
      product,
      uin: args.uin?.trim() || null,
      sourceHost: url.hostname,
      sha256: contentSha256,
      pageCount,
      evidenceCandidates: candidates.length,
      candidatesByTopic: evidenceCounts,
      note: 'Keyword matches are evidence candidates only. No normalized policy terms were approved or exposed to recommendations.',
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch(error => {
    console.error('Product document ingestion failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
  })
  .finally(async () => { await pool.end(); });
