// Initial content, inserted the first time the server starts with an empty database.
// It mirrors the static content in index.html.

export const SEED_ITEMS = {
  services: [
    { icon: 'code', title: 'Custom Software Development', description: 'Bespoke web platforms, SaaS products and enterprise systems engineered around your workflows — not the other way around.', features: ['Architecture & technical discovery', 'Web apps, portals & SaaS platforms', 'ERP / CRM and legacy modernisation', 'Secure APIs & third-party integrations'], tags: ['React', 'Next.js', 'Node.js', '.NET'] },
    { icon: 'mobile', title: 'Mobile App Development', description: 'Native and cross-platform apps for iOS and Android with smooth UX, offline support and app-store-ready polish.', features: ['iOS & Android from one codebase', 'Offline sync, push & in-app payments', 'Wearables & IoT companion apps', 'App Store & Play Store launch'], tags: ['Flutter', 'React Native', 'Swift', 'Kotlin'] },
    { icon: 'cloud', title: 'Cloud Computing & DevOps', description: 'Cloud-native architecture, migrations, CI/CD pipelines and infrastructure-as-code that keep you fast, secure and cost-efficient.', features: ['Cloud migration & modernisation', 'CI/CD pipelines & release automation', 'Kubernetes & serverless platforms', 'Monitoring, security & cost optimisation'], tags: ['AWS', 'Azure', 'Kubernetes', 'Terraform'] },
    { icon: 'palette', title: 'UI/UX Design & Branding', description: 'Research-driven product design, design systems and brand identities that make your product intuitive and unmistakably yours.', features: ['User research & usability testing', 'Wireframes & interactive prototypes', 'Design systems & component libraries', 'Logo, identity & brand guidelines'], tags: ['Figma', 'Design Systems', 'Prototyping', 'Branding'] },
    { icon: 'chip', title: 'AI & Machine Learning', description: 'Intelligent features that pay for themselves — LLM assistants, predictive analytics, computer vision and workflow automation.', features: ['LLM assistants, chatbots & RAG search', 'Predictive models & forecasting', 'Computer vision & document processing', 'MLOps: deploy, monitor, retrain'], tags: ['Python', 'PyTorch', 'LLMs', 'MLOps'] },
    { icon: 'database', title: 'Data Engineering & Analytics', description: 'Turn scattered data into decisions with reliable pipelines, modern warehouses and dashboards your teams actually use.', features: ['ETL / ELT pipelines & data lakes', 'Data warehouses & modelling', 'BI dashboards & self-serve reporting', 'Data quality & governance'], tags: ['Snowflake', 'BigQuery', 'dbt', 'Power BI'] },
    { icon: 'shield-check', title: 'Quality Assurance & Testing', description: 'Ship with confidence. Automated and manual testing that catches issues early and keeps every release stable.', features: ['Test strategy & automation frameworks', 'Performance & load testing', 'Security & penetration testing', 'Accessibility (WCAG) audits'], tags: ['Playwright', 'Cypress', 'k6', 'OWASP'] },
    { icon: 'headset', title: 'Maintenance & 24/7 Support', description: 'Keep critical systems healthy long after launch with proactive monitoring, SLAs and continuous improvement.', features: ['24/7 monitoring & incident response', 'SLA-backed bug fixing', 'Security patches & upgrades', 'Performance tuning & new features'], tags: ['SLA', 'On-call', 'Observability', 'SRE'] }
  ],
  case_studies: [
    { category: 'FinTech · Web Platform', title: 'Aurora Pay — Real-time Payments Dashboard', description: 'Rebuilt a legacy merchant portal into a real-time analytics platform processing 2M+ transactions a day, cutting reporting time by 70%.', tags: ['React', 'Node.js', 'PostgreSQL', 'AWS'], theme: 'cyan', visual: 'dashboard', image: '', link: '#contact' },
    { category: 'HealthTech · Mobile', title: 'Helix Health — Patient Care App', description: 'A HIPAA-compliant iOS & Android app for remote monitoring and teleconsultations, now used by 120,000+ patients with a 4.8★ rating.', tags: ['Flutter', 'Firebase', 'FHIR', 'Azure'], theme: 'emerald', visual: 'mobile', image: '', link: '#contact' },
    { category: 'Logistics · AI & Cloud', title: 'Vertex Logistics — AI Route Optimizer', description: 'A machine-learning engine that plans delivery routes for 3,000+ vehicles, reducing fuel costs by 22% and late deliveries by 35%.', tags: ['Python', 'TensorFlow', 'Kubernetes', 'GCP'], theme: 'violet', visual: 'network', image: '', link: '#contact' }
  ],
  jobs: [
    { title: 'Senior Full-Stack Engineer', department: 'Engineering', location: 'Hybrid / Remote', type: 'Full-time', tags: ['React', 'Node.js', 'PostgreSQL'], description: '' },
    { title: 'Mobile Developer', department: 'Engineering', location: 'Hybrid / Remote', type: 'Full-time', tags: ['Flutter', 'iOS', 'Android'], description: '' },
    { title: 'DevOps / Cloud Engineer', department: 'Infrastructure', location: 'Remote', type: 'Full-time', tags: ['AWS', 'Kubernetes', 'Terraform'], description: '' },
    { title: 'UI/UX Designer', department: 'Design', location: 'Hybrid', type: 'Full-time', tags: ['Figma', 'Design Systems', 'Research'], description: '' }
  ],
  stats: [
    { label: 'Projects delivered', value: '150+' },
    { label: 'Client retention', value: '98%' },
    { label: 'Engineers & designers', value: '60+' },
    { label: 'Countries served', value: '12' }
  ],
  values: [
    { icon: 'shield', title: 'Integrity', description: "Honest estimates, open communication and no surprises. We say what we'll do — then do it." },
    { icon: 'star', title: 'Craftsmanship', description: "Clean code, thoughtful design and rigorous testing. We build software we're proud to put our name on." },
    { icon: 'users', title: 'Partnership', description: 'Your goals are our goals. We act like owners, challenge ideas respectfully and share accountability.' },
    { icon: 'bulb', title: 'Curiosity', description: 'We keep learning, experiment with new technology and bring fresh ideas to every problem.' }
  ],
  timeline: [
    { year: '2018', title: 'Founded', description: 'NTALEC starts with a small team of engineers and one belief: software should be built right.' },
    { year: '2020', title: 'Going mobile & cloud', description: 'Dedicated mobile and cloud/DevOps practices launch as clients scale their products.' },
    { year: '2022', title: 'International growth', description: 'Serving clients across multiple countries in fintech, healthcare, retail and logistics.' },
    { year: '2024', title: 'AI & data practice', description: 'A specialist AI and data engineering team forms to deliver intelligent products.' },
    { year: 'Today', title: '60+ people, 150+ projects', description: 'A trusted long-term partner for startups and enterprises around the world.' }
  ]
};

export const SEED_SETTINGS = {
  email: 'hello@ntalec.com',
  phone: '+1 (555) 123-4567',
  address: '123 Innovation Drive, Tech City',
  linkedin: 'https://www.linkedin.com/company/ntalec',
  twitter: 'https://twitter.com/ntalec',
  github: 'https://github.com/ntalec',
  facebook: 'https://www.facebook.com/ntalec',
  seo_title: 'NTALEC | Custom Software Development, Cloud & AI Solutions',
  seo_description: 'NTALEC builds custom software, mobile apps, cloud platforms and AI solutions that help businesses scale. Agile delivery, expert engineers and 24/7 support.',
  social_title: 'NTALEC | Software That Moves Your Business Forward',
  social_description: 'Custom software, mobile, cloud and AI solutions engineered for growth.',
  notify_email: '',
  notify_messages: '1',
  notify_applications: '1'
};
