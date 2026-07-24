export type ResourceCategory = "daily" | "jobs" | "study" | "profile" | "tools";

export type DashboardResource = {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  category: ResourceCategory;
  mark: string;
  accent: "red" | "amber" | "green" | "cyan" | "blue" | "purple";
  priority?: boolean;
  searchTerms?: string;
};

export type CareerPortal = {
  mark: string;
  name: string;
  group: "FAANG" | "BIG TECH" | "AI" | "FINTECH" | "TECH";
  url: string;
};

export const careerPortals: CareerPortal[] = [
  { mark: "G", name: "Google", group: "FAANG", url: "https://www.google.com/about/careers/applications/jobs/results/" },
  { mark: "A", name: "Amazon", group: "FAANG", url: "https://www.amazon.jobs/en/search" },
  { mark: "", name: "Apple", group: "FAANG", url: "https://jobs.apple.com/en-us/search" },
  { mark: "M", name: "Meta", group: "FAANG", url: "https://www.metacareers.com/jobs" },
  { mark: "N", name: "Netflix", group: "FAANG", url: "https://jobs.netflix.com/search" },
  { mark: "MS", name: "Microsoft", group: "BIG TECH", url: "https://apply.careers.microsoft.com/careers" },
  { mark: "NV", name: "NVIDIA", group: "BIG TECH", url: "https://www.nvidia.com/en-us/about-nvidia/careers/" },
  { mark: "AI", name: "OpenAI", group: "AI", url: "https://openai.com/careers/search/" },
  { mark: "AN", name: "Anthropic", group: "AI", url: "https://www.anthropic.com/careers/jobs" },
  { mark: "S", name: "Stripe", group: "FINTECH", url: "https://stripe.com/jobs/search" },
  { mark: "SF", name: "Salesforce", group: "BIG TECH", url: "https://www.salesforce.com/company/careers/jobs/" },
  { mark: "AD", name: "Adobe", group: "BIG TECH", url: "https://careers.adobe.com/us/en/search-results" },
  { mark: "U", name: "Uber", group: "TECH", url: "https://jobs.uber.com/en/jobs/" },
  { mark: "AB", name: "Airbnb", group: "TECH", url: "https://careers.airbnb.com/positions/" },
  { mark: "IN", name: "LinkedIn", group: "TECH", url: "https://careers.linkedin.com/jobs" },
  { mark: "TT", name: "TikTok", group: "TECH", url: "https://lifeattiktok.com/search" },
  { mark: "T", name: "Tesla", group: "TECH", url: "https://www.tesla.com/careers/search/" },
  { mark: "O", name: "Oracle", group: "BIG TECH", url: "https://careers.oracle.com/en/sites/jobsearch/jobs" },
  { mark: "IBM", name: "IBM", group: "BIG TECH", url: "https://www.ibm.com/careers/search" },
];

