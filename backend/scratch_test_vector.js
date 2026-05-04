import { indexTextSource } from './src/services/ragIndexService.js';
import { retrieveChunks } from './src/services/ragRetrievalService.js';

async function run() {
  console.log('Indexing test text...');
  await indexTextSource({
    sourceType: 'test',
    sourceId: '123',
    documentType: 'test_doc',
    text: 'The quick brown fox jumps over the lazy dog in a vector space.',
    metadata: { test: true }
  });

  console.log('Retrieving...');
  const results = await retrieveChunks({
    query: 'fox jumps',
    topK: 5,
    sourceTypes: ['test']
  });

  console.log('Results:', JSON.stringify(results, null, 2));
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
