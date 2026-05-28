/**
 * File responsibility: Taxonomy term alias mappings configuration.
 * Main responsibilities:
 * - Define canonical forms for skill and technology term variations.
 * - Support case-insensitive term normalization.
 */

/**
 * Map of term variations to their canonical forms.
 * Keys are lowercase variations, values are canonical identifiers.
 */
export const TERM_ALIASES = new Map([
    ['power bi', 'power_bi'],
    ['powerbi', 'power_bi'],
    ['tableau', 'tableau'],
    ['sql', 'sql'],
    ['structured query language', 'sql'],
    ['javascript', 'javascript'],
    ['js', 'javascript'],
    ['typescript', 'typescript'],
    ['node', 'node_js'],
    ['node js', 'node_js'],
    ['node.js', 'node_js'],
    ['react', 'react'],
    ['reactjs', 'react'],
    ['react.js', 'react'],
    ['aws', 'aws'],
    ['amazon web services', 'aws'],
    ['azure', 'azure'],
    ['gcp', 'gcp'],
    ['google cloud', 'gcp'],
    ['communication', 'communication'],
    ['stakeholder communication', 'stakeholder_communication'],
    ['stakeholder management', 'stakeholder_management'],
    ['stakeholder engagement', 'stakeholder_management'],
    ['teamwork', 'teamwork'],
    ['team work', 'teamwork'],
    ['collaboration', 'collaboration'],
    ['problem solving', 'problem_solving'],
    ['problem-solving', 'problem_solving'],
    ['critical thinking', 'critical_thinking'],
    ['adaptability', 'adaptability'],
    ['leadership', 'leadership'],
    ['agile', 'agile'],
    ['agile methodologies', 'agile'],
    ['scrum', 'scrum'],
    ['kanban', 'kanban'],
    ['customer relationship management', 'crm'],
    ['crm', 'crm'],
    ['quality management systems', 'quality_management_systems'],
    ['qms', 'quality_management_systems'],
    ['pre-sales', 'pre_sales'],
    ['pre sales', 'pre_sales'],
    ['presales', 'pre_sales'],
    ['machine learning', 'machine_learning'],
    ['deep learning', 'deep_learning'],
    ['data science', 'data_science'],
    ['data analysis', 'data_analysis'],
    ['analytics', 'analytics'],
    ['project management', 'project_management'],
    ['client relationship management', 'client_relationship_management'],
    ['client relationship', 'client_relationship_management'],
    ['client relations', 'client_relationship_management'],
]);

// Made with Bob
