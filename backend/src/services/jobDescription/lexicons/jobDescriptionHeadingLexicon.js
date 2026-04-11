export const SECTION_HEADING_RULES = [
  {
    type: 'responsibilities',
    patterns: [
      /^what you'll be doing$/i,
      /^what you’ll be doing$/i,
      /^what you will be doing$/i,
      /^what you'll do$/i,
      /^what you will do$/i,
      /^responsibilities$/i,
      /^key responsibilities$/i,
      /^primary responsibilities$/i,
      /^the role$/i,
      /^about the role$/i,
      /^day to day$/i,
      /^duties$/i,
      /^your responsibilities$/i,
    ],
  },
  {
    type: 'qualifications',
    patterns: [
      /^what we're looking for$/i,
      /^what we’re looking for$/i,
      /^what we are looking for$/i,
      /^what you'll bring$/i,
      /^what you’ll bring$/i,
      /^what you bring$/i,
      /^qualifications$/i,
      /^requirements$/i,
      /^experience and skills$/i,
      /^about you$/i,
      /^who we're looking for$/i,
      /^who we’re looking for$/i,
    ],
  },
  {
    type: 'softSkillPersona',
    patterns: [
      /^you'll do well here if you're/i,
      /^you’ll do well here if you’re/i,
      /^success in this role$/i,
      /^who you are$/i,
      /^ideal candidate$/i,
      /^personal attributes$/i,
    ],
  },
  {
    type: 'benefits',
    patterns: [/^why join us\??$/i, /^benefits$/i, /^what we offer$/i, /^why work with us$/i, /^what’s in it for you$/i],
  },
  {
    type: 'companyContext',
    patterns: [/^about us$/i, /^about .+$/i, /^company overview$/i],
  },
  {
    type: 'applicationInstructions',
    patterns: [/^how to apply$/i, /^application process$/i, /^apply now$/i, /^next steps$/i],
  },
];

export const SECTION_TYPE_ORDER = [
  'introduction',
  'responsibilities',
  'qualifications',
  'softSkillPersona',
  'benefits',
  'companyContext',
  'applicationInstructions',
];
