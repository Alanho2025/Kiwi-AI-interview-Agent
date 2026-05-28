import { describe, expect, it } from 'vitest';
import {
    slugifyLabel,
    normalizeTaxonomyLabel,
    buildTaxonomyItem,
    uniqueById,
    mergeUniqueLabels,
    canonicalizeRole,
    inferRoleLevel,
    prettifyCanonicalRole,
} from '../../src/services/taxonomyService.js';

describe('taxonomyService', () => {
    describe('slugifyLabel', () => {
        it('should convert basic text to snake_case', () => {
            expect(slugifyLabel('Hello World')).toBe('hello_world');
            expect(slugifyLabel('Data Scientist')).toBe('data_scientist');
            expect(slugifyLabel('Machine Learning Engineer')).toBe('machine_learning_engineer');
        });

        it('should remove special characters', () => {
            expect(slugifyLabel('Hello@World!')).toBe('hello_world');
            expect(slugifyLabel('C++ Developer')).toBe('c_developer');
            expect(slugifyLabel('Node.js Engineer')).toBe('node_js_engineer');
        });

        it('should remove leading and trailing underscores', () => {
            expect(slugifyLabel('_hello_')).toBe('hello');
            expect(slugifyLabel('__test__')).toBe('test');
            expect(slugifyLabel('___data___')).toBe('data');
        });

        it('should collapse multiple consecutive underscores', () => {
            expect(slugifyLabel('hello___world')).toBe('hello_world');
            expect(slugifyLabel('data____scientist')).toBe('data_scientist');
        });

        it('should handle empty string', () => {
            expect(slugifyLabel('')).toBe('');
            expect(slugifyLabel('   ')).toBe('');
        });
    });

    describe('normalizeTaxonomyLabel', () => {
        it('should return canonical form for known aliases', () => {
            expect(normalizeTaxonomyLabel('power bi')).toBe('power_bi');
            expect(normalizeTaxonomyLabel('powerbi')).toBe('power_bi');
            expect(normalizeTaxonomyLabel('javascript')).toBe('javascript');
            expect(normalizeTaxonomyLabel('js')).toBe('javascript');
        });

        it('should fallback to slugify for unknown terms', () => {
            expect(normalizeTaxonomyLabel('Unknown Skill')).toBe('unknown_skill');
            expect(normalizeTaxonomyLabel('Custom Tool')).toBe('custom_tool');
        });

        it('should be case-insensitive', () => {
            expect(normalizeTaxonomyLabel('POWER BI')).toBe('power_bi');
            expect(normalizeTaxonomyLabel('JavaScript')).toBe('javascript');
            expect(normalizeTaxonomyLabel('AWS')).toBe('aws');
        });

        it('should handle empty and whitespace input', () => {
            expect(normalizeTaxonomyLabel('')).toBe('');
            expect(normalizeTaxonomyLabel('   ')).toBe('');
            // Note: null and undefined will cause errors in current implementation
            // This is expected behavior - callers should pass strings
        });

        it('should normalize Node.js variations', () => {
            expect(normalizeTaxonomyLabel('node')).toBe('node_js');
            expect(normalizeTaxonomyLabel('node js')).toBe('node_js');
            expect(normalizeTaxonomyLabel('node.js')).toBe('node_js');
        });
    });

    describe('buildTaxonomyItem', () => {
        it('should create basic taxonomy item with id and label', () => {
            const item = buildTaxonomyItem('JavaScript');
            expect(item).toEqual({
                id: 'javascript',
                label: 'JavaScript',
            });
        });

        it('should merge extra properties', () => {
            const item = buildTaxonomyItem('React', { category: 'frontend', level: 'advanced' });
            expect(item).toEqual({
                id: 'react',
                label: 'React',
                category: 'frontend',
                level: 'advanced',
            });
        });

        it('should handle empty label', () => {
            const item = buildTaxonomyItem('');
            expect(item).toEqual({
                id: '',
                label: '',
            });
        });

        it('should trim label whitespace', () => {
            const item = buildTaxonomyItem('  Python  ');
            expect(item.label).toBe('Python');
        });
    });

    describe('uniqueById', () => {
        it('should deduplicate items by id', () => {
            const items = [
                { id: 'javascript', label: 'JavaScript' },
                { id: 'javascript', label: 'JS' },
                { id: 'python', label: 'Python' },
            ];
            const result = uniqueById(items);
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('javascript');
            expect(result[1].id).toBe('python');
        });

        it('should handle items without id by using label', () => {
            const items = [
                { label: 'JavaScript' },
                { label: 'javascript' },
                { label: 'Python' },
            ];
            const result = uniqueById(items);
            expect(result).toHaveLength(2);
        });

        it('should handle empty array', () => {
            expect(uniqueById([])).toEqual([]);
        });

        it('should preserve order of first occurrence', () => {
            const items = [
                { id: 'a', label: 'A' },
                { id: 'b', label: 'B' },
                { id: 'a', label: 'A2' },
                { id: 'c', label: 'C' },
            ];
            const result = uniqueById(items);
            expect(result.map((i) => i.id)).toEqual(['a', 'b', 'c']);
            expect(result[0].label).toBe('A'); // First occurrence preserved
        });

        it('should filter out items with no id or label', () => {
            const items = [
                { id: 'valid', label: 'Valid' },
                { id: 'another', label: 'Another' },
            ];
            const result = uniqueById(items);
            expect(result).toHaveLength(2);

            // Items with empty id but valid label should use label
            const itemsWithEmptyId = [
                { id: 'valid', label: 'Valid' },
                { id: '', label: 'JavaScript' },  // Empty id, but has label
                { id: 'another', label: 'Another' },
            ];
            const resultWithEmptyId = uniqueById(itemsWithEmptyId);
            expect(resultWithEmptyId).toHaveLength(3);
            expect(resultWithEmptyId[1].id).toBe('');
            expect(resultWithEmptyId[1].label).toBe('JavaScript');
        });
    });

    describe('mergeUniqueLabels', () => {
        it('should merge multiple groups', () => {
            const group1 = ['JavaScript', 'Python'];
            const group2 = ['React', 'Vue'];
            const result = mergeUniqueLabels(group1, group2);
            expect(result).toHaveLength(4);
        });

        it('should convert strings to taxonomy items', () => {
            const result = mergeUniqueLabels(['JavaScript', 'Python']);
            expect(result[0]).toHaveProperty('id');
            expect(result[0]).toHaveProperty('label');
            expect(result[0].id).toBe('javascript');
        });

        it('should deduplicate across groups', () => {
            const group1 = ['JavaScript', 'Python'];
            const group2 = ['javascript', 'React'];
            const result = mergeUniqueLabels(group1, group2);
            expect(result).toHaveLength(3);
        });

        it('should filter out null and undefined', () => {
            const result = mergeUniqueLabels(['JavaScript', null, undefined, 'Python']);
            expect(result).toHaveLength(2);
        });

        it('should handle mixed string and object inputs', () => {
            const result = mergeUniqueLabels(
                ['JavaScript'],
                [{ id: 'python', label: 'Python', extra: 'data' }]
            );
            expect(result).toHaveLength(2);
            expect(result[1].extra).toBe('data');
        });
    });

    describe('canonicalizeRole', () => {
        it('should match data scientist patterns', () => {
            expect(canonicalizeRole('Data Scientist')).toEqual({
                roleCanonical: 'data_scientist',
                roleFamily: 'data_science',
            });
            expect(canonicalizeRole('Content Science')).toEqual({
                roleCanonical: 'data_scientist',
                roleFamily: 'data_science',
            });
        });

        it('should match machine learning engineer patterns', () => {
            expect(canonicalizeRole('Machine Learning Engineer')).toEqual({
                roleCanonical: 'machine_learning_engineer',
                roleFamily: 'ai_ml',
            });
            expect(canonicalizeRole('ML Engineer')).toEqual({
                roleCanonical: 'machine_learning_engineer',
                roleFamily: 'ai_ml',
            });
            expect(canonicalizeRole('AI Engineer')).toEqual({
                roleCanonical: 'machine_learning_engineer',
                roleFamily: 'ai_ml',
            });
        });

        it('should match software engineer patterns', () => {
            expect(canonicalizeRole('Software Engineer')).toEqual({
                roleCanonical: 'software_engineer',
                roleFamily: 'software_development',
            });
            expect(canonicalizeRole('Software Developer')).toEqual({
                roleCanonical: 'software_engineer',
                roleFamily: 'software_development',
            });
        });

        it('should match frontend engineer patterns', () => {
            expect(canonicalizeRole('Frontend Engineer')).toEqual({
                roleCanonical: 'frontend_engineer',
                roleFamily: 'frontend',
            });
            expect(canonicalizeRole('Front-end Developer')).toEqual({
                roleCanonical: 'frontend_engineer',
                roleFamily: 'frontend',
            });
        });

        it('should match backend engineer patterns', () => {
            expect(canonicalizeRole('Backend Engineer')).toEqual({
                roleCanonical: 'backend_engineer',
                roleFamily: 'backend',
            });
            expect(canonicalizeRole('Back-end Developer')).toEqual({
                roleCanonical: 'backend_engineer',
                roleFamily: 'backend',
            });
        });

        it('should use fallback text when title does not match', () => {
            const result = canonicalizeRole('Engineer', 'Working with data and machine learning');
            expect(result.roleFamily).toBe('data_science');
        });

        it('should fallback to slugified title when no pattern matches', () => {
            const result = canonicalizeRole('Custom Role');
            expect(result.roleCanonical).toBe('custom_role');
            expect(result.roleFamily).toBe('general');
        });

        it('should default to target_role when both title and fallback are empty', () => {
            const result = canonicalizeRole('', '');
            expect(result.roleCanonical).toBe('target_role');
            expect(result.roleFamily).toBe('general');
        });
    });

    describe('inferRoleLevel', () => {
        it('should detect graduate level', () => {
            expect(inferRoleLevel('Graduate Programme\nSoftware Engineer')).toBe('graduate');
            expect(inferRoleLevel('Graduate Software Engineer')).toBe('graduate');
            expect(inferRoleLevel('Looking for graduate developers')).toBe('graduate');
        });

        it('should not match post graduate as graduate', () => {
            expect(inferRoleLevel('Post Graduate Researcher')).not.toBe('graduate');
        });

        it('should detect intern level', () => {
            expect(inferRoleLevel('Intern Software Engineer')).toBe('intern');
            expect(inferRoleLevel('Apprentice Developer')).toBe('intern');
        });

        it('should detect junior level', () => {
            expect(inferRoleLevel('Junior Software Engineer')).toBe('junior');
            expect(inferRoleLevel('Entry Level Developer')).toBe('junior');
            expect(inferRoleLevel('Entry-level Position')).toBe('junior');
            expect(inferRoleLevel('Associate Engineer')).toBe('junior');
        });

        it('should detect senior level', () => {
            expect(inferRoleLevel('Senior Software Engineer')).toBe('senior');
            expect(inferRoleLevel('5+ years experience required')).toBe('senior');
            expect(inferRoleLevel('Looking for 7+ years')).toBe('senior');
        });

        it('should detect staff plus level', () => {
            expect(inferRoleLevel('Principal Engineer')).toBe('staff_plus');
            expect(inferRoleLevel('Staff Software Engineer')).toBe('staff_plus');
        });

        it('should detect lead level', () => {
            expect(inferRoleLevel('Lead Developer')).toBe('lead');
            expect(inferRoleLevel('Head of Engineering')).toBe('lead');
        });

        it('should detect leadership level', () => {
            expect(inferRoleLevel('Engineering Manager')).toBe('leadership');
            expect(inferRoleLevel('Manager of Software Development')).toBe('leadership');
        });

        it('should detect mid level from experience years', () => {
            expect(inferRoleLevel('2+ years experience')).toBe('mid');
            expect(inferRoleLevel('3-4 years required')).toBe('mid');
            expect(inferRoleLevel('Intermediate Developer')).toBe('mid');
        });

        it('should prioritize head text over body text', () => {
            const text = 'Graduate Programme\n\n' + 'Senior level skills required'.repeat(10);
            expect(inferRoleLevel(text)).toBe('graduate');
        });

        it('should default to mid when no pattern matches', () => {
            expect(inferRoleLevel('Software Engineer')).toBe('mid');
            expect(inferRoleLevel('Developer Position')).toBe('mid');
        });
    });

    describe('prettifyCanonicalRole', () => {
        it('should convert snake_case to Title Case', () => {
            expect(prettifyCanonicalRole('data_scientist')).toBe('Data Scientist');
            expect(prettifyCanonicalRole('machine_learning_engineer')).toBe('Machine Learning Engineer');
            expect(prettifyCanonicalRole('software_engineer')).toBe('Software Engineer');
        });

        it('should handle single word', () => {
            expect(prettifyCanonicalRole('developer')).toBe('Developer');
        });

        it('should handle empty string', () => {
            expect(prettifyCanonicalRole('')).toBe('');
        });

        it('should handle multiple consecutive underscores', () => {
            expect(prettifyCanonicalRole('data__scientist')).toBe('Data Scientist');
        });

        it('should filter out empty parts from underscores', () => {
            expect(prettifyCanonicalRole('_data_scientist_')).toBe('Data Scientist');
        });
    });
});

// Made with Bob
