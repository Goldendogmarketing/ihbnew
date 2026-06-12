export interface Project {
  id: string
  title: string
  client: string
  year: string
  tags: string[]
  url: string
  image: string
  blurb: string
}

export const asset = (p: string): string => `${import.meta.env.BASE_URL}${p}`

export const ACCENT = '#e0322c'

export const PROJECTS: Project[] = [
  {
    id: 'greekolivefusion',
    title: 'Greek Olive Fusion',
    client: 'Greek Olive Fusion',
    year: '2024',
    tags: ['Brand', 'Website', 'Hospitality'],
    url: 'https://www.greekolivefusion.com',
    image: 'sites/greekolivefusion.jpg',
    blurb:
      'A Mediterranean restaurant brand brought fully online — menu, story, and ordering in one place. Designed to feel as warm and generous as the food, with a focus on reservations and repeat locals.',
  },
  {
    id: 'nfbs',
    title: 'North Florida Building Solutions',
    client: 'NFBS',
    year: '2024',
    tags: ['Website', 'Lead-Gen', 'Construction'],
    url: 'https://www.northfloridabuildingsolutions.com',
    image: 'sites/nfbs.jpg',
    blurb:
      'A trust-first web presence for a North Florida construction partner. Capabilities, completed projects, and a frictionless path to a quote — built to turn searchers into site visits.',
  },
  {
    id: 'lakeregion',
    title: 'Lake Region Property Resource',
    client: 'LRPR',
    year: '2025',
    tags: ['Real Estate', 'Listings', 'Website'],
    url: 'https://www.lakeregionpropertyresource.com',
    image: 'sites/lakeregion.jpg',
    blurb:
      'A property hub for Florida’s lake region — listings, land knowledge, and local insight. Built to make rural and waterfront property search feel simple and personal.',
  },
  {
    id: 'trevorwaters',
    title: 'Trevor Waters Realty',
    client: 'Trevor Waters Realty',
    year: '2024',
    tags: ['Real Estate', 'IDX', 'Brand'],
    url: 'https://www.trevorwatersrealty.com',
    image: 'sites/trevorwaters.jpg',
    blurb:
      'A complete real-estate presence for a lake-country brokerage — IDX search, featured listings, and an agent brand buyers remember. Fast, friendly, and built to convert browsing into showings.',
  },
  {
    id: 'brandenwaters',
    title: 'Branden Waters',
    client: 'Personal',
    year: '2025',
    tags: ['Portfolio', 'Personal'],
    url: 'https://www.brandenwaters.com',
    image: 'sites/brandenwaters.jpg',
    blurb:
      'The personal site of the builder behind the work — part portfolio, part proving ground. A living index of projects, experiments, and the occasional unreasonable idea.',
  },
  {
    id: 'ihelpbuild',
    title: 'iHelpBuild',
    client: 'iHelpBuild',
    year: '2026',
    tags: ['Platform', 'AI', 'Studio'],
    url: 'https://www.ihelpbuild.com',
    image: 'sites/ihelpbuild.jpg',
    blurb:
      'The studio itself. iHelpBuild helps small businesses build smarter — websites, automation, and AI working together. This spatial gallery is one of its experiments.',
  },
  {
    id: 'hermes',
    title: 'Hermes Agent',
    client: 'iHelpBuild',
    year: '2026',
    tags: ['AI', 'Agent', 'Automation'],
    url: '#hermes',
    image: 'sites/hermes.jpg',
    blurb:
      'An AI agent system built for small businesses — intake, scheduling, follow-up, and reporting running 24/7. Hermes handles the admin layer so the humans handle the work.',
  },
  {
    id: 'growth',
    title: 'Growth & Marketing',
    client: 'iHelpBuild',
    year: '2026',
    tags: ['Marketing', 'Google Ads', 'Video'],
    url: '#contact',
    image: 'sites/growth.jpg',
    blurb:
      'Revenue strategy, a sharper marketing presence, Google Ads that convert, and social systems that post themselves — plus founder and customer video that builds trust on sight.',
  },
  {
    id: 'btw',
    title: 'BTW.LTD',
    client: 'BTW',
    year: '2025',
    tags: ['Ventures', 'Identity'],
    url: 'https://www.btw.ltd',
    image: 'sites/btw.jpg',
    blurb:
      'The umbrella over every venture. A deliberately quiet, deliberately sharp identity — minimal surface, maximum intent.',
  },
]
