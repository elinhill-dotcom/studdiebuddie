import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

function load(relativePath, globals = {}) {
  const source = fs.readFileSync(new URL('../' + relativePath, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, crypto: webcrypto, ...globals });
  return exports;
}
const { gradeAnswer } = load('src/lib/ai-quiz.ts');
const { homeworkPractice } = load('src/lib/practice.ts');
const { practiceBatches } = load('src/lib/practice-material.ts');
const { reminderAt, timingFromDate } = load('src/lib/reminder-time.ts');
const question = { id: 'q1', homeworkId: 'h1', prompt: 'Vad behövs?', expectedAnswer: 'vatten, solljus och koldioxid', topic: 'Fotosyntes' };
const session = (overrides = {}) => ({ id: 's1', homeworkIds: ['h1'], startedAt: '2026-09-12T10:00:00Z', mode: 'single', questions: [question], answers: [], ...overrides });

test('två delar ger delvis rätt; kompletteringen fullbordar samma svar', () => {
  const partial = gradeAnswer('vatten och solljus', question.expectedAnswer);
  assert.equal(partial.correct, false);
  assert.equal(partial.partial, true);
  assert.equal(gradeAnswer('vatten och solljus\nkoldioxid', question.expectedAnswer).correct, true);
});

test('utkast och pågående kompletteringar räknas inte som färdiga svar', () => {
  const stats = homeworkPractice([session({ answers: [{ questionId: 'q1', correct: false, pending: true }] })], 'h1');
  assert.equal(stats.answered, 0);
  assert.equal(stats.percent, null);
  assert.equal(stats.weakQuestions.length, 0);
});

test('blandade förhör tillskriver svaret rätt läxa och ignorerar tvetydig äldre data', () => {
  const mixed = session({ homeworkIds: ['h1', 'h2'], answers: [{ questionId: 'q1', correct: false }] });
  assert.equal(homeworkPractice([mixed], 'h1').answered, 1);
  assert.equal(homeworkPractice([mixed], 'h2').answered, 0);
  const legacy = { ...mixed, questions: [{ ...question, homeworkId: undefined }] };
  assert.equal(homeworkPractice([legacy], 'h1').answered, 0);
});

test('senaste svaret ersätter dubbla försök och omträning kan lösa en svaghet', () => {
  const first = session({ answers: [{ questionId: 'q1', correct: false }, { questionId: 'q1', correct: true, needsPractice: true }] });
  assert.equal(homeworkPractice([first], 'h1').answered, 1);
  assert.equal(homeworkPractice([first], 'h1').weakQuestions.length, 1);
  const retry = session({ id: 's2', startedAt: '2026-09-12T11:00:00Z', questions: [{ ...question, id: 'q2' }], answers: [{ questionId: 'q2', correct: true }] });
  assert.equal(homeworkPractice([retry, first], 'h1').weakQuestions.length, 0);
});

test('ett rätt svar tar inte bort en annan svag fråga inom samma ämnesområde', () => {
  const stats = homeworkPractice([session({ questions: [question, { ...question, id: 'q2', expectedAnswer: 'syre och glukos' }], answers: [{ questionId: 'q1', correct: false }, { questionId: 'q2', correct: true }] })], 'h1');
  assert.equal(stats.weakQuestions.length, 1);
  assert.equal(stats.weakQuestions[0].id, 'q1');
});

test('24 000 tecken ger full täckning och fler frågor i alla tre träningssätt', () => {
  const text = 'a'.repeat(24000);
  for (const [format, expectedCount] of [['flashcards', 48], ['chat', 32], ['exam', 24]]) {
    const sections = practiceBatches(text, format);
    assert.equal(sections.map(s => s.text).join(''), text);
    assert.equal(sections.reduce((n, s) => n + s.count, 0), expectedCount);
    assert.ok(sections.every(s => s.text.length <= 6000 && s.count <= 12));
  }
});

test('styckesgränser och sista delen bevaras utan att kort text fylls med dubbletter', () => {
  const text = 'Första delen. '.repeat(360) + '\nSista delen. '.repeat(400) + 'SLUT';
  const sections = practiceBatches(text, 'flashcards');
  assert.equal(sections.map(s => s.text).join(' ').replace(/\s+/g, ' '), text.replace(/\s+/g, ' '));
  assert.ok(sections.at(-1).text.endsWith('SLUT'));
  assert.equal(practiceBatches('', 'chat').length, 0);
});

