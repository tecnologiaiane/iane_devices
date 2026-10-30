import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDate,
  formatDateTime,
  formatCurrency,
  formatPhone,
  formatImei,
} from '../src/utils/formatters';

test('formatDate formata datas puras sem passar por Date', () => {
  assert.equal(formatDate('2026-10-28'), '28/10/2026');
  assert.equal(formatDate('2026-01-05'), '05/01/2026');
  assert.equal(formatDate(''), '-');
  assert.equal(formatDate(undefined), '-');
});

test('formatDate usa o dia local em timestamps ISO (não o dia UTC)', () => {
  const timestamp = new Date(2026, 9, 28, 23, 30).toISOString();
  assert.equal(formatDate(timestamp), '28/10/2026');
});

test('formatDate aceita data/hora local sem fuso', () => {
  assert.equal(formatDate('2026-10-28 23:30'), '28/10/2026');
});

test('formatDateTime mantém a hora informada', () => {
  assert.equal(formatDateTime('2026-10-28 23:30'), '28/10/2026 às 23:30');
  assert.equal(formatDateTime(undefined), '-');
});

test('formatadores auxiliares continuam funcionando', () => {
  assert.match(formatCurrency(1234.5), /1\.234,50/);
  assert.equal(formatCurrency(undefined), '-');
  assert.equal(formatPhone('11987654321'), '(11) 98765-4321');
  assert.equal(formatPhone('1133334444'), '(11) 3333-4444');
  assert.equal(formatImei('123456789012345'), '123456789012345');
  assert.equal(formatImei('01 234567 891112 1'), '012345678911121');
  assert.equal(formatImei('123'), '123');
});
