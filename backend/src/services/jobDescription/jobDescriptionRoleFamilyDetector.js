import { resolveRoleFamily } from './extractors/roleFamilyResolver.js';

export const detectJobDescriptionRoleFamily = (input = {}) => resolveRoleFamily(input);
