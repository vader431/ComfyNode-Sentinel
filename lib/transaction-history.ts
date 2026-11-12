import { UpdateTransaction } from '../types';

export function recordTransaction(
  transactions: UpdateTransaction[],
  params: {
    nodeFolderName: string;
    nodeDisplayName: string;
    previousCommit: string;
    targetCommit: string;
  }
): UpdateTransaction[] {
  const newTx: UpdateTransaction = {
    id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    nodeFolderName: params.nodeFolderName,
    nodeDisplayName: params.nodeDisplayName,
    previousCommit: params.previousCommit,
    targetCommit: params.targetCommit,
    timestamp: new Date().toISOString(),
    status: 'applied',
    rollbackCommand: `git -C custom_nodes/${params.nodeFolderName} checkout ${params.previousCommit}`,
  };

  return [newTx, ...transactions];
}

export function rollbackTransaction(
  transactions: UpdateTransaction[],
  transactionId: string
): {
  updatedTransactions: UpdateTransaction[];
  rolledBackTx: UpdateTransaction | undefined;
} {
  let rolledBackTx: UpdateTransaction | undefined;

  const updatedTransactions = transactions.map((tx) => {
    if (tx.id === transactionId) {
      rolledBackTx = { ...tx, status: 'rolled_back' };
      return rolledBackTx;
    }
    return tx;
  });

  return { updatedTransactions, rolledBackTx };
}

export function generateGitBisectScript(
  nodeFolderName: string,
  goodCommit: string,
  badCommit: string
): string {
  return [
    `#!/usr/bin/env bash`,
    `# Automated Git Bisect Assistant for custom_nodes/${nodeFolderName}`,
    `cd "custom_nodes/${nodeFolderName}" || exit 1`,
    ``,
    `echo "Initializing git bisect..."`,
    `git bisect start`,
    `git bisect bad ${badCommit}`,
    `git bisect good ${goodCommit}`,
    ``,
    `echo "Git Bisect active. Test each checkout in ComfyUI, then run:"`,
    `echo "  git bisect good   (if nodes load cleanly)"`,
    `echo "  git bisect bad    (if node raises traceback on startup)"`,
    `echo "When finished, run: git bisect reset"`,
  ].join('\n');
}

export const INITIAL_UPDATE_TRANSACTIONS: UpdateTransaction[] = [
  {
    id: 'tx-init-001',
    nodeFolderName: 'comfyui_controlnet_aux_plus',
    nodeDisplayName: 'ControlNet Aux Plus',
    previousCommit: 'e8d1a42',
    targetCommit: 'f93c011',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    status: 'applied',
    rollbackCommand: 'git -C custom_nodes/comfyui_controlnet_aux_plus checkout e8d1a42',
  },
  {
    id: 'tx-init-002',
    nodeFolderName: 'ComfyUI-AnimateDiff-Evolved',
    nodeDisplayName: 'AnimateDiff Evolved',
    previousCommit: '4a1b82c',
    targetCommit: '7e9d2f0',
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    status: 'applied',
    rollbackCommand: 'git -C custom_nodes/ComfyUI-AnimateDiff-Evolved checkout 4a1b82c',
  },
];
