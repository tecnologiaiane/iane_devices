import test from 'node:test';
import assert from 'node:assert/strict';
import { todayISO, toDateInputValue, nowLocalDateTime } from '../src/utils/dates';

test('todayISO usa o calendário local, sem deslocar para UTC', () => {
  // 23:30 local: em UTC-3 já seria o dia seguinte (bug original)
  assert.equal(todayISO(new Date(2026, 9, 28, 23, 30)), '2026-10-28');
  assert.equal(todayISO(new Date(2026, 0, 1, 0, 15)), '2026-01-01');
  assert.equal(todayISO(new Date(2026, 11, 31, 22, 59)), '2026-12-31');
});

test('toDateInputValue preserva datas puras e datas/horas locais', () => {
  assert.equal(toDateInputValue('2026-02-03'), '2026-02-03');
  assert.equal(toDateInputValue('2026-02-03 14:55'), '2026-02-03');
  assert.equal(toDateInputValue('2026-02-03 14:55:30'), '2026-02-03');
  assert.equal(toDateInputValue(''), '');
  assert.equal(toDateInputValue(undefined), '');
  assert.equal(toDateInputValue('texto inválido'), '');
});

test('toDateInputValue converte timestamps ISO para o dia local', () => {
  const local = new Date(2026, 9, 28, 23, 30);
  assert.equal(toDateInputValue(local.toISOString()), '2026-10-28');
});

test('nowLocalDateTime devolve data e hora locais', () => {
  assert.equal(nowLocalDateTime(new Date(2026, 9, 28, 9, 5)), '2026-10-28 09:05');
  assert.equal(nowLocalDateTime(new Date(2026, 0, 2, 0, 0)), '2026-01-02 00:00');
});
