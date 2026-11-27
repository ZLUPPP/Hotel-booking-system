import test from 'node:test';
import assert from 'node:assert/strict';
import {languages, translate} from './i18n.js';

test('offers Russian, English and Kazakh and translates profile sections', () => {
  assert.deepEqual(languages.map(({value}) => value), ['ru', 'en', 'kk']);
  assert.equal(translate('Личные данные', 'en'), 'Personal details');
  assert.equal(translate('Личные данные', 'kk'), 'Жеке деректер');
  assert.equal(translate('Конфиденциальность и управление данными', 'en'), 'Privacy and data management');
  assert.equal(translate('Мои отзывы', 'kk'), 'Пікірлерім');
});
