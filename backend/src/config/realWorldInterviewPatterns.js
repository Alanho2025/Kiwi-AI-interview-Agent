/**
 * Real-World Engineering Interview Pattern Bank
 * Derived from FAANG, ANZ (Xero/Atlassian/Canva), and NZ Tech Lead interview archives.
 */

import { normalizeText } from '../utils/commonHelpers.js';

export const TECHNICAL_TRADEOFF_DICTIONARY = Object.freeze({
  postgres: {
    label: 'PostgreSQL',
    tradeOffQuestion: 'You mentioned using PostgreSQL there. What was the trade-off between strict relational ACID compliance and horizontal write scaling?',
    keyConsiderations: ['ACID vs NoSQL', 'JSONB vs relational schema', 'connection pooling & replica lag'],
  },
  sql: {
    label: 'SQL Database',
    tradeOffQuestion: 'With your SQL setup, how did you balance index coverage for fast reads against write latency during high-volume inserts?',
    keyConsiderations: ['indexing overhead', 'query optimization', 'transaction isolation'],
  },
  kafka: {
    label: 'Apache Kafka',
    tradeOffQuestion: 'You referenced Kafka for event streaming. How did you handle partition ordering guarantees versus consumer parallel scaling?',
    keyConsiderations: ['partitioning vs ordering', 'pull vs push model', 'consumer offset management'],
  },
  websockets: {
    label: 'WebSockets',
    tradeOffQuestion: 'You used WebSockets for real-time updates. What was the trade-off of maintaining stateful persistent connections over stateless HTTP or SSE?',
    keyConsiderations: ['stateful connection scaling', 'load balancing overhead', 'heartbeat & fallback'],
  },
  redis: {
    label: 'Redis Caching',
    tradeOffQuestion: 'You mentioned Redis for caching. How did you handle cache invalidation and eventual consistency with your primary database?',
    keyConsiderations: ['cache-aside vs write-through', 'LRU eviction policy', 'in-memory cost vs durability'],
  },
  docker: {
    label: 'Docker Containers',
    tradeOffQuestion: 'You used Docker for containerization. What was the trade-off between lightweight OS-level virtualization and full VM security isolation?',
    keyConsiderations: ['kernel sharing vs isolation', 'container image size', 'multi-stage builds'],
  },
  rag: {
    label: 'Retrieval-Augmented Generation (RAG)',
    tradeOffQuestion: 'You mentioned RAG for AI retrieval. How did you balance vector retrieval depth (top-k) and chunk size against LLM query latency and cost?',
    keyConsiderations: ['chunking strategy', 'top-k retrieval depth', 'vector DB indexing vs latency'],
  },
  langchain: {
    label: 'LangChain Framework',
    tradeOffQuestion: 'You used LangChain for orchestration. What was the trade-off between rapid framework abstractions and raw SDK control/debuggability?',
    keyConsiderations: ['framework abstraction vs control', 'debugging black-box chains', 'latency overhead'],
  },
  react: {
    label: 'React Frontend',
    tradeOffQuestion: 'You built the frontend in React. How did you manage global state and re-render performance under frequent UI updates?',
    keyConsiderations: ['SSR vs CSR', 'state management complexity', 'component re-render optimization'],
  },
  aws: {
    label: 'AWS Cloud Infrastructure',
    tradeOffQuestion: 'You mentioned AWS infrastructure. What was the trade-off between managed serverless services and provisioned instance compute cost?',
    keyConsiderations: ['managed services vs compute cost', 'serverless cold starts', 'infrastructure as code'],
  },
  cicd: {
    label: 'CI/CD Pipelines',
    tradeOffQuestion: 'You worked on CI/CD pipelines. How did you balance extensive automated test coverage with rapid deployment velocity?',
    keyConsiderations: ['pipeline execution time', 'test parallelization', 'deployment safety vs speed'],
  },
  microservices: {
    label: 'Microservices Architecture',
    tradeOffQuestion: 'You mentioned microservices. What was the trade-off between domain service decoupling and network latency/distributed transaction complexity?',
    keyConsiderations: ['service boundaries', 'distributed tracing', 'eventual consistency'],
  },
  typescript: {
    label: 'TypeScript',
    tradeOffQuestion: 'You used TypeScript for development. How did compile-time type safety balance against initial build setup and complex generic overhead?',
    keyConsiderations: ['compile-time safety', 'build performance', 'type definition friction'],
  },
  mongodb: {
    label: 'MongoDB / NoSQL',
    tradeOffQuestion: 'You mentioned MongoDB for storage. What was the trade-off between flexible schema document modeling and relational consistency guarantees?',
    keyConsiderations: ['document model vs schema validation', 'eventual consistency', 'aggregation pipeline complexity'],
  },
  graphql: {
    label: 'GraphQL API',
    tradeOffQuestion: 'You used GraphQL for API delivery. How did client query flexibility balance against N+1 query complexity and HTTP caching difficulties?',
    keyConsiderations: ['overfetching solution vs N+1 queries', 'dataloader batching', 'persisted queries'],
  },
  rest: {
    label: 'REST API',
    tradeOffQuestion: 'You built a RESTful API. What was the trade-off between strict resource-oriented endpoint design and payload overfetching or multiple round-trips?',
    keyConsiderations: ['resource granularity', 'stateless endpoints', 'HTTP caching headers'],
  },
  kubernetes: {
    label: 'Kubernetes (K8s)',
    tradeOffQuestion: 'You used Kubernetes for orchestration. What was the trade-off between automated container scaling/self-healing and control plane operational complexity?',
    keyConsiderations: ['cluster management overhead', 'ingress & service mesh', 'resource limit tuning'],
  },
  terraform: {
    label: 'Terraform IaC',
    tradeOffQuestion: 'You managed infrastructure with Terraform. How did declarative infrastructure reproducibility balance against state lock management and resource drift?',
    keyConsiderations: ['state management', 'module abstraction', 'drift detection'],
  },
  python: {
    label: 'Python',
    tradeOffQuestion: 'You developed in Python. What was the trade-off between rapid prototyping/AI ecosystem support and GIL concurrency execution constraints?',
    keyConsiderations: ['GIL thread limits', 'multiprocessing vs async', 'dynamic typing speed vs runtime errors'],
  },
  nodejs: {
    label: 'Node.js',
    tradeOffQuestion: 'You used Node.js. How did single-threaded async event loop throughput handle non-blocking I/O vs CPU-intensive blocking workloads?',
    keyConsiderations: ['event loop unblocking', 'worker threads', 'async memory leaks'],
  },
  java: {
    label: 'Java / Spring',
    tradeOffQuestion: 'You built services in Java. What was the trade-off between enterprise JVM multi-threading stability and memory footprint/startup overhead?',
    keyConsiderations: ['JVM garbage collection tuning', 'Spring dependency injection', 'memory footprint'],
  },
  go: {
    label: 'Golang',
    tradeOffQuestion: 'You worked in Go. How did lightweight goroutine concurrency and fast binary compilation balance against framework Ecosystem maturity?',
    keyConsiderations: ['goroutine channel synchronization', 'explicit error handling', 'minimalist stdlib'],
  },
  elasticsearch: {
    label: 'Elasticsearch / OpenSearch',
    tradeOffQuestion: 'You used Elasticsearch for search. What was the trade-off between inverted index full-text speed and cluster memory/re-indexing maintenance cost?',
    keyConsiderations: ['inverted index overhead', 'shard allocation', 'mapping immutability'],
  },
  grpc: {
    label: 'gRPC / Protobuf',
    tradeOffQuestion: 'You used gRPC for internal service communication. How did binary Protobuf performance and HTTP/2 multiplexing compare to HTTP/JSON debuggability?',
    keyConsiderations: ['binary serialization', 'HTTP/2 streaming', 'schema version evolution'],
  },
  vectordb: {
    label: 'Vector Database / pgvector',
    tradeOffQuestion: 'You used vector storage for embeddings. What was the trade-off between ANN index accuracy (HNSW/IVF) and index build time plus RAM usage?',
    keyConsiderations: ['ANN accuracy vs speed', 'HNSW RAM usage', 'index rebuild latency'],
  },
  jwt: {
    label: 'JWT / OAuth',
    tradeOffQuestion: 'You implemented JWT authentication. What was the trade-off between stateless token validation scale and instant token revocation capability?',
    keyConsiderations: ['stateless validation', 'token revocation lists', 'short expiry + refresh tokens'],
  },
  nextjs: {
    label: 'Next.js',
    tradeOffQuestion: 'You used Next.js for full-stack rendering. How did Server-Side Rendering (SSR) SEO/first-paint gains balance against server CPU compute and hydration edge cases?',
    keyConsiderations: ['SSR vs SSG vs ISR', 'hydration mismatches', 'edge function latency'],
  },
  /* --- Non-IT / Non-Technical Role Trade-Off Dictionary --- */
  product_management: {
    label: 'Product Management',
    tradeOffQuestion: 'In your product role, how did you balance one-off enterprise custom feature requests against your core long-term product roadmap?',
    keyConsiderations: ['custom deal requests vs platform scalability', 'speed-to-market vs tech debt', 'short-term ARR vs user retention'],
  },
  marketing: {
    label: 'Digital Marketing & Growth',
    tradeOffQuestion: 'In your marketing campaigns, what was the trade-off between aggressive paid customer acquisition (CAC) and long-term organic brand building?',
    keyConsiderations: ['CAC vs LTV', 'performance marketing vs brand equity', 'conversion rate vs audience quality'],
  },
  sales: {
    label: 'Sales & Business Development',
    tradeOffQuestion: 'In your sales pipeline, how did you balance offering aggressive end-of-quarter discounts to close deals fast against long-term contract margin and retention?',
    keyConsiderations: ['discounting vs margin protection', 'short SMB sales cycle vs long enterprise deal cycle', 'deal speed vs customer fit'],
  },
  customer_success: {
    label: 'Customer Success',
    tradeOffQuestion: 'In client management, what was the trade-off between offering high-touch white-glove support and building scalable self-serve onboarding resources?',
    keyConsiderations: ['high-touch support vs self-serve scale', 'client escalation vs team capacity', 'retention vs expansion ARR'],
  },
  operations: {
    label: 'Operations & Supply Chain',
    tradeOffQuestion: 'In operational planning, how did you balance maintaining inventory safety buffers against working capital efficiency and holding costs?',
    keyConsiderations: ['safety stock vs capital efficiency', 'local sourcing resilience vs offshore unit cost', 'process speed vs compliance'],
  },
  human_resources: {
    label: 'Human Resources & Recruiting',
    tradeOffQuestion: 'In talent acquisition, what was the trade-off between time-to-fill hiring speed for open roles and maintaining a strict candidate quality bar?',
    keyConsiderations: ['hiring speed vs candidate quality bar', 'cultural alignment vs diversity of thought', 'structured interview rigor vs candidate drop-off'],
  },
  ui_ux_design: {
    label: 'UI/UX Design',
    tradeOffQuestion: 'In your design process, how did you balance minimalist visual simplicity against power-user feature density and accessibility standards?',
    keyConsiderations: ['visual simplicity vs feature density', 'design system consistency vs custom UI flexibility', 'aesthetic elegance vs accessibility'],
  },
  finance: {
    label: 'Finance & FP&A',
    tradeOffQuestion: 'In financial analysis, what was the trade-off between conservative risk mitigation/capital preservation and aggressive growth investment?',
    keyConsiderations: ['capital preservation vs growth investment', 'budget precision vs decision velocity', 'short-term EBITDA vs long-term R&D'],
  },
  business_analysis: {
    label: 'Business Analysis',
    tradeOffQuestion: 'In business analysis, how did you balance exhaustive data modeling precision against decision velocity for executive stakeholders?',
    keyConsiderations: ['data precision vs decision speed', 'stakeholder scope creep vs MVP scope', 'process standardization vs operational flexibility'],
  },
});

