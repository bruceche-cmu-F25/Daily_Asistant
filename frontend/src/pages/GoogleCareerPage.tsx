import { BrandGlyph, brandIdentity } from "../components/BrandLogo";

type CareerResource = {
  title: string;
  description: string;
  url: string;
  label: string;
  accent: string;
  mark?: string;
};

type CareerStage = {
  number: string;
  title: string;
  titleZh: string;
  summary: string;
  resources: CareerResource[];
};

const articleUrl = "https://www.linkedin.com/pulse/how-land-job-google-guide-hiring-process-utkarsh-sharma-8dcmf?utm_source=share&utm_medium=member_ios&utm_campaign=share_via";

const officialVideos: CareerResource[] = [
  {
    title: "Technical Interview Questions",
    description: "How to prepare for Google's technical interview questions.",
    url: "https://youtu.be/we7ba0slWrc",
    label: "OFFICIAL VIDEO",
    accent: "red",
  },
  {
    title: "How to Apply",
    description: "A practical walkthrough of applying for a role at Google.",
    url: "https://youtu.be/olScOTFtVW8",
    label: "OFFICIAL VIDEO",
    accent: "blue",
  },
  {
    title: "Non-Technical Interviews",
    description: "How to prepare for Google's non-technical interview questions.",
    url: "https://youtu.be/TPilhhzHTnU",
    label: "OFFICIAL VIDEO",
    accent: "amber",
  },
  {
    title: "Solve a Coding Question",
    description: "Watch a Google coding interview question solved step by step.",
    url: "https://youtu.be/Ti5vfu9arXQ",
    label: "OFFICIAL VIDEO",
    accent: "green",
  },
  {
    title: "Learning & Development",
    description: "Explore learning and development opportunities at Google.",
    url: "https://youtu.be/563VrWhFO38",
    label: "OFFICIAL VIDEO",
    accent: "purple",
  },
];

const careerStages: CareerStage[] = [
  {
    number: "00",
    title: "Learn the hiring process",
    titleZh: "了解招聘流程",
    summary: "Start with Google's own explanation of job search, application review, interviews, and decisions.",
    resources: [{
      title: "How We Hire",
      description: "Google Careers · the official end-to-end hiring process.",
      url: "https://www.google.com/about/careers/applications/how-we-hire/#step-job-searching",
      label: "OFFICIAL GUIDE",
      accent: "blue",
    }],
  },
  {
    number: "01",
    title: "Craft an exceptional resume",
    titleZh: "打磨针对性简历",
    summary: "Match the role, lead with measurable impact, and make your relevant skills easy to find.",
    resources: [{
      title: "Google Resume Guidelines",
      description: "Resume guidance collected for Google applicants.",
      url: "https://lnkd.in/dRQGTJfs",
      label: "RESUME",
      accent: "green",
    }],
  },
  {
    number: "02",
    title: "Connect with Google HR",
    titleZh: "建立招聘连接",
    summary: "Find recruiters in the location and function you are targeting, then make a concise, specific introduction.",
    resources: [],
  },
  {
    number: "03",
    title: "Apply to the right role",
    titleZh: "精准投递职位",
    summary: "Use the official careers portal and apply where your experience genuinely matches the requirements.",
    resources: [{
      title: "Google Careers",
      description: "Search and apply for current openings.",
      url: "https://www.google.com/about/careers/applications/jobs/results/",
      label: "OPEN ROLES",
      accent: "blue",
    }],
  },
  {
    number: "04",
    title: "Seek a relevant referral",
    titleZh: "寻找有效内推",
    summary: "Reach out through your real network and give a potential referrer enough context to assess your fit.",
    resources: [],
  },
  {
    number: "05",
    title: "Prepare for interviews",
    titleZh: "系统准备面试",
    summary: "Understand the role, practice structured answers, and rehearse the full problem-solving conversation.",
    resources: [{
      title: "Google Interview Preparation",
      description: "A focused collection of preparation guidance.",
      url: "https://lnkd.in/djpnDWXu",
      label: "PREP GUIDE",
      accent: "purple",
    }],
  },
  {
    number: "06",
    title: "Review sample interviews",
    titleZh: "复盘示例问题",
    summary: "Study both the reasoning process and how strong candidates communicate under pressure.",
    resources: [
      {
        title: "Example Coding Interview",
        description: "A sample Google coding interview.",
        url: "https://youtu.be/wwIysnVmAUg",
        label: "CODING",
        accent: "red",
      },
      {
        title: "Business Interview Sample",
        description: "A sample interview for a Google business role.",
        url: "https://youtu.be/lIuHpBq4jJw",
        label: "BUSINESS",
        accent: "amber",
      },
    ],
  },
];

const studentResources: CareerResource[] = [
  {
    title: "Students: Applying to Google",
    description: "Resume tips, application guidance, and interview preparation for students.",
    url: "https://careers.google.com/stories/applying-to-google/",
    label: "STUDENTS",
    accent: "green",
  },
  {
    title: "APM Application Process",
    description: "A closer look at the Associate Product Manager application journey.",
    url: "https://careers.google.com/stories/apm-application-process/",
    label: "APM",
    accent: "cyan",
  },
];