export const dashboardResources: DashboardResource[] = [
  { id: "gmail", title: "Gmail", subtitle: "Inbox", url: "https://mail.google.com/mail/u/0/#inbox", category: "daily", mark: "M", accent: "red", priority: true },
  { id: "leetcode", title: "LeetCode", subtitle: "Problem practice", url: "https://leetcode.com/problemset/", category: "daily", mark: "LC", accent: "amber", priority: true },
  { id: "neetcode", title: "NeetCode", subtitle: "Roadmap + patterns", url: "https://neetcode.io/roadmap", category: "daily", mark: "NC", accent: "green", priority: true },
  { id: "freecodecamp", title: "freeCodeCamp JavaScript V9", subtitle: "JavaScript project curriculum", url: "https://www.freecodecamp.org/learn/javascript-v9/", category: "daily", mark: "JS", accent: "purple", priority: true },
  { id: "jobright", title: "JobRight", subtitle: "Daily recommendations", url: "https://jobright.ai/jobs/recommend", category: "daily", mark: "JR", accent: "red", priority: true },
  { id: "notion", title: "This Week", subtitle: "Notion weekly plan", url: "https://www.notion.so/35ea5189545c80cfa8c3c910e0265817?source=copy_link", category: "daily", mark: "N", accent: "green", priority: true },
  { id: "abdul-bari", title: "DSA Video", subtitle: "Abdul Bari algorithms course", url: "https://www.youtube.com/playlist?list=PLDN4rrl48XKpZkf03iYFl-O29szjTrs_O", category: "daily", mark: "▶", accent: "red", priority: true },
  { id: "harvard-web", title: "Harvard Web", subtitle: "CS50W Web Development", url: "https://www.youtube.com/playlist?list=PLhQjrBD2T380xvFSUmToMMzERZ3qB5Ueu", category: "daily", mark: "H", accent: "red", priority: true },
  { id: "printing", title: "printing", subtitle: "SFPL mobile printing", url: "https://mobile.eprintitsaas.com/app/add-files?locationid=657b709e3f26b41cad5395f5&domainname=sfpl", category: "daily", mark: "P", accent: "cyan", priority: true },

  { id: "simplify", title: "Simplify Jobs", subtitle: "Job search platform", url: "https://simplify.jobs/jobs", category: "jobs", mark: "S", accent: "cyan" },
  { id: "linkedin", title: "LinkedIn", subtitle: "Profile + job search", url: "https://www.linkedin.com/in/chi-cheng921/", category: "jobs", mark: "in", accent: "blue" },
  { id: "handshake", title: "Handshake", subtitle: "Campus opportunities", url: "https://app.joinhandshake.com/", category: "jobs", mark: "H", accent: "purple" },
  { id: "summer-internships", title: "2026 SWE Internships", subtitle: "SimplifyJobs GitHub list", url: "https://github.com/SimplifyJobs/Summer2026-Internships", category: "jobs", mark: "GH", accent: "green" },
  { id: "new-grad", title: "New Grad Positions", subtitle: "SimplifyJobs GitHub list", url: "https://github.com/SimplifyJobs/New-Grad-Positions", category: "jobs", mark: "GH", accent: "green" },
  { id: "ai-college-jobs", title: "AI College Jobs", subtitle: "SpeedyApply 2027 list", url: "https://github.com/speedyapply/2027-AI-College-Jobs", category: "jobs", mark: "AI", accent: "cyan" },
  { id: "career-ops", title: "Career Ops", subtitle: "Local-first job search tools", url: "https://career-ops.org/docs", category: "jobs", mark: "CO", accent: "green" },
  ...careerPortals.map((portal): DashboardResource => ({
    id: `careers-${portal.name.toLowerCase()}`,
    title: `${portal.name} Careers`,
    subtitle: `${portal.group} · Official careers`,
    url: portal.url,
    category: "jobs",
    mark: portal.mark,
    accent: portal.group === "FAANG" ? "red" : "cyan",
    searchTerms: "官方招聘入口 大厂",
  })),

  { id: "odin", title: "The Odin Project", subtitle: "Full-stack JavaScript", url: "https://www.theodinproject.com/paths/full-stack-javascript", category: "study", mark: "O", accent: "green" },
  { id: "python-30", title: "30 Days of Python", subtitle: "Asabeneh curriculum", url: "https://github.com/Asabeneh/30-Days-Of-Python", category: "study", mark: "PY", accent: "blue" },
  { id: "project-learning", title: "Project Based Learning", subtitle: "Build while learning", url: "https://github.com/practical-tutorials/project-based-learning", category: "study", mark: "P", accent: "amber" },
  { id: "build-your-own-x", title: "Build Your Own X", subtitle: "Recreate technology", url: "https://github.com/codecrafters-io/build-your-own-x", category: "study", mark: "X", accent: "cyan" },
  { id: "ml-beginners", title: "ML for Beginners", subtitle: "Microsoft curriculum", url: "https://github.com/microsoft/ML-For-Beginners", category: "study", mark: "ML", accent: "purple" },
  { id: "advanced-ts", title: "Advanced TypeScript", subtitle: "Video tutorial", url: "https://www.youtube.com/watch?v=lMfGp29Ht8c&list=PLIvujZeVDLMx040-j1W4WFs1BxuTGdI_b", category: "study", mark: "TS", accent: "blue" },

  { id: "github-profile", title: "GitHub Profile", subtitle: "bruceche-cmu-F25", url: "https://github.com/bruceche-cmu-F25", category: "profile", mark: "GH", accent: "green" },
  { id: "idea-browser", title: "IdeaBrowser", subtitle: "Browse product ideas", url: "https://www.ideabrowser.com/hub/ideas/browse", category: "tools", mark: "IB", accent: "cyan" },
  { id: "trust-mrr", title: "TrustMRR", subtitle: "Product revenue search", url: "https://trustmrr.com/search", category: "tools", mark: "$", accent: "amber" },
];

export const priorityResources = dashboardResources.filter((resource) => resource.priority);

export const resourcesByCategory = (category: ResourceCategory) =>
  dashboardResources.filter((resource) => resource.category === category);