export const REAL_WORLD_CLARIFICATION_PATTERNS = Object.freeze({
  ask_question_meaning: (skill = '') => (
    skill
      ? `I am asking specifically about your experience with ${skill}. What is one concrete example of what you personally built and the outcome?`
      : 'It is asking for one relevant example from your experience, including what you personally did and what happened.'
  ),
  ask_example_type: (skill = '') => (
    skill
      ? `A real-world project or production scenario where you used ${skill} is ideal. Focus on your direct contribution.`
      : 'A practical project or workplace scenario is ideal, focusing on your direct role and technical choices.'
  ),
  uncertain_help_request: (skill = '') => (
    skill
      ? `No problem at all! Think of one project where you used ${skill}. Start by describing your role and one key decision you made.`
      : 'No problem at all! Pick any past project you feel confident about, and walk me through your key technical role.'
  ),
  question_too_complex: (skill = '') => (
    skill
      ? `Let's take it one part at a time. What was your main technical responsibility when working with ${skill}?`
      : "Let's take it one part at a time: What was your main technical responsibility in that project?"
  ),
});

export const lookupRealWorldTradeOff = (topicText = '') => {
  const text = normalizeText(topicText).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!text) return null;
  for (const [key, value] of Object.entries(TECHNICAL_TRADEOFF_DICTIONARY)) {
    const normKey = key.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const normLabel = value.label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (text.includes(normKey) || text.includes(normLabel) || normKey.includes(text) || normLabel.includes(text)) {
      return value;
    }
  }
  return null;
};

export const getDynamicFollowUpDepth = ({ claimComplexity = 'medium', topic = '' } = {}) => {
  const normalizedTopic = normalizeText(topic).toLowerCase();
  const isHighComplexityTopic = /\b(architecture|rag|distributed|microservice|kafka|recommendation|infrastructure|security|concurrency)\b/i.test(normalizedTopic);
  if (isHighComplexityTopic || claimComplexity === 'high') return 3;
  if (claimComplexity === 'low') return 1;
  return 2;
};
