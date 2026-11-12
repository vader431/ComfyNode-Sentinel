import { describe, it, expect } from 'vitest';
import {
  recordTransaction,
  rollbackTransaction,
  generateGitBisectScript,
} from '../lib/transaction-history';
import { UpdateTransaction } from '../types';

describe('Update Transaction History & Git Bisect Assistant', () => {
  const initialTxs: UpdateTransaction[] = [
    {
      id: 'tx-001',
      nodeFolderName: 'ComfyUI-Impact-Pack',
      nodeDisplayName: 'Impact Pack',
      previousCommit: 'aaa111',
      targetCommit: 'bbb222',
      timestamp: '2026-03-01T12:00:00Z',
      status: 'applied',
      rollbackCommand: 'git -C custom_nodes/ComfyUI-Impact-Pack checkout aaa111',
    },
  ];

  it('records a new update transaction with rollback command', () => {
    const updated = recordTransaction(initialTxs, {
      nodeFolderName: 'ComfyUI-AnimateDiff',
      nodeDisplayName: 'AnimateDiff',
      previousCommit: '111222',
      targetCommit: '333444',
    });

    expect(updated.length).toBe(2);
    expect(updated[0].nodeFolderName).toBe('ComfyUI-AnimateDiff');
    expect(updated[0].status).toBe('applied');
    expect(updated[0].rollbackCommand).toBe(
      'git -C custom_nodes/ComfyUI-AnimateDiff checkout 111222'
    );
  });

  it('rolls back a transaction and transitions status to rolled_back', () => {
    const { updatedTransactions, rolledBackTx } = rollbackTransaction(
      initialTxs,
      'tx-001'
    );

    expect(rolledBackTx).toBeDefined();
    expect(rolledBackTx?.status).toBe('rolled_back');
    expect(updatedTransactions[0].status).toBe('rolled_back');
  });

  it('generates executable git bisect debugging script', () => {
    const script = generateGitBisectScript('ComfyUI-Test', 'goodCommit01', 'badCommit02');
    expect(script).toContain('git bisect start');
    expect(script).toContain('git bisect bad badCommit02');
    expect(script).toContain('git bisect good goodCommit01');
    expect(script).toContain('git bisect reset');
  });
});