test('påminnelsetider stöder före start, midnatt och eget datum', () => {
  const timing = { choice: '30', date: '', time: '' };
  assert.equal(reminderAt('2026-09-15', '00:15', timing), new Date('2026-09-14T23:45:00').toISOString());
  assert.equal(reminderAt('2026-09-15', '09:00', { ...timing, choice: '1440' }), new Date('2026-09-14T09:00:00').toISOString());
  assert.equal(reminderAt('2026-09-15', '09:00', { choice: 'custom', date: '2026-09-12', time: '18:35' }), new Date('2026-09-12T18:35:00').toISOString());
  assert.equal(reminderAt('2026-09-15', '09:00', { ...timing, choice: '0' }), new Date('2026-09-15T09:00:00').toISOString());
});

test('påminnelser behåller lokal tid och validerar ofullständig tid', () => {
  const original = new Date('2026-10-25T17:35:00').toISOString();
  const timing = timingFromDate(original);
  assert.equal(reminderAt('', '', timing), original);
  assert.equal(reminderAt('2026-10-25', '17:35', { ...timing, choice: '1440' }), new Date('2026-10-24T17:35:00').toISOString());
  assert.equal(reminderAt('', '17:00', { ...timing, choice: '60' }), null);
  assert.equal(reminderAt('2026-09-15', '25:00', { ...timing, choice: '60' }), null);
});

test('läxans valda påminnelsetid bevaras nästa vecka utan att ändra pluggpåminnelsen', () => {
  const storage = new Map();
  const store = load('src/lib/store.ts', {
    window: {}, localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    require: name => {
      if (name === './types') return load('src/lib/types.ts');
      if (name === './helpers') return load('src/lib/helpers.ts', { require: () => load('src/lib/attachments.ts') });
      throw new Error('Unexpected dependency ' + name);
    },
  });
  const hw = { id: 'h1', title: 'Religion', dueDate: '2026-10-22', subject: 'SO', recurringWeekly: true, reminderEnabled: true };
  const originalAt = new Date('2026-10-21T18:30:00').toISOString();
  store.upsertHomework(hw);
  store.upsertReminder({ id: 'study', homeworkId: 'h1', eventId: 'study-event', enabled: true, notified: false, at: originalAt, url: '/forhor/start' });
  const reminder = store.ensureHomeworkReminder(hw, '09:00', originalAt);
  assert.notEqual(reminder.id, 'study');
  assert.equal(store.ensureHomeworkReminder(hw).at, originalAt);
  store.completeHomeworkOccurrence(hw);
  const result = store.loadData();
  assert.equal(result.reminders.find(r => r.id === reminder.id).at, new Date('2026-10-28T18:30:00').toISOString());
  assert.equal(result.reminders.find(r => r.id === 'study').at, originalAt);
});

const { gamePairs, answerOptions, mixedLetters, wordKey, shuffle } = load('src/lib/vocab-games.ts');
const words = [
  { id: '1', term: 'apple', translation: 'äpple' },
  { id: '2', term: 'APPLE', translation: 'Äpple' },
  { id: '3', term: 'apple', translation: 'frukt' },
  { id: '4', term: 'fruit', translation: 'frukt' },
  { id: '5', term: '', translation: 'tomt' },
];
test('glosspel undviker tvetydiga frågor och ofullständiga ord', () => {
  assert.equal(gamePairs(words, 'memory').length, 2);
  assert.equal(gamePairs(words, 'choice').length, 2);
  assert.equal(gamePairs(words, 'scramble').length, 2);
  assert.equal(words.length, 5);
});
test('svarsalternativ innehåller rätt svar en gång och högst fyra olika val', () => {
  const options = answerOptions(words[0], words);
  assert.equal(options.filter(x => wordKey(x) === 'äpple').length, 1);
  assert.equal(new Set(options.map(wordKey)).size, options.length);
  assert.ok(options.length <= 4);
});
test('bokstavsmix behåller bokstäver och accenter utan att ge svaret direkt', () => {
  for (const word of ['äpple', 'école', 'aaa']) {
    const letters = mixedLetters(word);
    assert.equal([...letters].sort().join(''), [...word].sort().join(''));
    if (word !== 'aaa') assert.notEqual(letters.join(''), word);
  }
  const original = ['a', 'b', 'c'];
  assert.equal([...shuffle(original)].sort().join(''), 'abc');
  assert.equal(original.join(''), 'abc');
});