const deepDiveResources: CareerResource[] = [
  {
    title: "Google Careers Video Library",
    description: "The full playlist: mock interviews, process breakdowns, and career guidance.",
    url: "https://www.youtube.com/playlist?list=PLllx_3tLoo4c_aR8RKOOnizL5LiUH02YF",
    label: "VIDEO PLAYLIST",
    accent: "red",
  },
  {
    title: "Comprehensive Google Guide",
    description: "Additional strategies and experience shared by Utkarsh Sharma.",
    url: "https://www.linkedin.com/pulse/how-secure-position-google-comprehensive-guide-utkarsh-sharma-guopc/",
    label: "DEEP DIVE",
    accent: "blue",
  },
  {
    title: "How to Land a Job at Google",
    description: "The source article for this roadmap and resource collection.",
    url: articleUrl,
    label: "SOURCE ARTICLE",
    accent: "cyan",
  },
];

function ResourceCard({ resource }: { resource: CareerResource }) {
  const identity = brandIdentity(resource.url);

  return (
    <a
      className={`google-resource-card accent-${resource.accent}`}
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="google-resource-icon">
        <BrandGlyph brand={identity.brand} fallback={resource.mark ?? identity.mark} />
      </span>
      <span className="google-resource-copy">
        <small>{resource.label}</small>
        <b>{resource.title}</b>
        <span>{resource.description}</span>
      </span>
      <span className="google-resource-arrow" aria-hidden="true">↗</span>
    </a>
  );
}

export function GoogleCareerPage() {
  return (
    <main className="google-career-page">
      <section className="google-career-hero panel">
        <div className="google-career-kicker">
          <span>GOOGLE CAREER PLAYBOOK</span>
          <b>00—06</b>
        </div>
        <div className="google-career-hero-copy">
          <p className="eyebrow">FROM APPLICATION TO INTERVIEW</p>
          <h1>LAND A JOB<br />AT <span>GOOGLE</span></h1>
          <p>一条可执行的 Google 求职路线：先理解流程，再精准投递、建立连接，并用官方资源准备技术与非技术面试。</p>
          <div className="google-career-actions">
            <a href="#google-roadmap">START THE ROADMAP ↓</a>
            <a href={articleUrl} target="_blank" rel="noopener noreferrer">READ SOURCE ARTICLE ↗</a>
          </div>
        </div>
        <div className="google-career-signal" aria-label="Google career roadmap summary">
          <span>CAREER SIGNAL</span>
          <strong>16</strong>
          <p>CURATED LINKS</p>
          <div>
            <span>OFFICIAL</span>
            <span>INTERVIEW</span>
            <span>STUDENT</span>
          </div>
        </div>
      </section>

      <section className="google-career-section panel" aria-labelledby="official-resources-heading">
        <div className="google-career-section-head">
          <div>
            <p className="eyebrow">START WITH THE SOURCE</p>
            <h2 id="official-resources-heading">Google’s official videos</h2>
          </div>
          <p>先看官方如何定义面试、申请与成长，再进入具体准备。</p>
        </div>
        <div className="google-resource-grid google-resource-grid-featured">
          {officialVideos.map((resource) => <ResourceCard resource={resource} key={resource.url} />)}
        </div>
      </section>

      <section className="google-career-roadmap panel" id="google-roadmap" aria-labelledby="roadmap-heading">
        <div className="google-career-section-head">
          <div>
            <p className="eyebrow">EXECUTION PLAN</p>
            <h2 id="roadmap-heading">Your application roadmap</h2>
          </div>
          <p>不要随机海投。每一步都留下一个明确产出。</p>
        </div>
        <div className="google-stage-list">
          {careerStages.map((stage) => (
            <article className="google-stage" key={stage.number}>
              <div className="google-stage-number">{stage.number}</div>
              <div className="google-stage-copy">
                <h3>{stage.title}</h3>
                <b>{stage.titleZh}</b>
                <p>{stage.summary}</p>
              </div>
              <div className="google-stage-resources">
                {stage.resources.length
                  ? stage.resources.map((resource) => <ResourceCard resource={resource} key={resource.url} />)
                  : <span className="google-stage-action">{stage.number === "02" ? "TARGET: RECRUITER + LOCATION + ROLE" : "TARGET: WARM CONTACT + ROLE CONTEXT"}</span>}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="google-career-columns">
        <div className="google-career-section panel">
          <div className="google-career-section-head">
            <div>
              <p className="eyebrow">EARLY CAREER</p>
              <h2>Student track</h2>
            </div>
          </div>
          <div className="google-resource-grid">
            {studentResources.map((resource) => <ResourceCard resource={resource} key={resource.url} />)}
          </div>
        </div>
        <div className="google-career-section panel">
          <div className="google-career-section-head">
            <div>
              <p className="eyebrow">BOX OF TREASURE</p>
              <h2>Go deeper</h2>
            </div>
          </div>
          <div className="google-resource-grid">
            {deepDiveResources.map((resource) => <ResourceCard resource={resource} key={resource.url} />)}
          </div>
        </div>
      </section>
    </main>
  );
}
