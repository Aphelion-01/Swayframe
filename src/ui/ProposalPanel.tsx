import { useState } from 'react';
import {
  MockLayoutAdvisor,
  MockColorAdvisor,
  MockMotionAdvisor,
} from '../core/intelligence-contracts';
import type { IntelligenceProposal } from '../core/intelligence-contracts';
import type { Project } from '../core/project-model';
import { activeComposition } from '../core/project-model';
import { proposalToTransaction } from '../core/proposal-commands';
import type { EditorStore } from './editor-store';

export function ProposalPanel({ store }: { store: EditorStore }) {
  const [candidate, setCandidate] = useState<{
    proposal: IntelligenceProposal;
    project: Project;
  }>();
  const suggest = async (kind: 'layout' | 'color' | 'motion') => {
    const view = store.getSnapshot();
    const provider =
      kind === 'layout'
        ? new MockLayoutAdvisor()
        : kind === 'color'
          ? new MockColorAdvisor()
          : new MockMotionAdvisor();
    const proposals = await provider.suggest({
      composition: activeComposition(view.project),
      selection: view.selection,
      time: view.time,
    });
    if (proposals[0]) {
      setCandidate({ proposal: proposals[0], project: view.project });
      store.setStatus('建议已准备好，选择应用后生效');
    } else {
      setCandidate(undefined);
      store.setStatus('请先创建或选择可编辑图层', true);
    }
  };
  return (
    <section className="proposal-panel" aria-label="智能建议">
      <div className="agent-heading">
        <span>辅助建议</span>
        <span>模拟</span>
      </div>
      <div className="proposal-buttons">
        <button onClick={() => void suggest('layout')}>布局建议</button>
        <button onClick={() => void suggest('color')}>配色建议</button>
        <button onClick={() => void suggest('motion')}>动效建议</button>
      </div>
      {candidate && (
        <div className="proposal-card">
          <p>{candidate.proposal.label}</p>
          <button
            className="primary"
            onClick={() => {
              try {
                if (candidate.project !== store.getSnapshot().project)
                  throw new Error('工程已变化，请重新获取建议');
                store.cancelDrag();
                const tx = proposalToTransaction(
                  candidate.proposal,
                  candidate.project,
                );
                const result = store.commands.executeTransaction(tx);
                if (!result.ok) throw new Error(result.error);
                store.setStatus('建议已应用 · 可撤销');
                setCandidate(undefined);
              } catch (error) {
                store.setStatus(
                  error instanceof Error ? error.message : '建议应用失败',
                  true,
                );
              }
            }}
          >
            应用建议
          </button>
          <button onClick={() => setCandidate(undefined)}>取消</button>
        </div>
      )}
    </section>
  );
}
