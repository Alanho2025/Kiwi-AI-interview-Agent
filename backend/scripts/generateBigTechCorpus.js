import fs from 'node:fs';
import path from 'node:path';

const targetDir = path.resolve('backend/tests/fixtures/jobDescription/bigtech_big4_corpus');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const corpus = [
  // 1. GOOGLE
  {
    filename: 'google-01-software-engineer.txt',
    content: `Job Title: Software Engineer III, AI Infrastructure
Company: Google
Location: Auckland, New Zealand / Remote
Category: Engineering & Technology

About the job:
At Google, our software engineers develop the next-generation technologies that change how billions of users connect, explore, and interact with information and one another. In this role, you will build core AI infrastructure that powers large language models and distributed vector retrieval.

Minimum qualifications:
- Bachelor’s degree in Computer Science, Computer Engineering, or equivalent practical experience.
- 4 years of experience with software development in C++, Java, or Python.
- 3 years of experience with data structures, algorithms, and distributed systems design.

Preferred qualifications:
- Master’s degree or PhD in Computer Science or Artificial Intelligence.
- Experience with PyTorch, TensorFlow, GPU cluster management, or CUDA programming.
- Experience building large-scale storage, vector search, or RPC network protocols.

Responsibilities:
- Design, implement, and maintain high-performance C++ and Python services for Google AI Infrastructure.
- Collaborate with research teams to optimize neural network inference latency and resource efficiency.
- Author technical design documents, perform code reviews, and drive unit and integration testing.
- Participate in on-call rotations and lead root-cause analysis for production incidents.`
  },

  // 2. APPLE
  {
    filename: 'apple-02-ml-engineer.txt',
    content: `Position Title: Senior Machine Learning Engineer - Vision & Perception
Company: Apple
Location: Auckland CBD, New Zealand
Job ID: 200548192

Summary:
The Vision Products team at Apple is seeking a Senior Machine Learning Engineer to craft next-generation spatial computing experiences for Apple Vision Pro and iOS devices.

Key Qualifications:
- 5+ years of hands-on experience building computer vision, deep learning, or multimodal AI systems.
- Deep proficiency in C++, Python, Metal, PyTorch, or CoreML.
- Proven track record deploying neural networks to resource-constrained hardware or Apple silicon.
- Strong fundamentals in 3D geometry, linear algebra, and real-time graphics pipelines.

Description:
In this role, you will research, build, and deploy real-time perception algorithms that fuse camera, lidar, and spatial sensors. You will collaborate closely with hardware, OS, and framework teams to optimize performance for low latency and minimal battery consumption.

Education & Experience:
- BS, MS, or PhD in Computer Science, Electrical Engineering, or related technical field.

Additional Requirements:
- Published papers in CVPR, ICCV, ECCV, or NeurIPS is a plus.`
  },

  // 3. EY (Ernst & Young)
  {
    filename: 'ey-03-tech-consulting-manager.txt',
    content: `Job Title: Senior Manager - Technology Consulting & Cloud Advisory
Company: EY (Ernst & Young)
Location: Auckland, New Zealand
Service Line: Consulting - Business Consulting

The Opportunity:
At EY, you will have the chance to build a truly exceptional experience. We are seeking a Senior Manager to join our Technology Consulting practice in Auckland, advising C-suite executives on digital transformation, cloud architecture, and enterprise technology strategy.

Your Key Responsibilities:
- Lead multi-disciplinary consulting teams in delivering cloud transformation strategies for enterprise clients across New Zealand.
- Advise executive leadership on AWS, Azure, IT governance, enterprise risk, and cloud migration frameworks.
- Drive business development, proposal writing, client pitches, and senior stakeholder relationship management.
- Mentor junior consultants and manage engagement budgets, margins, and deliverable quality.

Skills and Attributes for Success:
- 8+ years of management consulting or technology advisory experience.
- Deep domain knowledge in cloud transformation, enterprise architecture (TOGAF), and IT strategy.
- Strong commercial acumen, executive presentation skills, and workshop facilitation.

To Qualify for the Role, You Must Have:
- Bachelor’s degree in Business Information Systems, Computer Science, or Commerce.
- Proven track record leading major IT transformation engagements.

Ideally, You’ll Also Have:
- AWS Certified Solutions Architect Professional or Azure Solutions Architect Expert credentials.
- PMP or Agile SAFe certification.`
  },

  // 4. DELOITTE
  {
    filename: 'deloitte-04-sap-consultant.txt',
    content: `Job Title: Senior Consultant - SAP S/4HANA Digital Transformation
Company: Deloitte New Zealand
Location: Wellington, New Zealand
Business Unit: Enterprise Technology & Performance

About the Team:
Deloitte’s SAP practice helps organizations transform their core operations. We are looking for a Senior Consultant specializing in SAP S/4HANA Finance and Supply Chain integration.

Key Responsibilities:
- Design, configure, and implement SAP S/4HANA modules (FI/CO, MM, SD) for government and commercial clients.
- Facilitate business process blueprinting workshops and translate functional requirements into SAP configuration.
- Support data migration, integration testing, and user change management.

Requirements:
- 4+ years hands-on experience in SAP implementation or advisory roles.
- SAP S/4HANA Certified Application Associate credential.
- Tertiary degree in Information Systems, Accounting, or Supply Chain Management.
- Strong analytical skills, structured problem-solving, and client communication.

What We Offer:
- Flexible working arrangements, funded professional certifications, and clear career progression.`
  },

  // 5. PWC
  {
    filename: 'pwc-05-cybersecurity-manager.txt',
    content: `Job Title: Manager - Cybersecurity & Digital Trust
Company: PwC New Zealand
Location: Auckland CBD, New Zealand
Line of Service: Trust & Risk Assurance

Role Overview:
PwC is looking for a Manager to join our Cybersecurity and Digital Trust practice, helping clients defend against advanced cyber threats and maintain regulatory compliance.

Key Responsibilities:
- Conduct cybersecurity risk assessments, penetration testing oversight, and ISO 27001 / NIST framework audits.
- Design cloud security architectures across AWS, Azure, and Microsoft 365 environments.
- Respond to cybersecurity incidents, forensic investigations, and regulatory security reviews.
- Manage client engagements, project delivery, and team mentoring.

Qualifications & Requirements:
- 6+ years experience in cybersecurity, threat detection, or IT security auditing.
- CISSP, CISM, CISA, or CCSP certification required.
- Bachelor’s degree in Computer Science, Information Security, or related field.
- Deep expertise in identity & access management (IAM), firewalls, zero trust architecture, and SIEM tooling.`
  },

  // 6. KPMG
  {
    filename: 'kpmg-06-data-analytics-consultant.txt',
    content: `Job Title: Senior Data Analytics Consultant
Company: KPMG New Zealand
Location: Auckland, New Zealand
Division: Advisory - Lighthouse (Data & AI)

About Lighthouse:
KPMG Lighthouse is our Center of Excellence for Data, Analytics, and AI. We enable clients to unlock value from complex datasets.

Responsibilities:
- Build analytical models, SQL queries, and interactive Power BI dashboards for corporate clients.
- Extract, clean, and integrate data from ERP systems, cloud warehouses (Snowflake, BigQuery), and relational databases.
- Perform statistical data analysis to identify revenue leakage, operational bottlenecks, and fraud patterns.

Requirements:
- 3+ years experience in data analytics, business intelligence, or data science consulting.
- Bachelor’s or Master’s degree in Statistics, Data Science, Mathematics, or Information Technology.
- Advanced proficiency in SQL, Python, R, Power BI, and Tableau.
- Excellent storytelling skills with data and senior client management ability.`
  },

  // 7. MICROSOFT
  {
    filename: 'microsoft-07-principal-engineering-manager.txt',
    content: `Job Title: Principal Software Engineering Manager - Azure AI
Company: Microsoft
Location: Auckland, New Zealand / Remote
Organization: Cloud + AI

Overview:
Microsoft Azure AI is at the forefront of global artificial intelligence transformation. We are seeking a Principal Software Engineering Manager to lead an engineering organization building cloud AI developer services.

Key Responsibilities:
- Lead, grow, and empower an engineering organization of 12+ software engineers and engineering managers.
- Architect high-throughput, low-latency microservices on Azure, Kubernetes, and C#.
- Drive engineering excellence, live site reliability (SRE), and security compliance.
- Partner with Product Management, Executive Leadership, and global Azure engineering teams.

Qualifications:
- 10+ years experience in software engineering with 4+ years managing software development managers or senior engineers.
- Bachelor’s degree in Computer Science, Engineering, or equivalent experience.
- Demonstrated technical expertise in C#, C++, Go, Java, or Rust, and microservice cloud architectures.
- Exceptional executive communication, organizational culture building, and technical decision making.`
  },

  // 8. AMAZON / AWS
  {
    filename: 'amazon-08-solutions-architect.txt',
    content: `Job Title: Senior Solutions Architect - Enterprise Cloud
Company: Amazon Web Services (AWS)
Location: Auckland, New Zealand
Job ID: 2519482

DESCRIPTION:
AWS is seeking a Senior Solutions Architect to guide enterprise customers in New Zealand through their cloud modernizations and architecture designs.

BASIC QUALIFICATION:
- 7+ years of experience in infrastructure architecture, database architecture, or network design.
- 3+ years of experience displaying technical leadership in customer-facing roles.
- AWS Certified Solutions Architect Associate or Professional certification.
- Hands-on experience with Linux, Python, Terraform, Docker, and IP networking.
- Bachelor's degree in Computer Science, Engineering, or related field.

PREFERRED QUALIFICATION:
- Experience architecting microservices, serverless applications (AWS Lambda), and container orchestration (EKS/ECS).
- Master's degree or MBA.
- Demonstrated ability to communicate complex technical concepts to CTOs and VP of Engineering level executives.`
  },

  // 9. ACCENTURE
  {
    filename: 'accenture-09-devops-delivery-manager.txt',
    content: `Job Title: Cloud & DevOps Delivery Manager
Company: Accenture New Zealand
Location: Wellington, New Zealand
Practice: Accenture Cloud First

About Accenture:
Accenture Cloud First helps clients accelerate their cloud journey. We are looking for a Cloud & DevOps Delivery Manager to lead high-profile cloud migration projects.

Responsibilities:
- Manage multi-million dollar cloud delivery programs utilizing Agile, DevOps, and CI/CD methodologies.
- Oversee technical delivery teams across AWS, Azure, GCP, Kubernetes, and Ansible automation.
- Drive project financials, resource allocation, client expectations, and service level agreements (SLAs).

Requirements:
- 7+ years experience in IT delivery management, project management, or cloud consulting.
- Bachelor’s degree in Technology, Engineering, or Business.
- Certified Agile Practitioner (Scrum Master / SAFe) or PMP.
- Strong client leadership, risk mitigation, and commercial negotiation skills.`
  },

  // 10. META (FACEBOOK)
  {
    filename: 'meta-10-staff-product-designer.txt',
    content: `Job Title: Staff Product Designer - Design Systems
Company: Meta
Location: Auckland, New Zealand / Remote
Department: Product Design

About the Job:
Meta is seeking a Staff Product Designer to shape the evolution of our global design system used across Facebook, Instagram, WhatsApp, and Quest devices.

Responsibilities:
- Design scalable UI component libraries, tokens, and interaction patterns in Figma.
- Collaborate closely with React, React Native, and iOS/Android front-end engineers.
- Conduct user research, accessibility evaluations (WCAG 2.1 AAA), and usability testing.
- Define visual direction, typography scales, and motion guidelines.

Minimum Qualifications:
- 6+ years experience in product design, UI/UX design, or design systems at scale.
- Mastered proficiency in Figma, design tokens, responsive layout, and prototyping.
- Strong portfolio showcasing complex component systems, visual craft, and design rationale.

Preferred Qualifications:
- Bachelor’s or Master’s degree in Design, HCI, or Human Factors.
- Basic understanding of HTML, CSS, React, and design token build scripts.`
  }
];

corpus.forEach(({ filename, content }) => {
  fs.writeFileSync(path.join(targetDir, filename), content.trim(), 'utf8');
});

console.log(`Successfully generated ${corpus.length} Big Tech & Big 4 official JD test fixtures!`);
