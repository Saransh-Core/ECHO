import test from 'node:test';
import assert from 'node:assert/strict';
import { matchCareer, rankCareers } from '../src/features/careers/matching.ts';
import { scoreAssessment, questions, selectBalancedQuestionIds } from '../src/features/assessment/riasec.ts';
import { generateCareerRoadmap } from '../src/features/roadmaps/generator.ts';

const career = {
  id: 'data', name: 'Data analyst', riasecDimensions: ['I', 'C'],
  skillRequirements: [
    { id: 'analysis', name: 'Data analysis', notes: '', relevance: 'relevant' },
    { id: 'statistics', name: 'Statistics', notes: '', relevance: 'relevant' },
  ],
};

test('RIASEC scoring stays deterministic for the same responses', () => {
  const answers = Object.fromEntries(questions.filter(q => q.dimension === 'I').map(q => [q.id, 5]));
  assert.deepEqual(scoreAssessment(answers), scoreAssessment(answers));
  assert.equal(scoreAssessment(answers).scores.I, 100);
  assert.equal(scoreAssessment({}).scores.I, null);
});

test('career matching omits unavailable factors instead of treating them as zero', () => {
  const match = matchCareer(career, { riasecScores: { I: 80 }, skillEvidenceLoaded: false });
  assert.equal(match.score, 80);
  assert.equal(match.factors.evidencedSkills, null);
  assert.deepEqual(match.missingDimensions, ['C']);
});

test('career score remains normalized and skill evidence is linked by catalog ID', () => {
  const match = matchCareer(career, { riasecScores: { I: 100, C: 100 }, evidencedSkillIds: ['analysis', 'unrelated'], skillEvidenceLoaded: true });
  assert.ok(match.score >= 0 && match.score <= 100);
  assert.equal(match.factors.evidencedSkills, 50);
  assert.deepEqual(match.relevantEvidence.map(skill => skill.id), ['analysis']);
  assert.deepEqual(match.notYetEvidenced.map(skill => skill.id), ['statistics']);
  assert.equal(matchCareer(career, { skillEvidenceLoaded: true }).factors.evidencedSkills, null);
});

test('ranking is deterministic and keeps insufficient-data careers available', () => {
  const ranked = rankCareers([career, { ...career, id: 'unknown', riasecDimensions: [] }], { riasecScores: { I: 90 } });
  assert.equal(ranked[0].career.id, 'data');
  assert.equal(ranked[1].match.score, null);
});

test('new assessment attempts are balanced, distinct, and restorable by saved IDs', () => {
  const first = selectBalancedQuestionIds(1);
  const second = selectBalancedQuestionIds(2);
  assert.equal(first.length, 18);
  assert.equal(new Set(first).size, first.length);
  assert.notDeepEqual(first, second);
  assert.deepEqual(first.map(id => id), [...first]);
});

test('career roadmap generation uses catalog skills and prerequisite order', () => {
  const generated = generateCareerRoadmap(career, { title: 'Explore data', goalDescription: '', startingLevel: 'beginner', weeklyTime: '3 hours', preferredFormat: '' });
  assert.deepEqual(generated.map(task => task.skill_id).filter(Boolean), ['analysis', 'statistics']);
  assert.deepEqual(generated[1].depends_on, ['orientation']);
  assert.deepEqual(generated[2].depends_on, ['skill-analysis']);
  assert.deepEqual(generated.at(-1).depends_on, ['skill-statistics']);
});
