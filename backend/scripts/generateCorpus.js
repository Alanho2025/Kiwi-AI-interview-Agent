import fs from 'node:fs';
import path from 'node:path';

const targetDir = path.resolve('backend/tests/fixtures/jobDescription/seek_indeed_corpus');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const corpus = [
  // SEEK 1: Software Engineer
  {
    filename: 'seek-01-software-engineer.txt',
    content: `Job Title: Senior Software Engineer
Company: Xero
Location: Auckland CBD, New Zealand
Employment Type: Full-time

About the Role:
We are looking for a Senior Software Engineer to join our core billing team in Auckland. You will design, build, and maintain scalable web applications that support millions of global users.

Key Responsibilities:
• Design and implement RESTful APIs using React, Node.js, and TypeScript.
• Collaborate with cross-functional teams in an Agile environment to deliver high-quality features.
• Conduct thorough code reviews, write unit tests, and maintain CI/CD pipelines.
• Support production systems and perform root-cause failure investigations.

Requirements:
• 5+ years of software development experience with JavaScript, TypeScript, React, and Node.js.
• Bachelor of Computer Science degree or equivalent tertiary qualification.
• Solid understanding of PostgreSQL, Docker, and AWS cloud services.
• Strong problem-solving mindset and team communication skills.

Bonus Requirements:
• Experience with GraphQL and microservices architecture is advantageous.
• AWS Certified Developer certification is a plus.

Benefits:
• Competitive salary package with annual bonus.
• Flexible hybrid work environment (2 days in office, 3 days remote).
• Health insurance cover and wellness allowance.`
  },

  // SEEK 2: Data Engineer
  {
    filename: 'seek-02-data-engineer.txt',
    content: `Job Title: Senior Data Engineer
Company: Fonterra
Location: Hamilton, Waikato
Employment Type: Permanent Full-time

About Us:
Fonterra is a global dairy nutrition company seeking an experienced Senior Data Engineer to transform global supply chain datasets.

Key Responsibilities:
• Build and optimize data pipelines using SQL, Python, Snowflake, and dbt.
• Maintain data warehouse architecture and ensure high data quality standards.
• Work with business intelligence analysts to deliver Power BI dashboards.

Requirements:
• 4+ years of data engineering experience with SQL, Python, and Snowflake.
• Tertiary qualification in Data Analytics, Computer Science, or Information Systems.
• Experience building ETL pipelines and managing cloud data warehouses.
• Excellent analytical skills and stakeholder communication.

Nice to Have:
• Familiarity with PySpark and Azure Data Factory.

Benefits:
• Staff discount on dairy products.
• Superannuation matching and professional development allowance.`
  },

  // SEEK 3: AI Engineer
  {
    filename: 'seek-03-ai-engineer.txt',
    content: `Job Title: AI Solutions Engineer
Company: Canva
Location: Auckland, New Zealand
Employment Type: Full-time

Role Overview:
Join our AI Innovation team to build generative AI features, agentic workflows, and semantic search capabilities.

Key Responsibilities:
• Develop LLM-powered applications using OpenAI, PyTorch, Python, and RAG architectures.
• Implement vector database retrieval with Pinecone and PostgreSQL pgvector.
• Evaluate model performance, prompt safety, and inference latency benchmarks.

Requirements:
• Master of Science degree in Artificial Intelligence or Computer Science.
• 3+ years experience building AI/ML models or LLM agentic workflows in Python.
• Deep understanding of semantic retrieval, vector search, and API integration.
• Growth mindset and passion for cutting-edge AI technologies.

Preferred Qualifications:
• Published research papers in NLP or computer vision.
• Experience with LangChain or LlamaIndex frameworks.

Benefits:
• Generous equity grant and flexible working hours.
• Annual conference stipend and home office budget.`
  },

  // SEEK 4: DevOps Engineer
  {
    filename: 'seek-04-devops-engineer.txt',
    content: `Job Title: Lead DevOps Engineer
Company: Datacom
Location: Wellington, New Zealand
Employment Type: Full-time

Position Summary:
Datacom is looking for a Lead DevOps Engineer to drive cloud infrastructure modernization for government and enterprise clients.

Key Responsibilities:
• Design and manage infrastructure as code using Terraform, Ansible, and AWS.
• Configure Kubernetes clusters, Docker containers, and CI/CD automation pipelines.
• Implement monitoring, logging, and security compliance policies.

Requirements:
• 6+ years experience in DevOps, Cloud Engineering, or Systems Administration.
• Bachelor of IT degree or relevant AWS Solutions Architect Certification.
• Hands-on mastery of Linux, Shell Scripting, Python, and CloudFormation.
• Strong technical leadership and incident troubleshooting capability.

Bonus Points:
• CKA (Certified Kubernetes Administrator) credentials.

Benefits:
• Modern Wellington CBD office with catered lunches.
• Comprehensive health and life insurance.`
  },

  // SEEK 5: Product Manager
  {
    filename: 'seek-05-product-manager.txt',
    content: `Job Title: Senior Product Manager
Company: Trade Me
Location: Christchurch, New Zealand
Employment Type: Permanent Full-time

About the Role:
Trade Me is seeking a customer-focused Senior Product Manager to lead product discovery and execution for our marketplace platform.

Responsibilities:
• Define product roadmap, prioritization, and feature specifications.
• Collaborate with design, engineering, and data teams using Agile practices.
• Conduct user research, A/B testing, and market analysis to drive user engagement.

Requirements:
• 5+ years product management experience in e-commerce or SaaS.
• Bachelor’s degree in Business, Marketing, or Information Technology.
• Strong commercial acumen, user empathy, and analytical skills.

Nice to Haves:
• MBA or Product Management Certification (Pragmatic/Reforge).

Benefits:
• Birthday leave and 5 weeks annual leave.
• Hybrid work policy.`
  },

  // SEEK 6: Business Analyst
  {
    filename: 'seek-06-business-analyst.txt',
    content: `Job Title: Senior Business Analyst
Company: Air New Zealand
Location: Auckland CBD, New Zealand
Employment Type: Full-time

Role Purpose:
Support digital transformation across flight operations and customer booking workflows.

Key Responsibilities:
• Gather business requirements, map business processes, and draft functional specs.
• Facilitate workshops with key business stakeholders and engineering teams.
• Validate acceptance criteria and support user acceptance testing (UAT).

Requirements:
• 5+ years experience as a Business Analyst in large enterprise environments.
• Degree in Business Administration, Information Systems, or related field.
• Proficiency in BPMN process mapping, Jira, Confluence, and SQL queries.
• Exceptional written and verbal communication skills.

Bonus:
• CBAP certification.`
  },

  // SEEK 7: Marketing Specialist
  {
    filename: 'seek-07-marketing-specialist.txt',
    content: `Job Title: Digital Marketing Specialist
Company: Fisher & Paykel Healthcare
Location: East Tamaki, Auckland
Employment Type: Full-time

About the Position:
Drive digital marketing campaigns and brand engagement for respiratory care products across global markets.

Responsibilities:
• Execute SEO, SEM, and Google Ads paid acquisition campaigns.
• Analyze website traffic and conversion funnels using Google Analytics 4.
• Create compelling email marketing campaigns and social media content.

Requirements:
• 3+ years experience in digital marketing or growth marketing.
• Bachelor of Commerce or Marketing degree.
• Hands-on expertise with Google Analytics, HubSpot, and WordPress.
• Strong copywriting and creative problem-solving skills.`
  },

  // SEEK 8: Operations Coordinator
  {
    filename: 'seek-08-operations-coordinator.txt',
    content: `Job Title: Operations Coordinator
Company: Mainfreight
Location: Takanini, Auckland
Employment Type: Permanent Full-time

Role Overview:
Coordinate daily freight logistics, warehouse scheduling, and customer delivery tracking across New Zealand.

Key Responsibilities:
• Schedule transport routes and manage driver dispatch logs.
• Monitor warehouse inventory accuracy using SAP logistics modules.
• Communicate delivery status updates directly with commercial clients.

Requirements:
• 2+ years experience in supply chain, logistics, or transport operations.
• High school diploma or Diploma in Logistics Management.
• Proficient in Excel, data entry, and phone communication.
• Ability to thrive under time pressure in a fast-paced environment.`
  },

  // SEEK 9: Registered Nurse
  {
    filename: 'seek-09-registered-nurse.txt',
    content: `Job Title: Registered Nurse - Clinical Specialist
Company: Te Toka Tumai Auckland Health
Location: Auckland Hospital, Grafton
Employment Type: Full-time

Position Scope:
Deliver high-standard patient care within the surgical inpatient ward.

Key Responsibilities:
• Perform clinical patient assessments, medication administration, and care planning.
• Collaborate with multidisciplinary medical teams and surgeons.
• Ensure strict compliance with health & safety regulations and patient privacy.

Requirements:
• Current Nursing Council of New Zealand (NCNZ) Annual Practising Certificate.
• Bachelor of Nursing degree.
• 2+ years clinical nursing experience in acute care.
• Compassionate patient care and excellent interpersonal skills.`
  },

  // SEEK 10: Store Manager
  {
    filename: 'seek-10-store-manager.txt',
    content: `Job Title: Retail Store Manager
Company: Farmers Trading Company
Location: Albany, Auckland
Employment Type: Full-time

Role Purpose:
Lead sales operations, visual merchandising, and team development for our flagship Albany store.

Key Responsibilities:
• Drive store sales targets, rostering, and inventory control.
• Coach and mentor a team of 15 retail sales assistants.
• Resolve customer inquiries and maintain high store presentation standards.

Requirements:
• 3+ years retail management or Assistant Manager experience.
• Proven track record in achieving sales targets and staff leadership.
• Strong organizational, communication, and conflict resolution skills.`
  },

  // INDEED 1: Frontend Developer
  {
    filename: 'indeed-01-frontend-developer.txt',
    content: `Position Title: Senior Frontend Developer
Company: Pushpay
Location: Auckland, NZ (Hybrid)
Job Type: Full-time

We are seeking a Senior Frontend Developer to build responsive, accessible web interfaces for our giving platform.

What You Will Do:
- Write clean, maintainable code using React, TypeScript, Next.js, and Tailwind CSS.
- Optimize web application performance and cross-browser accessibility (WCAG).
- Partner with UI/UX designers and GraphQL backend engineers.

What We Are Looking For:
- 4+ years of professional front-end engineering experience.
- Bachelor of Computer Science or equivalent practical experience.
- Deep expertise in HTML5, CSS3, JavaScript ES6+, React, and state management.
- Strong passion for polished design systems and micro-interactions.

Pluses:
- Experience with WebSockets and real-time streaming interfaces.`
  },

  // INDEED 2: Data Scientist
  {
    filename: 'indeed-02-data-scientist.txt',
    content: `Position Title: Lead Data Scientist
Company: ASB Bank
Location: Auckland CBD
Job Type: Permanent

ASB Bank is looking for a Lead Data Scientist to build predictive credit risk and fraud detection models.

Responsibilities:
- Train machine learning models using Python, Scikit-Learn, XGBoost, and PyTorch.
- Query large-scale transactional datasets with SQL and PySpark on AWS.
- Present model findings and risk metrics to executive stakeholders.

Qualifications:
- Master’s or PhD degree in Statistics, Mathematics, Data Science, or Physics.
- 5+ years experience building production ML models in banking or finance.
- Mastery of Python, SQL, predictive modeling, and statistical analysis.`
  },

  // INDEED 3: ML Engineer
  {
    filename: 'indeed-03-ml-engineer.txt',
    content: `Position Title: Machine Learning Engineer
Company: Soul Machines
Location: Auckland Central
Job Type: Full-time

Join Soul Machines to deploy autonomous digital human avatars powered by neural networks.

Core Duties:
- Build MLOps pipelines using Docker, Kubernetes, Ray, and MLflow.
- Fine-tune deep learning models using PyTorch and CUDA on GPU clusters.
- Optimize model inference latency for real-time video and audio streaming.

Required Skills:
- Master’s degree in Computer Science or Artificial Intelligence.
- 3+ years ML engineering experience with Python, PyTorch, C++, and Docker.
- Experience with GPU cluster orchestration and model deployment.`
  },

  // INDEED 4: Cloud Architect
  {
    filename: 'indeed-04-cloud-architect.txt',
    content: `Position Title: Senior Cloud Architect
Company: Spark New Zealand
Location: Auckland CBD
Job Type: Full-time

Spark is hiring a Senior Cloud Architect to design enterprise multi-cloud architectures across AWS and Azure.

Responsibilities:
- Author cloud architecture blueprints, security standards, and disaster recovery plans.
- Guide enterprise migration strategies for legacy monolithic applications.
- Mentor cloud engineering teams in serverless design and Infrastructure as Code.

Requirements:
- AWS Certified Solutions Architect Professional or Azure Solutions Architect Expert.
- 8+ years IT experience with 4+ years in cloud architecture design.
- Deep expertise in networking, IAM, Terraform, and cloud cost governance.`
  },

  // INDEED 5: Project Manager
  {
    filename: 'indeed-05-project-manager.txt',
    content: `Position Title: IT Project Manager
Company: Orion Health
Location: Grafton, Auckland
Job Type: Contract (12 Months)

We are hiring an IT Project Manager to oversee healthcare software deployment projects.

Key Tasks:
- Manage project budgets, timelines, risk registers, and scope boundaries.
- Coordinate software releases across engineering, QA, and clinical client teams.
- Run daily standups, sprint planning, and retrospective meetings.

Requirements:
- PMP or PRINCE2 certification required.
- 5+ years IT project management experience delivering software applications.
- Excellent stakeholder management, conflict resolution, and Jira skills.`
  },

  // INDEED 6: Financial Analyst
  {
    filename: 'indeed-06-financial-analyst.txt',
    content: `Position Title: Senior Financial Analyst
Company: Genesis Energy
Location: Greenlane, Auckland
Job Type: Full-time

Genesis Energy is seeking a Senior Financial Analyst to support financial modeling, budgeting, and commercial forecasting.

Duties:
- Build financial models, variance analysis reports, and capital expenditure forecasts.
- Extract and analyze financial datasets using SQL, Power BI, and Excel.
- Present monthly financial performance summaries to executive management.

Requirements:
- CA or CPA accounting qualification or Bachelor of Commerce in Finance.
- 4+ years financial analysis experience in energy, utilities, or corporate finance.
- Advanced financial modeling expertise and strong communication skills.`
  },

  // INDEED 7: Content Strategist
  {
    filename: 'indeed-07-content-strategist.txt',
    content: `Position Title: Content & Communications Manager
Company: University of Auckland
Location: Auckland CBD
Job Type: Full-time

Lead content creation, brand storytelling, and public relations across university digital channels.

Responsibilities:
- Write engaging press releases, editorial articles, and social media campaigns.
- Oversee content governance and brand style guide compliance.
- Manage external media relations and crisis communications.

Requirements:
- Bachelor’s degree in Journalism, Communications, or Public Relations.
- 5+ years experience in corporate communications or content strategy.
- Impeccable writing, editing, and stakeholder relationship skills.`
  },

  // INDEED 8: Customer Support Lead
  {
    filename: 'indeed-08-customer-support-lead.txt',
    content: `Position Title: Customer Success Team Lead
Company: Vend by Lightspeed
Location: Newmarket, Auckland
Job Type: Full-time

Lead our customer support desk to deliver world-class technical support to global retail merchants.

Key Responsibilities:
- Supervise support ticket queues, SLA resolution times, and CSAT scores.
- Mentor and train 10 customer support representatives.
- Handle escalated merchant support inquiries via phone, chat, and email.

Requirements:
- 3+ years customer support experience in SaaS or tech.
- 1+ years supervisory or team lead experience.
- Proficiency with Zendesk, Salesforce, and troubleshooting web tools.`
  },

  // INDEED 9: Clinical Coordinator
  {
    filename: 'indeed-09-clinical-coordinator.txt',
    content: `Position Title: Clinical Research Coordinator
Company: Fisher & Paykel Healthcare
Location: East Tamaki, Auckland
Job Type: Full-time

Coordinate human clinical trials and medical device validation studies for respiratory therapies.

Responsibilities:
- Prepare clinical trial protocols, ethics committee submissions, and consent forms.
- Monitor patient data collection, clinical trial compliance, and trial audits.
- Analyze clinical trial datasets and contribute to scientific regulatory reports.

Requirements:
- Master’s degree in Science, Health Sciences, or Biomedical Engineering.
- 3+ years experience coordinating clinical research or medical device trials.
- Knowledge of GCP (Good Clinical Practice) and medical regulations.`
  },

  // INDEED 10: Restaurant Operations Manager
  {
    filename: 'indeed-10-restaurant-operations-manager.txt',
    content: `Position Title: Restaurant Operations Manager
Company: Restaurant Brands New Zealand
Location: Penrose, Auckland
Job Type: Full-time

Oversee operational performance, food safety compliance, and profitability for regional restaurant branches.

Key Duties:
- Monitor branch P&L performance, labor cost optimization, and food waste reduction.
- Enforce strict food hygiene (HACCP) regulations and customer service standards.
- Audit store operations and train store managers in leadership and service excellence.

Requirements:
- 5+ years multi-site restaurant management experience in QSR or hospitality.
- Diploma in Hospitality Management or Business Administration.
- Strong operational leadership, financial reporting, and problem-solving skills.`
  }
];

corpus.forEach(({ filename, content }) => {
  fs.writeFileSync(path.join(targetDir, filename), content.trim(), 'utf8');
});

console.log(`Successfully generated ${corpus.length} Seek & Indeed JD test fixtures!`);
